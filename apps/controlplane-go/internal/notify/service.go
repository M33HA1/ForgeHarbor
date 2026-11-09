package notify

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"forgeharbor/controlplane/internal/history"
	"forgeharbor/controlplane/internal/platform"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Notifications interface {
	Ping(context.Context) error
	List(context.Context, string) ([]bson.M, error)
	InsertOnce(context.Context, Document) error
}
type MongoNotifications struct{ DB *mongo.Database }

func (m MongoNotifications) Ping(ctx context.Context) error {
	return m.DB.RunCommand(ctx, bson.M{"ping": 1}).Err()
}
func (m MongoNotifications) List(ctx context.Context, user string) ([]bson.M, error) {
	cursor, err := m.DB.Collection("notifications").Find(ctx, bson.M{"user": user}, options.Find().SetProjection(bson.M{"_id": 0}).SetSort(bson.D{{Key: "timestamp", Value: -1}}).SetLimit(100))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []bson.M{}
	err = cursor.All(ctx, &items)
	return items, err
}
func (m MongoNotifications) InsertOnce(ctx context.Context, doc Document) error {
	collection := m.DB.Collection("notifications")
	_, err := collection.UpdateOne(ctx, bson.M{"_id": doc.ID}, bson.M{"$setOnInsert": doc}, options.UpdateOne().SetUpsert(true))
	if err != nil {
		return err
	}
	var stored Document
	if err = collection.FindOne(ctx, bson.M{"_id": doc.ID}).Decode(&stored); err != nil {
		return err
	}
	if stored != doc {
		return ErrInvalid
	}
	return nil
}

type Service struct {
	Store     Notifications
	Tokens    *platform.Tokens
	Connected atomic.Bool
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /notify/health", s.health)
	mux.HandleFunc("GET /notify", s.list)
	return mux
}
func (s *Service) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	mongo := s.Store.Ping(ctx) == nil
	consumer := s.Connected.Load()
	status, label := 503, "degraded"
	if mongo && consumer {
		status, label = 200, "ok"
	}
	platform.JSON(w, status, map[string]any{"status": label, "service": "notify-go", "dependencies": map[string]bool{"mongo": mongo, "consumer": consumer}})
}
func (s *Service) list(w http.ResponseWriter, r *http.Request) {
	claims, err := s.Tokens.Verify(platform.RequestToken(r))
	if err != nil {
		platform.JSON(w, 401, map[string]string{"detail": "authentication required"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	items, err := s.Store.List(ctx, claims.Subject)
	if err != nil {
		platform.JSON(w, 500, map[string]string{"detail": "failed to load notifications"})
		return
	}
	result := make([]any, 0, len(items))
	for _, item := range items {
		delete(item, "_id")
		result = append(result, history.JSONValue(item))
	}
	platform.JSON(w, 200, map[string]any{"notifications": result})
}
