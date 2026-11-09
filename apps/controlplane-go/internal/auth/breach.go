package auth

import (
	"context"
	"crypto/sha1" // HIBP's k-anonymity lookup protocol; never used for password storage.
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type BreachChecker interface {
	Compromised(context.Context, string) (bool, error)
}
type HIBP struct {
	client   *http.Client
	endpoint string
}

func NewHIBP() *HIBP {
	return &HIBP{client: &http.Client{Timeout: 4 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, endpoint: "https://api.pwnedpasswords.com"}
}
func (h *HIBP) Compromised(ctx context.Context, password string) (bool, error) {
	digest := sha1.Sum([]byte(password))
	hash := strings.ToUpper(hex.EncodeToString(digest[:]))
	req, err := http.NewRequestWithContext(ctx, "GET", h.endpoint+"/range/"+hash[:5], nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Add-Padding", "true")
	req.Header.Set("User-Agent", "ForgeHarbor Auth")
	response, err := h.client.Do(req)
	if err != nil {
		return false, errors.New("password screening unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return false, errors.New("password screening unavailable")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 256*1024+1))
	if err != nil || len(body) > 256*1024 {
		return false, errors.New("invalid password screening response")
	}
	return parseRange(string(body), hash[5:])
}
func parseRange(body, target string) (bool, error) {
	found, saw := false, false
	for _, line := range strings.Split(strings.TrimSpace(body), "\n") {
		if line == "" {
			continue
		}
		suffix, count, ok := strings.Cut(strings.TrimSuffix(line, "\r"), ":")
		_, hexErr := hex.DecodeString(suffix + "0") // 35 hexadecimal digits need a padding nibble.
		n, err := strconv.ParseUint(count, 10, 64)
		if !ok || len(suffix) != 35 || hexErr != nil || err != nil {
			return false, errors.New("invalid password screening response")
		}
		saw = true
		found = found || (strings.EqualFold(suffix, target) && n > 0)
	}
	if !saw {
		return false, errors.New("empty password screening response")
	}
	return found, nil
}
