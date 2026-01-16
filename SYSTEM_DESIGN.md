# ResilientTask Orchestrator: System Design & Architecture

ResilientTask is a High-Availability (HA) Distributed Task Orchestrator designed to handle long-running workloads with strict reliability, visibility, and control requirements.

---

## 1. Core Principles & Philosophy

### 1.1 Reliable Execution (At-Least-Once Delivery)
We use **Redis Streams** combined with **Consumer Groups** to ensure no task is lost.
- **ACK Mechanism**: Workers only acknowledge a task after successful processing.
- **Auto-Failover**: If a worker crashes mid-task, the system uses `XAUTOCLAIM` to re-assign stalled tasks to healthy workers after a 10s timeout.

### 1.2 Deterministic Control (Workload vs. Timeout)
To solve the ambiguity of task scheduling, we decouple the simulation from the safety limits:
- **Simulated Workload**: The actual "heavy-lifting" duration requested by the user.
- **Max Allowed Time (Timeout)**: A hard safety ceiling. If a task exceeds this (e.g., due to an infinite loop), the worker terminates it forcefully.

### 1.3 High-Context Visibility
The system prioritizes user feedback through **Optimistic UI**.
- **Instant Feed**: Tasks appear in the dashboard the millisecond they are submitted, using temporary client-side IDs before the backend confirmation arrives.
- **Live Monitoring**: Real-time polling and metric tracking (Active, Completed, Failed, Cancelled).

### 1.4 Native Batch Dispatch (Replicas)
The system supports atomic mass-dispatching through its **Replica Engine**.
- **Burst Load**: Users can initialize up to 50 replicas of a single task in a single request. 
- **Distributed Distribution**: Because workers use a competing consumer pattern, these replicas are immediately spread across the entire worker pool, allowing for massive parallel processing of similar jobs.

---

## II. Core Client-Server Principles

The ResilientTask architecture is built upon the foundational pillars of modern client-server systems.

### 2.1 Scalability
The system supports **Horizontal Scalability** across multiple layers:
- **Worker Tier**: Workers are stateless. You can scale from 1 to 100+ workers using `docker compose up --scale worker=N`. Each worker joins the same Redis Consumer Group, automatically load-balancing the task stream.
- **API Tier**: The FastAPI backend is stateless. In a production environment, multiple API instances can run behind a load balancer (like the included Nginx) to handle increased request volume.
- **Database**: PostgreSQL handles persistent state, allowing the application logic to remain lightweight and horizontally scalable.

### 2.2 Load Balancing
Distribution of work happens at two levels:
- **Request Level**: Nginx acts as a **Reverse Proxy and Load Balancer**, routing incoming traffic to the appropriate service (Web or API) and managing SSL/CORS.
- **Task Level**: Redis **Consumer Groups** implement a "Competing Consumers" pattern. Redis ensures that each task in the stream is delivered to exactly one available worker, preventing redundant processing and naturally balancing the workload across the pool.

### 2.3 Reliability & Fault Tolerance
Reliability is achieved through **At-Least-Once Delivery** semantics:
- **Acknowledgment (ACK)**: Tasks are not removed from the Redis pending list until the worker explicitly sends an `XACK`. If a worker fails, the task remains "Pending".
- **Automatic Failover**: Using `XAUTOCLAIM`, healthy workers periodically scan for "stale" tasks (messages pending for >10s). If found, they "claim" the task and restart the processing, ensuring that even worker crashes don't lead to lost jobs.
- **Persistence**: While Redis acts as the high-speed bus, PostgreSQL provides a durable source of truth for task history, ensuring state survives system restarts.

### 2.4 Security
Multiple layers of defense protect the system:
- **Authentication**: JWT (JSON Web Tokens) are used for all state-changing operations. The API verifies the HS256 signature on every request.
- **Identity Protection**: User passwords are saved using **bcrypt** with salted hashing, ensuring that even a database leak does not compromise plain-text credentials.
- **Resource Ownership**: The system enforces **Strict Ownership Scoping**. Users can only query, cancel, or delete tasks associated with their `owner_id`.
- **Network Security**: Nginx manages CORS (Cross-Origin Resource Sharing) policies, ensuring only authorized origins can interact with the API.

### 2.5 Redundancy
Redundancy is built into the infrastructure to prevent Single Points of Failure (SPOF):
- **Service Redundancy**: By default, the system runs 3 worker instances. If one container fails, the remaining two continue to process the queue without interruption.
- **Data Redundancy**: Docker Volumes (`postgres_data`, `redis_data`) ensure that even if containers are destroyed and recreated, the state is preserved on the host disk.

---

## III. System Architecture

### 3.1 The "Smart Sleep" Loop
Instead of a standard `time.sleep()`, workers execute a granular loop:
```python
while elapsed < duration:
    if check_is_cancelled(): break  # Immediate response to user "Abort"
    if total_time > max_allowed: break # Safety termination
    time.sleep(1)
```
This ensures the system is responsive to cancellations even during 15-minute tasks.

### 3.2 Security Model
- **Token-Based**: All API endpoints (except Login/Signup) require a valid JWT.
- **Ownership Scoping**: Users can only see, cancel, or delete tasks they own. The "Clear History" button is globally safe as it filters by `owner_id`.

### 3.3 Horizontal Scaling
The system is stateless. To increase throughput, more worker containers can be added (`docker compose up --scale worker=N`) without any configuration changes.

---

## 4. Operational Maintenance
- **Database Reset**: `docker compose down -v` wipes all persistence for clean testing.
- **Health Checks**: API provides a `/health` endpoint for infrastructure monitoring.
- **Bulk Cleanup**: Users can clear their history via `DELETE /tasks`, which performs a metadata wipe of their personal task logs.
