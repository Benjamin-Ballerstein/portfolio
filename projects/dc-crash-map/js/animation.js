// ─── Phase 2: Load crash data ─────────────────────────────────────────────────
async function loadCrashes() {
  const geojson = await d3.json('data/crashesFinal.geojson');
  crashGeoJSON = geojson;

  crashes = geojson.features
    .map(f => {
      const u = new Date(f.properties.REPORTDATE);
      const o = (u >= new Date('2025-03-09T07:00:00Z') && u < new Date('2025-11-02T06:00:00Z')) ? -4 : -5;
      return {
        ...f,
        properties: {
          ...f.properties,
          date:      u,
          localHour: (u.getUTCHours() + 24 + o) % 24,
          LANE_TYPE: f.properties.LANE_TYPE ?? 'No Bike Lane'
        }
      };
    })
    .sort((a, b) => a.properties.date - b.properties.date);

  // Pre-compute ward crash counts and bounding boxes
  WARD_LIST.forEach(ward => { wardCrashCounts[ward] = 0; });
  crashes.forEach(c => {
    const w = c.properties.WARD;
    if (w && Object.prototype.hasOwnProperty.call(wardCrashCounts, w)) wardCrashCounts[w]++;
  });
  WARD_LIST.forEach(ward => {
    const pts = crashes.filter(c => c.properties.WARD === ward).map(c => c.geometry.coordinates);
    if (!pts.length) return;
    wardBounds[ward] = [
      [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))],
      [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]
    ];
  });

}

// ─── Phase 3: Animation engine ────────────────────────────────────────────────
function initAnimation() {
  crashes.forEach(crash => {
    const t = (crash.properties.date - ANIM_START) / DATE_RANGE;
    crash.animMs = Math.max(0, Math.min(DURATION_MS, t * DURATION_MS));
    // Precompute nearest route name for search filtering
    const [lon, lat] = crash.geometry.coordinates;
    const nearby = findNearbySegments(lon, lat);
    if (nearby.length > 0) {
      const props = fidProps.get(nearby[0].fid);
      crash.nearestRouteName = props?.rid ? (ridToName.get(props.rid) ?? null) : null;
    } else {
      crash.nearestRouteName = null;
    }
  });

  scrubEl.max = DURATION_MS;
  wireControls();
  initTally();
  updateDateDisplay(0);

  window.play   = play;
  window.pause  = pause;
  window.replay = replay;
  window.seek   = seekTo;
}

function wireControls() {
  let wasScrubPlaying = false;

  scrubEl.addEventListener('mousedown', () => {
    wasScrubPlaying = isPlaying;
    pause();
  });
  scrubEl.addEventListener('input', () => {
    seekTo(+scrubEl.value);
  });
  scrubEl.addEventListener('mouseup', () => {
    if (wasScrubPlaying) play();
  });

  playBtnEl.addEventListener('click', () => {
    if (playIconEl.textContent.trim() === 'replay') { replay(); return; }
    if (isPlaying) pause(); else play();
  });

  skipTextEl.addEventListener('click', skipToEnd);
  document.getElementById('gap-btn').addEventListener('click', toggleGapMode);

  map.on('click', e => {
    if (!e.defaultPrevented && activeFilter) clearActiveFilter();
  });
}

function updateDateDisplay(ms) {
  const d = new Date(ANIM_START.getTime() + (ms / DURATION_MS) * DATE_RANGE);
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  dateEl.textContent = label;

  const pct    = ms / DURATION_MS;
  const trackW = scrubEl.offsetWidth || 352;
  const thumbW = 12;
  dateEl.style.left = (thumbW / 2 + pct * (trackW - thumbW)) + 'px';

  scrubEl.value = ms;
  scrubEl.style.background =
    `linear-gradient(to right, rgba(232,178,0,0.7) ${pct * 100}%, rgba(255,255,255,0.15) ${pct * 100}%)`;
}

function tick(now) {
  const delta = now - wallStart;
  wallStart   = now;
  animElapsed = Math.min(animElapsed + delta, DURATION_MS);

  updateDateDisplay(animElapsed);
  firePendingCrashes();

  if (animElapsed < DURATION_MS) {
    rafId = requestAnimationFrame(tick);
  } else {
    onAnimationEnd();
  }
}

function firePendingCrashes() {
  while (nextCrashIdx < crashes.length &&
         crashes[nextCrashIdx].animMs <= animElapsed) {
    fireCrash(crashes[nextCrashIdx]);
    nextCrashIdx++;
  }
}

function play() {
  if (isPlaying || animElapsed >= DURATION_MS) return;
  isPlaying = true;
  wallStart = performance.now();
  rafId     = requestAnimationFrame(tick);
}

function pause() {
  if (!isPlaying) return;
  isPlaying = false;
  cancelAnimationFrame(rafId);
}

function seekTo(ms) {
  const wasPlaying = isPlaying;
  pause();
  if (ms < animElapsed) resetVisualState();
  animElapsed  = Math.max(0, Math.min(DURATION_MS, ms));
  nextCrashIdx = crashes.findIndex(c => c.animMs > animElapsed);
  if (nextCrashIdx === -1) nextCrashIdx = crashes.length;
  updateDateDisplay(animElapsed);
  if (wasPlaying) play();
}

function replay() {
  pause();
  resetVisualState();
  animElapsed  = 0;
  nextCrashIdx = 0;
  playIconEl.textContent = 'play_pause';
  skipTextEl.classList.remove('hidden');
  updateDateDisplay(0);
  activeWard = null;
  if (streetmapVisible) {
    streetmapVisible = false;
    map.setLayoutProperty('carto-dark-layer', 'visibility', 'none');
    map.setLayoutProperty('carto-labels-layer', 'visibility', 'none');
    map.setLayoutProperty('bike-lanes-layer', 'visibility', 'none');
    map.setLayoutProperty('centerlines-layer', 'visibility', 'visible');
    map.setLayoutProperty('centerlines-labels', 'visibility', 'visible');
  }
  clearActiveFilter();
  if (pinsVisible) {
    pinsVisible = false;
    map.setLayoutProperty('crash-circles', 'visibility', 'none');
    map.setPaintProperty('crash-circles', 'circle-opacity', 0);
    document.getElementById('pins-btn').textContent = 'Show Collisions';
    document.getElementById('pins-legend').classList.remove('visible');
  }
  play();
}

function skipToEnd() {
  pause();
  while (nextCrashIdx < crashes.length) {
    fireCrash(crashes[nextCrashIdx]);
    nextCrashIdx++;
  }
  animElapsed = DURATION_MS;
  updateDateDisplay(DURATION_MS);
  onAnimationEnd();
}

function onAnimationEnd() {
  isPlaying = false;
  playIconEl.textContent = 'replay';
  skipTextEl.classList.add('hidden');
  if (!pinsVisible) {
    pinsVisible = true;
    map.setLayoutProperty('crash-circles', 'visibility', 'visible');
    map.setPaintProperty('crash-circles', 'circle-opacity', 0.7);
    document.getElementById('pins-btn').textContent = 'Hide Collisions';
    document.getElementById('pins-legend').classList.add('visible');
  }
}

// ─── Phase 4+5: Crash firing ──────────────────────────────────────────────────

// APPROACH A — N closest segments (current):
// Each crash illuminates the N nearest road segments. Covers the actual road
// even when a midpoint lookup is imprecise, and naturally lights multiple legs
// at intersections. Density accumulates per segment across crashes.
const CLOSEST_N = 1;

function fireCrash(crash) {
  updateTally(crash);
  const [lon, lat] = crash.geometry.coordinates;
  const { x, y }  = map.project([lon, lat]);

  waves.push({ cx: x, cy: y, startTime: performance.now() });

  const nearby = findNearbySegments(lon, lat).slice(0, CLOSEST_N);
  nearby.forEach(({ fid }) => activateSegment(fid));
  if (nearby.length > 0) fillRoadCorridor(nearby[0].fid);
}

// Radial reveal — lights up outer segments, does NOT accumulate density.
function revealSegment(fid) {
  if (segmentState.has(fid)) return;
  segmentState.set(fid, { hits: 1 });
  map.setFeatureState({ source: 'centerlines', id: fid }, { hits: 1 });
}

// Density activation — increments hit count for segments at the crash location.
function activateSegment(fid) {
  const current = segmentState.get(fid) ?? { hits: 0 };
  const newHits = current.hits + 1;
  segmentState.set(fid, { hits: newHits });
  map.setFeatureState({ source: 'centerlines', id: fid }, { hits: newHits });
}

function resetVisualState() {
  segmentState.forEach((_, fid) => {
    map.setFeatureState({ source: 'centerlines', id: fid }, { hits: 0 });
  });
  segmentState.clear();
  waves = [];
  resetTally();
}
