import json
import sys

# Set encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\corey\.gemini\antigravity\brain\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\.system_generated\logs\transcript.jsonl"
with open(log_path, 'r', encoding='utf-8') as f:
    for idx, line in enumerate(f):
        try:
            obj = json.loads(line)
            content = obj.get("content", "") or ""
            # If the planner response or user input contains "Step 1:" or "Step 2:" or "Step 3:" or "Step 4:"
            # or matches "proposed steps" or lists of tasks, let's print it.
            if "Step 1:" in content and "Step 2:" in content and "Step 3:" in content:
                print(f"Line {idx} (Step {obj.get('step_index')}):")
                print(content[:1500])
                print("="*80)
        except Exception as e:
            pass
