package auth

import (
	"strings"
	"unicode/utf8"
)

func validEmail(email string) bool {
	if len(email) > 254 {
		return false
	}
	local, domain, ok := strings.Cut(email, "@")
	if !ok || len(local) == 0 || len(local) > 64 || strings.HasPrefix(local, ".") || strings.HasSuffix(local, ".") || strings.Contains(local, "..") {
		return false
	}
	for _, c := range local {
		if c > 127 || !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || strings.ContainsRune(".!#$%&'*+-/=?^_`{|}~", c)) {
			return false
		}
	}
	if !strings.Contains(domain, ".") {
		return false
	}
	for _, label := range strings.Split(domain, ".") {
		if len(label) == 0 || len(label) > 63 || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return false
		}
		for _, c := range label {
			if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-') {
				return false
			}
		}
	}
	return true
}
func validate(email, password string, signup bool) string {
	length := utf8.RuneCountInString(password)
	if signup {
		if !validEmail(email) {
			return "Enter a valid email address (up to 254 characters)."
		}
		if length < 15 || length > 128 {
			return "Use a password with 15 to 128 characters."
		}
	} else if len(email) == 0 || len(email) > 254 || length > 1024 {
		return "Invalid login input."
	}
	return ""
}
