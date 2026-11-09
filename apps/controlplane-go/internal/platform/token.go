package platform

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Email       string `json:"email"`
	AuthVersion string `json:"auth_version,omitempty"`
	jwt.RegisteredClaims
}

type Tokens struct {
	Public                *rsa.PublicKey
	Private               *rsa.PrivateKey
	Issuer, Audience, Kid string
}

func NewTokens(publicPEM, privatePEM []byte, issuer, audience string) (*Tokens, error) {
	if strings.TrimSpace(issuer) == "" || strings.TrimSpace(audience) == "" {
		return nil, errors.New("JWT issuer and audience required")
	}
	key, err := jwt.ParseRSAPublicKeyFromPEM(publicPEM)
	if err != nil || key.N.BitLen() < 2048 {
		return nil, errors.New("invalid JWT public key")
	}
	t := &Tokens{Public: key, Issuer: issuer, Audience: audience}
	if len(privatePEM) != 0 {
		t.Private, err = jwt.ParseRSAPrivateKeyFromPEM(privatePEM)
		if err != nil || t.Private.PublicKey.N.Cmp(key.N) != 0 || t.Private.PublicKey.E != key.E {
			return nil, errors.New("JWT key pair does not match")
		}
	}
	jwk := t.JWK()
	canonical, _ := json.Marshal(map[string]string{"e": jwk["e"], "kty": "RSA", "n": jwk["n"]})
	digest := sha256.Sum256(canonical)
	t.Kid = base64.RawURLEncoding.EncodeToString(digest[:])
	return t, nil
}

func (t *Tokens) JWK() map[string]string {
	return map[string]string{"kty": "RSA", "use": "sig", "alg": "RS256", "kid": t.Kid,
		"n": base64.RawURLEncoding.EncodeToString(t.Public.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(t.Public.E)).Bytes())}
}

func RequestToken(r *http.Request) string {
	if value, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok && value != "" {
		return value
	}
	if cookie, err := r.Cookie("fh_access"); err == nil {
		return cookie.Value
	}
	return ""
}

func (t *Tokens) Verify(raw string) (*Claims, error) {
	if t == nil || t.Public == nil || len(raw) == 0 || len(raw) > 16384 {
		return nil, errors.New("invalid token")
	}
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (any, error) { return t.Public, nil },
		jwt.WithValidMethods([]string{"RS256"}), jwt.WithIssuer(t.Issuer), jwt.WithAudience(t.Audience),
		jwt.WithExpirationRequired(), jwt.WithLeeway(60*time.Second))
	if err != nil || strings.TrimSpace(claims.Subject) == "" {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (t *Tokens) Issue(userID, email string) (string, error) {
	return t.IssueVersion(userID, email, "")
}
func (t *Tokens) IssueVersion(userID, email, version string) (string, error) {
	if t.Private == nil {
		return "", errors.New("signing key unavailable")
	}
	now := time.Now()
	// Existing Rust consumers deserialize aud as a string. Avoid changing the
	// jwt package's global audience-marshalling setting across concurrent services.
	claims := jwt.MapClaims{"sub": userID, "email": email, "iss": t.Issuer,
		"aud": t.Audience, "jti": UUID(), "iat": now.Unix(), "exp": now.Add(time.Hour).Unix()}
	if version != "" {
		claims["auth_version"] = version
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = t.Kid
	return token.SignedString(t.Private)
}

func UUID() string {
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		panic("random source unavailable")
	}
	id[6] = (id[6] & 15) | 64
	id[8] = (id[8] & 63) | 128
	return fmt.Sprintf("%x-%x-%x-%x-%x", id[:4], id[4:6], id[6:8], id[8:10], id[10:])
}
