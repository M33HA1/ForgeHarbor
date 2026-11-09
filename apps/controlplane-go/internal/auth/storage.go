package auth

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type MongoUsers struct{ Collection *mongo.Collection }

func emailCollation() *options.Collation { return &options.Collation{Locale: "en", Strength: 2} }
func (m MongoUsers) EnsureIndex(ctx context.Context) error {
	_, err := m.Collection.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetName("users_email_case_insensitive_unique").SetUnique(true).SetCollation(emailCollation())})
	return err
}
func (m MongoUsers) Find(ctx context.Context, email string) (User, error) {
	var user User
	err := m.Collection.FindOne(ctx, bson.M{"email": email}, options.FindOne().SetCollation(emailCollation())).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return user, ErrNotFound
	}
	return user, err
}
func (m MongoUsers) Create(ctx context.Context, user User) error {
	_, err := m.Collection.InsertOne(ctx, user)
	if mongo.IsDuplicateKeyError(err) {
		return ErrConflict
	}
	return err
}

type RedisSessions struct{ Client *redis.Client }

func rateKey(kind, value string) string {
	return fmt.Sprintf("forgeharbor:auth:login:v1:%s:%x", kind, sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(value)))))
}
func signupKey(ip string) string {
	return fmt.Sprintf("forgeharbor:auth:signup:v1:ip:%x", sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(ip)))))
}
func revokedKey(jti string) string {
	return fmt.Sprintf("forgeharbor:auth:revoked:v1:jti:%x", sha256.Sum256([]byte(jti)))
}

const signupScript = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 900) end; return { n, redis.call('TTL', KEYS[1]) }`
const loginScript = `
local a = redis.call('INCR', KEYS[1]); if a == 1 then redis.call('EXPIRE', KEYS[1], 900) end
local i = redis.call('INCR', KEYS[2]); if i == 1 then redis.call('EXPIRE', KEYS[2], 900) end
local ttl = 0
if a > 5 then ttl = math.max(ttl, redis.call('TTL', KEYS[1])) end
if i > 60 then ttl = math.max(ttl, redis.call('TTL', KEYS[2])) end
return {a, i, ttl}`

func (s RedisSessions) SignupAttempt(ctx context.Context, ip string) (int64, int64, error) {
	values, err := redis.NewScript(signupScript).Run(ctx, s.Client, []string{signupKey(ip)}).Int64Slice()
	if err != nil || len(values) != 2 {
		return 0, 0, errors.New("rate limiter unavailable")
	}
	return values[0], values[1], nil
}
func (s RedisSessions) LoginAttempt(ctx context.Context, email, ip string) (int64, int64, int64, error) {
	values, err := redis.NewScript(loginScript).Run(ctx, s.Client, []string{rateKey("account", email), rateKey("ip", ip)}).Int64Slice()
	if err != nil || len(values) != 3 {
		return 0, 0, 0, errors.New("rate limiter unavailable")
	}
	return values[0], values[1], values[2], nil
}
func (s RedisSessions) ClearAccount(ctx context.Context, email string) error {
	return s.Client.Del(ctx, rateKey("account", email)).Err()
}
func (s RedisSessions) Revoke(ctx context.Context, jti string, ttl time.Duration) error {
	return s.Client.Set(ctx, revokedKey(jti), "1", ttl.Round(time.Second)+time.Second).Err()
}
func (s RedisSessions) Revoked(ctx context.Context, jti string) (bool, error) {
	n, err := s.Client.Exists(ctx, revokedKey(jti)).Result()
	return n > 0, err
}
