package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"forgeharbor/controlplane/internal/platform"
)

var ErrNotFound = errors.New("user not found")
var ErrConflict = errors.New("duplicate identity")

type User struct {
	UserID       string `bson:"user_id" json:"user_id"`
	Email        string `bson:"email" json:"email"`
	PasswordHash string `bson:"password_hash" json:"-"`
	CreatedAt    string `bson:"created_at" json:"-"`
}
type Users interface {
	Find(context.Context, string) (User, error)
	Create(context.Context, User) error
}
type Sessions interface {
	SignupAttempt(context.Context, string) (int64, int64, error)
	LoginAttempt(context.Context, string, string) (int64, int64, int64, error)
	ClearAccount(context.Context, string) error
	Revoke(context.Context, string, time.Duration) error
	Revoked(context.Context, string) (bool, error)
}

type Service struct {
	Users          Users
	Sessions       Sessions
	Tokens         *platform.Tokens
	Passwords      *Passwords
	Breach         BreachChecker
	CookieSecure   bool
	TrustedProxies map[netip.Addr]bool
	MFA            *MFA
}

func ParseProxies(value string) (map[netip.Addr]bool, error) {
	result := map[netip.Addr]bool{}
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		ip, err := netip.ParseAddr(item)
		if err != nil {
			return nil, errors.New("invalid trusted proxy IP")
		}
		result[ip.Unmap()] = true
	}
	return result, nil
}

func (s *Service) ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return "unknown"
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return "unknown"
	}
	peer = peer.Unmap()
	if s.TrustedProxies[peer] {
		values := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		for i := len(values) - 1; i >= 0; i-- {
			if ip, err := netip.ParseAddr(strings.TrimSpace(values[i])); err == nil {
				return ip.Unmap().String()
			}
		}
	}
	return peer.String()
}

func (s *Service) Handler(origins []string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /auth/health", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("Service is Healthy!")) })
	mux.HandleFunc("GET /auth/jwks", func(w http.ResponseWriter, r *http.Request) {
		platform.JSON(w, 200, map[string]any{"keys": []any{s.Tokens.JWK()}})
	})
	mux.HandleFunc("POST /auth/signup", s.signup)
	mux.HandleFunc("POST /auth/login", s.login)
	mux.HandleFunc("POST /auth/logout", s.logout)
	mux.HandleFunc("GET /auth/me", s.me)
	mux.HandleFunc("GET /auth/mfa", s.mfaStatus)
	mux.HandleFunc("POST /auth/mfa/setup", s.mfaSetup)
	mux.HandleFunc("POST /auth/mfa/enable", s.mfaEnable)
	mux.HandleFunc("POST /auth/mfa/verify", s.mfaVerify)
	mux.HandleFunc("POST /auth/mfa/disable", s.mfaDisable)
	return platform.CORS(mux, origins)
}

type credentials struct {
	Email    *string `json:"email"`
	Password *string `json:"password"`
}

// Serde's field names are case-sensitive and duplicate required fields are errors.
func (c *credentials) UnmarshalJSON(body []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	start, err := decoder.Token()
	if err != nil || start != json.Delim('{') {
		return errors.New("credentials must be an object")
	}
	seen := map[string]bool{}
	for decoder.More() {
		key, err := decoder.Token()
		if err != nil {
			return err
		}
		name, ok := key.(string)
		if !ok {
			return errors.New("invalid field")
		}
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			return err
		}
		if name != "email" && name != "password" {
			continue
		}
		if seen[name] {
			return errors.New("duplicate credential field")
		}
		seen[name] = true
		var value *string
		if err := json.Unmarshal(raw, &value); err != nil {
			return err
		}
		if name == "email" {
			c.Email = value
		} else {
			c.Password = value
		}
	}
	_, err = decoder.Token()
	return err
}

func input(w http.ResponseWriter, r *http.Request, signup bool) (string, string, bool) {
	var req credentials
	if !platform.Decode(w, r, &req) {
		return "", "", false
	}
	if req.Email == nil || req.Password == nil {
		platform.Error(w, 400, "Invalid JSON request")
		return "", "", false
	}
	if message := validate(*req.Email, *req.Password, signup); message != "" {
		platform.Error(w, 400, message)
		return "", "", false
	}
	return strings.ToLower(*req.Email), *req.Password, true
}
func retry(w http.ResponseWriter, status int, seconds int64, message string) {
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.FormatInt(seconds, 10))
	platform.Error(w, status, message)
}
func (s *Service) passwordError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrBusy) {
		retry(w, 503, 1, "Authentication is busy. Try again shortly.")
	} else {
		platform.Error(w, 500, "Internal authentication error")
	}
}
func (s *Service) signup(w http.ResponseWriter, r *http.Request) {
	email, password, ok := input(w, r, true)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	count, ttl, err := s.Sessions.SignupAttempt(ctx, s.ClientIP(r))
	if err != nil {
		platform.Error(w, 503, "Registration temporarily unavailable")
		return
	}
	if count > 20 {
		retry(w, 429, ttl, "Too many registration attempts. Try again later.")
		return
	}
	_, err = s.Users.Find(ctx, email)
	if err == nil {
		platform.Error(w, 409, "User with this email already exists")
		return
	}
	if !errors.Is(err, ErrNotFound) {
		platform.Error(w, 500, "Database error")
		return
	}
	compromised, err := s.Breach.Compromised(ctx, password)
	if err != nil {
		retry(w, 503, 30, "Registration temporarily unavailable")
		return
	}
	if compromised {
		platform.Error(w, 400, "Choose a password that has not appeared in known data breaches.")
		return
	}
	hash, err := s.Passwords.Hash(password)
	if err != nil {
		s.passwordError(w, err)
		return
	}
	user := User{UserID: platform.UUID(), Email: email, PasswordHash: hash, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	if err = s.Users.Create(ctx, user); errors.Is(err, ErrConflict) {
		platform.Error(w, 409, "User with this email already exists")
		return
	} else if err != nil {
		platform.Error(w, 500, "Failed to create user")
		return
	}
	platform.JSON(w, 201, user)
}
func (s *Service) login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	email, password, ok := input(w, r, false)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	account, ip, ttl, err := s.Sessions.LoginAttempt(ctx, email, s.ClientIP(r))
	if err != nil {
		platform.Error(w, 503, "Authentication temporarily unavailable")
		return
	}
	if account > 5 || ip > 60 {
		retry(w, 429, ttl, "Too many login attempts. Try again later.")
		return
	}
	user, err := s.Users.Find(ctx, email)
	if errors.Is(err, ErrNotFound) {
		platform.Error(w, 401, "Invalid email or password")
		return
	} else if err != nil {
		platform.Error(w, 500, "Database error")
		return
	}
	valid, err := s.Passwords.Verify(password, user.PasswordHash)
	if err != nil {
		s.passwordError(w, err)
		return
	}
	if !valid {
		platform.Error(w, 401, "Invalid email or password")
		return
	}
	state := MFAState{}
	if s.MFA != nil {
		state, err = s.MFA.States.Load(ctx, user.UserID)
		if err != nil {
			retry(w, 503, 1, "Authentication temporarily unavailable")
			return
		}
		if state.Enabled {
			s.cookie(w, "", 0)
			if !s.MFA.available() {
				retry(w, 503, 30, "Two-step verification temporarily unavailable")
				return
			}
			challenge, err := s.MFA.Challenges.Create(ctx, "login", MFAChallenge{UserID: user.UserID, Email: user.Email, Version: state.Version})
			if err != nil {
				retry(w, 503, 1, "Authentication temporarily unavailable")
				return
			}
			platform.JSON(w, 200, map[string]any{"mfa_required": true, "challenge_token": challenge, "expires_in": 300})
			return
		}
	}
	s.finishLogin(w, r, user.UserID, user.Email, state.Version)
}
func (s *Service) cookie(w http.ResponseWriter, token string, seconds int) {
	// net/http encodes a deletion with MaxAge=-1 as Max-Age=0.
	if seconds == 0 {
		seconds = -1
	}
	http.SetCookie(w, &http.Cookie{Name: "fh_access", Value: token, Path: "/", MaxAge: seconds, HttpOnly: true, Secure: s.CookieSecure, SameSite: http.SameSiteStrictMode})
}
func (s *Service) logout(w http.ResponseWriter, r *http.Request) {
	s.cookie(w, "", 0)
	if claims, err := s.Tokens.Verify(platform.RequestToken(r)); err == nil && claims.ID != "" {
		// Retain revocation through JWT validation's clock-skew allowance.
		ttl := time.Until(claims.ExpiresAt.Time.Add(60 * time.Second))
		if ttl > 0 {
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel()
			if err = s.Sessions.Revoke(ctx, claims.ID, ttl); err != nil {
				retry(w, 503, 1, "Logout temporarily unavailable")
				return
			}
		}
	}
	w.WriteHeader(204)
}
func (s *Service) me(w http.ResponseWriter, r *http.Request) {
	claims, _, ok := s.authenticated(w, r)
	if !ok {
		return
	}
	platform.JSON(w, 200, map[string]string{"user_id": claims.Subject, "email": claims.Email})
}
func (s *Service) authenticated(w http.ResponseWriter, r *http.Request) (*platform.Claims, MFAState, bool) {
	w.Header().Set("Cache-Control", "no-store")
	raw := platform.RequestToken(r)
	if raw == "" {
		platform.Error(w, 401, "Authentication required")
		return nil, MFAState{}, false
	}
	claims, err := s.Tokens.Verify(raw)
	if err != nil || claims.Email == "" {
		platform.Error(w, 401, "Invalid token")
		return nil, MFAState{}, false
	}
	if claims.ID != "" {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		revoked, err := s.Sessions.Revoked(ctx, claims.ID)
		if err != nil {
			retry(w, 503, 1, "Authentication temporarily unavailable")
			return nil, MFAState{}, false
		}
		if revoked {
			platform.Error(w, 401, "Invalid token")
			return nil, MFAState{}, false
		}
	}
	state := MFAState{}
	if s.MFA != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		state, err = s.MFA.States.Load(ctx, claims.Subject)
		if err != nil {
			retry(w, 503, 1, "Authentication temporarily unavailable")
			return nil, state, false
		}
		if state.Version != claims.AuthVersion {
			platform.Error(w, 401, "Sign in again to verify your account")
			return nil, state, false
		}
	}
	return claims, state, true
}
