import os

watchdog_path = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\watchdog.log"

if os.path.exists(watchdog_path):
    with open(watchdog_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        print(f"Total lines: {len(lines)}")
        last_lines = lines[-100:]
        for idx, line in enumerate(last_lines):
            line_num = len(lines) - 100 + idx
            clean = line.strip().encode("ascii", errors="replace").decode("ascii")
            print(f"[{line_num}] {clean}")
else:
    print("Log not found.")
