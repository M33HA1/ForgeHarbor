package main

import (
	"context"
	"strings"
	"testing"
)

func TestAuthRejectsUnplannedDatabaseCutover(t *testing.T) {
	t.Setenv("MONGO_DB", "unmigrated-fixture-database")
	if err := run(context.Background(), "auth"); err == nil || !strings.Contains(err.Error(), "separate explicit data plan") {
		t.Fatal("Auth must not silently switch away from the existing user database")
	}
}

func TestStartupRequiresDatabaseConfiguration(t *testing.T) {
	t.Setenv("MONGO_DB", "forgeharbor")
	t.Setenv("MONGO_URI", "")
	for _, service := range []string{"auth", "history", "notify"} {
		if err := run(context.Background(), service); err == nil {
			t.Fatalf("%s started without database configuration", service)
		}
	}
}
