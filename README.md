# ⚓ ForgeHarbor: Advanced Threat Detection Platform

ForgeHarbor is a sophisticated, microservice-based application designed to provide robust security analysis of files and URLs. Built with a modern, polyglot technology stack, it leverages the strengths of Rust, Go, Python, and TypeScript to deliver a fast, reliable, and scalable threat detection solution.

## ✨ Features

- **Secure User Authentication**: JWT-based user registration and login system
- **Phishing URL Detection**: Real-time analysis of URLs for phishing threats using Google's Gemini API
- **Malware File Scanning**: Upload and scan files for malware and viruses using the VirusTotal API
- **Comprehensive Scan History**: Access a detailed history of all past analysis requests
- **Downloadable Reports**: Generate and download detailed JSON reports for each scan
- **Real-time Notifications**: Asynchronous notifications on scan completion via a message queue
- **Service Health Monitoring**: A dedicated dashboard to monitor the status of all backend services

## 🏗️ Architecture

ForgeHarbor utilizes a distributed microservices architecture. Each service is independently deployable and responsible for a distinct business capability. Services are containerized with Docker and orchestrated via Docker Compose. All external traffic is routed through a Kong API Gateway, which handles concerns like authentication and CORS.

```
+----------------+      +----------------+      +---------------------+
|   Web Client   |----->| Kong Gateway   |----->| Backend Services    |
| (React/Vite)   |      | (Port 8000)    |      | (Rust, Go, TS, Py)  |
+----------------+      +----------------+      +----------+----------+
                                                           |
               +----------------+   +----------------+   +-----------+
               |   MongoDB      |<--|   RabbitMQ     |<--|   Redis   |
               | (Data Store)   |   | (Message Bus)  |   | (Cache)   |
               +----------------+   +----------------+   +-----------+
```

## 🚀 Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React.js, Vite, Tailwind CSS, lucide-react |
| Backend Services | Rust (Actix Web), TypeScript (Fastify), Go (Gin), Python (FastAPI) |
| API Gateway | Kong |
| Databases | MongoDB (Primary Data), Redis (Caching/Sessions), PostgreSQL (Kong) |
| Message Broker | RabbitMQ (for asynchronous notifications) |
| Object Storage | Minio (for storing generated reports) |
| Containerization | Docker, Docker Compose |

## 🏁 Getting Started

Follow these instructions to get the ForgeHarbor platform running locally for development.

### Prerequisites

- Docker & Docker Compose
- Git for cloning the repository

### Installation & Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/m33ha1/forgeharbor.git
cd forgeharbor
```

#### 2. Create Configuration File

Create a file named `.env` inside the `apps/config/` directory. Paste the following content into it, replacing the placeholder API keys with your actual credentials.

```bash
# apps/config/.env

# API Keys (Replace with your actual keys)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
VIRUSTOTAL_API_KEY=YOUR_VIRUSTOTAL_API_KEY

# Database
MONGO_URI=mongodb://root:password123@fh-mongo:27017/forgeharbor?authSource=admin
REDIS_URL=redis://fh-redis:6379

# Object Storage
S3_ENDPOINT=http://fh-minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=reports
MINIO_ENDPOINT=fh-minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Message Queue
RABBITMQ_URL=amqp://guest:guest@fh-rabbit:5672/

# JWT
JWT_SECRET=your-super-secret-jwt-key-here-must-be-at-least-32-characters-long
JWT_ISSUER=forgeharbor
JWT_AUDIENCE=forgeharbor-users

# Service ports
AUTH_PORT=8080
PHISHING_PORT=8081
MALWARE_PORT=8082
HISTORY_PORT=8083
REPORT_PORT=8084
NOTIFY_PORT=8085
SERVICE_PORT=8080

# Logging
RUST_LOG=debug
NODE_ENV=development
```

#### 3. Run the Application

Navigate to the `deploy/compose` directory and use Docker Compose to build and start all the services.

```bash
cd deploy/compose
docker-compose -f docker-compose.dev.yml up -d --build
```

This command will build the images for all custom services and start them in the background. It may take several minutes the first time you run it.

### Accessing the Services

- **Web Application**: http://localhost:5173
- **API Gateway**: http://localhost:8000
- **RabbitMQ Management**: http://localhost:15672 (user: `guest`, pass: `guest`)
- **Minio Console**: http://localhost:9001 (user: `minioadmin`, pass: `minioadmin`)

## 🔧 Usage

Once the application is running, you can:

1. Navigate to http://localhost:5173
2. Sign up for a new account and log in
3. Use the dashboard to analyze URLs or upload files for scanning
4. View results and previous scans in the "History" section
5. Check the status of all microservices on your "Profile" page

## ↔️ API Endpoints

All backend services are exposed through the Kong API Gateway at http://localhost:8000.

### Authentication
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me` (Protected)

### Scanning
- `POST /scan/url` (Protected)
- `POST /scan/file` (Protected)

### History
- `GET /history` (Protected)
- `GET /history/:scan_id` (Protected)

### Reports
- `POST /reports` (Protected)
- `GET /reports/:id/download` (Protected)

## 📜 License

This project is licensed under the MIT License. See the LICENSE file for more details.
