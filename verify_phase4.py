import requests
import random
import time

API_URL = "http://localhost:8080"
USERNAME = f"user_phase4_{random.randint(1000,9999)}"
PASSWORD = "password123"

def log(msg):
    print(f"[TEST] {msg}")

def get_token():
    # Signup
    requests.post(f"{API_URL}/signup", json={"username": USERNAME, "password": PASSWORD})
    # Login
    r = requests.post(f"{API_URL}/login", json={"username": USERNAME, "password": PASSWORD})
    if r.status_code != 200:
        log(f"Login failed: {r.text}")
        return None
    return r.json()["access_token"]

def test_bulk_delete(token):
    headers = {"Authorization": f"Bearer {token}"}
    # 0. Test Custom Persistence
    log("Testing Custom Timeout Persistence (505s)...")
    r = requests.post(f"{API_URL}/tasks", json={
        "input_data": "Test Persistence", 
        "task_type": "text_processing",
        "max_execution_time": 505
    }, headers=headers)
    if r.status_code == 200:
        data = r.json()
        if data["max_execution_time"] == 505:
            log("Persistence Test: SUCCESS (Saved 505s)")
        else:
            log(f"Persistence Test: FAILED (Saved {data['max_execution_time']}s)")
    else:
        log("Persistence Test: Request Failed")

    # 0. Test Explicit Duration Control
    log("Testing Explicit Duration Control (50s duration, 100s timeout)...")
    # Case A: Duration < Timeout -> Should COMPLETE in approx 50s
    r = requests.post(f"{API_URL}/tasks", json={
        "input_data": "Standard Task", 
        "task_type": "text_processing",
        "max_execution_time": 100,
        "simulated_duration": 50
    }, headers=headers)
    
    if r.status_code == 200:
        task_id = r.json()["id"]
        log(f"Task {task_id} created with 50s duration. Checking status after 5s...")
        time.sleep(5)
        t = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers).json()
        if t["status"] == "Processing":
            log("Task correctly in 'Processing' status.")
        else:
            log(f"Task status mismatch: {t['status']}")
            
    # Case B: Duration (10s) > Timeout (5s) -> Should TIME OUT
    log("Testing Timeout (10s duration, 5s timeout)...")
    r = requests.post(f"{API_URL}/tasks", json={
        "input_data": "Timeout Test", 
        "task_type": "text_processing",
        "max_execution_time": 5,
        "simulated_duration": 10
    }, headers=headers)
    
    if r.status_code == 200:
        task_id = r.json()["id"]
        # Poll for failure
        for _ in range(10):
            time.sleep(1)
            t = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers).json()
            if t["status"] == "Failed" and "Timed Out" in str(t.get("result", "")):
                log("Case B (Duration > Timeout): SUCCESS")
                break
        else:
             log("Case B (Duration > Timeout): FAILED (Status not updated)")

    # 1. Create multiple tasks
    log("Creating 3 tasks...")
    task_ids = []
    for i in range(3):
        r = requests.post(f"{API_URL}/tasks", json={
            "input_data": f"Task {i}", 
            "task_type": "text_processing",
            "max_execution_time": 30
        }, headers=headers)
        task_ids.append(r.json()["id"])
        
    log(f"Created Task IDs: {task_ids}")

    # 2. Delete All
    log("Executing Bulk Delete...")
    r = requests.delete(f"{API_URL}/tasks", headers=headers)
    if r.status_code == 200:
        log("Delete Request: OK")
    else:
        log(f"Delete Failed: {r.text}")
        return

    # 3. Verify IDs are gone
    all_gone = True
    for tid in task_ids:
        r = requests.get(f"{API_URL}/tasks/{tid}", headers=headers)
        if r.status_code != 404:
            log(f"Task {tid} still exists! Status: {r.status_code}")
            all_gone = False
    
    if all_gone:
        log("Bulk Delete Verification: SUCCESS")
    else:
        log("Bulk Delete Verification: FAILED")

if __name__ == "__main__":
    token = get_token()
    if token:
        test_bulk_delete(token)
