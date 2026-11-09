package platform

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestTokensFailClosedAndPreserveSessionContract(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	public, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
	tokens, err := NewTokens(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: public}), pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), "forgeharbor", "forgeharbor-users")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := tokens.Issue("owner", "fixture@example.invalid")
	if err != nil {
		t.Fatal(err)
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.Split(raw, ".")[1])
	if err != nil {
		t.Fatal("fixture token could not be decoded")
	}
	var encoded map[string]any
	if json.Unmarshal(payload, &encoded) != nil {
		t.Fatal("fixture token JSON invalid")
	}
	if audience, ok := encoded["aud"].(string); !ok || audience != tokens.Audience {
		t.Fatal("aud must remain a string for the existing Rust consumers")
	}
	claims, err := tokens.Verify(raw)
	if err != nil || claims.Subject != "owner" || claims.ID == "" || claims.Email != "fixture@example.invalid" {
		t.Fatal("issued claims incompatible")
	}
	if len(tokens.Kid) != 43 || tokens.JWK()["e"] != "AQAB" {
		t.Fatal("invalid RSA JWKS")
	}
	for _, change := range []string{"expired", "missing-exp", "wrong-issuer", "wrong-audience", "blank-subject", "wrong-algorithm"} {
		t.Run(change, func(t *testing.T) {
			c := Claims{RegisteredClaims: jwt.RegisteredClaims{Subject: "owner", Issuer: tokens.Issuer, Audience: jwt.ClaimStrings{tokens.Audience}, ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}}
			switch change {
			case "expired":
				c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Hour))
			case "missing-exp":
				c.ExpiresAt = nil
			case "wrong-issuer":
				c.Issuer = "other"
			case "wrong-audience":
				c.Audience = jwt.ClaimStrings{"other"}
			case "blank-subject":
				c.Subject = "   "
			}
			token := jwt.NewWithClaims(jwt.SigningMethodRS256, c)
			var raw string
			if change == "wrong-algorithm" {
				raw, _ = jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString([]byte("synthetic-test-key"))
			} else {
				raw, _ = token.SignedString(key)
			}
			if _, err := tokens.Verify(raw); err == nil {
				t.Fatal("invalid token accepted")
			}
		})
	}
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("Authorization", "Bearer preferred")
	r.Header.Set("Cookie", "fh_access=cookie")
	if RequestToken(r) != "preferred" {
		t.Fatal("bearer precedence changed")
	}
	if _, err = NewTokens([]byte("invalid"), nil, "issuer", "audience"); err == nil {
		t.Fatal("invalid key accepted")
	}
}
