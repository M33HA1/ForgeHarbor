package auth

import (
	"context"
	"errors"
	"net/http"
	"time"

	"forgeharbor/controlplane/internal/platform"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

func (s *Service) sessionCookie(w http.ResponseWriter, user, email, version string) bool {
	token, err := s.Tokens.IssueVersion(user, email, version)
	if err != nil {
		platform.Error(w, 500, "Token generation failed")
		return false
	}
	s.cookie(w, token, 3600)
	return true
}
func (s *Service) finishLogin(w http.ResponseWriter, r *http.Request, user, email, version string) {
	if !s.sessionCookie(w, user, email, version) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	_ = s.Sessions.ClearAccount(ctx, email)
	platform.JSON(w, 200, map[string]int{"expires_in": 3600})
}
func (s *Service) mfaStatus(w http.ResponseWriter, r *http.Request) {
	_, state, ok := s.authenticated(w, r)
	if !ok {
		return
	}
	platform.JSON(w, 200, map[string]any{"enabled": state.Enabled, "available": s.MFA.available(), "recovery_codes_remaining": len(state.Recovery)})
}
func (s *Service) reauthenticate(w http.ResponseWriter, r *http.Request, claims *platform.Claims, password string) bool {
	if validate(claims.Email, password, false) != "" {
		platform.Error(w, 400, "Invalid password input")
		return false
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	account, ip, ttl, err := s.Sessions.LoginAttempt(ctx, claims.Email, s.ClientIP(r))
	if err != nil {
		retry(w, 503, 1, "Authentication temporarily unavailable")
		return false
	}
	if account > 5 || ip > 60 {
		retry(w, 429, ttl, "Too many verification attempts. Try again later.")
		return false
	}
	user, err := s.Users.Find(ctx, claims.Email)
	if err != nil || user.UserID != claims.Subject {
		platform.Error(w, 401, "Password confirmation failed")
		return false
	}
	valid, err := s.Passwords.Verify(password, user.PasswordHash)
	if err != nil {
		s.passwordError(w, err)
		return false
	}
	if !valid {
		platform.Error(w, 401, "Password confirmation failed")
		return false
	}
	return true
}
func (s *Service) mfaSetup(w http.ResponseWriter, r *http.Request) {
	claims, state, ok := s.authenticated(w, r)
	if !ok {
		return
	}
	if !s.MFA.available() {
		retry(w, 503, 30, "Two-step verification temporarily unavailable")
		return
	}
	if state.Enabled {
		platform.Error(w, 409, "Two-step verification is already enabled")
		return
	}
	if claims.ID == "" {
		platform.Error(w, 401, "Sign in again to change two-step verification")
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if !platform.Decode(w, r, &req) || !s.reauthenticate(w, r, claims, req.Password) {
		return
	}
	key, err := totp.Generate(totp.GenerateOpts{Issuer: "ForgeHarbor", AccountName: claims.Email, Period: 30, SecretSize: 20, Digits: otp.DigitsSix, Algorithm: otp.AlgorithmSHA1})
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	sealed, err := s.MFA.seal(claims.Subject, key.Secret())
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	token, err := s.MFA.Challenges.Create(ctx, "enroll", MFAChallenge{SessionID: claims.ID, UserID: claims.Subject, Email: claims.Email, Version: state.Version, Cipher: sealed})
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	platform.JSON(w, 200, map[string]any{"secret": key.Secret(), "otpauth_uri": key.URL(), "enrollment_token": token, "expires_in": 300})
}
func (s *Service) mfaEnable(w http.ResponseWriter, r *http.Request) {
	claims, state, ok := s.authenticated(w, r)
	if !ok {
		return
	}
	if !s.MFA.available() {
		retry(w, 503, 30, "Two-step verification temporarily unavailable")
		return
	}
	if state.Enabled {
		platform.Error(w, 409, "Two-step verification is already enabled")
		return
	}
	var req struct {
		Token string `json:"enrollment_token"`
		Code  string `json:"code"`
	}
	if !platform.Decode(w, r, &req) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	pending, err := s.MFA.Challenges.Attempt(ctx, "enroll", req.Token)
	if err != nil {
		s.challengeError(w, err)
		return
	}
	if pending.UserID != claims.Subject || pending.SessionID != claims.ID || pending.Version != state.Version {
		platform.Error(w, 401, "Verification invalid or expired")
		return
	}
	secret, err := s.MFA.open(claims.Subject, pending.Cipher)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	step, valid := s.MFA.step(secret, req.Code, -1)
	if !valid {
		platform.Error(w, 401, "Verification code invalid or expired")
		return
	}
	codes, hashes, err := recoveryCodes(claims.Subject)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	taken, err := s.MFA.Challenges.Take(ctx, "enroll", req.Token, pending)
	if err != nil {
		s.challengeError(w, err)
		return
	}
	if !taken {
		platform.Error(w, 401, "Verification invalid or expired")
		return
	}
	next := MFAState{Enabled: true, Version: platform.UUID(), Cipher: pending.Cipher, LastStep: step, Recovery: hashes}
	changed, err := s.MFA.States.Enable(ctx, claims.Subject, state.Version, next)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	if !changed {
		platform.Error(w, 409, "Two-step settings changed. Start again.")
		return
	}
	if !s.sessionCookie(w, claims.Subject, claims.Email, next.Version) {
		return
	}
	platform.JSON(w, 200, map[string]any{"enabled": true, "recovery_codes": codes})
}
func (s *Service) challengeError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrVerification) {
		platform.Error(w, 401, "Verification invalid or expired")
	} else {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
	}
}
func (s *Service) mfaVerify(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !s.MFA.available() {
		retry(w, 503, 30, "Two-step verification temporarily unavailable")
		return
	}
	var req struct {
		Token string `json:"challenge_token"`
		Code  string `json:"code"`
	}
	if !platform.Decode(w, r, &req) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	pending, err := s.MFA.Challenges.Attempt(ctx, "login", req.Token)
	if err != nil {
		s.challengeError(w, err)
		return
	}
	state, err := s.MFA.States.Load(ctx, pending.UserID)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	if !state.Enabled || state.Version != pending.Version {
		platform.Error(w, 401, "Verification invalid or expired")
		return
	}
	step, hash, valid, err := s.MFA.proof(pending.UserID, state, req.Code)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	if !valid {
		platform.Error(w, 401, "Verification code invalid or expired")
		return
	}
	taken, err := s.MFA.Challenges.Take(ctx, "login", req.Token, pending)
	if err != nil {
		s.challengeError(w, err)
		return
	}
	if !taken {
		platform.Error(w, 401, "Verification invalid or expired")
		return
	}
	used, err := s.MFA.States.Consume(ctx, pending.UserID, state.Version, step, hash)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	if !used {
		platform.Error(w, 401, "Verification code already used or settings changed")
		return
	}
	s.finishLogin(w, r, pending.UserID, pending.Email, state.Version)
}
func (s *Service) mfaDisable(w http.ResponseWriter, r *http.Request) {
	claims, state, ok := s.authenticated(w, r)
	if !ok {
		return
	}
	if !s.MFA.available() {
		retry(w, 503, 30, "Two-step verification temporarily unavailable")
		return
	}
	if !state.Enabled {
		platform.Error(w, 409, "Two-step verification is not enabled")
		return
	}
	var req struct {
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if !platform.Decode(w, r, &req) || !s.reauthenticate(w, r, claims, req.Password) {
		return
	}
	step, hash, valid, err := s.MFA.proof(claims.Subject, state, req.Code)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	if !valid {
		platform.Error(w, 401, "Verification code invalid or expired")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	used, err := s.MFA.States.Consume(ctx, claims.Subject, state.Version, step, hash)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	if !used {
		platform.Error(w, 401, "Verification code already used")
		return
	}
	next := platform.UUID()
	changed, err := s.MFA.States.Disable(ctx, claims.Subject, state.Version, next)
	if err != nil {
		retry(w, 503, 1, "Two-step verification temporarily unavailable")
		return
	}
	if !changed {
		platform.Error(w, 409, "Two-step settings changed. Sign in again.")
		return
	}
	if !s.sessionCookie(w, claims.Subject, claims.Email, next) {
		return
	}
	platform.JSON(w, 200, map[string]bool{"enabled": false})
}
