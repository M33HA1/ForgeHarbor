package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type MongoMFA struct{ Collection *mongo.Collection }

func (m MongoMFA) Load(ctx context.Context, user string) (MFAState, error) {
	var record struct {
		MFA MFAState `bson:"mfa"`
	}
	err := m.Collection.FindOne(ctx, bson.M{"user_id": user}).Decode(&record)
	// Legacy signed fixtures and sessions may predate a persisted user record.
	if errors.Is(err, mongo.ErrNoDocuments) {
		return MFAState{}, nil
	}
	return record.MFA, err
}
func versionFilter(user, version string) bson.M {
	f := bson.M{"user_id": user}
	if version == "" {
		f["mfa.version"] = bson.M{"$in": bson.A{"", nil}}
	} else {
		f["mfa.version"] = version
	}
	return f
}
func (m MongoMFA) Enable(ctx context.Context, user, version string, state MFAState) (bool, error) {
	filter := versionFilter(user, version)
	filter["mfa.enabled"] = bson.M{"$ne": true}
	result, err := m.Collection.UpdateOne(ctx, filter, bson.M{"$set": bson.M{"mfa": state}})
	if err != nil {
		return false, err
	}
	return result.ModifiedCount == 1, nil
}
func (m MongoMFA) Consume(ctx context.Context, user, version string, step int64, recovery string) (bool, error) {
	filter := versionFilter(user, version)
	filter["mfa.enabled"] = true
	var update bson.M
	if recovery != "" {
		filter["mfa.recovery_hashes"] = recovery
		update = bson.M{"$pull": bson.M{"mfa.recovery_hashes": recovery}}
	} else {
		filter["mfa.last_step"] = bson.M{"$lt": step}
		update = bson.M{"$set": bson.M{"mfa.last_step": step}}
	}
	result, err := m.Collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return false, err
	}
	return result.ModifiedCount == 1, nil
}
func (m MongoMFA) Disable(ctx context.Context, user, version, next string) (bool, error) {
	filter := versionFilter(user, version)
	filter["mfa.enabled"] = true
	result, err := m.Collection.UpdateOne(ctx, filter, bson.M{"$set": bson.M{"mfa": MFAState{Version: next}}})
	if err != nil {
		return false, err
	}
	return result.ModifiedCount == 1, nil
}

type RedisMFAChallenges struct{ Client *redis.Client }

func challengeKey(purpose, token string) string {
	return fmt.Sprintf("forgeharbor:auth:mfa:v1:%s:%x", purpose, sha256.Sum256([]byte(token)))
}
func (c RedisMFAChallenges) Create(ctx context.Context, purpose string, payload MFAChallenge) (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(data)
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	_, err = redis.NewScript(`redis.call('HSET',KEYS[1],'payload',ARGV[1],'attempts',0); redis.call('EXPIRE',KEYS[1],300); return 1`).Run(ctx, c.Client, []string{challengeKey(purpose, token)}, string(encoded)).Result()
	return token, err
}
func (c RedisMFAChallenges) Attempt(ctx context.Context, purpose, token string) (MFAChallenge, error) {
	if len(token) != 43 || strings.ContainsAny(token, " \t\r\n") {
		return MFAChallenge{}, ErrVerification
	}
	value, err := redis.NewScript(`local p=redis.call('HGET',KEYS[1],'payload'); if not p then return false end; local n=redis.call('HINCRBY',KEYS[1],'attempts',1); if n>5 then redis.call('DEL',KEYS[1]); return false end; return p`).Run(ctx, c.Client, []string{challengeKey(purpose, token)}).Text()
	if errors.Is(err, redis.Nil) {
		return MFAChallenge{}, ErrVerification
	}
	if err != nil {
		return MFAChallenge{}, err
	}
	var payload MFAChallenge
	err = json.Unmarshal([]byte(value), &payload)
	return payload, err
}
func (c RedisMFAChallenges) Take(ctx context.Context, purpose, token string, payload MFAChallenge) (bool, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}
	n, err := redis.NewScript(`if redis.call('HGET',KEYS[1],'payload')==ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end; return 0`).Run(ctx, c.Client, []string{challengeKey(purpose, token)}, string(encoded)).Int()
	return n == 1, err
}

// Keep interface TTL documentation next to the atomic Redis scripts.
const MFAChallengeLifetime = 5 * time.Minute
