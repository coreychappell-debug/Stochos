import os
import urllib.request
from pypdf import PdfReader

# Define the PDF URLs and target text files
pdf_targets = {
    "nyl_2025_fs.txt": "https://edit.nylottery.ny.gov/sites/default/files/2025-07/Final_NYSL_FS_2025_0.pdf",
    "nyl_2025_annual.txt": "https://edit.nylottery.ny.gov/sites/default/files/2025-08/annualReport_2025_final.pdf",
    "nyl_2025_aid.txt": "https://edit.nylottery.ny.gov/sites/default/files/2025-07/aidToEd_2025_final_0731_0.pdf",
    "nyl_2020_cafr.txt": "https://edit.nylottery.ny.gov/sites/default/files/2022-04/FY%202019-2020%20Comprehensive%20Annual%20Financial%20Report.pdf"
}

# Directory for caching PDFs and outputs
scratch_dir = "C:\\Users\\corey\\.gemini\\antigravity\\brain\\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\\scratch"
os.makedirs(scratch_dir, exist_ok=True)

# Helper function to download and extract
def process_pdf(txt_name, url):
    pdf_path = os.path.join(scratch_dir, txt_name.replace(".txt", ".pdf"))
    txt_path = os.path.join(scratch_dir, txt_name)
    
    if os.path.exists(txt_path):
        print(f"{txt_name} already extracted.")
        return
        
    print(f"Downloading {url} to {pdf_path}...")
    try:
        # Bypass potential user-agent blocks by spoofing browser headers
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response, open(pdf_path, 'wb') as out_file:
            out_file.write(response.read())
        print("Download complete. Parsing PDF...")
        
        # Read PDF and write to text
        reader = PdfReader(pdf_path)
        with open(txt_path, "w", encoding="utf-8") as f:
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                f.write(f"--- PAGE {i+1} ---\n")
                f.write(text)
                f.write("\n\n")
        print(f"Extracted text to {txt_path} ({len(reader.pages)} pages).")
        # Clean up binary PDF to save space
        os.remove(pdf_path)
    except Exception as e:
        print(f"Error processing {txt_name}: {e}")

for txt_name, url in pdf_targets.items():
    process_pdf(txt_name, url)
