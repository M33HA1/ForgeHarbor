//go:build integration

package integration

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"forgeharbor/controlplane/internal/auth"
	"forgeharbor/controlplane/internal/history"
	"forgeharbor/controlplane/internal/notify"
	"forgeharbor/controlplane/internal/platform"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type syntheticBreach struct{}

func (syntheticBreach) Compromised(context.Context, string) (bool, error) { return false, nil }

type unavailableStorage struct{ notify.Notifications }

func (unavailableStorage) InsertOnce(context.Context, notify.Document) error {
	return errors.New("synthetic storage outage")
}

func TestControlPlaneContractsWithRealDependencies(t *testing.T) {
	for _, name := range []string{"MONGO_URI", "REDIS_URL", "RABBITMQ_URL"} {
		if os.Getenv(name) == "" {
			t.Fatalf("%s required: run scripts/check-go-parity.ps1", name)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	client, err := mongo.Connect(options.Client().ApplyURI(os.Getenv("MONGO_URI")).SetTimeout(5 * time.Second))
	if err != nil {
		t.Fatal("Mongo setup failed")
	}
	defer client.Disconnect(context.Background())
	name := "fh_go_parity_" + strings.ReplaceAll(platform.UUID(), "-", "")
	db := client.Database(name)
	defer func() {
		if !strings.HasPrefix(name, "fh_go_parity_") {
			t.Fatal("unsafe cleanup database")
		}
		if err := db.Drop(context.Background()); err != nil {
			t.Error("fixture cleanup failed")
		}
	}()
	redisOptions, err := redis.ParseURL(os.Getenv("REDIS_URL"))
	if err != nil {
		t.Fatal("Redis configuration failed")
	}
	cache := redis.NewClient(redisOptions)
	defer cache.Close()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	public, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
	tokens, err := platform.NewTokens(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: public}), pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), "forgeharbor", "forgeharbor-users")
	if err != nil {
		t.Fatal("key setup failed")
	}
	users := auth.MongoUsers{Collection: db.Collection("users")}
	if users.EnsureIndex(ctx) != nil {
		t.Fatal("email index failed")
	}
	sessions := auth.RedisSessions{Client: cache}
	authServer := httptest.NewServer((&auth.Service{Users: users, Sessions: sessions, Tokens: tokens, Passwords: auth.NewPasswords(), Breach: syntheticBreach{}, CookieSecure: true}).Handler([]string{"http://localhost:3000"}))
	defer authServer.Close()
	request := func(server, method, path, body, token string) (int, []byte, *http.Response) {
		t.Helper()
		req, _ := http.NewRequestWithContext(ctx, method, server+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		response, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal("HTTP fixture failed")
		}
		data, _ := io.ReadAll(response.Body)
		response.Body.Close()
		return response.StatusCode, data, response
	}
	email := "fixture-" + name + "@example.invalid"
	credentials := `{"email":"` + email + `","password":"synthetic fixture passphrase only"}`
	status, _, _ := request(authServer.URL, "POST", "/auth/signup", credentials, "")
	if status != 201 {
		t.Fatalf("signup: %d", status)
	}
	status, _, _ = request(authServer.URL, "POST", "/auth/signup", strings.Replace(credentials, email, strings.ToUpper(email), 1), "")
	if status != 409 {
		t.Fatalf("case duplicate: %d", status)
	}
	status, _, response := request(authServer.URL, "POST", "/auth/login", credentials, "")
	if status != 200 || len(response.Cookies()) != 1 {
		t.Fatalf("login: %d", status)
	}
	token := response.Cookies()[0].Value
	claims, err := tokens.Verify(token)
	if err != nil {
		t.Fatal("issued token invalid")
	}
	if status, _, _ = request(authServer.URL, "GET", "/auth/me", "", token); status != 200 {
		t.Fatal("me failed")
	}
	if status, _, _ = request(authServer.URL, "POST", "/auth/logout", "", token); status != 204 {
		t.Fatal("logout failed")
	}
	if status, _, _ = request(authServer.URL, "GET", "/auth/me", "", token); status != 401 {
		t.Fatal("revoked session accepted")
	}
	// Atomic Redis Lua behavior, with generated fixture identities and a dedicated Redis instance.
	rateEmail := email + "-limit"
	for i := int64(1); i <= 6; i++ {
		a, _, _, err := sessions.LoginAttempt(ctx, rateEmail, "198.51.100.77")
		if err != nil || a != i {
			t.Fatal("atomic login counter drift")
		}
	}
	for i := int64(1); i <= 21; i++ {
		n, _, err := sessions.SignupAttempt(ctx, "198.51.100.78")
		if err != nil || n != i {
			t.Fatal("atomic signup counter drift")
		}
	}
	owner := claims.Subject
	other := "foreign-" + name
	ownedID := bson.NewObjectID()
	foreignID := bson.NewObjectID()
	_, err = db.Collection("scans").InsertMany(ctx, []any{bson.M{"_id": ownedID, "user_id": owner, "scan_type": "url", "result": bson.M{"phishing": true}}, bson.M{"_id": foreignID, "user_id": other, "scan_type": "url", "result": bson.M{"risk_level": "high"}}})
	if err != nil {
		t.Fatal("scan fixtures failed")
	}
	ownerToken, _ := tokens.Issue(owner, email)
	historyServer := httptest.NewServer((&history.Service{Store: history.MongoScans{DB: db}, Tokens: tokens}).Handler())
	defer historyServer.Close()
	status, body, _ := request(historyServer.URL, "GET", "/history?risk=high&type=url", "", ownerToken)
	if status != 200 {
		t.Fatalf("history: %d", status)
	}
	var page struct {
		Items  []map[string]any `json:"items"`
		Cursor string           `json:"next_cursor"`
	}
	if json.Unmarshal(body, &page) != nil || len(page.Items) != 1 || page.Items[0]["_id"] != ownedID.Hex() || page.Cursor == "" {
		t.Fatal("history ownership/filter/serialization mismatch")
	}
	status, _, _ = request(historyServer.URL, "GET", "/history/"+foreignID.Hex(), "", ownerToken)
	if status != 404 {
		t.Fatal("foreign history exposed")
	}
	status, body, _ = request(historyServer.URL, "GET", "/history?cursor="+page.Cursor, "", ownerToken)
	if status != 200 || json.Unmarshal(body, &page) != nil || len(page.Items) != 0 {
		t.Fatal("pagination repeats record")
	}
	// Real broker handoff, confirmed poison routing, retries, and durable idempotency.
	queue := "go-parity-" + name
	notifications := notify.MongoNotifications{DB: db}
	worker := &notify.Service{Store: notifications, Tokens: tokens}
	workerCtx, stopWorker := context.WithCancel(ctx)
	defer stopWorker()
	go worker.Consume(workerCtx, os.Getenv("RABBITMQ_URL"), queue)
	wait(t, ctx, func() bool { return worker.Connected.Load() })
	conn, err := amqp.Dial(os.Getenv("RABBITMQ_URL"))
	if err != nil {
		t.Fatal("broker setup failed")
	}
	defer conn.Close()
	channel, err := conn.Channel()
	if err != nil {
		t.Fatal("broker channel failed")
	}
	defer channel.Close()
	report := bson.NewObjectID().Hex()
	event := map[string]any{"schema_version": 1, "event_type": "report.created", "event_id": "report.created:" + report, "user_id": owner, "occurred_at": "2026-11-03T00:00:00Z", "data": map[string]any{"report_id": report, "scan_id": ownedID.Hex(), "message": "Report created"}}
	payload, _ := json.Marshal(event)
	publish := func(body []byte) {
		t.Helper()
		if channel.PublishWithContext(ctx, "", queue, true, false, amqp.Publishing{DeliveryMode: amqp.Persistent, ContentType: "application/json", Body: body}) != nil {
			t.Fatal("publish failed")
		}
	}
	publish(payload)
	publish(payload)
	wait(t, ctx, func() bool {
		count, _ := db.Collection("notifications").CountDocuments(ctx, bson.M{"user": owner})
		return count == 1
	})
	changed := strings.Replace(string(payload), `"user_id":"`+owner+`"`, `"user_id":"`+other+`"`, 1)
	publish([]byte(changed))
	publish([]byte("{"))
	wait(t, ctx, func() bool { q, err := channel.QueueInspect(queue + ".dead"); return err == nil && q.Messages >= 2 })
	notifyServer := httptest.NewServer(worker.Handler())
	defer notifyServer.Close()
	status, body, _ = request(notifyServer.URL, "GET", "/notify", "", ownerToken)
	if status != 200 || !strings.Contains(string(body), report) || strings.Contains(string(body), `"_id"`) {
		t.Fatal("notification owner API mismatch")
	}
	foreignToken, _ := tokens.Issue(other, "other@example.invalid")
	status, body, _ = request(notifyServer.URL, "GET", "/notify", "", foreignToken)
	if status != 200 || strings.Contains(string(body), report) {
		t.Fatal("foreign notification exposed")
	}
	stored, err := users.Find(ctx, email)
	if err != nil || stored.UserID != owner || !strings.HasPrefix(stored.PasswordHash, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatal("legacy user storage incompatible")
	}
	if err = users.Create(ctx, stored); !errors.Is(err, auth.ErrConflict) {
		t.Fatal("duplicate-key mapping incompatible")
	}
	// Exercise the real five-second TTL redrive and exhaustion path, not just mocks.
	retryQueue := queue + "-storage-outage"
	failedWorker := &notify.Service{Store: unavailableStorage{Notifications: notifications}, Tokens: tokens}
	go failedWorker.Consume(workerCtx, os.Getenv("RABBITMQ_URL"), retryQueue)
	wait(t, ctx, func() bool { return failedWorker.Connected.Load() })
	if channel.PublishWithContext(ctx, "", retryQueue, true, false, amqp.Publishing{DeliveryMode: amqp.Persistent, ContentType: "application/json", Body: payload}) != nil {
		t.Fatal("retry fixture publish failed")
	}
	wait(t, ctx, func() bool {
		q, err := channel.QueueInspect(retryQueue + ".dead")
		return err == nil && q.Messages == 1
	})
	dead, ok, err := channel.Get(retryQueue+".dead", false)
	if err != nil || !ok || dead.Headers["x-notify-attempt"] != int32(4) || dead.Headers["x-notify-reason"] != "storage_retries_exhausted" {
		t.Fatal("broker retry budget or reason mismatch")
	}
	_ = dead.Ack(false)
}
func wait(t *testing.T, ctx context.Context, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for !condition() {
		if time.Now().After(deadline) || ctx.Err() != nil {
			t.Fatal("dependency contract timed out")
		}
		time.Sleep(50 * time.Millisecond)
	}
}
