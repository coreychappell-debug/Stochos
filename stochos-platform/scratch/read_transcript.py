import json

log_path = r"C:\Users\corey\.gemini\antigravity\brain\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\.system_generated\logs\transcript.jsonl"

try:
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT':
                print(f"--- Step {data.get('step_index')} ---")
                print(data.get('content'))
except Exception as e:
    print("Error:", e)
