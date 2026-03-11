"""
validate.py — Cross-check crashesFinal.geojson stats against raw CSV source data.
Usage: python3 validate.py
"""

import csv, json
from collections import defaultdict, Counter
from datetime import datetime, timezone, timedelta

# ── DST logic (same as fix_time_fields.py) ────────────────────────────────────
EDT_START = datetime(2025, 3, 9, 7, 0, 0, tzinfo=timezone.utc)
EDT_END   = datetime(2025, 11, 2, 6, 0, 0, tzinfo=timezone.utc)
EST = timedelta(hours=-5)
EDT = timedelta(hours=-4)

def to_eastern(utc_dt):
    return utc_dt + (EDT if EDT_START <= utc_dt < EDT_END else EST)

def time_of_day(hour):
    if 6 <= hour <= 8:   return 'AM Commute'
    if 9 <= hour <= 14:  return 'Midday'
    if 15 <= hour <= 18: return 'PM Commute'
    if 19 <= hour <= 22: return 'Evening'
    return 'Night'

def parse_utc(s):
    """Parse CSV REPORTDATE: '2025/01/06 00:20:00+00'"""
    s = s.strip().replace('+00', '').strip()
    return datetime.strptime(s, '%Y/%m/%d %H:%M:%S').replace(tzinfo=timezone.utc)

# ── Load raw CSV crashes ───────────────────────────────────────────────────────
print("Loading Crashes_in_DC.csv …")
with open('data/Crashes_in_DC.csv', newline='', encoding='utf-8-sig') as f:
    all_crashes = list(csv.DictReader(f))

# Filter: 2025 + bicycle involved
bike_2025 = []
for row in all_crashes:
    rd = row.get('REPORTDATE', '')
    if not rd.startswith('2025'):
        continue
    if int(row.get('TOTAL_BICYCLES', '0') or 0) < 1:
        continue
    bike_2025.append(row)

print(f"  Total rows in CSV:          {len(all_crashes):>6}")
print(f"  2025 rows:                  {sum(1 for r in all_crashes if r.get('REPORTDATE','').startswith('2025')):>6}")
print(f"  2025 + bicycle involved:    {len(bike_2025):>6}")

# Build set of CRIMEIDs for later join
bike_ids = {r['CRIMEID'] for r in bike_2025}

# ── Load GeoJSON for comparison ────────────────────────────────────────────────
print("\nLoading crashesFinal.geojson …")
with open('data/crashesFinal.geojson') as f:
    geojson = json.load(f)
geo_crashes = [feat['properties'] for feat in geojson['features']]
geo_ids = {c['CRIMEID'] for c in geo_crashes}

print(f"  Features in GeoJSON:        {len(geo_crashes):>6}")

# ── ID reconciliation ─────────────────────────────────────────────────────────
in_csv_not_geo = bike_ids - geo_ids
in_geo_not_csv = geo_ids - bike_ids
print(f"\n── ID Reconciliation ─────────────────────────────────────────────────")
print(f"  In CSV not in GeoJSON:      {len(in_csv_not_geo):>6}")
print(f"  In GeoJSON not in CSV:      {len(in_geo_not_csv):>6}")
if in_csv_not_geo:
    print(f"  Sample missing from GeoJSON: {list(in_csv_not_geo)[:5]}")
if in_geo_not_csv:
    print(f"  Sample extra in GeoJSON:     {list(in_geo_not_csv)[:5]}")

# ── Monthly distribution — CSV vs GeoJSON ─────────────────────────────────────
print(f"\n── Monthly Distribution (CSV vs GeoJSON) ─────────────────────────────")
csv_monthly  = Counter()
geo_monthly  = Counter()
month_names  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

for row in bike_2025:
    try:
        m = int(row['REPORTDATE'][5:7])
        csv_monthly[m] += 1
    except (ValueError, IndexError):
        pass

for c in geo_crashes:
    rd = c.get('REPORTDATE', '')
    if rd:
        try:
            m = int(rd[5:7])
            geo_monthly[m] += 1
        except (ValueError, IndexError):
            pass

print(f"  {'Month':<6} {'CSV':>6} {'GeoJSON':>8} {'Match':>7}")
all_match = True
for m in range(1, 13):
    csv_n = csv_monthly[m]
    geo_n = geo_monthly[m]
    match = '✓' if csv_n == geo_n else '✗ DIFF'
    if csv_n != geo_n:
        all_match = False
    print(f"  {month_names[m-1]:<6} {csv_n:>6} {geo_n:>8}  {match}")
print(f"  {'TOTAL':<6} {sum(csv_monthly.values()):>6} {sum(geo_monthly.values()):>8}  {'✓' if all_match else '✗'}")

# ── Time of day — recompute from CSV UTC times ─────────────────────────────────
print(f"\n── Time of Day (recomputed from CSV UTC → Eastern) ───────────────────")
csv_tod    = Counter()
csv_hours  = []
parse_errors = 0

for row in bike_2025:
    try:
        utc_dt   = parse_utc(row['REPORTDATE'])
        local_dt = to_eastern(utc_dt)
        tod      = time_of_day(local_dt.hour)
        csv_tod[tod] += 1
        csv_hours.append(local_dt.hour)
    except Exception:
        parse_errors += 1

geo_tod = Counter(c.get('TIME_OF_DAY') for c in geo_crashes)

tod_order = ['AM Commute', 'Midday', 'PM Commute', 'Evening', 'Night']
print(f"  {'Period':<14} {'CSV':>6} {'GeoJSON':>8} {'Match':>7}")
for t in tod_order:
    csv_n = csv_tod[t]
    geo_n = geo_tod[t]
    match = '✓' if csv_n == geo_n else '✗ DIFF'
    print(f"  {t:<14} {csv_n:>6} {geo_n:>8}  {match}")
if parse_errors:
    print(f"  Parse errors: {parse_errors}")

# ── Day of week ────────────────────────────────────────────────────────────────
print(f"\n── Day of Week (from CSV, Eastern time) ──────────────────────────────")
DOW_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
dow_counts = Counter()
for row in bike_2025:
    try:
        utc_dt   = parse_utc(row['REPORTDATE'])
        local_dt = to_eastern(utc_dt)
        dow_counts[local_dt.weekday()] += 1
    except Exception:
        pass

for d in range(7):
    bar = '#' * (dow_counts[d] // 5)
    print(f"  {DOW_NAMES[d]}  {dow_counts[d]:>4}  {bar}")
busiest = max(range(7), key=lambda d: dow_counts[d])
print(f"  Busiest: {DOW_NAMES[busiest]} ({dow_counts[busiest]} crashes)")

# ── Severity — CSV vs GeoJSON ──────────────────────────────────────────────────
print(f"\n── Severity (CSV source fields vs GeoJSON SEVERITY) ──────────────────")
# CSV encodes severity via: MAJORINJURIES_BICYCLIST, MINORINJURIES_BICYCLIST, FATAL_BICYCLIST
csv_sev = Counter()
for row in bike_2025:
    maj   = int(row.get('MAJORINJURIES_BICYCLIST', 0) or 0)
    minor = int(row.get('MINORINJURIES_BICYCLIST', 0) or 0)
    fatal = int(row.get('FATAL_BICYCLIST', 0) or 0)
    unk   = int(row.get('UNKNOWNINJURIES_BICYCLIST', 0) or 0)
    if fatal > 0:
        csv_sev['Fatal'] += 1
    elif maj > 0:
        csv_sev['Major Injury'] += 1
    elif minor > 0:
        csv_sev['Minor Injury'] += 1
    elif unk > 0:
        csv_sev['Unknown Injury'] += 1
    else:
        csv_sev['No Injury'] += 1

geo_sev = Counter(c.get('SEVERITY') for c in geo_crashes)

all_sev = sorted(set(list(csv_sev.keys()) + list(geo_sev.keys())), key=lambda x: x or '')
print(f"  {'Severity':<22} {'CSV':>6} {'GeoJSON':>8}")
for s in all_sev:
    print(f"  {str(s):<22} {csv_sev.get(s,0):>6} {geo_sev.get(s,0):>8}")

# ── Ward distribution ──────────────────────────────────────────────────────────
print(f"\n── Ward Distribution (CSV vs GeoJSON) ────────────────────────────────")
csv_ward = Counter(row.get('WARD') for row in bike_2025)
geo_ward = Counter(c.get('WARD') for c in geo_crashes)

print(f"  {'Ward':<10} {'CSV':>6} {'GeoJSON':>8} {'Match':>7}")
for w in sorted(csv_ward.keys()):
    csv_n = csv_ward[w]
    geo_n = geo_ward.get(w, 0)
    match = '✓' if csv_n == geo_n else '✗ DIFF'
    print(f"  {str(w):<10} {csv_n:>6} {geo_n:>8}  {match}")

# ── Risk flags ─────────────────────────────────────────────────────────────────
print(f"\n── Risk Flags (CSV vs GeoJSON) ───────────────────────────────────────")
csv_speed  = sum(1 for r in bike_2025 if int(r.get('SPEEDING_INVOLVED', 0) or 0) > 0)
csv_bkimp  = sum(1 for r in bike_2025 if int(r.get('BICYCLISTSIMPAIRED', 0) or 0) > 0)
csv_drimp  = sum(1 for r in bike_2025 if int(r.get('DRIVERSIMPAIRED', 0) or 0) > 0)
geo_speed  = sum(1 for c in geo_crashes if c.get('SPEEDING_INVOLVED'))
geo_bkimp  = sum(1 for c in geo_crashes if c.get('BICYCLISTSIMPAIRED'))
geo_drimp  = sum(1 for c in geo_crashes if c.get('DRIVERSIMPAIRED'))

print(f"  {'Flag':<22} {'CSV':>6} {'GeoJSON':>8} {'Match':>7}")
for label, cv, gv in [('Speeding', csv_speed, geo_speed),
                       ('Cyclist Impaired', csv_bkimp, geo_bkimp),
                       ('Driver Impaired', csv_drimp, geo_drimp)]:
    match = '✓' if cv == gv else '✗ DIFF'
    print(f"  {label:<22} {cv:>6} {gv:>8}  {match}")

# ── Vehicle types from detail table ───────────────────────────────────────────
print(f"\n── Vehicle Types (Detail Table → GeoJSON) ────────────────────────────")
print("Loading Crash_Details_Table.csv …")
with open('data/Crash_Details_Table.csv', newline='', encoding='utf-8-sig') as f:
    all_details = list(csv.DictReader(f))

# Filter detail rows to our 2025 bike crash IDs
bike_details = [r for r in all_details if r['CRIMEID'] in bike_ids]
print(f"  Detail rows for 2025 bike crashes: {len(bike_details)}")

# Show all unique vehicle types present
vtype_counts = Counter(r['INVEHICLETYPE'] for r in bike_details if r.get('PERSONTYPE') == 'Driver')
print(f"\n  Driver INVEHICLETYPE values:")
for vt, n in vtype_counts.most_common():
    print(f"    {str(vt):<45} {n}")

# Map to GeoJSON vehicle categories
PASSENGER = {'Passenger Car/Station Wagon/Jeep', 'Other Small Passenger'}
SUV       = {'Sport Utility Vehicle', 'Pickup Truck', 'Mini-Van (personal use, up to 8 seats)',
             'Cargo Van', 'Large Passenger Van'}
TRUCK     = {'Truck, Axles Unknown', 'Single-Unit Truck (2 axles)',
             'Construction Equipment (Backhoe, Bulldozer, etc.)'}
BUS       = {'Transit Bus', 'Charter/Tour Bus', 'School Bus', 'Shuttle Bus'}
MOTO      = {'Moped or motorized bicycle', 'Autocycle'}

def classify_vehicle(vt):
    if vt in PASSENGER: return 'PASSENGER_VEHICLE'
    if vt in SUV:       return 'SUV_PICKUP_VAN'
    if vt in TRUCK:     return 'HEAVY_TRUCK'
    if vt in BUS:       return 'BUS'
    if vt in MOTO:      return 'MOTORCYCLE_MOPED'
    return 'OTHER_VEHICLE'

# Per crash, which vehicle categories are present?
crash_vehicles = defaultdict(set)
for row in bike_details:
    if row.get('PERSONTYPE') != 'Driver':
        continue
    vt = row.get('INVEHICLETYPE', '').strip()
    if not vt or vt == '0':
        continue
    cat = classify_vehicle(vt)
    crash_vehicles[row['CRIMEID']].add(cat)

csv_veh_counts = Counter()
for cats in crash_vehicles.values():
    for cat in cats:
        csv_veh_counts[cat] += 1

# Solo crashes: in bike_2025 where no matching driver detail record exists
csv_solo = sum(1 for cid in bike_ids if cid not in crash_vehicles)

geo_veh_fields = ['PASSENGER_VEHICLE','SUV_PICKUP_VAN','HEAVY_TRUCK','BUS','MOTORCYCLE_MOPED','OTHER_VEHICLE']
geo_veh_counts = {f: sum(1 for c in geo_crashes if (c.get(f) or 0) > 0) for f in geo_veh_fields}
geo_solo       = sum(1 for c in geo_crashes if c.get('SOLO_CRASH'))

print(f"\n  {'Category':<22} {'CSV':>6} {'GeoJSON':>8}")
for cat in geo_veh_fields:
    print(f"  {cat:<22} {csv_veh_counts.get(cat,0):>6} {geo_veh_counts[cat]:>8}")
print(f"  {'Solo (no vehicle)':<22} {csv_solo:>6} {geo_solo:>8}")

# ── Cyclist age from detail table ──────────────────────────────────────────────
print(f"\n── Cyclist Age (Detail Table) ────────────────────────────────────────")
cyclist_rows = [r for r in bike_details if r.get('PERSONTYPE') == 'Bicyclist']
ages = []
for r in cyclist_rows:
    try:
        a = int(r['AGE'])
        if 0 < a < 100:
            ages.append(a)
    except (ValueError, TypeError):
        pass
ages.sort()
if ages:
    mean_age   = round(sum(ages) / len(ages), 1)
    median_age = ages[len(ages) // 2]
    print(f"  Cyclist detail rows:  {len(cyclist_rows)}")
    print(f"  Valid ages:           {len(ages)}")
    print(f"  Mean age:             {mean_age}")
    print(f"  Median age:           {median_age}")
    buckets = [
        ('Under 18',  [a for a in ages if a < 18]),
        ('18–34',     [a for a in ages if 18 <= a <= 34]),
        ('35–54',     [a for a in ages if 35 <= a <= 54]),
        ('55+',       [a for a in ages if a >= 55]),
    ]
    for label, grp in buckets:
        print(f"  {label:<10} n={len(grp)}")

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  VALIDATION SUMMARY")
print(f"{'='*60}")
print(f"  CSV 2025 bicycle crashes:   {len(bike_2025)}")
print(f"  GeoJSON features:           {len(geo_crashes)}")
count_match = len(bike_2025) == len(geo_crashes)
print(f"  Count match:                {'✓ YES' if count_match else '✗ NO — MISMATCH'}")
print(f"  IDs in CSV only:            {len(in_csv_not_geo)}")
print(f"  IDs in GeoJSON only:        {len(in_geo_not_csv)}")
print(f"  Monthly totals match:       {'✓ YES' if all_match else '✗ NO — see table above'}")
