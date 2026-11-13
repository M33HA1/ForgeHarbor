package routes

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func isolateStorageEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{"S3_MODE", "S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_SESSION_TOKEN",
		"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_REGION", "AWS_DEFAULT_REGION", "AWS_PROFILE", "AWS_DEFAULT_PROFILE",
		"AWS_ENDPOINT_URL", "AWS_ENDPOINT_URL_S3", "AWS_CONTAINER_CREDENTIALS_FULL_URI", "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
		"AWS_CONTAINER_AUTHORIZATION_TOKEN", "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE", "AWS_WEB_IDENTITY_TOKEN_FILE", "AWS_ROLE_ARN"} {
		t.Setenv(key, "")
	}
	t.Setenv("AWS_EC2_METADATA_DISABLED", "true")
	dir := t.TempDir()
	for _, key := range []string{"AWS_CONFIG_FILE", "AWS_SHARED_CREDENTIALS_FILE"} {
		name := filepath.Join(dir, key)
		if err := os.WriteFile(name, nil, 0600); err != nil {
			t.Fatal(err)
		}
		t.Setenv(key, name)
	}
	t.Setenv("S3_BUCKET", "forgeharbor-test-reports")
}

func awsStorageEnv(t *testing.T) {
	isolateStorageEnv(t)
	t.Setenv("S3_MODE", "aws")
	t.Setenv("AWS_REGION", "ap-south-1")
	// Synthetic disposable values; no request to AWS leaves these tests.
	t.Setenv("AWS_ACCESS_KEY_ID", "test-access")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "test-secret")
	t.Setenv("AWS_SESSION_TOKEN", "test-session")
}

type storageTransport func(*http.Request) (*http.Response, error)

func (f storageTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func storageTestClient(client *s3.Client, transport storageTransport) *s3.Client {
	opts := client.Options()
	opts.HTTPClient = &http.Client{Transport: transport}
	opts.RetryMaxAttempts = 1
	return s3.New(opts)
}

func storageResponse(r *http.Request, status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body)), Request: r}
}

func TestAWSStorageSignsTemporaryCredentialsAndObjectLifecycle(t *testing.T) {
	awsStorageEnv(t)
	// A stale shared-profile endpoint must not receive AWS credentials.
	if err := os.WriteFile(os.Getenv("AWS_CONFIG_FILE"), []byte("[default]\nendpoint_url = http://stale-endpoint.test:9000\n"), 0600); err != nil {
		t.Fatal(err)
	}
	client, bucket, create, err := newReportStorage(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if create {
		t.Fatal("AWS runtime must not create buckets")
	}
	methods := []string{}
	client = storageTestClient(client, func(r *http.Request) (*http.Response, error) {
		if r.URL.Scheme != "https" || r.URL.Host != bucket+".s3.ap-south-1.amazonaws.com" {
			t.Fatal("regional HTTPS endpoint not used")
		}
		if !strings.Contains(r.Header.Get("Authorization"), "/ap-south-1/s3/aws4_request") || r.Header.Get("X-Amz-Security-Token") != "test-session" {
			t.Fatal("temporary credentials not used for regional signing")
		}
		methods = append(methods, r.Method)
		if r.Body != nil {
			if _, err := io.Copy(io.Discard, r.Body); err != nil {
				return nil, err
			}
		}
		return storageResponse(r, 200, `{"source":"stored-scan-v1"}`), nil
	})
	ctx := context.Background()
	if err := initializeReportBucket(ctx, client, bucket, create); err != nil {
		t.Fatal(err)
	}
	key := aws.String("reports/test.json")
	if _, err := client.PutObject(ctx, &s3.PutObjectInput{Bucket: &bucket, Key: key, Body: strings.NewReader(`{"source":"stored-scan-v1"}`)}); err != nil {
		t.Fatal(err)
	}
	object, err := client.GetObject(ctx, &s3.GetObjectInput{Bucket: &bucket, Key: key})
	if err != nil {
		t.Fatal(err)
	}
	content, err := io.ReadAll(object.Body)
	object.Body.Close()
	if err != nil || string(content) != `{"source":"stored-scan-v1"}` {
		t.Fatal("download changed stored content")
	}
	if _, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &bucket, Key: key}); err != nil {
		t.Fatal(err)
	}
	if strings.Join(methods, ",") != "HEAD,PUT,GET,DELETE" {
		t.Fatalf("unexpected operations: %v", methods)
	}
}

func TestAWSStorageRefreshesRoleCredentials(t *testing.T) {
	awsStorageEnv(t)
	t.Setenv("AWS_ACCESS_KEY_ID", "")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "")
	t.Setenv("AWS_SESSION_TOKEN", "")
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"AccessKeyId":"test-role-%d","SecretAccessKey":"test-secret","Token":"test-role-token-%d","Expiration":%q}`, n, n, time.Now().Add(time.Hour).UTC().Format(time.RFC3339))
	}))
	defer server.Close()
	t.Setenv("AWS_CONTAINER_CREDENTIALS_FULL_URI", server.URL)
	client, _, _, err := newReportStorage(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	cache, ok := client.Options().Credentials.(*aws.CredentialsCache)
	if !ok {
		t.Fatal("role credentials lack SDK refresh support")
	}
	first, err := cache.Retrieve(context.Background())
	if err != nil || !first.CanExpire || first.SessionToken != "test-role-token-1" {
		t.Fatal("role token not loaded")
	}
	cache.Invalidate() // Exercise expiry refresh without sleeping.
	second, err := cache.Retrieve(context.Background())
	if err != nil || second.SessionToken != "test-role-token-2" || calls.Load() != 2 {
		t.Fatal("role credentials not refreshed")
	}
}

func TestCompatibleStoragePreservesPathStyleAndBucketCreation(t *testing.T) {
	isolateStorageEnv(t)
	t.Setenv("S3_ENDPOINT", "http://rustfs.test:9000")
	t.Setenv("S3_ACCESS_KEY", "test-local-access")
	t.Setenv("S3_SECRET_KEY", "test-local-secret")
	client, bucket, create, err := newReportStorage(context.Background())
	if err != nil || !create {
		t.Fatal("local configuration not preserved")
	}
	methods := []string{}
	client = storageTestClient(client, func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "rustfs.test:9000" || r.URL.Path != "/"+bucket {
			t.Fatal("local addressing changed")
		}
		if !strings.Contains(r.Header.Get("Authorization"), "test-local-access/") {
			t.Fatal("local credentials not selected")
		}
		methods = append(methods, r.Method)
		status := 200
		if r.Method == "HEAD" {
			status = 404
		}
		return storageResponse(r, status, ""), nil
	})
	if err := initializeReportBucket(context.Background(), client, bucket, create); err != nil {
		t.Fatal(err)
	}
	if strings.Join(methods, ",") != "HEAD,PUT" {
		t.Fatalf("unexpected operations: %v", methods)
	}
}

func TestAWSStorageDoesNotCreateMissingOrForbiddenBucket(t *testing.T) {
	for _, status := range []int{403, 404} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			awsStorageEnv(t)
			client, bucket, create, err := newReportStorage(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			client = storageTestClient(client, func(r *http.Request) (*http.Response, error) {
				if r.Method != "HEAD" {
					t.Fatal("runtime attempted bucket creation")
				}
				return storageResponse(r, status, ""), nil
			})
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
			defer cancel()
			if err := initializeReportBucket(ctx, client, bucket, create); err == nil {
				t.Fatal("unavailable bucket passed startup")
			}
		})
	}
}

func TestAWSStorageRejectsMixedConfigurationAndMissingCredentials(t *testing.T) {
	for _, key := range []string{"S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_SESSION_TOKEN", "AWS_ENDPOINT_URL", "AWS_ENDPOINT_URL_S3"} {
		t.Run(key, func(t *testing.T) {
			awsStorageEnv(t)
			t.Setenv(key, "test-invalid-value")
			if _, _, _, err := newReportStorage(context.Background()); err == nil {
				t.Fatal("mixed configuration accepted")
			}
		})
	}
	for _, missing := range []string{"credentials", "region"} {
		t.Run("missing "+missing, func(t *testing.T) {
			awsStorageEnv(t)
			if missing == "region" {
				t.Setenv("AWS_REGION", "")
			} else {
				t.Setenv("AWS_ACCESS_KEY_ID", "")
				t.Setenv("AWS_SECRET_ACCESS_KEY", "")
				t.Setenv("AWS_SESSION_TOKEN", "")
			}
			if _, _, _, err := newReportStorage(context.Background()); err == nil {
				t.Fatal("incomplete configuration accepted")
			}
		})
	}
}

func TestCompatibleStorageRejectsIncompleteOrUnsafeConfiguration(t *testing.T) {
	for _, endpoint := range []string{"", "ftp://rustfs.test", "http://user:password@rustfs.test", "http://rustfs.test/path", "http://rustfs.test?token=test"} {
		t.Run("endpoint "+endpoint, func(t *testing.T) {
			isolateStorageEnv(t)
			t.Setenv("S3_ENDPOINT", endpoint)
			t.Setenv("S3_ACCESS_KEY", "test-local-access")
			t.Setenv("S3_SECRET_KEY", "test-local-secret")
			if _, _, _, err := newReportStorage(context.Background()); err == nil {
				t.Fatal("invalid endpoint accepted")
			}
		})
	}
	for _, missing := range []string{"S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"} {
		t.Run("missing "+missing, func(t *testing.T) {
			isolateStorageEnv(t)
			t.Setenv("S3_ENDPOINT", "http://rustfs.test:9000")
			t.Setenv("S3_ACCESS_KEY", "test-local-access")
			t.Setenv("S3_SECRET_KEY", "test-local-secret")
			t.Setenv(missing, "")
			if _, _, _, err := newReportStorage(context.Background()); err == nil {
				t.Fatal("incomplete local config accepted")
			}
		})
	}
	isolateStorageEnv(t)
	t.Setenv("S3_MODE", "invalid")
	if _, _, _, err := newReportStorage(context.Background()); err == nil {
		t.Fatal("unknown storage mode accepted")
	}
}
