import requests
import time
import subprocess
import re
import sys

API_URL = "http://localhost:8080"

def log(msg):
    print(f"[RELIABILITY] {msg}")

def get_token():
    r = requests.post(f"{API_URL}/login")
    return r.json()["access_token"]

def submit_task(token):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{API_URL}/tasks", json={"input_data": "Make me reliable"}, headers=headers)
    return r.json()["id"]

def get_worker_for_task(task_id):
    # Polling logs to find who picked it up
    log(f"Waiting for worker to pick up task {task_id}...")
    start = time.time()
    while time.time() - start < 10:
        # Run docker compose logs
        result = subprocess.run(
            ["docker", "compose", "logs", "worker"], 
            capture_output=True, text=True
        )
        # Look for [HOSTNAME] Processing task ID
        # Pattern: \[([a-f0-9]+)\] Processing task <task_id>
        match = re.search(f"\\[([a-f0-9]+)\\] Processing task {task_id}", result.stdout)
        if match:
            worker_id = match.group(1)
            log(f"Task {task_id} picked up by worker {worker_id}")
            return worker_id
        time.sleep(1)
    return None

def kill_worker(worker_id):
    try:
        log(f"Killing worker {worker_id}...")
        subprocess.run(["docker", "stop", worker_id], check=True)
        log(f"Worker {worker_id} killed.")
    except Exception as e:
        log(f"Failed to kill worker: {e}")

def wait_for_completion(task_id, token):
    headers = {"Authorization": f"Bearer {token}"}
    log(f"Waiting for task {task_id} to complete (Reliability check)...")
    
    # We expect it within ~15s (10s consumer timeout + processing)
    for _ in range(30):
        r = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers)
        task = r.json()
        if task["status"] == "Completed":
            log(f"Task {task_id} COMPLETED! Result: {task['result']}")
            if "Processed by" in task["result"]:
                 log("Reliability Verified successfully!")
            return True
        time.sleep(1)
    
    log(f"Task {task_id} timed out / failed to complete.")
    return False

if __name__ == "__main__":
    token = get_token()
    task_id = submit_task(token)
    
    # Wait a moment for pickup but BEFORE it finishes (it takes 5s)
    # Pickup is usually instantaneous.
    worker_id = get_worker_for_task(task_id)
    
    if worker_id:
        kill_worker(worker_id)
        # Now wait for recovery
        wait_for_completion(task_id, token)
    else:
        log("Could not identify worker in time.")
