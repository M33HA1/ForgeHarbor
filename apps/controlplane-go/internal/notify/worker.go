package notify

import (
	"context"
	"errors"
	"log"
	"net"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Delivery decisions are separate from broker transport so ACK ordering can be tested.
type Handoff interface {
	Publish(context.Context, string, amqp.Publishing) error
	Ack() error
}

func Process(ctx context.Context, store Notifications, queue string, body []byte, headers amqp.Table, messageID string, delivery Handoff) error {
	doc, err := Parse(body)
	if err == nil {
		err = store.InsertOnce(ctx, doc)
	}
	if err == nil {
		return delivery.Ack()
	}
	attempt, valid := retryAttempt(headers["x-notify-attempt"])
	destination, reason := queue+".dead", "invalid_event"
	if !errors.Is(err, ErrInvalid) {
		if valid && attempt < 3 {
			destination, reason = queue+".retry", "storage_retry"
		} else {
			reason = "storage_retries_exhausted"
		}
	}
	copyHeaders := amqp.Table{}
	for key, value := range headers {
		copyHeaders[key] = value
	}
	if valid {
		copyHeaders["x-notify-attempt"] = attempt + 1
	} else {
		copyHeaders["x-notify-attempt"] = int32(4)
	}
	copyHeaders["x-notify-reason"] = reason
	if err = delivery.Publish(ctx, destination, amqp.Publishing{ContentType: "application/json", DeliveryMode: amqp.Persistent, MessageId: messageID, Headers: copyHeaders, Body: body}); err != nil {
		return err
	}
	return delivery.Ack()
}
func retryAttempt(value any) (int32, bool) {
	if value == nil {
		return 0, true
	}
	var n int64
	switch v := value.(type) {
	case int:
		n = int64(v)
	case int8:
		n = int64(v)
	case int16:
		n = int64(v)
	case int32:
		n = int64(v)
	case int64:
		n = v
	default:
		return 0, false
	}
	if n < 0 || n > 2147483646 {
		return 0, false
	}
	return int32(n), true
}

type brokerDelivery struct {
	channel  *amqp.Channel
	returns  <-chan amqp.Return
	delivery amqp.Delivery
}

func (d brokerDelivery) Ack() error { return d.delivery.Ack(false) }
func (d brokerDelivery) Publish(ctx context.Context, queue string, message amqp.Publishing) error {
	confirmation, err := d.channel.PublishWithDeferredConfirmWithContext(ctx, "", queue, true, false, message)
	if err != nil || confirmation == nil {
		return errors.New("handoff publication unavailable")
	}
	confirmed, err := confirmation.WaitContext(ctx)
	if err != nil || !confirmed {
		return errors.New("handoff was not confirmed")
	}
	// Use a synchronous same-channel RPC as a frame-processing fence. Separate
	// return/confirmation channels alone do not provide a delivery-order guarantee.
	if _, err = d.channel.QueueInspect(queue); err != nil {
		return errors.New("handoff destination unavailable")
	}
	select {
	case <-d.returns:
		return errors.New("handoff was unroutable")
	default:
		return nil
	}
}
func (s *Service) Consume(ctx context.Context, url, queue string) {
	delay := time.Second
	for ctx.Err() == nil {
		err := s.consumeConnection(ctx, url, queue, func() { delay = time.Second })
		s.Connected.Store(false)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			log.Print("notification consumer reconnecting")
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		if delay < 30*time.Second {
			delay *= 2
		}
		if delay > 30*time.Second {
			delay = 30 * time.Second
		}
	}
}
func (s *Service) consumeConnection(ctx context.Context, url, queue string, connected func()) error {
	var socket net.Conn
	connection, err := amqp.DialConfig(url, amqp.Config{Heartbeat: 30 * time.Second, Dial: func(network, address string) (net.Conn, error) {
		conn, err := (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, address)
		if err == nil {
			socket = conn
			_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
		}
		return conn, err
	}})
	if err != nil {
		return errors.New("broker connection unavailable")
	}
	defer connection.Close()
	_ = socket.SetDeadline(time.Time{})
	stopClose := context.AfterFunc(ctx, func() { _ = socket.Close() })
	defer stopClose()
	channel, err := connection.Channel()
	if err != nil {
		return err
	}
	defer channel.Close()
	for _, name := range []string{queue, queue + ".dead"} {
		if _, err = channel.QueueDeclare(name, true, false, false, false, nil); err != nil {
			return err
		}
	}
	if _, err = channel.QueueDeclare(queue+".retry", true, false, false, false, amqp.Table{"x-message-ttl": int32(5000), "x-dead-letter-exchange": "", "x-dead-letter-routing-key": queue}); err != nil {
		return err
	}
	if err = channel.Confirm(false); err != nil {
		return err
	}
	returns := channel.NotifyReturn(make(chan amqp.Return, 1))
	if err = channel.Qos(10, 0, false); err != nil {
		return err
	}
	deliveries, err := channel.Consume(queue, "", false, false, false, false, nil)
	if err != nil {
		return err
	}
	s.Connected.Store(true)
	connected()
	defer s.Connected.Store(false)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case delivery, ok := <-deliveries:
			if !ok {
				return errors.New("consumer disconnected")
			}
			work, cancel := context.WithTimeout(ctx, 10*time.Second)
			// Broker RPCs do not honor context cancellation themselves. Close the
			// transport on a work deadline so blocked handoffs cannot hang the worker.
			stopWorkClose := context.AfterFunc(work, func() { _ = socket.Close() })
			_ = socket.SetWriteDeadline(time.Now().Add(10 * time.Second))
			err := Process(work, s.Store, queue, delivery.Body, delivery.Headers, delivery.MessageId, brokerDelivery{channel: channel, returns: returns, delivery: delivery})
			stopWorkClose()
			cancel()
			_ = socket.SetWriteDeadline(time.Time{})
			if err != nil {
				return err
			} // close the connection without ACK, preserving redelivery.
		}
	}
}
