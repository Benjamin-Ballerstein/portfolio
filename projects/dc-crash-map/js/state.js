// ─── Animation state ──────────────────────────────────────────────────────────
let crashes         = [];
let isPlaying       = false;
let animElapsed     = 0;
let wallStart       = null;
let rafId           = null;
let nextCrashIdx    = 0;

// ─── Spatial state ────────────────────────────────────────────────────────────
let gridIndex    = new Map(); // "cellX,cellY" → [segmentIndex, ...]
let segmentMids  = [];        // [{lon, lat, fid}]
let segmentState = new Map(); // fid → { hits }

// ─── Road index ───────────────────────────────────────────────────────────────
let fidProps       = new Map(); // OBJECTID → { rid, from_m, to_m }
let roadIndex      = new Map(); // ROUTEID  → [{fid, from_m, to_m}] sorted by from_m
const ridToName    = new Map(); // ROUTEID  → ROUTENAME
const routeNameSet = new Set(); // all unique ROUTENAMEs

// ─── App state ────────────────────────────────────────────────────────────────
let waves          = [];     // canvas shockwave rings
let crashGeoJSON   = null;   // raw geojson — stored for MapLibre pins layer
let pinsVisible    = false;
let gapModeActive  = false;
let crashCount     = 0;
let activeFilter   = null;   // { section, key } or null
let streetmapVisible = false;

// ─── Ward state ───────────────────────────────────────────────────────────────
let wardCrashCounts = {}; // "Ward X" → total crashes (pre-computed, static)
let wardBounds      = {}; // "Ward X" → [[minLon,minLat],[maxLon,maxLat]]
let activeWard      = null;
let wardsData       = null; // stored for mini-map rendering

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const canvas         = document.getElementById('crash-canvas');
const ctx            = canvas.getContext('2d');
const scrubEl        = document.getElementById('scrub-bar');
const dateEl         = document.getElementById('date-display');
const playBtnEl      = document.getElementById('play-btn');
const playIconEl     = document.getElementById('play-icon');
const skipTextEl     = document.getElementById('skip-text');
const crashNumEl     = document.getElementById('crash-num');

// ─── Tally state ──────────────────────────────────────────────────────────────
let tallyVehicle  = {};
let tallyLane     = {};
let tallySeverity = {};
let tallyHour     = new Array(24).fill(0);
let tallyRoadType = {};
let tallyWard     = {};
let tallyMaxV = 1, tallyMaxSev = 1, tallyMaxH = 1, tallyMaxRT = 1;

let monthlyTotals = new Array(12).fill(0);
let monthlyLive   = new Array(12).fill(0);
let tallyMaxM     = 1;
