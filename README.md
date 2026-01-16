# ResilientTask Mission Control 🛰️

A production-grade distributed task orchestrator designed for high-availability workloads, featuring a premium dashboard and robust resource management.

## 🚀 Overview

ResilientTask is a distributed system built to handle intensive asynchronous workloads with zero-latency feedback. It features a sophisticated Next.js dashboard, a FastAPI gateway, and a scalable pool of Python workers coordinated via Redis Streams and PostgreSQL.

### Key Features

*   **Premium Mission Control**: Real-time task monitoring with optimistic UI updates.
*   **Recursive Stability**: Worker failover logic with `XAUTOCLAIM` to prevent task theft.
*   **Resource Command Deck**: Real-time quota enforcement with dynamic SVG-based usage visualizations.
*   **Selective Simulation**: Explicit control over "Simulated Duration" vs "Max Execution Timeout".
*   **Admin Power Suite**: Global user registry, system-wide purge capabilities, and role-based access control.
*   **Batch Dispatch**: Native support for up to 100 replicas in a single sequence.

## 🛠️ Architecture

*   **Frontend**: Next.js 15+, Tailwind CSS, Framer Motion.
*   **Backend**: FastAPI (Python 3.11), SQLAlchemy (PostgreSQL), PyJWT.
*   **Broker**: Redis (Streams & Key-Value).
*   **Workers**: Async Python consumers with smart-sleep cancellation logic.
*   **Infrastructure**: Docker Compose, Nginx Load Balancer.

## 🧠 Core Implementation Details

### 1. High-Availability & Reliability
- **XAUTOCLAIM Consumer Group**: We use Redis Streams with an optimized `XAUTOCLAIM` idle time (30 minutes). This ensures that if a worker crashes, another worker can eventually "claim" the task, but it prevents active long-running tasks from being "stolen" by other workers while they are still processing.
- **Smart Cancellation**: Workers utilize an asynchronous "Smart Sleep" mechanism that checks the database for `is_cancelled` flags at frequent intervals (1s), allowing for graceful termination of long-running workloads.

### 2. Resource Management & Quotas
- **Backend Enforcement**: Every task dispatch is validated against the user's `task_quota` stored in PostgreSQL. Batch dispatches (replicas) are tracked atomically to prevent over-allocation.
- **Dynamic Visualization**: The frontend's "Resource Command Deck" polls usage every 5 seconds, calculating "Usage Velocity" and displaying a real-time SVG pulse of system activity.

### 3. Real-Time Experience
- **Optimistic UI Updates**: Task replicas are injected into the local frontend state immediately upon submission, providing instant feedback while the backend processes the batch.
- **Asynchronous Polling**: A 5-second delta-sync strategy keeps the global task feed and metrics updated without overwhelming the API gateway.

### 4. Administrative Oversight
- **Global Protocol Reset**: Admins have access to a "Protocol Format" tool that uses SQL `TRUNCATE` with identity resets. This provides a clean slate by clearing all task records and resetting ID sequences system-wide.

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
