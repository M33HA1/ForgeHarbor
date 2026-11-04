package routes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type trackedReadCloser struct {
	*strings.Reader
	closed bool
}

func (r *trackedReadCloser) Close() error {
	r.closed = true
	return nil
}

var _ io.ReadCloser = (*trackedReadCloser)(nil)

func TestReportLookupFailureSeparatesMissingFromUnavailable(t *testing.T) {
	for _, test := range []struct {
		name       string
		err        error
		wantStatus int
		wantBody   string
	}{
		{name: "missing or foreign", err: mongo.ErrNoDocuments, wantStatus: 404, wantBody: "not found"},
		{name: "timeout", err: context.DeadlineExceeded, wantStatus: 503, wantBody: "report lookup unavailable"},
		{name: "database failure", err: errors.New("database unavailable"), wantStatus: 503, wantBody: "report lookup unavailable"},
	} {
		t.Run(test.name, func(t *testing.T) {
			status, body := reportLookupFailure(test.err)
			if status != test.wantStatus || body != test.wantBody {
				t.Fatalf("reportLookupFailure() = (%d, %q), want (%d, %q)", status, body, test.wantStatus, test.wantBody)
			}
		})
	}
}

func TestReportDownloadsRequireTrustedStoredScanProvenance(t *testing.T) {
	for _, test := range []struct {
		name    string
		source  string
		trusted bool
	}{
		{name: "current stored scan", source: reportSourceStoredScanV1, trusted: true},
		{name: "missing legacy provenance", source: "", trusted: false},
		{name: "unknown provenance", source: "caller-content-v0", trusted: false},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := reportArtifactTrusted(Report{Source: test.source}); got != test.trusted {
				t.Fatalf("reportArtifactTrusted(%q) = %v, want %v", test.source, got, test.trusted)
			}
		})
	}
}

func TestEnsureReportBucketRetriesTransientStorageFailures(t *testing.T) {
	checks := 0
	creates := 0
	err := ensureReportBucket(context.Background(),
		func(context.Context) error {
			checks++
			if checks < 3 {
				return errors.New("storage unavailable")
			}
			return nil
		},
		func(context.Context) error {
			creates++
			return errors.New("storage unavailable")
		},
	)
	if err != nil {
		t.Fatalf("ensureReportBucket() error = %v", err)
	}
	if checks != 3 || creates != 2 {
		t.Fatalf("head/create attempts = %d/%d, want 3/2", checks, creates)
	}
}

func TestEnsureReportBucketStopsWhenContextExpires(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	checks := 0
	err := ensureReportBucket(ctx,
		func(context.Context) error {
			checks++
			cancel()
			return errors.New("storage unavailable")
		},
		func(context.Context) error { return errors.New("storage unavailable") },
	)
	if err == nil {
		t.Fatal("ensureReportBucket() should return an error after cancellation")
	}
	if checks != 1 {
		t.Fatalf("head attempts = %d, want 1", checks)
	}
}

func TestReportHealthRequiresEveryStorageDependency(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, test := range []struct {
		name       string
		mongoError error
		s3Error    error
		wantStatus int
		wantState  string
	}{
		{name: "ready", wantStatus: 200, wantState: "healthy"},
		{name: "mongo unavailable", mongoError: errors.New("mongo down"), wantStatus: 503, wantState: "degraded"},
		{name: "storage unavailable", s3Error: errors.New("storage down"), wantStatus: 503, wantState: "degraded"},
	} {
		t.Run(test.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/reports/health", reportHealthHandler(
				func(context.Context) error { return test.mongoError },
				func(context.Context) error { return test.s3Error },
			))
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest("GET", "/reports/health", nil))
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, test.wantStatus)
			}
			var body map[string]any
			if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body["status"] != test.wantState || body["service"] != "report-go" {
				t.Fatalf("unexpected health response: %#v", body)
			}
			if strings.Contains(recorder.Body.String(), "down") {
				t.Fatal("health response must not expose dependency error details")
			}
		})
	}
}

func TestReportMetadataFailureCompensatesUploadedArtifact(t *testing.T) {
	requestCtx, cancel := context.WithCancel(context.Background())
	cancel()

	cleanupCalled := false
	insertErr := errors.New("metadata insert failed")
	err := insertReportWithCompensation(
		requestCtx,
		func(ctx context.Context) error {
			if ctx.Err() == nil {
				t.Fatal("test requires the original request context to be canceled")
			}
			return insertErr
		},
		func(ctx context.Context) (bool, error) {
			if ctx.Err() != nil {
				t.Fatalf("verification context unexpectedly canceled: %v", ctx.Err())
			}
			deadline, ok := ctx.Deadline()
			if !ok || time.Until(deadline) > 2*time.Second {
				t.Fatal("metadata verification must have a bounded two-second deadline")
			}
			return false, nil
		},
		func(ctx context.Context) error {
			cleanupCalled = true
			if ctx.Err() != nil {
				t.Fatalf("compensation context unexpectedly canceled: %v", ctx.Err())
			}
			deadline, ok := ctx.Deadline()
			if !ok || time.Until(deadline) > 5*time.Second {
				t.Fatal("compensation must have a bounded five-second deadline")
			}
			return nil
		},
	)
	if !errors.Is(err, insertErr) {
		t.Fatalf("metadata error = %v, want original insert error", err)
	}
	if !cleanupCalled {
		t.Fatal("uploaded artifact was not scheduled for cleanup")
	}
}

func TestReportMetadataSuccessSkipsArtifactCompensation(t *testing.T) {
	cleanupCalled := false
	err := insertReportWithCompensation(
		context.Background(),
		func(context.Context) error { return nil },
		func(context.Context) (bool, error) {
			t.Fatal("successful insert must not require ambiguity verification")
			return false, nil
		},
		func(context.Context) error {
			cleanupCalled = true
			return nil
		},
	)
	if err != nil {
		t.Fatalf("successful metadata insert returned %v", err)
	}
	if cleanupCalled {
		t.Fatal("successful metadata insert must keep the uploaded artifact")
	}
}

func TestAmbiguousMetadataInsertRetainsArtifactWhenVerificationFails(t *testing.T) {
	insertErr := errors.New("metadata insert timed out")
	cleanupCalled := false
	err := insertReportWithCompensation(
		context.Background(),
		func(context.Context) error { return insertErr },
		func(context.Context) (bool, error) { return false, errors.New("mongo unavailable") },
		func(context.Context) error {
			cleanupCalled = true
			return nil
		},
	)
	if !errors.Is(err, insertErr) {
		t.Fatalf("metadata error = %v, want original insert error", err)
	}
	if cleanupCalled {
		t.Fatal("artifact must be retained when metadata persistence cannot be determined")
	}
}

func TestAmbiguousMetadataInsertSucceedsWhenDocumentIsFound(t *testing.T) {
	cleanupCalled := false
	err := insertReportWithCompensation(
		context.Background(),
		func(context.Context) error { return errors.New("write acknowledgement lost") },
		func(context.Context) (bool, error) { return true, nil },
		func(context.Context) error {
			cleanupCalled = true
			return nil
		},
	)
	if err != nil {
		t.Fatalf("verified metadata insert should be treated as success: %v", err)
	}
	if cleanupCalled {
		t.Fatal("verified metadata must retain its artifact")
	}
}

func TestReportCreatedEventContract(t *testing.T) {
	report := Report{ID: primitive.NewObjectID(), UserID: "owner", ScanID: primitive.NewObjectID().Hex(), CreatedAt: time.Now()}
	message := reportCreatedMessage(report)
	if message.DeliveryMode != 2 || message.MessageId != "report.created:"+report.ID.Hex() {
		t.Fatal("event must have persistent delivery and stable identity")
	}
	var event map[string]any
	if err := json.Unmarshal(message.Body, &event); err != nil {
		t.Fatal(err)
	}
	if event["schema_version"] != float64(1) || event["user_id"] != report.UserID || event["event_type"] != "report.created" {
		t.Fatal("unexpected event contract")
	}
	if event["data"].(map[string]any)["scan_id"] != report.ScanID {
		t.Fatal("event does not reference stored report scan")
	}
}

func TestStoredScanExportPreservesEvidenceAndOmitsInternalFields(t *testing.T) {
	scan := bson.M{
		"_id": primitive.NewObjectID(), "user_id": "owner", "scan_type": "file",
		"input": "evidence.bin", "created_at": time.Now(),
		"result":         bson.M{"malicious": true, "risk_level": "high"},
		"internal_debug": "must not be exported",
	}
	encoded, err := storedScanJSON(scan)
	if err != nil {
		t.Fatal(err)
	}
	var exported map[string]any
	if err := json.Unmarshal(encoded, &exported); err != nil {
		t.Fatal(err)
	}
	if _, leaked := exported["internal_debug"]; leaked {
		t.Fatal("internal field leaked")
	}
	if exported["result"].(map[string]any)["malicious"] != true {
		t.Fatal("stored evidence changed")
	}
	delete(scan, "result")
	if _, err := storedScanJSON(scan); err == nil {
		t.Fatal("incomplete scan must be rejected")
	}
	if _, err := storedScanJSON(bson.M{"result": bson.M{"risk_level": "high"}}); err == nil {
		t.Fatal("missing scan identity fields must be rejected")
	}
}

func TestWriteReportBodyCopiesOnceAndClosesObject(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("GET", "/reports/test-id/download", nil)
	body := &trackedReadCloser{Reader: strings.NewReader(`{"status":"clean"}`)}

	writeReportBody(ctx, body, "report-test.json")

	if got, want := recorder.Body.String(), `{"status":"clean"}`; got != want {
		t.Fatalf("response body = %q, want %q", got, want)
	}
	if got, want := recorder.Header().Get("Content-Type"), "application/json"; got != want {
		t.Fatalf("Content-Type = %q, want %q", got, want)
	}
	if got, want := recorder.Header().Get("Content-Disposition"), "attachment; filename=report-test.json"; got != want {
		t.Fatalf("Content-Disposition = %q, want %q", got, want)
	}
	if !body.closed {
		t.Fatal("report object body was not closed")
	}
}

func TestParseReportScanIDsDeduplicatesAndRejectsInvalidInput(t *testing.T) {
	ids, err := parseReportScanIDs([]string{" scan-a ", "scan-b", "scan-a"})
	if err != nil {
		t.Fatalf("parseReportScanIDs returned error: %v", err)
	}
	if len(ids) != 2 || ids[0] != "scan-a" || ids[1] != "scan-b" {
		t.Fatalf("parsed IDs = %#v, want deduplicated scan-a and scan-b", ids)
	}
	for name, input := range map[string][]string{
		"missing": nil,
		"empty":   {" "},
		"too many": func() []string {
			values := make([]string, maxReportScanIDs+1)
			for i := range values {
				values[i] = fmt.Sprintf("scan-%d", i)
			}
			return values
		}(),
		"too long": {strings.Repeat("x", 129)},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := parseReportScanIDs(input); err == nil {
				t.Fatal("expected invalid scan IDs to be rejected")
			}
		})
	}
}

func TestReportScanFilterAlwaysScopesToOwner(t *testing.T) {
	filter := reportScanFilter("user-a", []string{"scan-a", "scan-b"})
	if filter["user_id"] != "user-a" {
		t.Fatalf("owner filter = %#v, want user-a", filter["user_id"])
	}
	scanFilter, ok := filter["scanId"].(bson.M)
	if !ok {
		t.Fatalf("scan filter type = %T, want bson.M", filter["scanId"])
	}
	if got := scanFilter["$in"].([]string); len(got) != 2 || got[0] != "scan-a" || got[1] != "scan-b" {
		t.Fatalf("scan IDs = %#v, want scan-a and scan-b", got)
	}
}
