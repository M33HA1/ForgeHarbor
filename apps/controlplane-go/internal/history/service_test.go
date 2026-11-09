package history

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http/httptest"
	"testing"

	"forgeharbor/controlplane/internal/platform"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type fixtureScans struct {
	filter bson.M
	items  []bson.M
}

func (f *fixtureScans) Ping(context.Context) error { return nil }
func (f *fixtureScans) List(_ context.Context, filter bson.M, _ int64) ([]bson.M, error) {
	f.filter = filter
	return f.items, nil
}
func (f *fixtureScans) One(_ context.Context, filter bson.M) (bson.M, error) {
	f.filter = filter
	return nil, mongo.ErrNoDocuments
}
func TestHistoryScopesEveryQueryAndRetainsWireFormat(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	public, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
	tokens, _ := platform.NewTokens(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: public}), pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), "forgeharbor", "forgeharbor-users")
	id := bson.NewObjectID()
	store := &fixtureScans{items: []bson.M{{"_id": id, "user_id": "owner", "result": bson.M{"risk_level": "high"}}}}
	handler := (&Service{Store: store, Tokens: tokens}).Handler()
	token, _ := tokens.Issue("owner", "fixture@example.invalid")
	request := func(path string, authorized bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", path, nil)
		if authorized {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if request("/history", false).Code != 401 {
		t.Fatal("anonymous list allowed")
	}
	w := request("/history?risk=high&type=url", true)
	if w.Code != 200 || store.filter["user_id"] != "owner" || store.filter["scan_type"] != "url" || store.filter["$or"] == nil {
		t.Fatal("owner/type/risk filter lost")
	}
	var response struct {
		Items []map[string]any `json:"items"`
		Next  string           `json:"next_cursor"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &response)
	if response.Items[0]["_id"] != id.Hex() || response.Next != base64.StdEncoding.EncodeToString([]byte(id.Hex())) {
		t.Fatal("BSON wire format or cursor changed")
	}
	if request("/history/"+id.Hex(), true).Code != 404 || store.filter["user_id"] != "owner" {
		t.Fatal("detail leaks foreign record")
	}
	for _, path := range []string{"/history/bad-id", "/history?risk=critical", "/history?type=other", "/history?cursor=bad"} {
		if request(path, true).Code != 400 {
			t.Fatal("invalid query accepted")
		}
	}
}
func TestPaginationDefaultsAndLegacyRisk(t *testing.T) {
	for input, want := range map[string]int64{"": 20, "0": 20, "-2": 1, "101": 100, "12junk": 12, "invalid": 20} {
		if PageSize(input) != want {
			t.Fatalf("page limit %q", input)
		}
	}
	filter, err := Filter("owner", "file", "low", "")
	if err != nil || filter["user_id"] != "owner" || len(filter["$or"].(bson.A)) != 3 {
		t.Fatal("legacy filter omitted")
	}
}
