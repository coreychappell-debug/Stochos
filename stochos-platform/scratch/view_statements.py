import os

scratch_dir = "C:\\Users\\corey\\.gemini\\antigravity\\brain\\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\\scratch"

def print_all_pages(filename):
    filepath = os.path.join(scratch_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # print up to 5000 characters
    print(content[:5000].encode('ascii', errors='replace').decode('ascii'))

print_all_pages("nyl_2025_aid.txt")
