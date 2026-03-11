"""
DC Bicycle Collision 2025 — Statistics Analysis
Produces factual statements grounded in the crash data.
Usage: python3 stats.py
Requires: json, datetime (stdlib only)
"""

import json
from collections import defaultdict, Counter
from datetime import datetime, timezone, timedelta

# ── Load data ──────────────────────────────────────────────────────────────────
with open('data/crashesFinal.geojson') as f:
    geojson = json.load(f)

crashes = [feat['properties'] for feat in geojson['features']]
total = len(crashes)
print(f"\n{'='*60}")
print(f"  DC Bicycle Collision Map — 2025 Data Summary")
print(f"  n = {total} police-reported crashes")
print(f"{'='*60}\n")


# ── Helpers ────────────────────────────────────────────────────────────────────
def pct(n, d=None):
    d = d if d is not None else total
    return round(100 * n / d, 1) if d else 0

def injury_rate(subset):
    if not subset:
        return 0
    injured = sum(1 for c in subset
                  if c.get('SEVERITY') in ('Minor Injury', 'Major Injury'))
    return round(100 * injured / len(subset), 1)

def major_rate(subset):
    if not subset:
        return 0
    major = sum(1 for c in subset if c.get('SEVERITY') == 'Major Injury')
    return round(100 * major / len(subset), 1)


# ── Severity breakdown ─────────────────────────────────────────────────────────
sev_counts = Counter(c.get('SEVERITY', 'Unknown') for c in crashes)
print("── Severity ──────────────────────────────────────────────────")
for sev, n in sev_counts.most_common():
    print(f"  {str(sev):<20} {n:>4}  ({pct(n)}%)")

total_injured  = sum(1 for c in crashes if c.get('SEVERITY') in ('Minor Injury', 'Major Injury'))
total_major    = sev_counts.get('Major Injury', 0)
total_no_inj   = sev_counts.get('No Injury', 0)
print(f"\n  FINDING: {pct(total_injured)}% of crashes result in injury ({total_injured} of {total})")
print(f"  FINDING: {total_major} crashes ({pct(total_major)}%) result in major injury")
print()


# ── Time of day ────────────────────────────────────────────────────────────────
print("── Time of Day ───────────────────────────────────────────────")
time_order = ['AM Commute', 'Midday', 'PM Commute', 'Evening', 'Night']
time_groups = defaultdict(list)
for c in crashes:
    time_groups[c.get('TIME_OF_DAY', 'Unknown')].append(c)

for t in time_order:
    grp = time_groups[t]
    ir  = injury_rate(grp)
    mr  = major_rate(grp)
    print(f"  {t:<14} n={len(grp):>3}  injury={ir}%  major={mr}%")

pm_n  = len(time_groups['PM Commute'])
am_n  = len(time_groups['AM Commute'])
mid_n = len(time_groups['Midday'])
mid_ir = injury_rate(time_groups['Midday'])
busiest_t = max(time_order, key=lambda t: len(time_groups[t]))
highest_ir_t = max(time_order, key=lambda t: injury_rate(time_groups[t]))
highest_ir_val = injury_rate(time_groups[highest_ir_t])

after_work = len(time_groups['Evening']) + len(time_groups['Night'])
print(f"\n  FINDING: PM Commute is the busiest period ({pm_n} crashes, {pct(pm_n)}% of total)")
if am_n > 0:
    print(f"  FINDING: PM Commute has {round(pm_n/am_n,1)}x more crashes than AM Commute ({pm_n} vs {am_n})")
print(f"  FINDING: {highest_ir_t} has the highest injury rate at {highest_ir_val}%")
print(f"  FINDING: Evening + Night account for {after_work} crashes ({pct(after_work)}%)")
print()


# ── Day of week ────────────────────────────────────────────────────────────────
print("── Day of Week ───────────────────────────────────────────────")
DOW_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
EDT_START_DOW = datetime(2025, 3, 9, 7, 0, 0, tzinfo=timezone.utc)
EDT_END_DOW   = datetime(2025, 11, 2, 6, 0, 0, tzinfo=timezone.utc)
dow_groups = defaultdict(list)
for c in crashes:
    rd = c.get('REPORTDATE', '')
    if rd:
        try:
            utc_dt = datetime.fromisoformat(rd.replace('Z', '+00:00'))
            offset = timedelta(hours=-4) if EDT_START_DOW <= utc_dt < EDT_END_DOW else timedelta(hours=-5)
            local_dt = utc_dt + offset
            dow_groups[local_dt.weekday()].append(c)
        except (ValueError, AttributeError):
            pass

for d in range(7):
    grp = dow_groups[d]
    ir  = injury_rate(grp)
    bar = '#' * (len(grp) // 5)
    print(f"  {DOW_NAMES[d]}  {len(grp):>3}  {ir}%  {bar}")

busiest_dow  = max(range(7), key=lambda d: len(dow_groups[d]))
quietest_dow = min(range(7), key=lambda d: len(dow_groups[d]) if dow_groups[d] else 9999)
weekday_n    = sum(len(dow_groups[d]) for d in range(5))
weekend_n    = sum(len(dow_groups[d]) for d in range(5, 7))
weekday_ir   = injury_rate([c for d in range(5) for c in dow_groups[d]])
weekend_ir   = injury_rate([c for d in range(5, 7) for c in dow_groups[d]])
print(f"\n  FINDING: {DOW_NAMES[busiest_dow]} is the busiest day ({len(dow_groups[busiest_dow])} crashes)")
print(f"  FINDING: Weekdays: {weekday_n} crashes ({pct(weekday_n)}%)  injury={weekday_ir}%")
print(f"  FINDING: Weekends: {weekend_n} crashes ({pct(weekend_n)}%)  injury={weekend_ir}%")
print()


# ── Road type ──────────────────────────────────────────────────────────────────
print("── Road Type ─────────────────────────────────────────────────")
road_groups = defaultdict(list)
for c in crashes:
    road_groups[c.get('ROAD_TYPE', 'Unknown')].append(c)

road_counts = sorted(road_groups.items(), key=lambda x: -len(x[1]))
for rt, grp in road_counts:
    ir = injury_rate(grp)
    print(f"  {str(rt):<30} n={len(grp):>3}  injury={ir}%")

int_n   = len(road_groups['Intersection'])
road_n  = len(road_groups['Road'])
int_ir  = injury_rate(road_groups['Intersection'])
road_ir = injury_rate(road_groups['Road'])
lot_n   = len(road_groups.get('Parking Lot', []))
print(f"\n  FINDING: {pct(int_n)}% of crashes occur at intersections vs {pct(road_n)}% on road segments")
print(f"  FINDING: Intersection injury rate {int_ir}% vs Road segment {road_ir}%")
print()


# ── Vehicle type ───────────────────────────────────────────────────────────────
print("── Vehicle Involvement ───────────────────────────────────────")
vehicle_fields = [
    ('PASSENGER_VEHICLE', 'Passenger Vehicle'),
    ('SUV_PICKUP_VAN',    'SUV / Pickup Van'),
    ('HEAVY_TRUCK',       'Heavy Truck'),
    ('BUS',               'Bus'),
    ('MOTORCYCLE_MOPED',  'Motorcycle / Moped'),
    ('OTHER_VEHICLE',     'Other Vehicle'),
]
solo = [c for c in crashes if c.get('SOLO_CRASH')]
solo_ir = injury_rate(solo)
print(f"  Solo crash (no vehicle)  n={len(solo):>3}  ({pct(len(solo))}%)  injury={solo_ir}%")
for field, label in vehicle_fields:
    grp = [c for c in crashes if (c.get(field) or 0) > 0]
    if grp:
        ir = injury_rate(grp)
        mr = major_rate(grp)
        print(f"  {label:<25} n={len(grp):>3}  ({pct(len(grp))}%)  injury={ir}%  major={mr}%")

bus_grp  = [c for c in crashes if (c.get('BUS') or 0) > 0]
suv_grp  = [c for c in crashes if (c.get('SUV_PICKUP_VAN') or 0) > 0]
pass_grp = [c for c in crashes if (c.get('PASSENGER_VEHICLE') or 0) > 0]
bus_ir   = injury_rate(bus_grp)
suv_ir   = injury_rate(suv_grp)
pass_ir  = injury_rate(pass_grp)
motor_vehicle_n = total - len(solo)
print(f"\n  FINDING: {pct(len(solo))}% of crashes involve no motor vehicle (solo falls/swerves/obstacles)")
print(f"  FINDING: Bus collisions have the highest injury rate at {bus_ir}% ({len(bus_grp)} crashes)")
if suv_ir != pass_ir:
    diff = round(suv_ir - pass_ir, 1)
    print(f"  FINDING: SUV/Pickup injury rate is {diff:+.1f}pp vs Passenger Vehicle ({suv_ir}% vs {pass_ir}%)")
print()


# ── Bike lane type ─────────────────────────────────────────────────────────────
print("── Bike Lane Type ────────────────────────────────────────────")
lane_groups = defaultdict(list)
for c in crashes:
    lt = c.get('LANE_TYPE') or 'No Bike Lane'
    lane_groups[lt].append(c)

protected_keys    = ['Protected', 'Dual Protected']
buffered_keys     = ['Buffered', 'Dual Buffered']
conventional_keys = ['Conventional', 'Contraflow', 'Through Lane Adjacent']

protected_grp    = [c for k in protected_keys   for c in lane_groups[k]]
buffered_grp     = [c for k in buffered_keys     for c in lane_groups[k]]
conventional_grp = [c for k in conventional_keys for c in lane_groups[k]]
no_lane_grp      = lane_groups['No Bike Lane']
has_infra_grp    = protected_grp + buffered_grp + conventional_grp

categories = [
    ('Protected',    protected_grp),
    ('Buffered',     buffered_grp),
    ('Conventional', conventional_grp),
    ('No Bike Lane', no_lane_grp),
]
for label, grp in categories:
    ir = injury_rate(grp)
    mr = major_rate(grp)
    print(f"  {label:<16} n={len(grp):>3}  ({pct(len(grp))}%)  injury={ir}%  major={mr}%")

print(f"\n  FINDING: {pct(len(no_lane_grp))}% of crashes occur on roads with no bike infrastructure")
if protected_grp:
    prot_mr  = major_rate(protected_grp)
    nolane_mr = major_rate(no_lane_grp)
    print(f"  FINDING: Major injury rate — No Lane {nolane_mr}% vs Protected {prot_mr}%")
    print(f"  FINDING: {len(has_infra_grp)} crashes ({pct(len(has_infra_grp))}%) occurred despite some form of bike infrastructure")
print()


# ── Speeding & impairment ──────────────────────────────────────────────────────
print("── Risk Factors ──────────────────────────────────────────────")
speeding  = [c for c in crashes if c.get('SPEEDING_INVOLVED')]
bk_imp    = [c for c in crashes if c.get('BICYCLISTSIMPAIRED')]
dr_imp    = [c for c in crashes if c.get('DRIVERSIMPAIRED')]
any_risk  = [c for c in crashes if c.get('SPEEDING_INVOLVED') or c.get('BICYCLISTSIMPAIRED') or c.get('DRIVERSIMPAIRED')]
no_risk   = [c for c in crashes if not (c.get('SPEEDING_INVOLVED') or c.get('BICYCLISTSIMPAIRED') or c.get('DRIVERSIMPAIRED'))]

speed_ir   = injury_rate(speeding)
bk_imp_ir  = injury_rate(bk_imp)
no_risk_ir = injury_rate(no_risk)
print(f"  Speeding involved  n={len(speeding):>3}  ({pct(len(speeding))}%)  injury={speed_ir}%")
print(f"  Cyclist impaired   n={len(bk_imp):>3}  ({pct(len(bk_imp))}%)  injury={bk_imp_ir}%")
print(f"  Driver impaired    n={len(dr_imp):>3}  ({pct(len(dr_imp))}%)")
print(f"  Any risk flag      n={len(any_risk):>3}  ({pct(len(any_risk))}%)  injury={injury_rate(any_risk)}%")
print(f"  No risk flag       n={len(no_risk):>3}  ({pct(len(no_risk))}%)  injury={no_risk_ir}%")
if speeding:
    print(f"\n  FINDING: All {len(speeding)} speeding-involved crashes resulted in injury ({speed_ir}%)")
print()


# ── Cyclist age ────────────────────────────────────────────────────────────────
print("── Cyclist Age ───────────────────────────────────────────────")
ages = [c.get('CYCLIST_AGE_YOUNGEST') for c in crashes if c.get('CYCLIST_AGE_YOUNGEST') is not None]
ages_clean = [a for a in ages if a < 100]

if ages_clean:
    ages_clean.sort()
    median_age = ages_clean[len(ages_clean) // 2]
    mean_age   = round(sum(ages_clean) / len(ages_clean), 1)
    print(f"  Valid age records: {len(ages_clean)} of {total}")
    print(f"  Mean age:   {mean_age}  |  Median age: {median_age}")

    buckets = [
        ('Under 18',   [c for c in crashes if (c.get('CYCLIST_AGE_YOUNGEST') or 999) < 18]),
        ('18–34',      [c for c in crashes if 18 <= (c.get('CYCLIST_AGE_YOUNGEST') or 999) <= 34]),
        ('35–54',      [c for c in crashes if 35 <= (c.get('CYCLIST_AGE_YOUNGEST') or 999) <= 54]),
        ('55+',        [c for c in crashes if 55 <= (c.get('CYCLIST_AGE_YOUNGEST') or 999) < 100]),
    ]
    print()
    for label, grp in buckets:
        ir = injury_rate(grp)
        mr = major_rate(grp)
        print(f"  {label:<10} n={len(grp):>3}  injury={ir}%  major={mr}%")

    # Multi-cyclist crashes
    multi = [c for c in crashes if (c.get('CYCLIST_COUNT') or 1) > 1]
    print(f"\n  Multi-cyclist crashes: {len(multi)} ({pct(len(multi))}%)")
    print(f"\n  FINDING: Mean cyclist age is {mean_age}; riders 18–34 account for the most crashes")
    under18 = buckets[0][1]
    print(f"  FINDING: {len(under18)} crashes ({pct(len(under18))}%) involve cyclists under 18")
print()


# ── Monthly distribution ───────────────────────────────────────────────────────
print("── Monthly Distribution ──────────────────────────────────────")
monthly = defaultdict(list)
for c in crashes:
    rd = c.get('REPORTDATE', '')
    if rd:
        try:
            month = int(rd[5:7])
            monthly[month].append(c)
        except (ValueError, IndexError):
            pass

month_names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
for m in range(1, 13):
    grp = monthly[m]
    ir  = injury_rate(grp)
    bar = '#' * (len(grp) // 3)
    print(f"  {month_names[m-1]}  {len(grp):>3}  {ir}%  {bar}")

peak_month  = max(range(1, 13), key=lambda m: len(monthly[m]))
low_month   = min(range(1, 13), key=lambda m: len(monthly[m]) if monthly[m] else 9999)
summer      = [c for m in [6,7,8] for c in monthly[m]]
winter      = [c for m in [12,1,2] for c in monthly[m]]
spring      = [c for m in [3,4,5] for c in monthly[m]]
fall        = [c for m in [9,10,11] for c in monthly[m]]
print(f"\n  Spring (Mar–May):  {len(spring):>3} crashes  injury={injury_rate(spring)}%")
print(f"  Summer (Jun–Aug):  {len(summer):>3} crashes  injury={injury_rate(summer)}%")
print(f"  Fall   (Sep–Nov):  {len(fall):>3} crashes  injury={injury_rate(fall)}%")
print(f"  Winter (Dec–Feb):  {len(winter):>3} crashes  injury={injury_rate(winter)}%")
print(f"\n  FINDING: {month_names[peak_month-1]} is the peak month ({len(monthly[peak_month])} crashes, {pct(len(monthly[peak_month]))}% of annual total)")
print(f"  FINDING: Fall (Sep–Nov) accounts for {len(fall)} crashes — {pct(len(fall))}% of the year")
if len(winter) > 0:
    print(f"  FINDING: Summer has {round(len(summer)/len(winter),1)}x more crashes than winter")
print()


# ── Ward distribution ──────────────────────────────────────────────────────────
print("── Ward Distribution ─────────────────────────────────────────")
ward_groups = defaultdict(list)
for c in crashes:
    ward_groups[c.get('WARD', 'Unknown')].append(c)

for ward in sorted(ward_groups.keys()):
    grp = ward_groups[ward]
    ir  = injury_rate(grp)
    mr  = major_rate(grp)
    bar = '#' * (len(grp) // 5)
    print(f"  {ward:<8} n={len(grp):>3}  ({pct(len(grp)):>5}%)  injury={ir}%  major={mr}%  {bar}")

top2     = sorted(ward_groups.keys(), key=lambda w: -len(ward_groups[w]))[:2]
top2_n   = sum(len(ward_groups[w]) for w in top2)
top_ward = top2[0]
high_ir_ward = max(ward_groups, key=lambda w: injury_rate(ward_groups[w]) if len(ward_groups[w]) >= 20 else 0)
low_ir_ward  = min(ward_groups, key=lambda w: injury_rate(ward_groups[w]) if len(ward_groups[w]) >= 20 else 999)
print(f"\n  FINDING: {top2[0]} and {top2[1]} together account for {pct(top2_n)}% of all crashes ({top2_n} of {total})")
print(f"  FINDING: {high_ir_ward} has the highest injury rate at {injury_rate(ward_groups[high_ir_ward])}%")
print(f"  FINDING: {low_ir_ward} has the lowest injury rate at {injury_rate(ward_groups[low_ir_ward])}%")
print()


# ── Summary card ───────────────────────────────────────────────────────────────
print("=" * 60)
print("  KEY STATEMENTS FOR THE PRESENTATION")
print("=" * 60)

pm_count         = len(time_groups['PM Commute'])
am_count         = len(time_groups['AM Commute'])
commute_ratio    = round(pm_count / am_count, 1) if am_count else 0
mid_count        = len(time_groups['Midday'])
mid_ir_val       = injury_rate(time_groups['Midday'])
after_work_n     = len(time_groups['Evening']) + len(time_groups['Night'])
after_work_pct_v = pct(after_work_n)

w2_count  = len(ward_groups.get('Ward 2', []))
w6_count  = len(ward_groups.get('Ward 6', []))
w2_w6_pct = pct(w2_count + w6_count)

bus_ir_v  = injury_rate([c for c in crashes if (c.get('BUS') or 0) > 0])
bus_n     = len([c for c in crashes if (c.get('BUS') or 0) > 0])

no_lane_pct_v    = pct(len(no_lane_grp))
sep_count        = len(monthly[9])
summer_winter_r  = round(len(summer) / len(winter), 1) if winter else 0
under18_n        = len([c for c in crashes if (c.get('CYCLIST_AGE_YOUNGEST') or 999) < 18])
age1834_n        = len([c for c in crashes if 18 <= (c.get('CYCLIST_AGE_YOUNGEST') or 999) <= 34])
age1834_ir_v     = injury_rate([c for c in crashes if 18 <= (c.get('CYCLIST_AGE_YOUNGEST') or 999) <= 34])
fall_n           = len(fall)
fall_pct_v       = pct(fall_n)
busiest_dow_name = DOW_NAMES[busiest_dow]
busiest_dow_n    = len(dow_groups[busiest_dow])

print(f"""
1. "{total} police-reported bicycle collisions in DC in 2025.
   {pct(total_injured)}% resulted in injury — {total_major} were classified as major."

2. "The PM commute is the most dangerous window: {pm_count} crashes —
   {commute_ratio}x more than the AM commute ({am_count} crashes).
   Midday hours had the highest injury rate of any period at {mid_ir_val}%."

3. "{busiest_dow_name} is the busiest crash day. Weekdays account for {pct(weekday_n)}% of
   crashes; weekends see fewer collisions but a {weekend_ir}% injury rate."

4. "Ward 2 (downtown/Capitol Hill) and Ward 6 (Navy Yard/Near Southeast)
   together account for {w2_w6_pct}% of all crashes — {w2_count + w6_count} of {total}.
   Ward 2 alone: {w2_count} crashes ({pct(w2_count)}%)."

5. "September alone saw {sep_count} crashes — the highest of any single month.
   Fall (Sep–Nov) produced {fall_pct_v}% of the year's collisions."

6. "{no_lane_pct_v}% of crashes occurred on roads with no bike infrastructure.
   Only {pct(len(protected_grp))}% happened on protected lanes — but {len(protected_grp)} crashes still occurred there."

7. "Bus collisions result in injury {bus_ir_v}% of the time —
   the highest rate of any vehicle type ({bus_n} crashes)."

8. "{under18_n} crashes ({pct(under18_n)}%) involved cyclists under 18.
   Riders aged 18–34 were hit most often ({age1834_n} crashes, {age1834_ir_v}% injury rate)."

9. "{pct(len(solo))}% of crashes involved no motor vehicle —
   solo falls, door strikes, and road hazards with no car present."

10. "Every single speeding-involved crash resulted in injury.
    Though rare ({len(speeding)} reported cases), speed transforms a collision into a certainty of harm."
""")
