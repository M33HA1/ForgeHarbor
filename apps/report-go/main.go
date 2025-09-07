package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/streadway/amqp"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"report-go/routes"
)

var (
	mongoClient *mongo.Client
	rabbitConn  *amqp.Connection
)

func main() {
	//load .env
	err := godotenv.Load("../../config/.env")
	if err != nil {
		log.Println("No .env file found, using system env")
	}

	//mongo connection
	mongoURI := os.Getenv("MONGO_URI")
	mongoClient, err = mongo.Connect(context.TODO(), options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal("Mongo connect error:", err)
	}
	if err = mongoClient.Ping(context.TODO(), nil); err != nil {
		log.Fatal("Mongo ping error", err)
	}
	log.Println("Connected to MongoDB")

	//RabbitMQ connection
	rabbitURL := os.Getenv("RABBITMQ_URL")
	rabbitConn, err = amqp.Dial(rabbitURL)
	if err != nil {
		log.Fatal("RabbitMQ connect error:", err)
	}
	log.Println("Connected to RabbitMQ")

	//gin router
	r := gin.Default()
	routes.RegisterReportRoutes(r, mongoClient, rabbitConn)

	port := os.Getenv("REPORT_PORT")
	if port == "" {
		port = "8084"
	}
	log.Println("Report service listening on port", port)
	if err := r.Run("0.0.0.0:" + port); err != nil && err != http.ErrServerClosed {
		log.Fatal("Server error:", err)

	}
}
