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
