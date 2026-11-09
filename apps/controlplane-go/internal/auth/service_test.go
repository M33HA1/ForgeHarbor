package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"forgeharbor/controlplane/internal/platform"
)

type fixtureUsers struct{ items map[string]User }

func (f fixtureUsers) Find(_ context.Context, email string) (User, error) {
	u, ok := f.items[email]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}
func (f fixtureUsers) Create(_ context.Context, u User) error {
	if _, ok := f.items[u.Email]; ok {
		return ErrConflict
	}
	f.items[u.Email] = u
	return nil
}

type fixtureSessions struct {
	failure             bool
	account, ip, signup int64
	revoked             map[string]bool
}

func (f *fixtureSessions) err() error {
	if f.failure {
		return errors.New("offline")
	}
	return nil
}
func (f *fixtureSessions) SignupAttempt(context.Context, string) (int64, int64, error) {
	return f.signup, 900, f.err()
}
func (f *fixtureSessions) LoginAttempt(context.Context, string, string) (int64, int64, int64, error) {
	return f.account, f.ip, 900, f.err()
}
func (f *fixtureSessions) ClearAccount(context.Context, string) error { return f.err() }
func (f *fixtureSessions) Revoke(_ context.Context, jti string, _ time.Duration) error {
	if f.failure {
		return f.err()
	}
	f.revoked[jti] = true
	return nil
}
func (f *fixtureSessions) Revoked(_ context.Context, jti string) (bool, error) {
	return f.revoked[jti], f.err()
}

type fixtureBreach struct{ bad, offline bool }

func (f fixtureBreach) Compromised(context.Context, string) (bool, error) {
	if f.offline {
		return false, errors.New("offline")
	}
	return f.bad, nil
}
func fixture(t *testing.T) *Service {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	public, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
	tokens, err := platform.NewTokens(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: public}), pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), "forgeharbor", "forgeharbor-users")
	if err != nil {
		t.Fatal(err)
	}
	trusted, _ := ParseProxies("192.0.2.10")
	return &Service{Users: fixtureUsers{items: map[string]User{}}, Sessions: &fixtureSessions{revoked: map[string]bool{}}, Tokens: tokens, Passwords: NewPasswords(), Breach: fixtureBreach{}, CookieSecure: true, TrustedProxies: trusted}
}
func request(s *Service, method, path, body, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.RemoteAddr = "192.0.2.99:12345"
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	s.Handler([]string{"http://localhost:3000"}).ServeHTTP(w, r)
	return w
}
func TestSignupLoginCookieRevocationAndLegacyPassword(t *testing.T) {
	s := fixture(t)
	w := request(s, "POST", "/auth/signup", `{"email":"Fixture@Example.invalid","password":"  synthetic fixture passphrase  "}`, "")
	if w.Code != 201 {
		t.Fatalf("signup status %d", w.Code)
	}
	var user map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &user)
	if user["email"] != "fixture@example.invalid" || user["password_hash"] != nil || user["created_at"] != nil {
		t.Fatal("public user schema changed")
	}
	if w = request(s, "POST", "/auth/signup", `{"email":"FIXTURE@example.invalid","password":"  synthetic fixture passphrase  "}`, ""); w.Code != 409 {
		t.Fatal("duplicate identity accepted")
	}
	w = request(s, "POST", "/auth/login", `{"email":"FIXTURE@example.invalid","password":"  synthetic fixture passphrase  "}`, "")
	if w.Code != 200 {
		t.Fatalf("login status %d", w.Code)
	}
	cookies := w.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode || cookies[0].MaxAge != 3600 {
		t.Fatal("session cookie weakened")
	}
	token := cookies[0].Value
	if request(s, "GET", "/auth/me", "", token).Code != 200 {
		t.Fatal("issued session rejected")
	}
	if request(s, "POST", "/auth/logout", "", token).Code != 204 || request(s, "GET", "/auth/me", "", token).Code != 401 {
		t.Fatal("revocation failed")
	}
	users := s.Users.(fixtureUsers)
	u := users.items["fixture@example.invalid"]
	u.PasswordHash, _ = s.Passwords.Hash("short")
	users.items[u.Email] = u
	if request(s, "POST", "/auth/login", `{"email":"fixture@example.invalid","password":"short"}`, "").Code != 200 {
		t.Fatal("legacy short password rejected")
	}
}
func TestAuthRejectionsAndDependencyFailures(t *testing.T) {
	s := fixture(t)
	for _, body := range []string{`null`, `{}`, `{"email":"a@example.invalid"}`, `{"Email":"a@example.invalid","password":"synthetic long passphrase"}`, `{"email":"a@example.invalid","email":"b@example.invalid","password":"synthetic long passphrase"}`, `{"email":"a@example.invalid","password":"short"}`, `{"email":"a@@example.invalid","password":"synthetic long passphrase"}`, `{"password":"sensitive-test-marker`} {
		w := request(s, "POST", "/auth/signup", body, "")
		if w.Code != 400 || strings.Contains(w.Body.String(), "sensitive-test-marker") {
			t.Fatal("bad input accepted or echoed")
		}
	}
	if request(s, "POST", "/auth/signup", strings.Repeat("x", 9000), "").Code != 413 {
		t.Fatal("body limit missing")
	}
	body := `{"email":"fixture@example.invalid","password":"synthetic long passphrase"}`
	s.Sessions.(*fixtureSessions).signup = 21
	w := request(s, "POST", "/auth/signup", body, "")
	if w.Code != 429 || w.Header().Get("Retry-After") == "" {
		t.Fatal("signup limit missing")
	}
	s.Sessions.(*fixtureSessions).signup = 0
	s.Sessions.(*fixtureSessions).account = 6
	if request(s, "POST", "/auth/login", body, "").Code != 429 {
		t.Fatal("login limit missing")
	}
	s.Sessions.(*fixtureSessions).failure = true
	if request(s, "POST", "/auth/signup", body, "").Code != 503 || request(s, "POST", "/auth/login", body, "").Code != 503 {
		t.Fatal("Redis outage did not fail closed")
	}
	token, _ := s.Tokens.Issue("owner", "fixture@example.invalid")
	if request(s, "GET", "/auth/me", "", token).Code != 503 {
		t.Fatal("revocation outage did not fail closed")
	}
	s.Sessions.(*fixtureSessions).failure = false
	s.Breach = fixtureBreach{offline: true}
	if request(s, "POST", "/auth/signup", body, "").Code != 503 {
		t.Fatal("HIBP outage accepted signup")
	}
	s.Breach = fixtureBreach{bad: true}
	if request(s, "POST", "/auth/signup", body, "").Code != 400 {
		t.Fatal("compromised password accepted")
	}
}
func TestProxyAndCredentialParity(t *testing.T) {
	s := fixture(t)
	r := httptest.NewRequest("POST", "/auth/login", nil)
	r.Header.Set("X-Forwarded-For", "198.51.100.1, 198.51.100.2")
	r.RemoteAddr = "192.0.2.99:12345"
	if s.ClientIP(r) != "192.0.2.99" {
		t.Fatal("untrusted proxy spoof accepted")
	}
	r.RemoteAddr = "192.0.2.10:12345"
	if s.ClientIP(r) != "198.51.100.2" {
		t.Fatal("trusted proxy chain changed")
	}
	if _, err := ParseProxies("192.0.2.0/24"); err == nil {
		t.Fatal("non-exact proxy accepted")
	}
	for _, password := range []string{strings.Repeat("🛟", 15), strings.Repeat("🛟", 128)} {
		if validate("fixture@example.invalid", password, true) != "" {
			t.Fatal("Unicode password length changed")
		}
	}
	if validate("fixture@example.invalid", strings.Repeat("🛟", 129), true) == "" {
		t.Fatal("password cap missing")
	}
	if rateKey("account", " Fixture@Example.invalid ") != rateKey("account", "fixture@example.invalid") {
		t.Fatal("rate namespace incompatible")
	}
}
func TestPasswordBoundsAndHIBPPrivacy(t *testing.T) {
	p := NewPasswords()
	p.slots <- struct{}{}
	p.slots <- struct{}{}
	if _, err := p.Hash("fixture"); !errors.Is(err, ErrBusy) {
		t.Fatal("unbounded hash concurrency")
	}
	<-p.slots
	<-p.slots
	if _, err := p.Verify("fixture", "$argon2id$v=19$m=4294967295,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$YWJjZGVmZ2hpamtsbW5vcA"); err == nil {
		t.Fatal("unbounded persisted hash memory")
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/range/5BAA6" || r.Header.Get("Add-Padding") != "true" {
			t.Error("HIBP request leaked more than prefix or omitted padding")
		}
		w.Write([]byte("1E4C9B93F3F0682250B6CF8331B7EE68FD8:12\r\n"))
	}))
	defer server.Close()
	h := NewHIBP()
	h.endpoint = server.URL
	bad, err := h.Compromised(context.Background(), "password")
	if err != nil || !bad {
		t.Fatal("range lookup failed")
	}
	if _, err := parseRange("malformed", "target"); err == nil {
		t.Fatal("invalid range data accepted")
	}
}

func TestReadsRustArgon2DefaultHash(t *testing.T) {
	// Generated independently with argon2 0.5.3 Argon2::default(), matching auth-rs.
	const fixture = "$argon2id$v=19$m=19456,t=2,p=1$cHVibGljLXRlc3Qtc2FsdA$wcIdazdJKFdJPNZeu2zxWZSsR+Y80K2rrt94ZCe4Oxg"
	jobs := NewPasswords()
	if valid, err := jobs.Verify("synthetic interoperability fixture", fixture); err != nil || !valid {
		t.Fatal("Rust password hash incompatible")
	}
	if valid, err := jobs.Verify("incorrect synthetic fixture", fixture); err != nil || valid {
		t.Fatal("incorrect legacy password accepted")
	}
}
