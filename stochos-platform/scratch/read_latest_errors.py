import os
from datetime import datetime

obs_path = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform\logs\observability.log"

if os.path.exists(obs_path):
    print("Filtering observability.log for recent messages...")
    with open(obs_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if "2026-06-09T03:" in line:
                # Parse timestamp to verify it's after 03:15:00
                try:
                    parts = line.split('"timestamp":"')
                    if len(parts) > 1:
                        ts_str = parts[1].split('"')[0]
                        # ts_str looks like '2026-06-09T03:19:03.853Z'
                        time_part = ts_str.split('T')[1].replace('Z', '')
                        h, m, s = map(float, time_part.split(':'))
                        if m >= 15: # After 03:15:00
                            clean = line.strip().encode("ascii", errors="replace").decode("ascii")
                            print(clean)
                except Exception as e:
                    pass
else:
    print("Log not found.")
