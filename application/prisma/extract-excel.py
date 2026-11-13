# Standalone Python extractor for Financial Management.xlsx
# Extracts Sheet 2 ('Buku Besar Update') into excel-data.json

import os
import sys
import json
import zipfile
import xml.etree.ElementTree as ET

def extract():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_path = os.path.abspath(os.path.join(script_dir, "../../Financial Management.xlsx"))
    json_path = os.path.join(script_dir, "excel-data.json")

    if not os.path.exists(excel_path):
        print(f"Excel file not found at: {excel_path}")
        return

    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    ss = []

    with zipfile.ZipFile(excel_path) as z:
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('s:si', ns):
                ss.append(''.join(t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')))

        if 'xl/worksheets/sheet2.xml' not in z.namelist():
            print("sheet2.xml (Buku Besar Update) not found in xlsx")
            return

        root = ET.fromstring(z.read('xl/worksheets/sheet2.xml'))
        rows = root.findall('.//s:row', ns)
        col_map = {
            'A': 'timestamp', 'B': 'tanggal', 'C': 'nama', 'D': 'debit', 'E': 'kredit', 
            'F': 'peran', 'G': 'penyimpanan', 'H': 'jenis', 'I': 'keterangan', 'J': 'bukti',
            'K': 'saldo', 'L': 'transaksi', 'M': 'month', 'N': 'consume'
        }
        
        buku_besar_update = []
        for r in rows[1:]:
            item = {}
            for c in r.findall('s:c', ns):
                ref = c.attrib.get('r')
                col = ''.join([ch for ch in ref if ch.isalpha()])
                t = c.attrib.get('t')
                v = c.find('s:v', ns)
                val = ''
                if t == 's' and v is not None:
                    val = ss[int(v.text)]
                elif v is not None:
                    val = v.text
                if col in col_map:
                    item[col_map[col]] = val
            if item.get('nama') or item.get('debit') or item.get('kredit'):
                buku_besar_update.append(item)

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump({'buku_besar_update': buku_besar_update}, f, indent=2, ensure_ascii=False)
        
        print(f"Extracted {len(buku_besar_update)} rows from sheet 'Buku Besar Update' to {json_path}")

if __name__ == "__main__":
    extract()

