import os

watchdog_path = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\watchdog.log"
obs_path = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform\logs\observability.log"

def scan_log(path, num_lines=100):
    if not os.path.exists(path):
        print(f"File {path} does not exist.")
        return
    print(f"\n=== Recent errors in {os.path.basename(path)} ===")
    
    # Read last N lines
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            # Find lines containing fomo/territories/apply or Exception/Error
            interesting = []
            for i, line in enumerate(lines):
                lower_line = line.lower()
                if "error" in lower_line or "exception" in lower_line or "prisma" in lower_line or "failed" in lower_line or "rollback" in lower_line:
                    interesting.append((i, line))
            
            for idx, line in interesting[-50:]:
                clean_line = line.strip().encode('ascii', errors='replace').decode('ascii')
                print(f"Line {idx}: {clean_line}")
    except Exception as e:
        print(f"Failed to read {path}: {e}")

scan_log(watchdog_path)
scan_log(obs_path)
