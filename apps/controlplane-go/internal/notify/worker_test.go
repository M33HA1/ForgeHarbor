package notify

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func event() []byte {
	return []byte(`{"schema_version":1,"event_id":"report.created:aaaaaaaaaaaaaaaaaaaaaaaa","event_type":"report.created","user_id":"owner","occurred_at":"2026-11-03T00:00:00Z","data":{"report_id":"aaaaaaaaaaaaaaaaaaaaaaaa","scan_id":"bbbbbbbbbbbbbbbbbbbbbbbb","message":"Report created"}}`)
}

type fixtureStore struct {
	items   map[string]Document
	offline bool
}

func (f *fixtureStore) Ping(context.Context) error {
	if f.offline {
		return errors.New("offline")
	}
	return nil
}
func (f *fixtureStore) List(context.Context, string) ([]bson.M, error) { return []bson.M{}, nil }
func (f *fixtureStore) InsertOnce(_ context.Context, doc Document) error {
	if f.offline {
		return errors.New("offline")
	}
	if old, ok := f.items[doc.ID]; ok && old != doc {
		return ErrInvalid
	}
	f.items[doc.ID] = doc
	return nil
}

type fixtureDelivery struct {
	ops         []string
	destination string
	message     amqp.Publishing
	fail        bool
}

func (d *fixtureDelivery) Publish(_ context.Context, destination string, message amqp.Publishing) error {
	d.ops = append(d.ops, "publish")
	d.destination = destination
	d.message = message
	if d.fail {
		return errors.New("failed handoff")
	}
	return nil
}
func (d *fixtureDelivery) Ack() error { d.ops = append(d.ops, "ack"); return nil }
func TestEventContractLegacyAndTimestamp(t *testing.T) {
	doc, err := Parse(event())
	if err != nil || doc.Timestamp != "2026-11-03T00:00:00+00:00" || doc.ID != "event:report.created:aaaaaaaaaaaaaaaaaaaaaaaa" {
		t.Fatal("event contract changed")
	}
	legacy := []byte(`{"reportId":"aaaaaaaaaaaaaaaaaaaaaaaa","scanId":"bbbbbbbbbbbbbbbbbbbbbbbb","user":"owner","message":"Report created"}`)
	a, err := Parse(legacy)
	b, _ := Parse(legacy)
	if err != nil || a != b {
		t.Fatal("legacy event normalization unstable")
	}
	for _, body := range [][]byte{[]byte(`[]`), []byte(`null`), []byte(`{}`), []byte(strings.Repeat("x", 65537)), []byte(strings.Replace(string(event()), `"schema_version":1`, `"schema_version":1.0`, 1)), []byte(strings.Replace(string(event()), `"schema_version":1`, `"schema_version":"1"`, 1)), []byte(strings.Replace(string(event()), `"user_id":"owner"`, `"user_id":" "`, 1)), []byte(strings.Replace(string(event()), "2026-11-03T00:00:00Z", "2026-11-03T00:00:00", 1))} {
		if _, err := Parse(body); err == nil {
			t.Fatal("invalid event accepted")
		}
	}
}
func TestIdempotencyCollisionAndAckOrdering(t *testing.T) {
	store := &fixtureStore{items: map[string]Document{}}
	for i := 0; i < 2; i++ {
		delivery := &fixtureDelivery{}
		if Process(context.Background(), store, "fixture", event(), nil, "id", delivery) != nil || strings.Join(delivery.ops, ",") != "ack" {
			t.Fatal("normal delivery failed")
		}
	}
	if len(store.items) != 1 {
		t.Fatal("redelivery duplicated notification")
	}
	changed := []byte(strings.Replace(string(event()), `"user_id":"owner"`, `"user_id":"other"`, 1))
	delivery := &fixtureDelivery{}
	if Process(context.Background(), store, "fixture", changed, nil, "id", delivery) != nil || delivery.destination != "fixture.dead" || strings.Join(delivery.ops, ",") != "publish,ack" {
		t.Fatal("collision did not hand off before ACK")
	}
	for _, doc := range store.items {
		if doc.User != "owner" {
			t.Fatal("collision reassigned owner")
		}
	}
	delivery = &fixtureDelivery{fail: true}
	if Process(context.Background(), store, "fixture", []byte("{"), nil, "id", delivery) == nil || strings.Join(delivery.ops, ",") != "publish" {
		t.Fatal("failed handoff acknowledged original")
	}
}
func TestRetriesAndReadiness(t *testing.T) {
	store := &fixtureStore{offline: true}
	for _, test := range []struct {
		attempt     any
		destination string
	}{{nil, "fixture.retry"}, {int32(2), "fixture.retry"}, {int64(3), "fixture.dead"}, {"bad", "fixture.dead"}, {true, "fixture.dead"}, {int32(-1), "fixture.dead"}} {
		delivery := &fixtureDelivery{}
		if Process(context.Background(), store, "fixture", event(), amqp.Table{"x-notify-attempt": test.attempt}, "id", delivery) != nil || delivery.destination != test.destination || delivery.message.DeliveryMode != amqp.Persistent {
			t.Fatal("unbounded or nonpersistent retry")
		}
	}
	s := &Service{Store: store}
	handler := s.Handler()
	request := func() int {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", "/notify/health", nil))
		return w.Code
	}
	if request() != 503 {
		t.Fatal("unready consumer reported healthy")
	}
	store.offline = false
	s.Connected.Store(true)
	if request() != 200 {
		t.Fatal("healthy dependencies rejected")
	}
	doc, _ := Parse(event())
	body, _ := json.Marshal(doc)
	if strings.Contains(string(body), `"_id"`) {
		t.Fatal("internal notification ID exposed")
	}
}
