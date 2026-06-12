import sys

libs = ['pypdf', 'pdfplumber', 'pdfminer', 'fitz', 'PyPDF2']
print("Python Version:", sys.version)
print("Checking libraries:")
for lib in libs:
    try:
        __import__(lib)
        print(f"  {lib}: AVAILABLE")
    except ImportError:
        print(f"  {lib}: NOT AVAILABLE")
