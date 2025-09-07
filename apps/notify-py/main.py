import os
import json
import pika
import pymongo
import threading
from fastapi import FastAPI
from pathlib import Path
from dotenv import load_dotenv

# Load shared env from ../../config/.env
env_path = Path(__file__).resolve().parents[2] / "config" / ".env"
load_dotenv(dotenv_path=env_path)

# MongoDB setup
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
mongo_db = os.getenv("MONGO_DB", "forgeharbor")
client = pymongo.MongoClient(mongo_uri)
db = client[mongo_db]
notifications_col = db["notifications"]

# RabbitMQ setup
rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
queue_name = os.getenv("NOTIFY_QUEUE", "notifications")

# FastAPI app
app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok", "service": "notify-py"}

# Worker to consume messages
def consume_notifications():
    connection = pika.BlockingConnection(pika.URLParameters(rabbitmq_url))
    channel = connection.channel()
    channel.queue_declare(queue=queue_name, durable=True)

    def callback(ch, method, properties, body):
        try:
            data = json.loads(body)
            notifications_col.insert_one({
                "message": data.get("message", ""),
                "user": data.get("user", "unknown"),
                "timestamp": data.get("timestamp")
            })
            print(f"[notify-py] Saved notification: {data}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            print(f"[notify-py] Failed to process message: {e}")

    channel.basic_consume(queue=queue_name, on_message_callback=callback)
    print("[notify-py] Waiting for messages in RabbitMQ...")
    channel.start_consuming()

# Start RabbitMQ worker in background
def start_worker():
    worker = threading.Thread(target=consume_notifications, daemon=True)
    worker.start()

# Run FastAPI with worker
if __name__ == "__main__":
    start_worker()
    import uvicorn
    port = int(os.getenv("NOTIFY_PORT", 8084))
    uvicorn.run(app, host="0.0.0.0", port=port)
