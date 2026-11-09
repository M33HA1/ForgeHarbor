package history

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"forgeharbor/controlplane/internal/platform"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Scans interface {
	Ping(context.Context) error
	List(context.Context, bson.M, int64) ([]bson.M, error)
	One(context.Context, bson.M) (bson.M, error)
}
type MongoScans struct{ DB *mongo.Database }

func (m MongoScans) Ping(ctx context.Context) error {
	return m.DB.RunCommand(ctx, bson.M{"ping": 1}).Err()
}
func (m MongoScans) List(ctx context.Context, filter bson.M, limit int64) ([]bson.M, error) {
	cursor, err := m.DB.Collection("scans").Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(limit))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []bson.M{}
	err = cursor.All(ctx, &items)
	return items, err
}
func (m MongoScans) One(ctx context.Context, filter bson.M) (bson.M, error) {
	var item bson.M
	err := m.DB.Collection("scans").FindOne(ctx, filter).Decode(&item)
	return item, err
}

type Service struct {
	Store  Scans
	Tokens *platform.Tokens
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /history/health", s.health)
	mux.HandleFunc("GET /history", s.list)
	mux.HandleFunc("GET /history/{scan_id}", s.one)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/history/health" && r.Method == "GET" {
			mux.ServeHTTP(w, r)
			return
		}
		claims, err := s.Tokens.Verify(platform.RequestToken(r))
		if err != nil {
			platform.Error(w, 401, "authentication required")
			return
		}
		r = r.WithContext(context.WithValue(r.Context(), ownerKey{}, claims.Subject))
		mux.ServeHTTP(w, r)
	})
}

type ownerKey struct{}

func (s *Service) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	status := "connected"
	if s.Store.Ping(ctx) != nil {
		status = "disconnected"
	}
	platform.JSON(w, 200, map[string]string{"status": "healthy", "service": "history-go", "timestamp": time.Now().UTC().Format(time.RFC3339Nano), "mongodb": status})
}
func PageSize(value string) int64 {
	// Match the existing parseInt(value, 10) default/clamp behavior.
	value = strings.TrimSpace(value)
	end := 0
	if len(value) > 0 && (value[0] == '+' || value[0] == '-') {
		end++
	}
	start := end
	for end < len(value) && value[end] >= '0' && value[end] <= '9' {
		end++
	}
	if end == start {
		return 20
	}
	n, err := strconv.ParseInt(value[:end], 10, 64)
	if err != nil {
		if strings.HasPrefix(value, "-") {
			return 1
		}
		return 100
	}
	if n == 0 {
		return 20
	}
	if n < 1 {
		return 1
	}
	if n > 100 {
		return 100
	}
	return n
}
func Filter(owner, kind, risk, cursor string) (bson.M, error) {
	filter := bson.M{"user_id": owner}
	if kind != "" {
		if kind != "url" && kind != "file" {
			return nil, errors.New("type must be url or file")
		}
		filter["scan_type"] = kind
	}
	if risk != "" {
		if risk != "high" && risk != "low" {
			return nil, errors.New("risk must be high or low")
		}
		filter["$or"] = bson.A{bson.M{"result.risk_level": risk}, bson.M{"result.phishing": risk == "high"}, bson.M{"result.malicious": risk == "high"}}
	}
	if cursor != "" {
		decoded, err := base64.StdEncoding.DecodeString(cursor)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(cursor)
		}
		if err != nil {
			return nil, errors.New("invalid cursor")
		}
		id, err := bson.ObjectIDFromHex(string(decoded))
		if err != nil {
			return nil, errors.New("invalid cursor")
		}
		filter["_id"] = bson.M{"$lt": id}
	}
	return filter, nil
}
func (s *Service) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filter, err := Filter(r.Context().Value(ownerKey{}).(string), q.Get("type"), q.Get("risk"), q.Get("cursor"))
	if err != nil {
		platform.Error(w, 400, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	items, err := s.Store.List(ctx, filter, PageSize(q.Get("limit")))
	if err != nil {
		platform.Error(w, 503, "History temporarily unavailable")
		return
	}
	var next *string
	if len(items) > 0 {
		if id, ok := items[len(items)-1]["_id"].(bson.ObjectID); ok {
			value := base64.StdEncoding.EncodeToString([]byte(id.Hex()))
			next = &value
		}
	}
	result := make([]any, 0, len(items))
	for _, item := range items {
		result = append(result, JSONValue(item))
	}
	platform.JSON(w, 200, map[string]any{"items": result, "next_cursor": next})
}
func (s *Service) one(w http.ResponseWriter, r *http.Request) {
	id, err := bson.ObjectIDFromHex(r.PathValue("scan_id"))
	if err != nil {
		platform.Error(w, 400, "invalid scan id")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	item, err := s.Store.One(ctx, bson.M{"_id": id, "user_id": r.Context().Value(ownerKey{}).(string)})
	if errors.Is(err, mongo.ErrNoDocuments) {
		platform.Error(w, 404, "not found")
		return
	}
	if err != nil {
		platform.Error(w, 503, "History temporarily unavailable")
		return
	}
	platform.JSON(w, 200, JSONValue(item))
}

// Mongo's extended JSON changes the existing API; preserve Node's ObjectId/date strings.
func JSONValue(value any) any {
	switch v := value.(type) {
	case bson.ObjectID:
		return v.Hex()
	case bson.DateTime:
		return v.Time().UTC().Format("2006-01-02T15:04:05.000Z")
	case time.Time:
		return v.UTC().Format("2006-01-02T15:04:05.000Z")
	case bson.M:
		result := map[string]any{}
		for k, item := range v {
			result[k] = JSONValue(item)
		}
		return result
	case bson.D:
		result := map[string]any{}
		for _, item := range v {
			result[item.Key] = JSONValue(item.Value)
		}
		return result
	case bson.A:
		result := make([]any, 0, len(v))
		for _, item := range v {
			result = append(result, JSONValue(item))
		}
		return result
	default:
		return value
	}
}
