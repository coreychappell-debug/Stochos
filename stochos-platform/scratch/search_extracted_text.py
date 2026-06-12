import os
import sys

# Set standard output encoding to utf-8 if possible
if sys.stdout.encoding != 'utf-8':
    try:
        import sys
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except Exception:
        pass

scratch_dir = "C:\\Users\\corey\\.gemini\\antigravity\\brain\\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\\scratch"

def search_keywords(filename, keywords):
    filepath = os.path.join(scratch_dir, filename)
    if not os.path.exists(filepath):
        print(f"File {filename} not found.")
        return
        
    print(f"=== Searching in {filename} ===")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    lines = content.splitlines()
    for kw in keywords:
        print(f"\nSearching for '{kw}':")
        found = 0
        for i, line in enumerate(lines):
            if kw.lower() in line.lower():
                print(f"  Line {i+1}: {line.strip().encode('ascii', errors='replace').decode('ascii')}")
                # Print 15 lines below
                for j in range(1, 40):
                    if i + j < len(lines):
                        print(f"    + {lines[i+j].strip().encode('ascii', errors='replace').decode('ascii')}")
                found += 1
                if found >= 2:
                    print("  ... (truncated further matches)")
                    break
        if found == 0:
            print("  No matches.")

# Search in the 2025 Audited Financial Statements
search_keywords("nyl_2025_fs.txt", [
    "Statements of Net Position", 
    "Statements of Revenue, Expenses", 
    "Statements of Cash Flows"
])
