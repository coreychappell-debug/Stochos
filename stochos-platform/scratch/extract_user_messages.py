import json

log_path = r"C:\Users\corey\.gemini\antigravity\brain\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\.system_generated\logs\transcript.jsonl"
out_path = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform\scratch\user_messages.txt"

try:
    with open(log_path, 'r', encoding='utf-8') as f, open(out_path, 'w', encoding='utf-8') as out:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    out.write(f"=== Step {data.get('step_index')} ===\n")
                    out.write(data.get('content') + "\n\n")
            except Exception as e:
                pass
    print("Successfully extracted user messages to user_messages.txt")
except Exception as e:
    print("Error:", e)
