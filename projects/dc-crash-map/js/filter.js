// ─── Unified chart filter ─────────────────────────────────────────────────────
function getFilterExpr(section, key) {
  if (section === 'V') {
    if (key === 'SOLO_CRASH')     return ['==', ['get', 'SOLO_CRASH'], true];
    if (key === 'OTHER_COMBINED') return ['any',
      ['>', ['coalesce', ['get', 'MOTORCYCLE_MOPED'], 0], 0],
      ['>', ['coalesce', ['get', 'HEAVY_TRUCK'], 0], 0],
      ['>', ['coalesce', ['get', 'BUS'], 0], 0],
      ['>', ['coalesce', ['get', 'OTHER_VEHICLE'], 0], 0]
    ];
    return ['>', ['coalesce', ['get', key], 0], 0];
  }
  if (section === 'L') {
    const cat = LANE_CATEGORIES.find(c => c.key === key);
    if (!cat) return null;
    if (key === 'No Bike Lane') return ['==', ['coalesce', ['get', 'LANE_TYPE'], 'No Bike Lane'], 'No Bike Lane'];
    if (cat.sources.length === 1) return ['==', ['get', 'LANE_TYPE'], cat.sources[0]];
    return ['any', ...cat.sources.map(s => ['==', ['get', 'LANE_TYPE'], s])];
  }
  if (section === 'M') {
    const mm = String(parseInt(key) + 1).padStart(2, '0');
    return ['==', ['slice', ['get', 'REPORTDATE'], 5, 7], mm];
  }
  if (section === 'S')  return ['==', ['get', 'SEVERITY'], key];
  if (section === 'RT') {
    if (key === 'Road')         return ['==', ['get', 'ROAD_TYPE'], 'Road'];
    if (key === 'Intersection') return ['==', ['get', 'ROAD_TYPE'], 'Intersection'];
    return ['all', ['!=', ['get', 'ROAD_TYPE'], 'Road'], ['!=', ['get', 'ROAD_TYPE'], 'Intersection']];
  }
  return null;
}

function clearActiveFilter() {
  if (!activeFilter) return;
  document.querySelectorAll('#tally-panel .bar-row[data-section]').forEach(r => {
    r.classList.remove('bar-active', 'bar-dimmed');
  });
  LANE_CATEGORIES.forEach((_, i) => {
    const arc = document.getElementById(`lane-arc-${i}`);
    if (arc) arc.setAttribute('opacity', '0.88');
  });
  document.querySelectorAll('#lane-legend .hin-lrow').forEach(r => { r.style.opacity = '1'; });
  for (let h = 0; h < 24; h++) {
    const bar = document.getElementById(`hbar-${h}`);
    if (bar) bar.setAttribute('opacity', '1');
  }
  MONTH_LABELS.forEach((_, i) => {
    const live  = document.getElementById(`mbar-${i}`);
    const ghost = document.getElementById(`mghost-${i}`);
    if (live)  live.setAttribute('opacity', '1');
    if (ghost) ghost.setAttribute('opacity', '1');
  });
  activeFilter = null;
  if (map.getLayer('crash-circles')) {
    map.setPaintProperty('crash-circles', 'circle-color', '#ffffff');
    map.setPaintProperty('crash-circles', 'circle-opacity', 0.7);
  }
  document.querySelectorAll('#tally-panel .bar-fill').forEach(el => { el.style.background = ''; });
}

function applyFilter(section, key) {
  const isToggleOff = activeFilter && activeFilter.section === section && activeFilter.key === key;
  clearActiveFilter();
  if (isToggleOff) return;

  const filterExpr = getFilterExpr(section, key);
  activeFilter = { section, key };

  if (filterExpr) {
    map.setPaintProperty('crash-circles', 'circle-color',   '#ffffff');
    map.setPaintProperty('crash-circles', 'circle-opacity', ['case', filterExpr, 0.75, 0]);
  }

  if (!pinsVisible) {
    pinsVisible = true;
    map.setLayoutProperty('crash-circles', 'visibility', 'visible');
    document.getElementById('pins-btn').textContent = 'Hide Collisions';
    document.getElementById('pins-legend').classList.add('visible');
  }

  if (section === 'L') {
    LANE_CATEGORIES.forEach((c, i) => {
      const arc = document.getElementById(`lane-arc-${i}`);
      if (arc) arc.setAttribute('opacity', c.key === key ? '0.88' : '0.15');
    });
    document.querySelectorAll('#lane-legend .hin-lrow[data-key]').forEach(r => {
      r.style.opacity = r.dataset.key === key ? '1' : '0.25';
    });
  } else if (section === 'M') {
    MONTH_LABELS.forEach((_, i) => {
      const isActive = String(i) === key;
      const live  = document.getElementById(`mbar-${i}`);
      const ghost = document.getElementById(`mghost-${i}`);
      if (live)  live.setAttribute('opacity', isActive ? '1' : '0.2');
      if (ghost) ghost.setAttribute('opacity', isActive ? '1' : '0.2');
    });
  } else {
    document.querySelectorAll(`#tally-panel .bar-row[data-section="${section}"]`).forEach(r => {
      r.classList.add(r.dataset.key === key ? 'bar-active' : 'bar-dimmed');
    });
  }
}
