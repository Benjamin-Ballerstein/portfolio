// ─── Tally: chart constants ───────────────────────────────────────────────────
const _lanePie = d3.pie().value(d => d).sort(null).padAngle(0.04);
const _laneArc = d3.arc().innerRadius(14).outerRadius(30).cornerRadius(1);

// Report Hour — 24-bar column chart (local Eastern time, 0–23)
const H_BAR_W   = 3;
const H_BAR_GAP = 3;
const H_BAR_BOT = 50;
const H_BAR_MAX = 46;
const H_SVG_W   = 24 * (H_BAR_W + H_BAR_GAP) - H_BAR_GAP; // 141px

// Monthly bar chart — 12 bars Jan–Dec
const M_BAR_W   = 10;
const M_BAR_GAP = 2;
const M_BAR_BOT = 50;
const M_BAR_MAX = 46;
const M_SVG_W   = 12 * (M_BAR_W + M_BAR_GAP) - M_BAR_GAP; // 142px

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toBarId(prefix, str) {
  return `${prefix}-${str.replace(/[^a-zA-Z0-9]/g, '-')}`;
}

// ─── HTML builders ────────────────────────────────────────────────────────────
function buildBarRows(fields, prefix, section) {
  return fields.map(({ key, label }) => `
    <div class="bar-row" data-section="${section}" data-key="${key}">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" id="${toBarId('bf' + prefix, key)}"></div></div>
      <span class="bar-count" id="${toBarId('bc' + prefix, key)}">0</span>
    </div>`).join('');
}

function buildLaneDonut() {
  return `
    <div id="lane-wrap">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r="30" fill="#181818"/>
        <circle cx="34" cy="34" r="30" fill="none" stroke="#484848" stroke-width="1"/>
        <g id="lane-arcs" transform="translate(34,34)">
          ${LANE_CATEGORIES.map((c, i) =>
            `<path id="lane-arc-${i}" fill="${LANE_COLORS[c.key]}" d="" opacity="0.88" style="cursor:pointer"/>`
          ).join('')}
        </g>
      </svg>
      <div id="lane-legend">
        ${LANE_CATEGORIES.map(c => `
          <div class="hin-lrow" data-key="${c.key}" style="cursor:pointer;pointer-events:all">
            <span class="hin-dot" style="background:${LANE_COLORS[c.key]}"></span>${c.label}
          </div>`).join('')}
      </div>
    </div>`;
}

function buildMonthlyChart() {
  const svgH = M_BAR_BOT + 12;
  return `
    <svg width="${M_SVG_W}" height="${svgH}" style="overflow:visible;pointer-events:all">
      ${MONTH_LABELS.map((lbl, i) => {
        const x  = i * (M_BAR_W + M_BAR_GAP);
        const cx = x + M_BAR_W / 2;
        const gh = Math.round((monthlyTotals[i] / tallyMaxM) * M_BAR_MAX);
        return `
          <rect id="mghost-${i}" x="${x}" y="${M_BAR_BOT - gh}" width="${M_BAR_W}" height="${gh}"
                fill="rgba(255,255,255,0.07)" rx="1"/>
          <rect id="mbar-${i}"
                x="${x}" y="${M_BAR_BOT}" width="${M_BAR_W}" height="0"
                fill="#e8b200f2" rx="1"/>
          <rect x="${x}" y="0" width="${M_BAR_W}" height="${M_BAR_BOT}"
                fill="transparent" data-section="M" data-key="${i}"
                style="cursor:pointer"/>
          <text x="${cx}" y="${M_BAR_BOT + 10}"
                text-anchor="middle"
                font-family="'Inter', system-ui, sans-serif"
                font-weight="300" font-size="7"
                fill="white" opacity="0.4">${lbl}</text>`;
      }).join('')}
    </svg>`;
}

function buildHourChart() {
  const svgH = H_BAR_BOT + 14;
  const bars = Array.from({ length: 24 }, (_, h) => {
    const x  = h * (H_BAR_W + H_BAR_GAP);
    const cx = x + H_BAR_W / 2;
    const label = (h % 6 === 0) ? String(h) : '';
    return `
      <rect id="hbar-${h}" x="${x}" y="${H_BAR_BOT}" width="${H_BAR_W}" height="0"
            fill="rgba(232,178,0,0.95)" rx="1"/>
      ${label ? `<text x="${cx}" y="${H_BAR_BOT + 10}"
            text-anchor="middle"
            font-family="'Inter', system-ui, sans-serif"
            font-weight="300" font-size="7"
            fill="white" opacity="0.4">${label}</text>` : ''}`;
  }).join('');
  return `<svg width="${H_SVG_W}" height="${svgH}" style="overflow:visible">${bars}</svg>`;
}

function buildWardMiniMap() {
  if (!wardsData) return '';
  const W = 142, H = 104, PAD = 4;

  const lonMin = DC_BOUNDS[0][0], lonMax = DC_BOUNDS[1][0];
  const latMin = DC_BOUNDS[0][1], latMax = DC_BOUNDS[1][1];
  const cosLat = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
  const wEff   = (lonMax - lonMin) * cosLat;
  const hEff   = latMax - latMin;
  const scale  = Math.min((W - 2 * PAD) / wEff, (H - 2 * PAD) / hEff);
  const offX   = (W - wEff * scale) / 2;
  const offY   = (H - hEff * scale) / 2;
  const project = ([lon, lat]) => [
    (offX + (lon - lonMin) * cosLat * scale).toFixed(1),
    (H - offY - (lat - latMin) * scale).toFixed(1)
  ];

  function ringToD(ring) {
    return ring.map((c, i) => `${i ? 'L' : 'M'}${project(c).join(',')}`).join('') + 'Z';
  }
  function featToD(feat) {
    const g = feat.geometry;
    if (!g) return '';
    const rings = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
    return rings.map(ringToD).join('');
  }

  const paths = wardsData.features.map(feat => {
    const name   = feat.properties.NAME;
    const id     = feat.properties.WARD;
    const d      = featToD(feat);
    if (!d) return '';
    const pathId = `ward-path-${name.replace(/\s+/g, '-')}`;
    return `<path id="${pathId}" d="${d}" fill="rgba(232,178,0,0)" stroke="rgba(90,90,90,0.7)" stroke-width="0.8" style="cursor:pointer;pointer-events:all" data-ward-name="${name}" data-ward-id="${id}"/>`;
  }).join('');

  return `<svg id="ward-minimap" width="${W}" height="${H}" style="display:block;overflow:hidden;pointer-events:all">
    ${paths}
  </svg>`;
}

function refreshWardMap() {
  const maxCount = Math.max(1, ...Object.values(wardCrashCounts));
  WARD_LIST.forEach(name => {
    const el = document.getElementById(`ward-path-${name.replace(/\s+/g, '-')}`);
    if (!el) return;
    const opacity = (0.06 + (tallyWard[name] / maxCount) * 0.89).toFixed(2);
    el.setAttribute('fill', `rgba(232,178,0,${opacity})`);
  });
}

function buildTallyHTML() {
  return `
    <div class="tally-panel-header">2025 Crash Statistics</div>
    <div class="tally-cols-row">
      <div class="tally-col">
        <div class="tally-section">
          <div class="tally-heading">Vehicle Type</div>
          ${buildBarRows(VEHICLE_FIELDS, 'V', 'V')}
        </div>
        <div class="tally-section">
          <div class="tally-heading">Bike Lane Type</div>
          ${buildLaneDonut()}
        </div>
        <div class="tally-section">
          <div class="tally-heading">Severity</div>
          ${buildBarRows(SEVERITY_FIELDS, 'S', 'S')}
        </div>
        <div class="tally-section">
          <div class="tally-heading">Road Type</div>
          ${buildBarRows(ROAD_TYPE_FIELDS, 'RT', 'RT')}
        </div>
      </div>
      <div class="tally-col">
        <div class="tally-section">
          <div class="tally-heading">Monthly Crashes</div>
          ${buildMonthlyChart()}
        </div>
        <div class="tally-section">
          <div class="tally-heading">Report Hour</div>
          ${buildHourChart()}
        </div>
        <div class="tally-section">
          <div class="tally-heading">Crashes by Ward</div>
          ${buildWardMiniMap()}
        </div>
      </div>
    </div>`;
}

// ─── Tally: init ──────────────────────────────────────────────────────────────
function initTally() {
  // Precompute final totals for stable scaling
  const finalV = {}, finalL = {}, finalS = {}, finalH = new Array(24).fill(0), finalRT = {};
  VEHICLE_FIELDS.forEach(f    => { finalV[f.key]  = 0; });
  LANE_CATEGORIES.forEach(g   => { finalL[g.key]  = 0; });
  SEVERITY_FIELDS.forEach(f   => { finalS[f.key]  = 0; });
  ROAD_TYPE_FIELDS.forEach(f  => { finalRT[f.key] = 0; });

  crashes.forEach(({ properties: p }) => {
    VEHICLE_FIELDS.forEach(f => {
      if (f.key === 'SOLO_CRASH') { if (p.SOLO_CRASH) finalV[f.key]++; }
      else if (f.sources)         { if (f.sources.some(s => (p[s] ?? 0) > 0)) finalV[f.key]++; }
      else                        { if ((p[f.key] ?? 0) > 0) finalV[f.key]++; }
    });
    const rawLane   = p.LANE_TYPE ?? 'No Bike Lane';
    const laneGroup = LANE_CATEGORIES.find(g => g.sources.includes(rawLane))?.key ?? 'No Bike Lane';
    if (laneGroup in finalL) finalL[laneGroup]++;
    const sev = p.SEVERITY;
    if (sev && sev in finalS) finalS[sev]++;
    finalH[p.localHour]++;
    const rt = p.ROAD_TYPE ?? null;
    const rtKey = (rt === 'Road' || rt === 'Intersection') ? rt : 'Other';
    finalRT[rtKey]++;
  });

  VEHICLE_FIELDS.sort((a, b) => (finalV[b.key] ?? 0) - (finalV[a.key] ?? 0));

  tallyMaxV   = Math.max(1, ...Object.values(finalV));
  tallyMaxSev = Math.max(1, ...Object.values(finalS));
  tallyMaxH   = Math.max(1, ...finalH);
  tallyMaxRT  = Math.max(1, ...Object.values(finalRT));

  monthlyTotals.fill(0);
  crashes.forEach(({ properties: p }) => { monthlyTotals[p.date.getMonth()]++; });
  tallyMaxM = Math.max(1, ...monthlyTotals);
  monthlyLive.fill(0);

  VEHICLE_FIELDS.forEach(f    => { tallyVehicle[f.key]   = 0; });
  LANE_CATEGORIES.forEach(g   => { tallyLane[g.key]      = 0; });
  SEVERITY_FIELDS.forEach(f   => { tallySeverity[f.key]  = 0; });
  tallyHour.fill(0);
  ROAD_TYPE_FIELDS.forEach(f  => { tallyRoadType[f.key]  = 0; });
  WARD_LIST.forEach(w         => { tallyWard[w]          = 0; });

  const panel = document.getElementById('tally-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = buildTallyHTML();

  document.querySelectorAll('#tally-panel .bar-row[data-section]').forEach(row => {
    row.addEventListener('click', () => applyFilter(row.dataset.section, row.dataset.key));
  });
  LANE_CATEGORIES.forEach((c, i) => {
    const arc = document.getElementById(`lane-arc-${i}`);
    if (arc) arc.addEventListener('click', () => applyFilter('L', c.key));
  });
  document.querySelectorAll('#lane-legend .hin-lrow[data-key]').forEach(row => {
    row.addEventListener('click', () => applyFilter('L', row.dataset.key));
  });
  MONTH_LABELS.forEach((_, i) => {
    const hitRect = panel.querySelector(`[data-section="M"][data-key="${i}"]`);
    if (hitRect) hitRect.addEventListener('click', () => applyFilter('M', String(i)));
  });
  document.querySelectorAll('#ward-minimap path').forEach(el => {
    el.addEventListener('click', () => zoomToWard(el.dataset.wardName, +el.dataset.wardId));
  });

}

// ─── Tally: update ────────────────────────────────────────────────────────────
function updateTally(crash) {
  const p = crash.properties;

  crashCount++;
  if (crashNumEl) crashNumEl.textContent = crashCount;

  VEHICLE_FIELDS.forEach(f => {
    if (f.key === 'SOLO_CRASH') { if (p.SOLO_CRASH) tallyVehicle[f.key]++; }
    else if (f.sources)         { if (f.sources.some(s => (p[s] ?? 0) > 0)) tallyVehicle[f.key]++; }
    else                        { if ((p[f.key] ?? 0) > 0) tallyVehicle[f.key]++; }
  });

  const rawLane   = p.LANE_TYPE ?? 'No Bike Lane';
  const laneGroup = LANE_CATEGORIES.find(g => g.sources.includes(rawLane))?.key ?? 'No Bike Lane';
  if (laneGroup in tallyLane) tallyLane[laneGroup]++;

  const sev = p.SEVERITY;
  if (sev && sev in tallySeverity) tallySeverity[sev]++;

  tallyHour[p.localHour]++;

  const rt = p.ROAD_TYPE ?? null;
  tallyRoadType[(rt === 'Road' || rt === 'Intersection') ? rt : 'Other']++;

  monthlyLive[p.date.getMonth()]++;

  const ward = p.WARD;
  if (ward && ward in tallyWard) { tallyWard[ward]++; refreshWardMap(); }

  refreshBars();
  refreshMonthlyBars();
}

// ─── Tally: refresh ───────────────────────────────────────────────────────────
function refreshBars() {
  VEHICLE_FIELDS.forEach(({ key }) => {
    document.getElementById(toBarId('bfV', key)).style.width =
      `${(tallyVehicle[key] / tallyMaxV) * 100}%`;
    document.getElementById(toBarId('bcV', key)).textContent = tallyVehicle[key];
  });

  refreshLane();

  SEVERITY_FIELDS.forEach(({ key }) => {
    document.getElementById(toBarId('bfS', key)).style.width =
      `${(tallySeverity[key] / tallyMaxSev) * 100}%`;
    document.getElementById(toBarId('bcS', key)).textContent = tallySeverity[key];
  });

  for (let h = 0; h < 24; h++) {
    const bar = document.getElementById(`hbar-${h}`);
    if (!bar) continue;
    const px = Math.round((tallyHour[h] / tallyMaxH) * H_BAR_MAX);
    bar.setAttribute('y', H_BAR_BOT - px);
    bar.setAttribute('height', px);
  }

  ROAD_TYPE_FIELDS.forEach(({ key }) => {
    const fill = document.getElementById(toBarId('bfRT', key));
    const cnt  = document.getElementById(toBarId('bcRT', key));
    if (fill) fill.style.width = `${(tallyRoadType[key] / tallyMaxRT) * 100}%`;
    if (cnt)  cnt.textContent  = tallyRoadType[key];
  });
}

function refreshLane() {
  const vals  = LANE_CATEGORIES.map(c => tallyLane[c.key] ?? 0);
  const total = vals.reduce((s, v) => s + v, 0);
  if (total === 0) return;
  _lanePie(vals).forEach((arc, i) => {
    const el = document.getElementById(`lane-arc-${i}`);
    if (el) el.setAttribute('d', _laneArc(arc));
  });
}

function refreshMonthlyBars() {
  for (let i = 0; i < 12; i++) {
    const bar = document.getElementById(`mbar-${i}`);
    if (!bar) continue;
    const h = Math.round((monthlyLive[i] / tallyMaxM) * M_BAR_MAX);
    bar.setAttribute('y', M_BAR_BOT - h);
    bar.setAttribute('height', h);
  }
}

// ─── Tally: reset ─────────────────────────────────────────────────────────────
function resetTally() {
  crashCount = 0;
  if (crashNumEl) crashNumEl.textContent = '';

  VEHICLE_FIELDS.forEach(f    => { tallyVehicle[f.key]  = 0; });
  LANE_CATEGORIES.forEach(g   => { tallyLane[g.key]     = 0; });
  SEVERITY_FIELDS.forEach(f   => { tallySeverity[f.key] = 0; });
  tallyHour.fill(0);
  ROAD_TYPE_FIELDS.forEach(f  => { tallyRoadType[f.key]  = 0; });
  WARD_LIST.forEach(w         => { tallyWard[w]          = 0; });
  monthlyLive.fill(0);
  refreshBars();
  refreshMonthlyBars();
  refreshWardMap();
  LANE_CATEGORIES.forEach((_, i) => {
    const el = document.getElementById(`lane-arc-${i}`);
    if (el) el.setAttribute('d', '');
  });
}

