import os
import re

app_dir = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform\app"
exclude_dirs = ["api", "node_modules", ".next", "components"]

print("Scanning Next.js files for uploads, downloads, imports, exports, and heavy operations...")

files_scanned = 0
matches = []

for root, dirs, files in os.walk(app_dir):
    # Skip excluded directories
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    
    for file in files:
        if file.endswith((".js", ".jsx", ".ts", ".tsx")):
            file_path = os.path.join(root, file)
            relative_path = os.path.relpath(file_path, app_dir)
            files_scanned += 1
            
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                
                # Check for interesting keywords
                has_button = "<button" in content or "btn " in content
                has_input_file = 'type="file"' in content or "type='file'" in content
                has_upload = any(kw in content.lower() for kw in ["upload", "import", "export", "download", "compile", "sync", "optimize", "calculate"])
                
                if has_button or has_input_file or has_upload:
                    # Let's search for fetch/post requests
                    api_calls = re.findall(r"fetch\(['\"]([^'\"]+)['\"]", content)
                    post_calls = "POST" in content or "post" in content.lower()
                    
                    matches.append({
                        "file": relative_path,
                        "has_file_input": has_input_file,
                        "api_calls": list(set(api_calls)),
                        "post_calls": post_calls,
                        "keywords": [kw for kw in ["upload", "import", "export", "download", "compile", "sync", "optimize", "calculate"] if kw in content.lower()]
                    })

print(f"\nScanned {files_scanned} files. Found {len(matches)} potential action files:")
for m in matches:
    print(f"\n--- {m['file']} ---")
    if m['has_file_input']:
        print("  [File Input Detected]")
    if m['api_calls']:
        print(f"  API routes: {', '.join(m['api_calls'])}")
    if m['keywords']:
        print(f"  Keywords: {', '.join(m['keywords'])}")
