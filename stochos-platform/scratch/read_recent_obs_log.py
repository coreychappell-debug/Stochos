import os

obs_path = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform\logs\observability.log"

if os.path.exists(obs_path):
    with open(obs_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        print(f"Total lines: {len(lines)}")
        last_lines = lines[-50:]
        for idx, line in enumerate(last_lines):
            line_num = len(lines) - 50 + idx
            clean = line.strip().encode("ascii", errors="replace").decode("ascii")
            print(f"[{line_num}] {clean}")
else:
    print("Log not found.")
