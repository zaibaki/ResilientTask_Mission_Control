# ResilientTask Mission Control 🛰️

A production-grade distributed task orchestrator designed for high-availability workloads, featuring a premium dashboard and robust resource management.

## 🚀 Overview

ResilientTask is a distributed system built to handle intensive asynchronous workloads with zero-latency feedback. It features a sophisticated Next.js dashboard, a FastAPI gateway, and a scalable pool of Python workers coordinated via Redis Streams and PostgreSQL.

## 🏗️ Architectural Pillars

The ResilientTask Orchestrator is engineered to satisfy the rigorous demands of enterprise-grade distributed systems.

### 1. Scalability (Horizontal & Vertical)
- **Scaling Workers**: The system supports effortless horizontal scaling. By increasing the `replicas` count in the `docker-compose.yml`, you can deploy dozens of workers to handle massive stream spikes.
- **Stateless Gateway**: The FastAPI backend is entirely stateless, allowing it to be replicated behind a load balancer without session stickiness concerns.

### 2. Load Balancing
- **Nginx Ingress**: Nginx serves as the primary load balancer, distributing incoming API traffic across multiple gateway instances.
- **Natural Stream Distribution**: Redis Streams automatically balances the workload. When multiple workers join the same consumer group, Redis ensures each task is delivered to exactly one available worker, maximizing throughput.

### 3. Reliability & Fault Tolerance
- **Task Failover**: Utilizing Redis `XAUTOCLAIM`, the system identifies "hanging" tasks (e.g., from a crashed worker) and reassigns them to healthy workers after a 30-minute safety window.
- **Persistent State**: PostgreSQL acts as the source of truth for task history. Even if the entire broker (Redis) is flushed, the historical data and results remain intact.

### 4. Security
- **JWT Protection**: Every API endpoint is guarded by JSON Web Token (JWT) authentication. This ensures that only verified operators can dispatch missions or access administrative tools.
- **Hashed Identities**: User credentials never touch the database in plain text; they are secured using `bcrypt` with unique salts.
- **Role-Based Access (RBAC)**: The system distinguishes between Operators and Administrators, restricting high-privilege actions (like global purges) to specific account tiers.

### 5. Redundancy
- **Worker Redundancy**: The multi-worker pool ensures zero downtime if individual containers fail.
- **Docker Healthchecks**: The infrastructure uses automated healthchecks to monitor the status of Postgres and Redis, triggering restarts if dependencies become unresponsive.

## 🚦 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (for local web development)
- Python 3.11+ (for local API/Worker development)

### Quick Start (Docker)
1. Clone the repository:
   ```bash
   git clone https://github.com/zaibaki/ResilientTask_Mission_Control.git
   cd ResilientTask_Mission_Control
   ```
2. Launch the entire stack:
   ```bash
   docker-compose up -d --build
   ```
3. Access the Dashboard:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **API Entry (Nginx)**: [http://localhost:8080](http://localhost:8080)

### Local Manual Development
- **API**: `cd api && uvicorn main:app --reload`
- **Web**: `cd web && npm run dev`
- **Worker**: `cd worker && python worker.py`

## 🛡️ Administrative Access
For demo purposes, all new users are granted **Administrator** status.
- **Test Admin Alias**: `admin_test`
- **Password**: `password123`

---
*Built for resilient, distributed task orchestration.*
