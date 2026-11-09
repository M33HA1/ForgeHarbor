package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
)

type memoryMFAStates struct {
	state   MFAState
	offline bool
}

func (m *memoryMFAStates) Load(context.Context, string) (MFAState, error) {
	if m.offline {
		return MFAState{}, errors.New("offline")
	}
	return m.state, nil
}
func (m *memoryMFAStates) Enable(_ context.Context, _ string, v string, s MFAState) (bool, error) {
	if m.state.Enabled || m.state.Version != v {
		return false, nil
	}
	m.state = s
	return true, nil
}
func (m *memoryMFAStates) Consume(_ context.Context, _, v string, step int64, hash string) (bool, error) {
	if !m.state.Enabled || m.state.Version != v {
		return false, nil
	}
	if hash != "" {
		for i, h := range m.state.Recovery {
			if h == hash {
				m.state.Recovery = append(m.state.Recovery[:i], m.state.Recovery[i+1:]...)
				return true, nil
			}
		}
		return false, nil
	}
	if step <= m.state.LastStep {
		return false, nil
	}
	m.state.LastStep = step
	return true, nil
}
func (m *memoryMFAStates) Disable(_ context.Context, _, v, next string) (bool, error) {
	if !m.state.Enabled || m.state.Version != v {
		return false, nil
	}
	m.state = MFAState{Version: next}
	return true, nil
}

type memoryMFAChallenges struct {
	items   map[string]MFAChallenge
	counts  map[string]int
	expired bool
	seq     int
}

func (m *memoryMFAChallenges) Create(_ context.Context, p string, c MFAChallenge) (string, error) {
	m.seq++
	key := strings.Repeat("t", 42) + string(rune('A'+m.seq))
	m.items[p+key] = c
	return key, nil
}
func (m *memoryMFAChallenges) Attempt(_ context.Context, p, key string) (MFAChallenge, error) {
	m.counts[p+key]++
	c, ok := m.items[p+key]
	if !ok || m.expired || m.counts[p+key] > 5 {
		return MFAChallenge{}, ErrVerification
	}
	return c, nil
}
func (m *memoryMFAChallenges) Take(_ context.Context, p, key string, c MFAChallenge) (bool, error) {
	v, ok := m.items[p+key]
	if !ok || m.expired || v != c {
		return false, nil
	}
	delete(m.items, p+key)
	return true, nil
}
func mfaFixture(t *testing.T) (*Service, *memoryMFAStates, *memoryMFAChallenges, string, string) {
	t.Helper()
	s := fixture(t)
	states := &memoryMFAStates{}
	challenges := &memoryMFAChallenges{items: map[string]MFAChallenge{}, counts: map[string]int{}}
	var err error
	s.MFA, err = NewMFA(states, challenges, []byte(strings.Repeat("k", 32)))
	if err != nil {
		t.Fatal(err)
	}
	s.MFA.now = func() time.Time { return time.Unix(1800000000, 0) }
	body := `{"email":"mfa@example.invalid","password":"synthetic fixture passphrase"}`
	if request(s, "POST", "/auth/signup", body, "").Code != 201 {
		t.Fatal("signup failed")
	}
	w := request(s, "POST", "/auth/login", body, "")
	if w.Code != 200 {
		t.Fatal("login failed")
	}
	return s, states, challenges, w.Result().Cookies()[0].Value, body
}
func jsonBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var data map[string]any
	if json.Unmarshal(w.Body.Bytes(), &data) != nil {
		t.Fatal("invalid JSON")
	}
	return data
}
func encodeBody(v any) string { data, _ := json.Marshal(v); return string(data) }
func enrollMFA(t *testing.T, s *Service, token string) (string, []string) {
	t.Helper()
	w := request(s, "POST", "/auth/mfa/setup", `{"password":"synthetic fixture passphrase"}`, token)
	if w.Code != 200 {
		t.Fatalf("setup %d", w.Code)
	}
	data := jsonBody(t, w)
	code, _ := totp.GenerateCode(data["secret"].(string), s.MFA.now())
	w = request(s, "POST", "/auth/mfa/enable", encodeBody(map[string]any{"enrollment_token": data["enrollment_token"], "code": code}), token)
	if w.Code != 200 {
		t.Fatalf("enable %d", w.Code)
	}
	result := jsonBody(t, w)
	codes := []string{}
	for _, v := range result["recovery_codes"].([]any) {
		codes = append(codes, v.(string))
	}
	return w.Result().Cookies()[0].Value, codes
}
func TestMFALifecycleAndNoPasswordOnlySession(t *testing.T) {
	s, states, _, old, body := mfaFixture(t)
	session, codes := enrollMFA(t, s, old)
	if len(codes) != 10 || len(states.state.Recovery) != 10 || strings.Contains(states.state.Cipher, "otpauth") {
		t.Fatal("invalid protected state")
	}
	if request(s, "GET", "/auth/me", "", old).Code != 401 || request(s, "GET", "/auth/me", "", session).Code != 200 {
		t.Fatal("enrollment session invalidation failed")
	}
	w := request(s, "POST", "/auth/login", body, "")
	data := jsonBody(t, w)
	if w.Code != 200 || data["mfa_required"] != true || data["access_token"] != nil || len(w.Result().Cookies()) != 1 || w.Result().Cookies()[0].Value != "" {
		t.Fatal("password issued access")
	}
	pending := data["challenge_token"].(string)
	if request(s, "GET", "/auth/me", "", pending).Code != 401 {
		t.Fatal("challenge accepted as session")
	}
	verify := func(token, code string) *httptest.ResponseRecorder {
		return request(s, "POST", "/auth/mfa/verify", encodeBody(map[string]string{"challenge_token": token, "code": code}), "")
	}
	if verify(pending, "bad").Code != 401 {
		t.Fatal("invalid proof accepted")
	}
	w = verify(pending, codes[0])
	if w.Code != 200 || len(w.Result().Cookies()) != 1 {
		t.Fatal("recovery login failed")
	}
	signed := w.Result().Cookies()[0].Value
	if verify(pending, codes[1]).Code != 401 {
		t.Fatal("challenge replay accepted")
	}
	next := jsonBody(t, request(s, "POST", "/auth/login", body, ""))["challenge_token"].(string)
	if verify(next, codes[0]).Code != 401 {
		t.Fatal("recovery replay accepted")
	}
	if request(s, "POST", "/auth/mfa/disable", `{"password":"wrong","code":"bad"}`, signed).Code != 401 {
		t.Fatal("disable without password")
	}
	w = request(s, "POST", "/auth/mfa/disable", encodeBody(map[string]string{"password": "synthetic fixture passphrase", "code": codes[1]}), signed)
	if w.Code != 200 || states.state.Enabled || states.state.Cipher != "" || len(states.state.Recovery) != 0 {
		t.Fatal("disable failed")
	}
	if request(s, "GET", "/auth/me", "", signed).Code != 401 || request(s, "GET", "/auth/me", "", session).Code != 401 {
		t.Fatal("disable retained old sessions")
	}
	if request(s, "GET", "/auth/me", "", w.Result().Cookies()[0].Value).Code != 200 {
		t.Fatal("replacement session invalid")
	}
	w = request(s, "POST", "/auth/login", body, "")
	if jsonBody(t, w)["mfa_required"] != nil || request(s, "GET", "/auth/me", "", w.Result().Cookies()[0].Value).Code != 200 {
		t.Fatal("disabled account cannot login")
	}
}
func TestMFAExpiryAttemptsSessionBindingAndOutages(t *testing.T) {
	s, states, challenges, token, body := mfaFixture(t)
	setup := jsonBody(t, request(s, "POST", "/auth/mfa/setup", `{"password":"synthetic fixture passphrase"}`, token))
	other, _ := s.Tokens.Issue("other", "mfa@example.invalid")
	code, _ := totp.GenerateCode(setup["secret"].(string), s.MFA.now())
	payload := encodeBody(map[string]any{"enrollment_token": setup["enrollment_token"], "code": code})
	if request(s, "POST", "/auth/mfa/enable", payload, other).Code != 401 {
		t.Fatal("cross-user enrollment")
	}
	claims, _ := s.Tokens.Verify(token)
	second, _ := s.Tokens.Issue(claims.Subject, claims.Email)
	if request(s, "POST", "/auth/mfa/enable", payload, second).Code != 401 {
		t.Fatal("cross-session enrollment")
	}
	challenges.expired = true
	if request(s, "POST", "/auth/mfa/enable", payload, token).Code != 401 {
		t.Fatal("expired enrollment")
	}
	challenges.expired = false
	_, codes := enrollMFA(t, s, token)
	pending := jsonBody(t, request(s, "POST", "/auth/login", body, ""))["challenge_token"].(string)
	for i := 0; i < 5; i++ {
		if request(s, "POST", "/auth/mfa/verify", encodeBody(map[string]string{"challenge_token": pending, "code": "bad"}), "").Code != 401 {
			t.Fatal("invalid proof")
		}
	}
	if request(s, "POST", "/auth/mfa/verify", encodeBody(map[string]string{"challenge_token": pending, "code": codes[0]}), "").Code != 401 {
		t.Fatal("attempt budget bypass")
	}
	pending = jsonBody(t, request(s, "POST", "/auth/login", body, ""))["challenge_token"].(string)
	challenges.expired = true
	if request(s, "POST", "/auth/mfa/verify", encodeBody(map[string]string{"challenge_token": pending, "code": codes[0]}), "").Code != 401 {
		t.Fatal("expired login accepted")
	}
	challenges.expired = false
	s.MFA.box = nil
	if request(s, "POST", "/auth/login", body, "").Code != 503 {
		t.Fatal("missing key bypass")
	}
	states.offline = true
	if request(s, "POST", "/auth/login", body, "").Code != 503 {
		t.Fatal("state outage bypass")
	}
}
func TestMFACryptographyAndTOTPReplayWindow(t *testing.T) {
	s, _, _, _, _ := mfaFixture(t)
	key, err := totp.Generate(totp.GenerateOpts{Issuer: "Fixture", AccountName: "fixture@example.invalid"})
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := s.MFA.seal("owner", key.Secret())
	if err != nil || sealed == key.Secret() {
		t.Fatal("secret not sealed")
	}
	if _, err = s.MFA.open("other", sealed); err == nil {
		t.Fatal("cipher not owner-bound")
	}
	if _, err = NewMFA(nil, nil, []byte("bad")); err == nil {
		t.Fatal("invalid encryption key accepted")
	}
	now := s.MFA.now()
	code, _ := totp.GenerateCode(key.Secret(), now)
	step, ok := s.MFA.step(key.Secret(), code, -1)
	if !ok {
		t.Fatal("current code rejected")
	}
	if _, ok = s.MFA.step(key.Secret(), code, step); ok {
		t.Fatal("TOTP replay")
	}
	for _, offset := range []time.Duration{-30 * time.Second, 30 * time.Second} {
		v, _ := totp.GenerateCode(key.Secret(), now.Add(offset))
		if _, ok = s.MFA.step(key.Secret(), v, -1); !ok {
			t.Fatal("clock skew rejected")
		}
	}
	old, _ := totp.GenerateCode(key.Secret(), now.Add(-120*time.Second))
	if _, ok = s.MFA.step(key.Secret(), old, -1); ok {
		t.Fatal("expired code")
	}
	for _, value := range []string{"12345", "1234567", "abcdef", "１２３４５６"} {
		if _, ok = s.MFA.step(key.Secret(), value, -1); ok {
			t.Fatal("invalid code format")
		}
	}
}

func TestMFATOTPLoginReplayAndCorruptSeedFailClosed(t *testing.T) {
	s, states, _, token, body := mfaFixture(t)
	enrollMFA(t, s, token)
	claims, _ := s.Tokens.Verify(token)
	secret, err := s.MFA.open(claims.Subject, states.state.Cipher)
	if err != nil {
		t.Fatal("seed decryption")
	}
	now := s.MFA.now().Add(30 * time.Second)
	s.MFA.now = func() time.Time { return now }
	code, _ := totp.GenerateCode(secret, now)
	login := func() string {
		w := request(s, "POST", "/auth/login", body, "")
		if w.Code != 200 {
			t.Fatal("password login")
		}
		return jsonBody(t, w)["challenge_token"].(string)
	}
	proof := func(pending string) *httptest.ResponseRecorder {
		return request(s, "POST", "/auth/mfa/verify", encodeBody(map[string]string{"challenge_token": pending, "code": code}), "")
	}
	if w := proof(login()); w.Code != 200 || w.Result().Cookies()[0].Value == "" {
		t.Fatal("valid TOTP login rejected")
	}
	if proof(login()).Code != 401 {
		t.Fatal("TOTP replay on new challenge")
	}
	pending := login()
	states.state.Cipher = "corrupted"
	if proof(pending).Code != 503 {
		t.Fatal("corrupt ciphertext did not fail closed")
	}
}
