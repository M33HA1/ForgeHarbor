package platform

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"
)

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"error": message})
}

// Decode never includes submitted content in an error response.
func Decode(w http.ResponseWriter, r *http.Request, target any) bool {
	if !strings.EqualFold(strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]), "application/json") {
		Error(w, http.StatusBadRequest, "Invalid JSON request or request body too large")
		return false
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8192))
	if err != nil {
		var tooLarge *http.MaxBytesError
		status := http.StatusBadRequest
		if errors.As(err, &tooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		Error(w, status, "Invalid JSON request or request body too large")
		return false
	}
	if len(body) == 0 || !utf8.Valid(body) {
		Error(w, 400, "Invalid JSON request")
		return false
	}
	if err := json.Unmarshal(body, target); err != nil {
		Error(w, 400, "Invalid JSON request or request body too large")
		return false
	}
	return true
}

func CORS(next http.Handler, origins []string) http.Handler {
	allowed := make(map[string]bool)
	for _, origin := range origins {
		if origin = strings.TrimSpace(origin); origin != "" && origin != "*" {
			allowed[origin] = true
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		if origin := r.Header.Get("Origin"); origin != "" {
			if !allowed[origin] {
				Error(w, 403, "Origin not allowed")
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			if r.Header.Get("Origin") == "" || !allowed[r.Header.Get("Origin")] {
				Error(w, 403, "Origin not allowed")
				return
			}
			method := r.Header.Get("Access-Control-Request-Method")
			if method != "GET" && method != "POST" {
				Error(w, 403, "Method not allowed")
				return
			}
			for _, header := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
				header = strings.ToLower(strings.TrimSpace(header))
				if header != "" && header != "authorization" && header != "content-type" {
					Error(w, 403, "Header not allowed")
					return
				}
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
