# DC Crash Map — Claude Context

## Project
DC bicycle collision visualization for 2025. MapLibre GL + D3 v7. No build step — plain `<script>` tags share global scope.

## File Structure

| File | Contents | ~Lines |
|------|----------|--------|
| `js/config.js` | All constants: animation timing, DENSITY_STOPS, spatial params, WARD_LIST, DC_BOUNDS, VEHICLE_FIELDS, SEVERITY_FIELDS, LANE_CATEGORIES, LANE_COLORS, ROAD_TYPE_FIELDS, MONTH_LABELS | ~80 |
| `js/state.js` | All `let`/`const` globals: animation state, spatial state, ward state, DOM refs, tally state | ~55 |
| `js/canvas.js` | `resizeCanvas()`, `canvasTick()`, `startCanvasLoop()` | ~35 |
| `js/spatial.js` | `buildSpatialIndex()`, `findNearbySegments()` | ~50 |
| `js/animation.js` | `loadCrashes()`, `initAnimation()`, `wireControls()`, `tick()`, `play()`, `pause()`, `seekTo()`, `replay()`, `skipToEnd()`, `onAnimationEnd()`, `fireCrash()`, `revealSegment()`, `activateSegment()`, `resetVisualState()` | ~195 |
| `js/layers.js` | `initWards()`, `zoomToWard()`, `initBikeLanes()`, `toggleStreetmap()`, `buildPopupHTML()`, `initCrashPins()` | ~185 |
| `js/filter.js` | `getFilterExpr()`, `clearActiveFilter()`, `applyFilter()` | ~85 |
| `js/tally.js` | All tally panel: `initTally()`, `updateTally()`, `resetTally()`, `refreshBars()`, `refreshLane()`, `refreshMonthlyBars()`, `refreshWardMap()`, `buildTallyHTML()`, `buildWardMiniMap()`, + chart builders | ~285 |
| `app.js` | Map init (`new maplibregl.Map`) + `map.on('load')` bootstrap | ~55 |
| `index.html` | HTML shell; loads scripts in order (config → state → canvas → spatial → animation → layers → filter → tally → app) | ~85 |
| `style.css` | All CSS | ~496 |

## Data Files
- `data/crashesFinal.geojson` — 2025 bicycle crashes with properties: REPORTDATE, SEVERITY, LANE_TYPE, TIME_OF_DAY, LIGHT_CONDITION, ROAD_TYPE, WARD, SOLO_CRASH, cyclist/vehicle flags
- `data/centerlinesFinal.geojson` — DC road segments with `fid` property (used as MapLibre promoteId)
- `data/wards.geojson` — DC ward polygons with NAME ("Ward 1"…"Ward 8") and WARD (numeric) properties
- `BicycleLanes.geojson` — DC bike lane network

## Key Architecture Notes
- **Shared global state**: no ES modules — all scripts share the same browser global scope. Load order matters.
- **`map` variable** is defined in `app.js` (last). Functions in other files reference it in their bodies, not at define-time, so they safely call it after all scripts are loaded.
- **MapLibre feature state** drives road color/opacity/width via `hits` count on `centerlines` source.
- **Ward mini-map** in tally panel: SVG paths built from wards.geojson with manual Mercator projection. Ward paths have `pointer-events:all` to work inside `pointer-events:none` tally panel.
- **Tally panel** (`#tally-panel`) has CSS `pointer-events: none`; interactive children override with `pointer-events: all`.

## Key Constants (in js/config.js)
- `DURATION_MS = 30_000` — 30s animation
- `DC_BOUNDS = [[-77.13, 38.785], [-76.905, 38.998]]`
- `WARD_LIST` — 8 wards, Ward 1–8

## Key State Variables (in js/state.js)
- `crashes[]` — sorted crash features with `animMs` timing
- `wardCrashCounts` — static final counts per ward (populated in `loadCrashes`)
- `tallyWard` — live counts that animate in during playback
- `activeFilter` — `{ section, key }` or null
- `wardsData` — wards GeoJSON stored for mini-map rendering

## Tally Filter Sections
- `'V'` — vehicle type (VEHICLE_FIELDS keys)
- `'S'` — severity
- `'L'` — lane category (LANE_CATEGORIES keys)
- `'M'` — month index (0–11)
- `'RT'` — road type

## CSS Classes to Know
- `.hidden` — `display: none !important`
- `.bar-active` / `.bar-dimmed` — filter highlight state on `.bar-row` elements
- `#tally-panel` — fixed bottom-left panel, `pointer-events: none`
