package routes

import (
    "context"
    "fmt"
    "log"
    "net"
    "os"
    "time"

    "github.com/streadway/amqp"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

type eventPublisher interface {
    Publish(string, string, bool, bool, amqp.Publishing) error
}

func publishConfirmed(ctx context.Context, channel eventPublisher, queue string, message amqp.Publishing,
    confirms <-chan amqp.Confirmation, returned <-chan amqp.Return) error {
    if err := ctx.Err(); err != nil { return err }
    if err := channel.Publish("", queue, true, false, message); err != nil { return err }
    select {
    case confirmation, open := <-confirms:
        if !open || !confirmation.Ack { return fmt.Errorf("notification publication not acknowledged") }
        // RabbitMQ sends mandatory returns before its confirmation. Both
        // listeners are buffered so a returned message cannot count as sent.
        select {
        case <-returned: return fmt.Errorf("notification was not routed")
        default: return nil
        }
    case <-returned: return fmt.Errorf("notification was not routed")
    case <-ctx.Done(): return ctx.Err()
    }
}

// Each relay owns its AMQP channel. Duplicate sends after an ambiguous failure
// or across replicas use the same event ID and are idempotent in Notify.
func RunNotificationRelay(ctx context.Context, client *mongo.Client, url string) {
    reports := client.Database(os.Getenv("MONGO_DB")).Collection("reports")
    queue := os.Getenv("NOTIFY_QUEUE")
    if queue == "" { queue = "notifications" }
    delay := time.Second
    for ctx.Err() == nil {
        err := relaySession(ctx, reports, url, queue)
        if ctx.Err() != nil { return }
        if err != nil { log.Println("Report notification relay unavailable; pending events retained") }
        select {
        case <-ctx.Done(): return
        case <-time.After(delay):
        }
        if delay < 30*time.Second { delay *= 2 }
        if delay > 30*time.Second { delay = 30*time.Second }
    }
}

func relaySession(ctx context.Context, reports *mongo.Collection, url, queue string) error {
    var socket net.Conn
    connection, err := amqp.DialConfig(url, amqp.Config{Heartbeat: 10*time.Second, Dial: func(network, address string) (net.Conn, error) {
        var err error
        socket, err = net.DialTimeout(network, address, 5*time.Second)
        if err == nil { _ = socket.SetDeadline(time.Now().Add(10*time.Second)) }
        return socket, err
    }})
    if socket != nil { defer socket.Close() }
    if err != nil { return err }
    channel, err := connection.Channel()
    if err != nil { return err }
    if _, err = channel.QueueDeclare(queue, true, false, false, false, nil); err != nil { return err }
    confirmations := channel.NotifyPublish(make(chan amqp.Confirmation, 1))
    returned := channel.NotifyReturn(make(chan amqp.Return, 1))
    closed := channel.NotifyClose(make(chan *amqp.Error, 1))
    if err = channel.Confirm(false); err != nil { return err }
    _ = socket.SetDeadline(time.Time{})
    for ctx.Err() == nil {
        readCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
        cursor, err := reports.Find(readCtx, bson.M{"notification_pending": true}, options.Find().SetSort(bson.D{{Key:"createdAt", Value:1}}).SetLimit(100))
        var batch []Report
        if err == nil {
            err = cursor.All(readCtx, &batch)
            _ = cursor.Close(readCtx)
        }
        cancel()
        if err != nil { return err }
        for _, report := range batch {
            publishCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
            _ = socket.SetDeadline(time.Now().Add(5*time.Second))
            err = publishConfirmed(publishCtx, channel, queue, reportCreatedMessage(report), confirmations, returned)
            cancel()
            if err != nil { return err }
            _ = socket.SetDeadline(time.Time{})
            updateCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
            _, err = reports.UpdateOne(updateCtx, bson.M{"_id": report.ID, "notification_pending": true}, bson.M{"$set": bson.M{
                "notification_pending": false, "notification_published_at": time.Now().UTC(),
            }})
            cancel()
            if err != nil { return err }
        }
        select {
        case <-ctx.Done(): return ctx.Err()
        case <-closed: return fmt.Errorf("notification channel closed")
        case <-time.After(2*time.Second):
        }
    }
    return ctx.Err()
}
