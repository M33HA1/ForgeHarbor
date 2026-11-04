import os
import pymongo
import threading
import jwt
from worker import consume_forever, connected
from fastapi.responses import JSONResponse
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pathlib import Path
from dotenv import load_dotenv

# Load shared env from ../../config/.env
# Fix: Use environment variable override instead of path resolution
load_dotenv()

# MongoDB setup
mongo_uri = os.getenv("MONGO_URI", "mongodb://fh-mongo:27017")
mongo_db = os.getenv("MONGO_DB", "forgeharbor")
client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, socketTimeoutMS=5000)
db = client[mongo_db]
notifications_col = db["notifications"]

# RabbitMQ setup
rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@fh-rabbit:5672/")
queue_name = os.getenv("NOTIFY_QUEUE", "notifications")

# FastAPI app
app = FastAPI()
bearer_scheme = HTTPBearer(auto_error=False)
public_key_path = os.getenv("JWT_PUBLIC_KEY_PATH", "/app/config/jwt-public.pem")
with open(public_key_path, encoding="utf-8") as key_file:
    jwt_public_key = key_file.read()

def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    token = credentials.credentials if credentials is not None and credentials.scheme.lower() == "bearer" else request.cookies.get("fh_access")
    if not token:
        raise HTTPException(status_code=401, detail="authentication required")
    try:
        claims = jwt.decode(
            token,
            jwt_public_key,
            algorithms=["RS256"],
            issuer=os.getenv("JWT_ISSUER", "forgeharbor"),
            audience=os.getenv("JWT_AUDIENCE", "forgeharbor-users"),
            options={"require": ["sub", "exp", "iss", "aud"]},
        )
        if not isinstance(claims.get("sub"), str) or not claims["sub"]:
            raise HTTPException(status_code=401, detail="invalid token claims")
        return claims
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid token")

@app.get("/notify/health")
def health():
    try:
        db.command("ping")
        mongo_ready = True
    except pymongo.errors.PyMongoError:
        mongo_ready = False
    ready = mongo_ready and connected.is_set()
    return JSONResponse(status_code=200 if ready else 503, content={
        "status": "ok" if ready else "degraded", "service": "notify-py",
        "dependencies": {"mongo": mongo_ready, "consumer": connected.is_set()}})

@app.get("/notify")
def get_notifications(user=Depends(current_user)):
    """Get all notifications for the current user"""
    try:
        notifications = list(
            notifications_col.find({"user": user["sub"]}, {"_id": 0})
            .sort("timestamp", -1)
            .limit(100)
        )
        return {"notifications": notifications}
    except Exception:
        raise HTTPException(status_code=500, detail="failed to load notifications")

# Worker to consume messages
def consume_notifications():
    consume_forever(rabbitmq_url, queue_name, notifications_col)

# Start RabbitMQ worker in background
def start_worker():
    worker = threading.Thread(target=consume_notifications, daemon=True)
    worker.start()

# Run FastAPI with worker
if __name__ == "__main__":
    start_worker()
    import uvicorn
    port = int(os.getenv("NOTIFY_PORT", 8085))
    uvicorn.run(app, host="0.0.0.0", port=port)
