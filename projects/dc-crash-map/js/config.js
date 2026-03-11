// ─── Animation ────────────────────────────────────────────────────────────────
const DURATION_MS = 30_000;
const ANIM_START  = new Date('2025-01-01T00:00:00Z');
const ANIM_END    = new Date('2025-12-31T23:59:59Z');
const DATE_RANGE  = ANIM_END - ANIM_START;

// ─── Density color scale ──────────────────────────────────────────────────────
// Three knobs:
//   DENSITY_BASE    — unhit road color
//   DENSITY_LOW     — color of a first-hit / corridor-fill road
//   DENSITY_HIGH    — color once a segment reaches DENSITY_MAXHITS crashes
//   DENSITY_MAXHITS — how many crashes on the same segment = full brightness
// MapLibre linearly interpolates between LOW and HIGH, so you only need to
// balance two colors. Make LOW more amber/gold; make HIGH white or warm-white.
const DENSITY_BASE    = '#3a3a3a';
const DENSITY_LOW     = '#d99800';  // ← adjust: more amber (lower) or more gold (higher)
const DENSITY_HIGH    = '#ffe599';  // ← adjust: try '#ffe599' for warm-white instead of pure white
const DENSITY_MAXHITS = 2;          // ← adjust: lower = hotspots appear faster

const DENSITY_STOPS = [
  [0,               DENSITY_BASE],
  [1,               DENSITY_LOW ],
  [DENSITY_MAXHITS, DENSITY_HIGH],
];

// ─── Spatial search ───────────────────────────────────────────────────────────
const GRID_RES        = 0.001;  // degrees per grid cell (~90–111m)
const SEARCH_RADIUS   = 0.001;  // degrees (~100m)
const MAX_CORRIDOR_M  = 400;    // meters — road-fill reveal radius each side of a crash (~18 blocks)

// ─── Canvas shockwave ─────────────────────────────────────────────────────────
const WAVE_DURATION = 500; // ms

// ─── Geography ────────────────────────────────────────────────────────────────
const WARD_LIST = ['Ward 1','Ward 2','Ward 3','Ward 4','Ward 5','Ward 6','Ward 7','Ward 8'];
const DC_BOUNDS = [[-77.13, 38.785], [-76.905, 38.998]];

// ─── Tally: vehicle fields ────────────────────────────────────────────────────
const VEHICLE_FIELDS = [
  { key: 'PASSENGER_VEHICLE', label: 'Passenger'           },
  { key: 'SUV_PICKUP_VAN',    label: 'SUV / Pickup'        },
  { key: 'SOLO_CRASH',        label: 'No Vehicle Recorded' },
  { key: 'OTHER_COMBINED', label: 'Other',
    sources: ['MOTORCYCLE_MOPED','HEAVY_TRUCK','BUS','OTHER_VEHICLE'] },
];

// ─── Tally: severity fields ───────────────────────────────────────────────────
const SEVERITY_FIELDS = [
  { key: 'Major Injury', label: 'Major'  },
  { key: 'Minor Injury', label: 'Minor'  },
  { key: 'No Injury',    label: 'No Inj' },
];

// ─── Tally: bike lane categories ─────────────────────────────────────────────
const LANE_CATEGORIES = [
  { key: 'No Bike Lane', label: 'No Lane',      sources: ['No Bike Lane'] },
  { key: 'Conventional', label: 'Conventional', sources: ['Conventional', 'Contraflow', 'Through Lane Adjacent'] },
  { key: 'Protected',    label: 'Protected',    sources: ['Protected', 'Dual Protected'] },
  { key: 'Buffered',     label: 'Buffered',     sources: ['Buffered', 'Dual Buffered'] },
];

const LANE_COLORS = {
  'No Bike Lane': 'rgba(220,220,220,0.18)',
  'Conventional': 'rgba(232,178,0,0.55)',
  'Buffered':     'rgba(232,178,0,0.82)',
  'Protected':    'rgba(255,220,100,0.95)',
};

// ─── Tally: road type fields ──────────────────────────────────────────────────
const ROAD_TYPE_FIELDS = [
  { key: 'Road',         label: 'Road'         },
  { key: 'Intersection', label: 'Intersection' },
  { key: 'Other',        label: 'Other'        },
];

// ─── Tally: month labels ──────────────────────────────────────────────────────
const MONTH_LABELS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

