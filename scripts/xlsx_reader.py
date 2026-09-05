"""Minimal .xlsx reader (stdlib only) — enough to pull rows out of the shop's
CRM workbook without adding an Excel dependency. Used by convert-crm-xlsx.py."""
import zipfile, re, sys
from xml.etree import ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

class X:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        # shared strings
        self.ss = []
        if 'xl/sharedStrings.xml' in self.z.namelist():
            root = ET.fromstring(self.z.read('xl/sharedStrings.xml'))
            for si in root.findall('m:si', NS):
                self.ss.append(''.join(t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')))
        # sheet names -> file
        wb = ET.fromstring(self.z.read('xl/workbook.xml'))
        rels = ET.fromstring(self.z.read('xl/_rels/workbook.xml.rels'))
        rmap = {r.get('Id'): r.get('Target') for r in rels}
        self.sheets = []
        for sh in wb.find('m:sheets', NS):
            rid = sh.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            tgt = rmap[rid]
            if not tgt.startswith('xl/'): tgt = 'xl/' + tgt.lstrip('/')
            self.sheets.append((sh.get('name'), tgt))

    def rows(self, target):
        root = ET.fromstring(self.z.read(target))
        out = []
        for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
            cells = {}
            for c in row.findall('m:c', NS):
                ref = c.get('r'); col = re.match(r'([A-Z]+)', ref).group(1)
                t = c.get('t'); v = c.find('m:v', NS)
                isel = c.find('m:is', NS)
                if isel is not None:
                    val = ''.join(x.text or '' for x in isel.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
                elif v is None:
                    val = None
                elif t == 's':
                    val = self.ss[int(v.text)]
                else:
                    val = v.text
                cells[col] = val
            out.append((int(row.get('r')), cells))
        return out
