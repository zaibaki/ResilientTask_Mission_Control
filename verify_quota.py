import requests
import json
import time

API_URL = "http://localhost:8080"

def test_quota():
    print("[TEST] Testing Quota Enforcement...")
    
    # 1. Signup/Login
    username = f"quota_user_{int(time.time())}"
    print(f"Creating user: {username}")
    requests.post(f"{API_URL}/signup", json={"username": username, "password": "password"})
    login_res = requests.post(f"{API_URL}/login", json={"username": username, "password": "password"}).json()
    token = login_res["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check initial quota
    quota_res = requests.get(f"{API_URL}/users/me/quota", headers=headers).json()
    print(f"Initial Quota Usage: {quota_res['used']}/{quota_res['quota']}")

    # 3. Create tasks until quota is full (Default 100)
    # Let's create a batch of 10 replicas
    print("Dispatching 10 replicas...")
    requests.post(f"{API_URL}/tasks", headers=headers, json={
        "input_data": "Quota test batch",
        "replicas": 10
    })
    
    quota_res = requests.get(f"{API_URL}/users/me/quota", headers=headers).json()
    print(f"Quota after batch 1: {quota_res['used']}/{quota_res['quota']}")

    # 4. Try to exceed quota
    # We'll create another 95 tasks (total 105)
    print("Attempting to exceed quota (replicas=95)...")
    over_res = requests.post(f"{API_URL}/tasks", headers=headers, json={
        "input_data": "Exceed quota test",
        "replicas": 100
    })
    
    if over_res.status_code == 400:
        error_detail = over_res.json().get("detail", "")
        print(f"[SUCCESS] Server rejected over-quota request: {error_detail}")
    else:
        print(f"[FAILURE] Server accepted over-quota request (Status: {over_res.status_code})")

    # 5. Verify stability (30s task doesn't fail)
    print("[TEST] Verifying Worker Stability (30s work)...")
    task_res = requests.post(f"{API_URL}/tasks", headers=headers, json={
        "input_data": "Stability Test",
        "simulated_duration": 30,
        "max_execution_time": 60
    }).json()
    task_id = task_res[0]["id"]
    
    print(f"Task {task_id} dispatched. Waiting 35s...")
    time.sleep(35)
    
    status_res = requests.get(f"{API_URL}/tasks", headers=headers).json()
    my_task = next(t for t in status_res if t["id"] == task_id)
    print(f"Final Task Status: {my_task['status']}")
    
    if my_task["status"] == "Completed":
        print("[SUCCESS] No worker theft occurred.")
    else:
        print(f"[FAILURE] Task ended in state: {my_task['status']}")

if __name__ == "__main__":
    test_quota()
