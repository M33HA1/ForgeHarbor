package routes

import (
    "context"
    "errors"
    "testing"
    "time"
    "github.com/streadway/amqp"
)

type fakeEventPublisher struct { send func(bool) error }
func (f fakeEventPublisher) Publish(_ string, _ string, mandatory, _ bool, _ amqp.Publishing) error { return f.send(mandatory) }

func TestPublicationRequiresConfirmedRouting(t *testing.T) {
    for _, outcome := range []string{"ack", "nack", "return", "closed", "write-error", "timeout"} {
        t.Run(outcome, func(t *testing.T) {
            confirms := make(chan amqp.Confirmation, 1)
            returned := make(chan amqp.Return, 1)
            publisher := fakeEventPublisher{send: func(mandatory bool) error {
                if !mandatory { t.Fatal("publication must require routing") }
                switch outcome {
                case "ack": confirms <- amqp.Confirmation{Ack:true}
                case "nack": confirms <- amqp.Confirmation{Ack:false}
                case "return": returned <- amqp.Return{}; confirms <- amqp.Confirmation{Ack:true}
                case "closed": close(confirms)
                case "write-error": return errors.New("write failed")
                }
                return nil
            }}
            ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
            defer cancel()
            err := publishConfirmed(ctx, publisher, "notifications", amqp.Publishing{}, confirms, returned)
            if (outcome == "ack") != (err == nil) { t.Fatalf("outcome %s returned %v", outcome, err) }
        })
    }
}
