package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
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
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ScanID    string             `bson:"scanId" json:"scanId"`
	Key       string             `bson:"key" json:"key"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}

func RegisterReportRoutes(r *gin.Engine, mongoClient *mongo.Client, rabbitConn *amqp.Connection) {
	db := mongoClient.Database(os.Getenv("MONGO_DB"))
	reportsColl := db.Collection("reports")

	// S3 setup
	awsCfg, err := config.LoadDefaultConfig(
		context.TODO(),
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
	s3Client := s3.NewFromConfig(awsCfg)
	bucket := os.Getenv("S3_BUCKET")

	// RabbitMQ setup
	ch, err := rabbitConn.Channel()
	if err != nil {
		log.Fatal("RabbitMQ channel error:", err)
	}
	queue := "report_events"
	_, err = ch.QueueDeclare(queue, true, false, false, false, nil)
	if err != nil {
		log.Fatal("RabbitMQ queue declare error:", err)
	}

	// POST /reports → create new report
	r.POST("/reports", func(c *gin.Context) {
		var body struct {
			ScanID  string `json:"scanId"`
			Content string `json:"content"`
		}
		if err := c.BindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		key := fmt.Sprintf("report-%s.json", body.ScanID)

		// Upload to S3
		_, err := s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
			Bucket:      aws.String(bucket),
			Key:         aws.String(key),
			Body:        bytes.NewReader([]byte(body.Content)),
			ContentType: aws.String("application/json"),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "s3 upload failed"})
			return
		}

		// Save in Mongo
		report := Report{
			ScanID:    body.ScanID,
			Key:       key,
			CreatedAt: time.Now(),
		}
		res, err := reportsColl.InsertOne(context.TODO(), report, options.InsertOne())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "mongo insert failed"})
			return
		}
		report.ID = res.InsertedID.(primitive.ObjectID)

		// Publish to RabbitMQ
		msgBody, _ := json.Marshal(gin.H{"reportId": report.ID.Hex(), "scanId": body.ScanID})
		err = ch.Publish("", queue, false, false, amqp.Publishing{
			ContentType: "application/json",
			Body:        msgBody,
		})
		if err != nil {
			log.Println("RabbitMQ publish error:", err)
		}

		c.JSON(http.StatusOK, report)
	})
	// Add to apps/report-go/routes/reports.go
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "report-go",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})
	// GET /reports/:id → fetch metadata
	r.GET("/reports/:id", func(c *gin.Context) {
		idHex := c.Param("id")
		id, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		var report Report
		err = reportsColl.FindOne(context.TODO(), bson.M{"_id": id}).Decode(&report)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		c.JSON(http.StatusOK, report)
	})

	// GET /reports/:id/download → fetch report file
	r.GET("/reports/:id/download", func(c *gin.Context) {
		idHex := c.Param("id")
		id, err := primitive.ObjectIDFromHex(idHex)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}

		var report Report
		err = reportsColl.FindOne(context.TODO(), bson.M{"_id": id}).Decode(&report)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		obj, err := s3Client.GetObject(context.TODO(), &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(report.Key),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "s3 get failed"})
			return
		}

		c.Header("Content-Type", "application/json")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", report.Key))
		c.Stream(func(w io.Writer) bool {
			_, err := io.Copy(w, obj.Body)
			return err == nil
		})
	})
}
