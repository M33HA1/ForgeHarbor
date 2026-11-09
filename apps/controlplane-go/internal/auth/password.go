package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

var ErrBusy = errors.New("password capacity busy")

// Rust argon2::Argon2::default(): Argon2id v19, m=19456 KiB, t=2, p=1.
type Passwords struct{ slots chan struct{} }

func NewPasswords() *Passwords { return &Passwords{slots: make(chan struct{}, 2)} }
func (p *Passwords) run(work func() (string, bool, error)) (string, bool, error) {
	select {
	case p.slots <- struct{}{}:
	default:
		return "", false, ErrBusy
	}
	defer func() { <-p.slots }()
	// Run synchronously: cancellation cannot release a slot while hashing continues.
	return work()
}
func (p *Passwords) Hash(password string) (string, error) {
	hash, _, err := p.run(func() (string, bool, error) {
		salt := make([]byte, 16)
		if _, err := rand.Read(salt); err != nil {
			return "", false, err
		}
		key := argon2.IDKey([]byte(password), salt, 2, 19456, 1, 32)
		return fmt.Sprintf("$argon2id$v=19$m=19456,t=2,p=1$%s$%s", base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), true, nil
	})
	return hash, err
}
func (p *Passwords) Verify(password, encoded string) (bool, error) {
	_, ok, err := p.run(func() (string, bool, error) {
		parts := strings.Split(encoded, "$")
		if len(parts) != 6 || parts[1] != "argon2id" || parts[2] != "v=19" {
			return "", false, errors.New("invalid stored password hash")
		}
		var memory, iterations uint32
		var threads uint8
		if n, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &threads); err != nil || n != 3 || memory < 8*uint32(threads) || memory > 262144 || iterations < 1 || iterations > 10 || threads < 1 || threads > 16 {
			return "", false, errors.New("invalid hash parameters")
		}
		salt, err := base64.RawStdEncoding.DecodeString(parts[4])
		if err != nil || len(salt) < 8 || len(salt) > 64 {
			return "", false, errors.New("invalid hash salt")
		}
		want, err := base64.RawStdEncoding.DecodeString(parts[5])
		if err != nil || len(want) < 16 || len(want) > 64 {
			return "", false, errors.New("invalid hash key")
		}
		got := argon2.IDKey([]byte(password), salt, iterations, memory, threads, uint32(len(want)))
		return "", subtle.ConstantTimeCompare(got, want) == 1, nil
	})
	return ok, err
}
