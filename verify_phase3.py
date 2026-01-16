import requests
import time
import sys
import random

API_URL = "http://localhost:8080"
USERNAME = f"user_phase3_{random.randint(1000,9999)}"
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

def test_task_types(token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Submit Image Gen (Medium Duration ~10s)
    log("Submitting Image Gen Task...")
    r = requests.post(f"{API_URL}/tasks", json={
        "input_data": "cat image", 
        "task_type": "image_gen",
        "max_execution_time": 30
    }, headers=headers)
    img_id = r.json()["id"]
    
    # 2. Submit Text Processing (Short Duration ~5s)
    log("Submitting Text Task...")
    r = requests.post(f"{API_URL}/tasks", json={
        "input_data": "summarize", 
        "task_type": "text_processing",
        "max_execution_time": 30
    }, headers=headers)
    text_id = r.json()["id"]

    # Verify Durations
    log("Waiting for completion...")
    
    # Text should finish first
    start = time.time()
    text_done = False
    img_done = False
    
    while time.time() - start < 30:
        if not text_done:
            r = requests.get(f"{API_URL}/tasks/{text_id}", headers=headers)
            status = r.json()["status"]
            if status == "Completed":
                text_time = time.time() - start
                log(f"Text Task Completed in {text_time:.2f}s")
                text_done = True
            elif status == "Failed":
                log(f"Text Task FAILED: {r.json()}")
                break
        
        if not img_done:
            r = requests.get(f"{API_URL}/tasks/{img_id}", headers=headers)
            status = r.json()["status"]
            if status == "Completed":
                img_time = time.time() - start
                log(f"Image Task Completed in {img_time:.2f}s")
                img_done = True
            elif status == "Failed":
                log(f"Image Task FAILED: {r.json()}")
                break
            else:
                # Debug
                print(f"Image Task Status: {status}", end="\r")
        
        if text_done and img_done:
            break
        time.sleep(1)

    if text_done and img_done:
        log("Task Type Verification: SUCCESS")
    else:
        log("Task Type Verification: FAILED (Timed out)")

if __name__ == "__main__":
    token = get_token()
    if token:
        test_task_types(token)
