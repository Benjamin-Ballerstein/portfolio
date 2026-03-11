"""
Re-derive TIME_OF_DAY and LIGHT_CONDITION for each crash using:
- REPORTDATE (UTC ISO string) → Eastern local time (EDT/EST)
- TIME_OF_DAY: based on local hour
- LIGHT_CONDITION: based on astronomical sunrise/sunset for DC

2025 DST in DC (Eastern):
  EDT (UTC-4): Mar 9 02:00 local = Mar 9 07:00 UTC  →  Nov 2 02:00 local = Nov 2 06:00 UTC
  EST (UTC-5): otherwise
"""

import json
import math
from datetime import datetime, timezone, timedelta

# ─── DST boundaries for 2025 (UTC) ───────────────────────────────────────────
EDT_START = datetime(2025, 3, 9, 7, 0, 0, tzinfo=timezone.utc)   # clocks spring forward
EDT_END   = datetime(2025, 11, 2, 6, 0, 0, tzinfo=timezone.utc)  # clocks fall back

EST = timedelta(hours=-5)
EDT = timedelta(hours=-4)

def to_eastern(utc_dt):
    if EDT_START <= utc_dt < EDT_END:
        return utc_dt + EDT
    return utc_dt + EST

# ─── TIME_OF_DAY from local hour ──────────────────────────────────────────────
# AM Commute: 6-8, Midday: 9-14, PM Commute: 15-18, Evening: 19-22, Night: 23/0-5
def time_of_day(local_hour):
    if 6 <= local_hour <= 8:
        return "AM Commute"
    elif 9 <= local_hour <= 14:
        return "Midday"
    elif 15 <= local_hour <= 18:
        return "PM Commute"
    elif 19 <= local_hour <= 22:
        return "Evening"
    else:
        return "Night"

# ─── Solar position: sunrise/sunset for DC ───────────────────────────────────
# Algorithm: NOAA simplified solar position
# Returns (sunrise_hour, sunset_hour) in local fractional hours (Eastern)
# DC coordinates: 38.9072°N, 77.0369°W

LAT  =  38.9072
LON  = -77.0369

def deg2rad(d): return d * math.pi / 180
def rad2deg(r): return r * 180 / math.pi

def solar_times(date_local, utc_offset_hours):
    """
    Returns (sunrise, sunset) as fractional hours in local time.
    date_local: a date object (year/month/day in local time)
    utc_offset_hours: integer offset (e.g. -4 for EDT, -5 for EST)
    """
    # Julian day number
    jd = 367 * date_local.year \
        - int(7 * (date_local.year + int((date_local.month + 9) / 12)) / 4) \
        + int(275 * date_local.month / 9) \
        + date_local.day + 1721013.5

    # Julian century
    T = (jd - 2451545.0) / 36525.0

    # Geometric mean longitude (degrees)
    L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360

    # Mean anomaly (degrees)
    M = 357.52911 + T * (35999.05029 - T * 0.0001537)

    # Equation of center
    C = math.sin(deg2rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) \
      + math.sin(deg2rad(2 * M)) * (0.019993 - 0.000101 * T) \
      + math.sin(deg2rad(3 * M)) * 0.000289

    # Sun's true longitude
    sun_lon = L0 + C

    # Apparent longitude (aberration + nutation)
    omega = 125.04 - 1934.136 * T
    apparent_lon = sun_lon - 0.00569 - 0.00478 * math.sin(deg2rad(omega))

    # Mean obliquity of ecliptic
    eps0 = 23 + (26 + (21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813))) / 60) / 60
    # Corrected obliquity
    eps = eps0 + 0.00256 * math.cos(deg2rad(omega))

    # Sun's declination
    sin_dec = math.sin(deg2rad(eps)) * math.sin(deg2rad(apparent_lon))
    dec = rad2deg(math.asin(sin_dec))

    # Equation of time (minutes)
    y = math.tan(deg2rad(eps / 2)) ** 2
    eq_time = 4 * rad2deg(
        y * math.sin(2 * deg2rad(L0))
        - 2 * 0.016708634 * math.sin(deg2rad(M))
        + 4 * 0.016708634 * y * math.sin(deg2rad(M)) * math.cos(2 * deg2rad(L0))
        - 0.5 * y * y * math.sin(4 * deg2rad(L0))
        - 1.25 * 0.016708634 * 0.016708634 * math.sin(2 * deg2rad(M))
    )

    # Hour angle sunrise (degrees) — 0.833° = atmospheric refraction + solar disk
    cos_ha = (math.cos(deg2rad(90.833)) / (math.cos(deg2rad(LAT)) * math.cos(deg2rad(dec)))
              - math.tan(deg2rad(LAT)) * math.tan(deg2rad(dec)))

    # Clamp for polar edge cases (won't happen for DC)
    cos_ha = max(-1.0, min(1.0, cos_ha))
    ha = rad2deg(math.acos(cos_ha))

    # Solar noon (minutes past UTC midnight)
    solar_noon_utc = 720 - 4 * LON - eq_time  # minutes

    # Sunrise/sunset in minutes past UTC midnight
    sunrise_utc = solar_noon_utc - ha * 4
    sunset_utc  = solar_noon_utc + ha * 4

    # Convert to local fractional hours
    sunrise_local = (sunrise_utc / 60) + utc_offset_hours
    sunset_local  = (sunset_utc  / 60) + utc_offset_hours

    return sunrise_local, sunset_local

# ─── LIGHT_CONDITION from local time vs solar times ──────────────────────────
TWILIGHT_BUFFER = 0.5  # 30 minutes

def light_condition(local_hour_frac, sunrise, sunset):
    if sunrise + TWILIGHT_BUFFER <= local_hour_frac <= sunset - TWILIGHT_BUFFER:
        return "Daylight"
    elif (sunrise - TWILIGHT_BUFFER <= local_hour_frac < sunrise + TWILIGHT_BUFFER or
          sunset - TWILIGHT_BUFFER < local_hour_frac <= sunset + TWILIGHT_BUFFER):
        return "Twilight"
    else:
        return "Dark"

# ─── Main ─────────────────────────────────────────────────────────────────────
with open("data/crashesFinal.geojson", "r") as f:
    geojson = json.load(f)

before_tod   = {}
before_light = {}
after_tod    = {}
after_light  = {}

skipped = 0

for feature in geojson["features"]:
    props = feature["properties"]
    report_date_str = props.get("REPORTDATE")

    if not report_date_str:
        skipped += 1
        continue

    # Parse UTC datetime
    # Format: "2025-01-06T00:20:00Z" or "2025-01-06T00:20:00.000Z"
    rd = report_date_str.rstrip("Z").split(".")[0]
    utc_dt = datetime.fromisoformat(rd).replace(tzinfo=timezone.utc)

    # Determine offset
    utc_offset_hours = -4 if EDT_START <= utc_dt < EDT_END else -5

    # Convert to Eastern
    local_dt = to_eastern(utc_dt)
    local_hour = local_dt.hour + local_dt.minute / 60

    # Before tallies
    before_tod[props.get("TIME_OF_DAY", "None")]     = before_tod.get(props.get("TIME_OF_DAY", "None"), 0) + 1
    before_light[props.get("LIGHT_CONDITION", "None")] = before_light.get(props.get("LIGHT_CONDITION", "None"), 0) + 1

    # Compute new TIME_OF_DAY
    new_tod = time_of_day(local_dt.hour)

    # Compute solar times for this date at DC
    sunrise, sunset = solar_times(local_dt.date(), utc_offset_hours)

    # Compute new LIGHT_CONDITION
    new_light = light_condition(local_hour, sunrise, sunset)

    # After tallies
    after_tod[new_tod]     = after_tod.get(new_tod, 0) + 1
    after_light[new_light] = after_light.get(new_light, 0) + 1

    # Write back
    props["TIME_OF_DAY"]     = new_tod
    props["LIGHT_CONDITION"] = new_light

print(f"Skipped (no REPORTDATE): {skipped}")
print()

print("TIME_OF_DAY — before vs after")
print(f"{'Category':<20} {'Before':>8} {'After':>8}")
all_tod = sorted(set(list(before_tod.keys()) + list(after_tod.keys())), key=lambda x: x or "")
for k in all_tod:
    print(f"  {str(k):<18} {before_tod.get(k, 0):>8} {after_tod.get(k, 0):>8}")

print()
print("LIGHT_CONDITION — before vs after")
print(f"{'Category':<20} {'Before':>8} {'After':>8}")
all_light = sorted(set(list(before_light.keys()) + list(after_light.keys())), key=lambda x: x or "")
for k in all_light:
    print(f"  {str(k):<18} {before_light.get(k, 0):>8} {after_light.get(k, 0):>8}")

# Write corrected GeoJSON
with open("data/crashesFinal.geojson", "w") as f:
    json.dump(geojson, f, separators=(",", ":"))

print()
print("Wrote corrected data/crashesFinal.geojson")
