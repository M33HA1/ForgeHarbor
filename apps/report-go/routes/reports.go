package routes

import (
	"bytes"
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/streadway/amqp"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Report struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID              string             `bson:"user_id" json:"userId"`
	ScanID              string             `bson:"scanId" json:"scanId"`
	Key                 string             `bson:"key" json:"key"`
	Source              string             `bson:"source,omitempty" json:"source,omitempty"`
	CreatedAt           time.Time          `bson:"createdAt" json:"createdAt"`
	NotificationPending bool               `bson:"notification_pending,omitempty" json:"-"`
}

const maxReportScanIDs = 100
const reportQueryTimeout = 5 * time.Second
const reportDownloadTimeout = 20 * time.Second
const reportSourceStoredScanV1 = "stored-scan-v1"
const reportBucketInitTimeout = 30 * time.Second
const reportBucketRetryDelay = 500 * time.Millisecond

func ensureReportBucket(ctx context.Context, headBucket, createBucket func(context.Context) error) error {
	for {
		if err := headBucket(ctx); err == nil {
			return nil
		}
		if err := createBucket(ctx); err == nil {
			return nil
		}

		timer := time.NewTimer(reportBucketRetryDelay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return fmt.Errorf("report bucket unavailable before startup deadline: %w", ctx.Err())
		case <-timer.C:
		}
	}
}

func reportLookupFailure(err error) (int, string) {
	if errors.Is(err, mongo.ErrNoDocuments) {
		return http.StatusNotFound, "not found"
	}
	return http.StatusServiceUnavailable, "report lookup unavailable"
}

func reportArtifactTrusted(report Report) bool {
	return report.Source == reportSourceStoredScanV1
}

func parseReportScanIDs(values []string) ([]string, error) {
	if len(values) == 0 || len(values) > maxReportScanIDs {
		return nil, fmt.Errorf("between 1 and %d scan IDs are required", maxReportScanIDs)
	}
	ids := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		id := strings.TrimSpace(value)
		if id == "" || len(id) > 128 {
			return nil, fmt.Errorf("invalid scan ID")
		}
		if _, ok := seen[id]; !ok {
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func reportScanFilter(userID string, scanIDs []string) bson.M {
	return bson.M{
		"user_id": userID,
		"scanId":  bson.M{"$in": scanIDs},
	}
}

// Export only the stored scan contract, never caller content or internal fields.
func storedScanJSON(scan bson.M) ([]byte, error) {
	result, ok := scan["result"].(bson.M)
	if !ok || len(result) == 0 {
		return nil, fmt.Errorf("scan result is incomplete")
	}
	kind, _ := scan["scan_type"].(string)
	input, _ := scan["input"].(string)
	if (kind != "url" && kind != "file") || input == "" || scan["created_at"] == nil {
		return nil, fmt.Errorf("scan record is incomplete")
	}
	return bson.MarshalExtJSON(bson.M{
		"_id": scan["_id"], "user_id": scan["user_id"], "scan_type": kind,
		"input": input, "result": result, "created_at": scan["created_at"],
	}, false, false)
}

func reportCreatedMessage(report Report) amqp.Publishing {
	eventID := "report.created:" + report.ID.Hex()
	body, _ := json.Marshal(gin.H{
		"schema_version": 1, "event_id": eventID, "event_type": "report.created",
		"occurred_at": report.CreatedAt.UTC().Format(time.RFC3339Nano), "user_id": report.UserID,
		"data": gin.H{"report_id": report.ID.Hex(), "scan_id": report.ScanID, "message": "Report created"},
	})
	return amqp.Publishing{ContentType: "application/json", DeliveryMode: amqp.Persistent,
		MessageId: eventID, Timestamp: report.CreatedAt, Body: body}
}

func insertReportWithCompensation(
	ctx context.Context,
	insert func(context.Context) error,
	verify func(context.Context) (bool, error),
	compensate func(context.Context) error,
) error {
	insertErr := insert(ctx)
	if insertErr == nil {
		return nil
	}

	// MongoDB can return an ambiguous write error after the document committed.
	// Verify with an independent deadline before deleting the corresponding S3
	// object; otherwise a committed report could point to a deleted artifact.
	verifyCtx, cancelVerify := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	persisted, verifyErr := verify(verifyCtx)
	cancelVerify()
	if verifyErr != nil {
		log.Println("Report metadata outcome could not be verified; artifact retained")
		return insertErr
	}
	if persisted {
		return nil
	}

	// The request context may already be canceled after the upload. Give the
	// compensating delete a short independent budget so it can still run.
	cleanupCtx, cancelCleanup := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancelCleanup()
	if cleanupErr := compensate(cleanupCtx); cleanupErr != nil {
		// Keep object keys and dependency error details out of logs.
		log.Println("Report artifact compensation failed after metadata insert")
	}
	return insertErr
}

func RegisterReportRoutes(r *gin.Engine, mongoClient *mongo.Client) {
	db := mongoClient.Database(os.Getenv("MONGO_DB"))
	reportsColl := db.Collection("reports")
	_, err := reportsColl.Indexes().CreateOne(context.TODO(), mongo.IndexModel{
		Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "scanId", Value: 1}, {Key: "createdAt", Value: -1}},
	})
	if err != nil {
		log.Fatal("Report owner/scan index setup failed")
	}

	// S3 setup
	awsCfg, err := config.LoadDefaultConfig(
		context.TODO(),
		config.WithRegion(func() string {
			if v := os.Getenv("S3_REGION"); v != "" {
				return v
			}
			return "us-east-1"
		}()),
		config.WithEndpointResolver(aws.EndpointResolverFunc(func(service, region string) (aws.Endpoint, error) {
			return aws.Endpoint{URL: os.Getenv("S3_ENDPOINT"), HostnameImmutable: true}, nil
		})),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			os.Getenv("S3_ACCESS_KEY"),
			os.Getenv("S3_SECRET_KEY"),
			"",
		)),
	)
	if err != nil {
		log.Fatal("S3 config error:", err)
	}
	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		// MinIO/S3-compatible: prefer path-style addressing
		o.UsePathStyle = true
	})
	bucket := os.Getenv("S3_BUCKET")

	// Ensure bucket exists (create if missing)
	if bucket == "" {
		log.Fatal("S3_BUCKET env var is required")
	}
	bucketCtx, cancelBucket := context.WithTimeout(context.Background(), reportBucketInitTimeout)
	err = ensureReportBucket(bucketCtx,
		func(ctx context.Context) error {
			_, err := s3Client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
			return err
		},
		func(ctx context.Context) error {
			_, err := s3Client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
			return err
		},
	)
	cancelBucket()
	if err != nil {
		log.Fatal("S3 bucket check/create failed before startup deadline")
	}

	// Load the same Auth public key used by History and Notify. Missing or invalid
	// auth configuration prevents the protected service from starting.
	publicKeyPath := os.Getenv("JWT_PUBLIC_KEY_PATH")
	if publicKeyPath == "" {
		publicKeyPath = "/app/config/jwt-public.pem"
	}
	publicKeyPEM, err := os.ReadFile(publicKeyPath)
	if err != nil {
		log.Fatal("JWT public key is required")
	}
	publicKey, err := jwt.ParseRSAPublicKeyFromPEM(publicKeyPEM)
	if err != nil {
		log.Fatal("JWT public key is invalid")
	}
	issuer := os.Getenv("JWT_ISSUER")
	if issuer == "" {
		issuer = "forgeharbor"
	}
	audience := os.Getenv("JWT_AUDIENCE")
	if audience == "" {
		audience = "forgeharbor-users"
	}
	auth := reportAuth(publicKey, issuer, audience)

	_, err = reportsColl.Indexes().CreateOne(context.TODO(), mongo.IndexModel{
		Keys:    bson.D{{Key: "notification_pending", Value: 1}, {Key: "createdAt", Value: 1}},
		Options: options.Index().SetPartialFilterExpression(bson.M{"notification_pending": true}),
	})
	if err != nil {
		log.Fatal("Report outbox index setup failed")
	}

	// GET /reports?scan_id=a&scan_id=b returns only this owner's reports.
	r.GET("/reports", auth, func(c *gin.Context) {
		scanIDs, err := parseReportScanIDs(c.QueryArray("scan_id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "one to 100 scan_id values are required"})
			return
		}
		findOptions := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(1000)
		queryCtx, cancel := context.WithTimeout(c.Request.Context(), reportQueryTimeout)
		defer cancel()
		cursor, err := reportsColl.Find(queryCtx, reportScanFilter(c.GetString("user_id"), scanIDs), findOptions)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "report lookup unavailable"})
			return
		}
		defer cursor.Close(queryCtx)
		reports := make([]Report, 0)
		if err := cursor.All(queryCtx, &reports); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "report lookup unavailable"})
			return
		}
		c.JSON(http.StatusOK, reports)
	})

	// POST /reports → create new report
	r.POST("/reports", auth, func(c *gin.Context) {
		var body struct {
			ScanID string `json:"scanId"`
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64*1024)
		if err := c.ShouldBindJSON(&body); err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body exceeds 64 KiB"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		scanID, err := primitive.ObjectIDFromHex(body.ScanID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "valid scanId is required"})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		var scan bson.M
		err = db.Collection("scans").FindOne(ctx, bson.M{"_id": scanID, "user_id": c.GetString("user_id")}).Decode(&scan)
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "scan not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan lookup failed"})
			return
		}
		content, err := storedScanJSON(scan)
		if err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "stored scan result is incomplete"})
			return
		}

		reportID := primitive.NewObjectID()
		key := fmt.Sprintf("report-%s.json", reportID.Hex())

		// Upload to S3
		_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(bucket),
			Key:         aws.String(key),
			Body:        bytes.NewReader(content),
			ContentType: aws.String("application/json"),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "s3 upload failed"})
			return
		}

		// Save in Mongo
		report := Report{
			ID:                  reportID,
			UserID:              c.GetString("user_id"),
			ScanID:              scanID.Hex(),
			Key:                 key,
			Source:              reportSourceStoredScanV1,
			CreatedAt:           time.Now(),
			NotificationPending: true,
		}
		err = insertReportWithCompensation(ctx,
			func(insertCtx context.Context) error {
				_, err := reportsColl.InsertOne(insertCtx, report, options.InsertOne())
				return err
			},
			func(verifyCtx context.Context) (bool, error) {
				err := reportsColl.FindOne(verifyCtx, bson.M{"_id": report.ID}).Err()
				if errors.Is(err, mongo.ErrNoDocuments) {
					return false, nil
				}
				return err == nil, err
			},
			func(cleanupCtx context.Context) error {
				_, err := s3Client.DeleteObject(cleanupCtx, &s3.DeleteObjectInput{
					Bucket: aws.String(bucket),
					Key:    aws.String(key),
				})
				return err
			},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "mongo insert failed"})
			return
		}
		// The pending notification is committed in this same MongoDB document.
		// A separate relay clears it only after mandatory routing and confirmation.

		c.JSON(http.StatusOK, report)
	})
	// Report operations require both metadata storage and the artifact bucket.
	r.GET("/reports/health", reportHealthHandler(
		func(ctx context.Context) error { return mongoClient.Ping(ctx, nil) },
		func(ctx context.Context) error {
			_, err := s3Client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
			return err
		},
	))
	// GET /reports/:id → fetch metadata
	r.GET("/reports/:id", auth, func(c *gin.Context) {
		idHex := c.Param("id")
		id, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		var report Report
		queryCtx, cancel := context.WithTimeout(c.Request.Context(), reportQueryTimeout)
		defer cancel()
		err = reportsColl.FindOne(queryCtx, bson.M{"_id": id, "user_id": c.GetString("user_id")}).Decode(&report)
		if err != nil {
			status, message := reportLookupFailure(err)
			c.JSON(status, gin.H{"error": message})
			return
		}

		c.JSON(http.StatusOK, report)
	})

	// GET /reports/:id/download → fetch report file
	r.GET("/reports/:id/download", auth, func(c *gin.Context) {
		idHex := c.Param("id")
		id, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		downloadCtx, cancel := context.WithTimeout(c.Request.Context(), reportDownloadTimeout)
		defer cancel()
		var report Report
		err = reportsColl.FindOne(downloadCtx, bson.M{"_id": id, "user_id": c.GetString("user_id")}).Decode(&report)
		if err != nil {
			status, message := reportLookupFailure(err)
			c.JSON(status, gin.H{"error": message})
			return
		}
		if !reportArtifactTrusted(report) {
			c.JSON(http.StatusGone, gin.H{"error": "legacy report artifact unavailable; generate a new report from stored scan evidence"})
			return
		}

		obj, err := s3Client.GetObject(downloadCtx, &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(report.Key),
		})
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "report download unavailable"})
			return
		}
		writeReportBody(c, obj.Body, report.Key)
	})
}

func reportHealthHandler(checks ...func(context.Context) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		results := make(chan error, len(checks))
		for _, check := range checks {
			go func(check func(context.Context) error) { results <- check(ctx) }(check)
		}

		ready := true
		for range checks {
			select {
			case err := <-results:
				if err != nil {
					ready = false
				}
			case <-ctx.Done():
				ready = false
			}
		}

		status := http.StatusOK
		state := "healthy"
		if !ready {
			status = http.StatusServiceUnavailable
			state = "degraded"
		}
		c.JSON(status, gin.H{
			"status":    state,
			"service":   "report-go",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	}
}

func writeReportBody(c *gin.Context, body io.ReadCloser, key string) {
	defer body.Close()
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", key))
	if _, err := io.Copy(c.Writer, body); err != nil {
		c.Error(err)
	}
}

func reportAuth(publicKey *rsa.PublicKey, issuer, audience string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authorization := c.GetHeader("Authorization")
		tokenValue := ""
		if strings.HasPrefix(authorization, "Bearer ") {
			tokenValue = strings.TrimPrefix(authorization, "Bearer ")
		} else if cookie, err := c.Cookie("fh_access"); err == nil {
			tokenValue = cookie
		}
		if tokenValue == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		claims := &jwt.RegisteredClaims{}
		token, err := jwt.ParseWithClaims(tokenValue, claims,
			func(token *jwt.Token) (any, error) {
				if token.Method.Alg() != jwt.SigningMethodRS256.Alg() {
					return nil, fmt.Errorf("unexpected signing method")
				}
				return publicKey, nil
			}, jwt.WithIssuer(issuer), jwt.WithAudience(audience))
		if err != nil || token == nil || !token.Valid || claims.Subject == "" || claims.ExpiresAt == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("user_id", claims.Subject)
		c.Next()
	}
}
