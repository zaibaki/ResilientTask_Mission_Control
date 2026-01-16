import redis
import psycopg2
import os
import time
import json
import socket
import sys

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/taskdb")
STREAM_KEY = "task_stream"
GROUP_NAME = "task_workers"
CONSUMER_NAME = socket.gethostname() # Unique container ID

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Error connecting to DB: {e}")
        return None

def process_task(task_data):
    task_id = task_data.get('task_id')
    print(f"[{CONSUMER_NAME}] Processing task {task_id}")
    
    conn = get_db_connection()
    if not conn:
        print(f"[{CONSUMER_NAME}] DB Connection failed")
        return

    cur = conn.cursor()
    # Fetch task details (input, max_execution_time, task_type, simulated_duration)
    cur.execute("SELECT input_data, max_execution_time, task_type, simulated_duration FROM tasks WHERE id = %s", (task_id,))
    row = cur.fetchone()
    
    if not row:
        print(f"[{CONSUMER_NAME}] Task {task_id} not found in DB")
        cur.close()
        conn.close()
        return

    input_val, max_time, task_type, duration = row
    max_time = max_time if max_time else 30 
    duration = duration if duration else 5 
    
    print(f"[{CONSUMER_NAME}] Task {task_id} Details -> Type: {task_type}, Timeout: {max_time}s, Duration: {duration}s")
    
    # Update status to Processing
    cur.execute("UPDATE tasks SET status = 'Processing', updated_at = NOW() WHERE id = %s", (task_id,))
    conn.commit()
    
    # "Smart Sleep" Loop
    start_time = time.time()
    cancelled = False
    timed_out = False
    
    elapsed = 0
    while elapsed < duration:
        # 1. Check Cancellation
        cur.execute("SELECT is_cancelled FROM tasks WHERE id = %s", (task_id,))
        check_row = cur.fetchone()
        if check_row and check_row[0]:
            cancelled = True
            break
        
        # 2. Check Max Time
        total_elapsed = time.time() - start_time
        if total_elapsed > max_time:
            timed_out = True
            break
        
        time.sleep(1)
        elapsed += 1
    
    # Finalize
    if cancelled:
        print(f"[{CONSUMER_NAME}] Task {task_id} CANCELLED")
        # Already marked as Cancelled by API, but let's ensure consistency or logging
    elif timed_out:
        print(f"[{CONSUMER_NAME}] Task {task_id} TIMED OUT")
        cur.execute("UPDATE tasks SET status = 'Failed', result = 'Timed Out', updated_at = NOW() WHERE id = %s", (task_id,))
        conn.commit()
    else:
        # Completed successfully
        result_val = input_val[::-1]
        cur.execute("UPDATE tasks SET status = 'Completed', result = %s, updated_at = NOW() WHERE id = %s", 
                    (f"Processed by {CONSUMER_NAME}: {result_val}", task_id))
        conn.commit()
        print(f"[{CONSUMER_NAME}] Task {task_id} COMPLETED")

    cur.close()
    conn.close()
    

def main():
    # redis_client
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

    # Create Consumer Group
    try:
        r.xgroup_create(STREAM_KEY, GROUP_NAME, mkstream=True)
        print(f"[{CONSUMER_NAME}] Consumer group created")
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            print(f"[{CONSUMER_NAME}] Consumer group already exists")
        else:
            print(f"[{CONSUMER_NAME}] Error creating group: {e}")

    print(f"[{CONSUMER_NAME}] Worker started. Waiting for tasks...")

    while True:
        try:
            # 1. READ NEW MESSAGES
            # Count 1, Block 2000ms
            entries = r.xreadgroup(GROUP_NAME, CONSUMER_NAME, {STREAM_KEY: ">"}, count=1, block=2000)

            if entries:
                for stream, messages in entries:
                    for message_id, data in messages:
                        try:
                            process_task(data)
                            r.xack(STREAM_KEY, GROUP_NAME, message_id)
                            print(f"[{CONSUMER_NAME}] Task ACKed")
                        except Exception as e:
                            print(f"[{CONSUMER_NAME}] Error processing: {e}")
            
            # 2. FAILOVER / RELIABILITY CHECK (The "Retry" Logic)
            # Check for pending messages that are older than 10 seconds (stalled workers)
            # This allows other workers to pick up the slack.
            try:
                # XAUTOCLAIM key group consumer min-idle-time start [COUNT count] [JUSTID]
                # min-idle-time in ms. 1800000 = 30m.
                claimed = r.xautoclaim(STREAM_KEY, GROUP_NAME, CONSUMER_NAME, 1800000, start_id="0-0", count=1)
                # claimed returns: [next_start_id, [messages]]
                if claimed and len(claimed) > 1 and claimed[1]:
                     messages = claimed[1]
                     for message_id, data in messages:
                         print(f"[{CONSUMER_NAME}] !!! CLAIMED STALLED TASK {message_id} !!!")
                         try:
                            process_task(data)
                            r.xack(STREAM_KEY, GROUP_NAME, message_id)
                            print(f"[{CONSUMER_NAME}] Claimed Task ACKed")
                         except Exception as e:
                            print(f"[{CONSUMER_NAME}] Error processing claimed task: {e}")

            except Exception as e:
                # xautoclaim might fail on older redis versions, but we used redis:7 in docker-compose.
                print(f"Failover check error: {e}")

        except Exception as e:
            print(f"[{CONSUMER_NAME}] Loop Error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()
