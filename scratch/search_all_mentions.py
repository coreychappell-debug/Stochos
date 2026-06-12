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
            if "Step 3:" in content and "Step 4:" in content:
                print(f"Line {idx} (Step {obj.get('step_index')}) Type {obj.get('type')}:")
                # Print occurrences of lists
                print(content[:1500])
                print("="*80)
        except Exception as e:
            pass
