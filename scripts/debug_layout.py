import os
from pypdf import PdfReader

def analyze_pdf(pdf_path):
    print("==================================================")
    print(f"Analyzing PDF Layout: {pdf_path}")
    print("==================================================")
    
    if not os.path.exists(pdf_path):
        print(f"Error: File not found at {pdf_path}")
        return
        
    reader = PdfReader(pdf_path)
    print(f"Total Pages: {len(reader.pages)}")
    
    for i, page in enumerate(reader.pages, 1):
        print(f"\n--- PAGE {i} ---")
        mediabox = page.mediabox
        print(f"Dimensions: Width={mediabox.width:.2f}pt, Height={mediabox.height:.2f}pt (A4 is 595.27 x 841.89)")
        
        # Extract text to inspect
        text = page.extract_text()
        print("Extracted Text Content:")
        print("--------------------------------------------------")
        if text.strip():
            lines = text.split('\n')
            for line in lines:
                print(f"  [Text Line] {line.strip()}")
        else:
            print("  (No extractable text or page is empty/images)")
        print("--------------------------------------------------")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_path = os.path.join(script_dir, 'report', 'test-report.pdf')
    analyze_pdf(pdf_path)
