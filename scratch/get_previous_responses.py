import json
import sys

# Set encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\corey\.gemini\antigravity\brain\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\.system_generated\logs\transcript.jsonl"

steps = []
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
            steps.append(obj)
        except Exception as e:
            pass

for idx in range(8240, min(8270, len(steps))):
    step = steps[idx]
    t = step.get("type")
    c = step.get("content")
    tc = step.get("tool_calls")
    print(f"Index {idx} | Step {step.get('step_index')} | Type {t}")
    if c:
        print(f"Content: {c[:1000]}")
    if tc:
        print(f"Tool Calls: {json.dumps(tc)[:1000]}")
    print("-"*60)
