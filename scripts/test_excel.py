import os
import sys

scripts_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(scripts_dir)

from test_report import test_data
from generate_excel import generate_excel

def main():
    report_dir = os.path.join(scripts_dir, 'report')
    os.makedirs(report_dir, exist_ok=True)
    
    excel_bytes = generate_excel(test_data)
    excel_path = os.path.join(report_dir, 'test-report.xlsx')
    
    with open(excel_path, 'wb') as f:
        f.write(excel_bytes)
        
    print(f"Success! Excel report generated and saved at: {excel_path}")

if __name__ == '__main__':
    main()
