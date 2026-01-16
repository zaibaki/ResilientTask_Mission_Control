import requests
import time
import sys
import json

API_URL = "http://localhost:8080"

def log(msg):
    print(f"[TEST] {msg}")

def check_health():
    try:
        r = requests.get(f"{API_URL}/health")
        if r.status_code == 200:
            log("Health Check: OK")
            return True
        else:
            log(f"Health Check Failed: {r.status_code}")
            return False
    except Exception as e:
        log(f"Health Check Error: {e}")
        return False

def get_token():
    try:
        r = requests.post(f"{API_URL}/login")
        if r.status_code == 200:
            token = r.json().get("access_token")
            log("Login: OK")
            return token
        else:
            log(f"Login Failed: {r.status_code}")
            return None
    except Exception as e:
        log(f"Login Error: {e}")
        return None

def submit_tasks(token, count=10):
    log(f"Submitting {count} tasks...")
    headers = {"Authorization": f"Bearer {token}"}
    for i in range(count):
        payload = {"input_data": f"Stress Test {i}"}
        try:
            r = requests.post(f"{API_URL}/tasks", json=payload, headers=headers)
            if r.status_code == 200:
                pass # log(f"Task {i} Submitted")
            else:
                log(f"Task {i} Failed: {r.status_code}")
        except Exception as e:
            log(f"Task {i} Error: {e}")
    log("All tasks submitted.")

def monitor_tasks(token):
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(10):
        try:
            r = requests.get(f"{API_URL}/tasks?limit=10", headers=headers)
            tasks = r.json()
            completed = sum(1 for t in tasks if t['status'] == 'Completed')
            processing = sum(1 for t in tasks if t['status'] == 'Processing')
            pending = sum(1 for t in tasks if t['status'] == 'Pending')
            log(f"Status: {completed} Completed, {processing} Processing, {pending} Pending")
            time.sleep(2)
        except Exception as e:
            log(f"Monitor Error: {e}")

if __name__ == "__main__":
    log("Waiting for API to be ready...")
    for _ in range(30):
        if check_health():
            break
        time.sleep(2)
    
    token = get_token()
    if not token:
        sys.exit(1)
        
    submit_tasks(token, 10)
    monitor_tasks(token)
