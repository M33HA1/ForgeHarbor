package auth

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

var ErrVerification = errors.New("verification invalid or expired")

type MFAState struct {
	Enabled  bool     `bson:"enabled"`
	Version  string   `bson:"version"`
	Cipher   string   `bson:"cipher,omitempty"`
	LastStep int64    `bson:"last_step"`
	Recovery []string `bson:"recovery_hashes,omitempty"`
}
type MFAStates interface {
	Load(context.Context, string) (MFAState, error)
	Enable(context.Context, string, string, MFAState) (bool, error)
	Consume(context.Context, string, string, int64, string) (bool, error)
	Disable(context.Context, string, string, string) (bool, error)
}
type MFAChallenge struct {
	SessionID string `json:"session_id,omitempty"`
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Version   string `json:"version"`
	Cipher    string `json:"cipher,omitempty"`
}
type MFAChallenges interface {
	Create(context.Context, string, MFAChallenge) (string, error)
	Attempt(context.Context, string, string) (MFAChallenge, error)
	Take(context.Context, string, string, MFAChallenge) (bool, error)
}
type MFA struct {
	States     MFAStates
	Challenges MFAChallenges
	box        cipher.AEAD
	now        func() time.Time
}

func NewMFA(states MFAStates, challenges MFAChallenges, key []byte) (*MFA, error) {
	m := &MFA{States: states, Challenges: challenges, now: time.Now}
	if len(key) == 0 {
		return m, nil
	}
	if len(key) != 32 {
		return nil, errors.New("MFA encryption key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	m.box, err = cipher.NewGCM(block)
	return m, err
}
func (m *MFA) available() bool { return m != nil && m.box != nil }
func (m *MFA) seal(user, secret string) (string, error) {
	if !m.available() {
		return "", errors.New("MFA unavailable")
	}
	nonce := make([]byte, m.box.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := m.box.Seal(nonce, nonce, []byte(secret), []byte("forgeharbor:mfa:v1:"+user))
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}
func (m *MFA) open(user, sealed string) (string, error) {
	if !m.available() {
		return "", errors.New("MFA unavailable")
	}
	data, err := base64.RawURLEncoding.DecodeString(sealed)
	if err != nil || len(data) < m.box.NonceSize() {
		return "", errors.New("invalid MFA state")
	}
	plain, err := m.box.Open(nil, data[:m.box.NonceSize()], data[m.box.NonceSize():], []byte("forgeharbor:mfa:v1:"+user))
	return string(plain), err
}
func (m *MFA) step(secret, code string, last int64) (int64, bool) {
	if len(code) != 6 {
		return 0, false
	}
	for _, digit := range code {
		if digit < '0' || digit > '9' {
			return 0, false
		}
	}
	current := m.now().Unix() / 30
	matched := int64(-1)
	for offset := int64(-1); offset <= 1; offset++ {
		step := current + offset
		candidate, err := totp.GenerateCodeCustom(secret, time.Unix(step*30, 0), totp.ValidateOpts{Period: 30, Digits: otp.DigitsSix, Algorithm: otp.AlgorithmSHA1})
		if err == nil && subtle.ConstantTimeCompare([]byte(candidate), []byte(code)) == 1 && step > last {
			matched = step
		}
	}
	return matched, matched >= 0
}
func normalizeRecovery(code string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))
}
func recoveryHash(user, code string) string {
	sum := sha256.Sum256([]byte(user + "\x00" + normalizeRecovery(code)))
	return hex.EncodeToString(sum[:])
}
func recoveryCodes(user string) ([]string, []string, error) {
	codes, hashes := make([]string, 10), make([]string, 10)
	for i := range codes {
		data := make([]byte, 16)
		if _, err := rand.Read(data); err != nil {
			return nil, nil, err
		}
		raw := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(data)
		parts := []string{}
		for len(raw) > 4 {
			parts = append(parts, raw[:4])
			raw = raw[4:]
		}
		parts = append(parts, raw)
		codes[i] = strings.Join(parts, "-")
		hashes[i] = recoveryHash(user, codes[i])
	}
	return codes, hashes, nil
}
func (m *MFA) proof(user string, state MFAState, code string) (int64, string, bool, error) {
	if !m.available() {
		return 0, "", false, errors.New("MFA unavailable")
	}
	normalized := normalizeRecovery(code)
	if len(normalized) == 26 {
		hash := recoveryHash(user, normalized)
		valid := 0
		for _, candidate := range state.Recovery {
			valid |= subtle.ConstantTimeCompare([]byte(candidate), []byte(hash))
		}
		return 0, hash, valid == 1, nil
	}
	secret, err := m.open(user, state.Cipher)
	if err != nil {
		return 0, "", false, err
	}
	step, valid := m.step(secret, strings.TrimSpace(code), state.LastStep)
	return step, "", valid, nil
}
