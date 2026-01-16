import requests
import time
import sys
import random

API_URL = "http://localhost:8080"

def log(msg):
    print(f"[TEST] {msg}")

def signup_login():
    username = f"user_{random.randint(1000,9999)}"
    password = "password123"
    
    # Signup
    try:
        r = requests.post(f"{API_URL}/signup", json={"username": username, "password": password})
        if r.status_code == 200:
            log(f"Signup ({username}): OK")
        else:
            log(f"Signup Failed: {r.text}")
            return None
    except Exception as e:
        log(f"Signup Error: {e}")
        return None

    # Login
    try:
        r = requests.post(f"{API_URL}/login", json={"username": username, "password": password})
        if r.status_code == 200:
            token = r.json().get("access_token")
            log("Login: OK")
            return token
        else:
            log(f"Login Failed: {r.text}")
            return None
    except Exception as e:
        log(f"Login Error: {e}")
        return None

def test_cancellation(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Submit Long Task
    payload = {"input_data": "long run", "max_execution_time": 60}
    r = requests.post(f"{API_URL}/tasks", json=payload, headers=headers)
    task_id = r.json()["id"]
    log(f"Submitted Long Task: {task_id}")
    
    # Wait for processing
    time.sleep(2) 
    
    # 2. Cancel it
    r = requests.post(f"{API_URL}/tasks/{task_id}/cancel", headers=headers)
    if r.status_code == 200:
        log("Cancellation Request: OK")
    else:
        log(f"Cancellation Failed: {r.text}")

    # 3. Verify Cancelled Status
    for _ in range(5):
        r = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers)
        status = r.json()["status"]
        if status == "Cancelled" or r.json()["is_cancelled"]:
            log("Verified Task is Cancelled!")
            return
        time.sleep(1)
    
    log(f"Failed to verify cancellation. Final status: {status}")

def test_timeout(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Submit Short Max Time Task (input not 'long' by default runs 5s, so we set max=2)
    # But worker logic: wait 5s normally. If max_time=2, it should timeout.
    payload = {"input_data": "timeout test", "max_execution_time": 2}
    r = requests.post(f"{API_URL}/tasks", json=payload, headers=headers)
    task_id = r.json()["id"]
    log(f"Submitted Timeout Task: {task_id} (Max=2s)")
    
    # Wait
    time.sleep(6)
    
    r = requests.get(f"{API_URL}/tasks/{task_id}", headers=headers)
    status = r.json()["status"]
    if status == "Failed" and "Timed Out" in (r.json()["result"] or ""):
         log("Verified Task Timed Out!")
    else:
         log(f"Failed to verify timeout. Status: {status}")

if __name__ == "__main__":
    token = signup_login()
    if not token:
        sys.exit(1)
        
    test_cancellation(token)
    test_timeout(token)
