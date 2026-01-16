# ResilientTask Orchestrator: Setup & Execution Guide

Follow these instructions to deploy, verify, and manage the ResilientTask distributed orchestrator.

---

## 1. Prerequisites
Ensure you have the following installed on your host system:
- **Docker** (20.10+)
- **Docker Compose** (V2 recommended)
- **Python 3.x** (optional, for running local verification scripts)

---

## 2. Quick Start (One-Command Deployment)

Navigate to the project root and run:
```bash
docker compose up -d --build
```
This command builds the images and starts all 8 containers (API, Web, Redis, Postgres, Nginx, and 3 Workers).

---

## 3. Accessing the Services

Once the containers are healthy, you can access the system at:

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:3000](http://localhost:3000) | Main Mission Control Dashboard |
| **API Docs** | [http://localhost:8080/docs](http://localhost:8080/docs) | Interactive Swagger API Documentation |
| **Backend API** | [http://localhost:8080](http://localhost:8080) | Base API endpoint (via Nginx) |

---

## 4. Testing & Verification

We provide automated scripts to verify the system's reliability and Phase 4 features.

### 4.1 Local Verification
Install dependencies (requests):
```bash
pip install requests
```

Run the Phase 4 test suite:
```bash
python3 verify_phase4.py
```
This script validates:
- **User Authentication** (Signup/Login)
- **Custom Timeout Persistence** (e.g., setting a 505s limit)
- **Explicit Workload Control** (e.g., simulating a 50s task)
- **Batch Dispatch**: Validates creating multiple task replicas in a single call.
- **Bulk Deletion** (Clearing history safely)

---

## 5. Operational Commands

### 5.1 Scaling Workers
To increase processing power (Horizontal Scaling):
```bash
docker compose up -d --scale worker=10
```

### 5.2 Viewing Logs
To debug a specific service:
```bash
docker compose logs -f api      # Follow API logs
docker compose logs -f worker   # Follow Worker logs
```

### 5.3 Resetting the Environment
To wipe all data (tasks, users, redis state) for a fresh start:
```bash
docker compose down -v
docker compose up -d --build
```

### 5.4 Selective Restarts
If you modify only the frontend or worker:
```bash
docker compose up -d --build web
docker compose up -d --build worker
```

---

## 6. Troubleshooting

- **CORS Errors**: Ensure you are accessing through `localhost:3000`. Nginx is configured to only permit authorized origins.
- **Port Conflicts**: Ensure ports `80`, `3000`, `8080`, `5432`, and `6379` are not in use by other local services.
- **Database Connection**: On first start, the API might wait for Postgres to be healthy. Check `docker compose logs api` if it fails to start.
