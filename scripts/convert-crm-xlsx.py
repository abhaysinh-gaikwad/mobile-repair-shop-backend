import sys, re, json, datetime, collections
#!/usr/bin/env python3
"""
Converts the shop's CRM spreadsheet into src/data/crm-legacy-leads.json, which
scripts/import-legacy-crm.js then loads into the leads table.

    cd src/data && python3 ../../scripts/convert-crm-xlsx.py

A separate step, in Python, on purpose: it needs no Excel library on the
server (the box has ~950MB of RAM), and it keeps the messy decisions about
this particular sheet visible in one reviewable file instead of buried in the
importer. Those decisions are:

  * DATES ARE DAY/MONTH TRANSPOSED. The shop typed d/m/y into cells Excel read
    as m/d/y, so the stored serials decode to nonsense (2016 .. 3036).
    Swapping day and month restores 2026-02-10 .. 2026-09-05 with 99.9% of
    rows in chronological order, which is how this was confirmed.
  * MOBILES ARE FLOATS IN SCIENTIFIC NOTATION ('7.517558971E9'). float() must
    be tried before any digit regex - a regex reads the decimal point as a
    separator and silently drops the leading digit.
  * A TRAILING " P" / " N" ON THE NAME names the telecaller (Pooja / Nikita).
    It is stripped from the name, which is a marker and not part of it.
  * "T. RATE" STAYS TEXT. Real values are like "6500/-/ 9200" - two grades of
    part. A numeric column would throw half of it away.

Depends only on the standard library plus scripts/xlsx_reader.py.
"""
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx_reader import X

E = datetime.date(1899, 12, 30)
TODAY = datetime.date(2026, 9, 5)

STATUS = {
 'INTRESTED':'INTERESTED', 'NOT INTRESTED':'NOT_INTERESTED', 'RINGING':'RINGING',
 'CALL BACK':'CALL_BACK', 'OUT OF COVERAGE':'OUT_OF_COVERAGE',
 'OUT OFF LOCATION':'OUT_OF_LOCATION', 'SWITCH OFF':'SWITCH_OFF', 'OTHER':'OTHER',
 'MATERIAL NOT AVILABLE':'MATERIAL_NOT_AVAILABLE', 'RATES':'RATES_GIVEN',
 'SHOP VISIT DONE':'SHOP_VISIT_DONE', 'JUST TO SAVE NO':'JUST_TO_SAVE_NUMBER',
 'WANT JOIN CLASS':'WANT_TO_JOIN_CLASS', 'DONE':'WORK_DONE',
 '2ND HAND MOBILE':'SECOND_HAND_MOBILE', 'NOT DONE':'NOT_DONE', '':'NEW',
}

def clean(v):
    if v is None: return None
    s = re.sub(r'\s+', ' ', str(v)).strip()
    return s or None

def date_from(v):
    """Excel stored these with day and month TRANSPOSED (the shop typed d/m/y
    into cells Excel read as m/d/y). Verified: swapping restores 2026-02-10 ->
    2026-09-05 with 99.9% of rows in chronological order."""
    s = clean(v)
    if not s: return None
    if re.fullmatch(r'\d+(\.\d+)?', s):
        f = float(s)
        if not (45000 < f < 47000): return None      # junk serials (2016, 3036...)
        d = E + datetime.timedelta(days=int(f))
        if d.day <= 12:
            try: d = d.replace(month=d.day, day=d.month)
            except ValueError: pass
        return d.isoformat() if d <= TODAY else None
    m = re.match(r'\D*(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})', s)
    if not m: return None
    a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100: y += 2000
    if a > 12 and b <= 12: day, mon = a, b          # clearly d/m
    elif b > 12 and a <= 12: day, mon = b, a
    else: day, mon = a, b                            # ambiguous -> d/m (Indian)
    try:
        d = datetime.date(y, mon, day)
        return d.isoformat() if d <= TODAY else None
    except ValueError:
        return None

def mobile_from(v):
    """Excel stored most of these as floats in SCIENTIFIC notation
    ('7.517558971E9'). Float conversion has to be tried FIRST: a digit regex
    sees the decimal point as a separator and silently returns the 9 digits
    after it, dropping the leading 7 - which is how 2,969 numbers came out
    one digit short on the first attempt."""
    s = clean(v)
    if not s: return None, None
    try:
        d = str(int(float(s)))
        return (d[-10:] if len(d) >= 10 else d), None
    except (ValueError, OverflowError):
        pass
    nums = re.findall(r'\d{7,}', s.replace(' ', ''))
    if not nums: return None, s
    primary = nums[0][-10:] if len(nums[0]) >= 10 else nums[0]
    return primary, (' / '.join(nums[1:]) or None)

x = X('SUSHANT CRM.xlsx')
rows = x.rows(dict(x.sheets)['Sheet1'])

out, stats = [], collections.Counter()
for rn, c in rows[1:]:
    name_raw, mob_raw = clean(c.get('C')), clean(c.get('E'))
    if not name_raw and not mob_raw:
        continue

    # " P" / " N" at the end of the name marks who handles the lead.
    handler, name = None, name_raw
    if name_raw:
        parts = name_raw.split()
        if parts and parts[-1] in ('P', 'p'):
            handler, name = 'Pooja', ' '.join(parts[:-1]).strip() or name_raw
        elif parts and parts[-1] in ('N', 'n'):
            handler, name = 'Nikita', ' '.join(parts[:-1]).strip() or name_raw
    # An explicit `user` column wins over the name suffix.
    u = (clean(c.get('R')) or '').lower()
    if u.startswith('pooj'): handler = 'Pooja'
    elif u.startswith('nik'): handler = 'Nikita'
    stats[handler or '(unassigned)'] += 1

    mobile, extra_mobile = mobile_from(c.get('E'))
    status = STATUS.get((clean(c.get('I')) or '').upper(), 'OTHER')
    stats['status:' + status] += 1

    remarks = [clean(c.get(k)) for k in ('L', 'M', 'N')]
    notes = '\n'.join(r for r in remarks if r) or None
    if extra_mobile:
        notes = ((notes + '\n') if notes else '') + 'Other number: ' + extra_mobile

    out.append({
        'rowNo':       rn,
        'customerName': name,
        'mobile':       mobile,
        'location':     clean(c.get('D')),
        'modelNumber':  clean(c.get('F')),
        'problem':      clean(c.get('G')),
        'quotedRate':   None if clean(c.get('H')) in (None, '-') else clean(c.get('H')),
        'status':       status,
        'enquiryDate':  date_from(c.get('B')),
        'lastCallDate': date_from(c.get('J')),
        'nextActionDate': date_from(c.get('K')),
        'handler':      handler,
        'notes':        notes,
    })

json.dump(out, open('crm-legacy-leads.json', 'w'), ensure_ascii=False, indent=0)
print('exported %d leads -> crm-legacy-leads.json' % len(out))
print()
for k in ('Pooja', 'Nikita', '(unassigned)'): print('  %-14s %d' % (k, stats[k]))
print()
print('  with mobile     :', sum(1 for r in out if r['mobile']))
print('  with location   :', sum(1 for r in out if r['location']))
print('  with enquiryDate:', sum(1 for r in out if r['enquiryDate']))
print('  with notes      :', sum(1 for r in out if r['notes']))
print('  with quotedRate :', sum(1 for r in out if r['quotedRate']))
print()
print('  statuses:')
for k, v in sorted(((k[7:], v) for k, v in stats.items() if k.startswith('status:')), key=lambda t: -t[1]):
    print('    %-24s %d' % (k, v))
