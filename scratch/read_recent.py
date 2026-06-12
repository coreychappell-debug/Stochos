import json
import sys

# Set encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\corey\.gemini\antigravity\brain\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\.system_generated\logs\transcript.jsonl"
with open(log_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in lines[-250:]:
    try:
        obj = json.loads(line)
        t = obj.get("type")
        c = obj.get("content")
        if t in ("USER_INPUT", "PLANNER_RESPONSE") and c:
            print(f"[{t}]")
            print(c[:2000])
            print("="*60)
    except Exception as e:
        print(f"Error parsing: {e}")
