package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"forgeharbor/controlplane/internal/auth"
	"forgeharbor/controlplane/internal/history"
	"forgeharbor/controlplane/internal/notify"
	"forgeharbor/controlplane/internal/platform"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func value(name, fallback string) string {
	if v, ok := os.LookupEnv(name); ok {
		return v
	}
	return fallback
}
func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	if len(os.Args) != 2 || (os.Args[1] != "auth" && os.Args[1] != "history" && os.Args[1] != "notify") {
		log.Print("usage: forgeharbor auth|history|notify")
		os.Exit(2)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1]); err != nil {
		log.Print("service startup or runtime failed; check dependency and key configuration")
		os.Exit(1)
	}
}
func run(ctx context.Context, service string) error {
	// Legacy Rust Auth always uses forgeharbor.users, even when sibling services
	// configure another database. A language cutover must not silently move users.
	if service == "auth" && value("MONGO_DB", "forgeharbor") != "forgeharbor" {
		return errors.New("Auth database migration requires a separate explicit data plan")
	}
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		return errors.New("MONGO_URI required")
	}
	public, err := os.ReadFile(value("JWT_PUBLIC_KEY_PATH", "/app/config/jwt-public.pem"))
	if err != nil {
		return errors.New("public key required")
	}
	var private []byte
	if service == "auth" {
		private, err = os.ReadFile(value("JWT_PRIVATE_KEY_PATH", "/app/config/jwt-private.pem"))
		if err != nil {
			return errors.New("private key required")
		}
	}
	tokens, err := platform.NewTokens(public, private, value("JWT_ISSUER", "forgeharbor"), value("JWT_AUDIENCE", "forgeharbor-users"))
	if err != nil {
		return err
	}
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetTimeout(5 * time.Second).SetConnectTimeout(5 * time.Second).SetServerSelectionTimeout(5 * time.Second))
	if err != nil {
		return errors.New("database configuration invalid")
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Disconnect(cleanup)
	}()
	startup, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if client.Ping(startup, nil) != nil {
		return errors.New("database unavailable")
	}
	db := client.Database(value("MONGO_DB", "forgeharbor"))
	var handler http.Handler
	port := ""
	switch service {
	case "auth":
		users := auth.MongoUsers{Collection: db.Collection("users")}
		if users.EnsureIndex(startup) != nil {
			return errors.New("email uniqueness index unavailable")
		}
		redisURL := os.Getenv("REDIS_URL")
		if redisURL == "" {
			return errors.New("REDIS_URL required")
		}
		settings, err := redis.ParseURL(redisURL)
		if err != nil {
			return errors.New("Redis configuration invalid")
		}
		settings.DialTimeout = 5 * time.Second
		settings.ReadTimeout = 3 * time.Second
		settings.WriteTimeout = 3 * time.Second
		settings.ContextTimeoutEnabled = true
		cache := redis.NewClient(settings)
		defer cache.Close()
		if cache.Ping(startup).Err() != nil {
			return errors.New("Redis unavailable")
		}
		trusted, err := auth.ParseProxies(os.Getenv("AUTH_TRUSTED_PROXY_IPS"))
		if err != nil {
			return err
		}
		mfaKey, err := os.ReadFile(value("MFA_ENCRYPTION_KEY_PATH", "/app/config/mfa-encryption.key"))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return errors.New("MFA key configuration unavailable")
		}
		mfa, err := auth.NewMFA(auth.MongoMFA{Collection: db.Collection("users")}, auth.RedisMFAChallenges{Client: cache}, mfaKey)
		if err != nil {
			return errors.New("MFA key configuration invalid")
		}
		s := &auth.Service{Users: users, Sessions: auth.RedisSessions{Client: cache}, Tokens: tokens, Passwords: auth.NewPasswords(), Breach: auth.NewHIBP(), CookieSecure: !strings.EqualFold(value("AUTH_COOKIE_SECURE", "true"), "false"), TrustedProxies: trusted, MFA: mfa}
		handler = s.Handler(strings.Split(value("CORS_ALLOWED_ORIGINS", "http://localhost:8088,http://localhost:3000"), ","))
		port = value("AUTH_PORT", "8080")
	case "history":
		handler = (&history.Service{Store: history.MongoScans{DB: db}, Tokens: tokens}).Handler()
		port = value("HISTORY_PORT", "8083")
	case "notify":
		broker := os.Getenv("RABBITMQ_URL")
		if broker == "" {
			return errors.New("RABBITMQ_URL required")
		}
		queue := value("NOTIFY_QUEUE", "notifications")
		if strings.TrimSpace(queue) == "" {
			return errors.New("queue name required")
		}
		s := &notify.Service{Store: notify.MongoNotifications{DB: db}, Tokens: tokens}
		go s.Consume(ctx, broker, queue)
		handler = s.Handler()
		port = value("NOTIFY_PORT", "8085")
	}
	n, err := strconv.Atoi(port)
	if err != nil || n < 1 || n > 65535 {
		return errors.New("invalid port")
	}
	server := &http.Server{Addr: net.JoinHostPort("0.0.0.0", port), Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 * 1024}
	stopped := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = server.Shutdown(cleanup)
		case <-stopped:
		}
	}()
	log.Printf("%s-go starting on port %s", service, port)
	err = server.ListenAndServe()
	close(stopped)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
