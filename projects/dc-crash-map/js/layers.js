// ─── Ward choropleth layer ────────────────────────────────────────────────────
async function initWards() {
  wardsData = await d3.json('data/wards.geojson');

  map.addSource('carto-dark', {
    type: 'raster',
    tiles: [
      'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
      'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
      'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
    ],
    tileSize: 512,
    attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  map.addLayer({ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', layout: { visibility: 'none' } });

  map.addSource('carto-labels', {
    type: 'raster',
    tiles: [
      'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
      'https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
      'https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
    ],
    tileSize: 512,
  });
  map.addLayer({ id: 'carto-labels-layer', type: 'raster', source: 'carto-labels', minzoom: 13, layout: { visibility: 'none' } });

  map.addSource('wards', { type: 'geojson', data: wardsData });

  map.addLayer({
    id: 'wards-line',
    type: 'line',
    source: 'wards',
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.18, 'line-width': 1 }
  }, 'centerlines-layer');

  map.addLayer({
    id: 'wards-fill',
    type: 'fill',
    source: 'wards',
    paint: { 'fill-color': '#000000', 'fill-opacity': 0 }
  }, 'centerlines-layer');


}

function zoomToWard(wardName, wardId) {
  if (activeWard && activeWard.id === wardId) {
    activeWard = null;
    map.fitBounds(DC_BOUNDS, { padding: 24, duration: 600 });
    return;
  }
  activeWard = { name: wardName, id: wardId };
  if (wardBounds[wardName]) {
    map.fitBounds(wardBounds[wardName], { padding: 40, duration: 600, maxZoom: 14 });
  }
}

// ─── Bike lanes layer ─────────────────────────────────────────────────────────
async function initBikeLanes() {
  const lanesData = await d3.json('BicycleLanes.geojson');
  map.addSource('bike-lanes', { type: 'geojson', data: lanesData });
  map.addLayer({
    id: 'bike-lanes-layer',
    type: 'line',
    source: 'bike-lanes',
    layout: { visibility: 'none' },
    paint: { 'line-color': 'rgba(52, 211, 153, 0.85)', 'line-width': 3 }
  });
}

function toggleStreetmap() {
  streetmapVisible = !streetmapVisible;
  const vis = streetmapVisible ? 'visible' : 'none';

  map.setLayoutProperty('carto-dark-layer', 'visibility', vis);
  map.setLayoutProperty('carto-labels-layer', 'visibility', vis);
  map.setLayoutProperty('bike-lanes-layer', 'visibility', vis);
  map.setLayoutProperty('centerlines-layer', 'visibility', streetmapVisible ? 'none' : 'visible');
  map.setLayoutProperty('centerlines-labels', 'visibility', streetmapVisible ? 'none' : 'visible');

  document.getElementById('bikelane-legend').classList.toggle('hidden', !streetmapVisible);
}

// ─── Bike lane overlay mode ───────────────────────────────────────────────────
function toggleGapMode() {
  gapModeActive = !gapModeActive;

  const baseColor = [
    'interpolate', ['linear'],
    ['coalesce', ['feature-state', 'hits'], 0],
    ...DENSITY_STOPS.flat()
  ];
  const baseWidth = [
    'interpolate', ['linear'],
    ['coalesce', ['feature-state', 'hits'], 0],
    0, 0.5, 1, 2, 3, 3, 6, 4.0
  ];

  if (gapModeActive) {
    map.setPaintProperty('centerlines-layer', 'line-color',
      ['case', ['>', ['get', 'BIKE'], 0], 'rgba(52,211,153,0.9)', baseColor]
    );
    map.setPaintProperty('centerlines-layer', 'line-opacity',
      ['case', ['>', ['get', 'BIKE'], 0], 0.7, 1]
    );
    map.setPaintProperty('centerlines-layer', 'line-width',
      ['case', ['>', ['get', 'BIKE'], 0], 2.0, baseWidth]
    );
  } else {
    map.setPaintProperty('centerlines-layer', 'line-color',   baseColor);
    map.setPaintProperty('centerlines-layer', 'line-opacity', 1);
    map.setPaintProperty('centerlines-layer', 'line-width',   baseWidth);
  }

  document.getElementById('gap-check').checked = gapModeActive;
}

// ─── Route search ─────────────────────────────────────────────────────────────
function initRouteSearch() {
  const input = document.getElementById('route-input');
  const list  = document.getElementById('route-suggestions');

  function applyRouteFilter(name) {
    const upper = name.toUpperCase();
    const matching = crashes
      .filter(c => c.nearestRouteName && c.nearestRouteName.toUpperCase().includes(upper))
      .map(c => c.properties.CRIMEID);

    if (!pinsVisible) {
      pinsVisible = true;
      map.setLayoutProperty('crash-circles', 'visibility', 'visible');
      document.getElementById('pins-check').checked = true;
      document.getElementById('pins-legend').classList.add('visible');
    }
    map.setFilter('crash-circles',
      matching.length
        ? ['in', ['get', 'CRIMEID'], ['literal', matching]]
        : ['==', ['get', 'CRIMEID'], '']
    );
  }

  function clearRouteFilter() {
    map.setFilter('crash-circles', null);
    list.style.display = 'none';
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { clearRouteFilter(); return; }

    const upper = q.toUpperCase();
    const matches = [...routeNameSet].filter(n => n.includes(upper)).slice(0, 12);
    list.innerHTML = matches.map(n => `<li>${n}</li>`).join('');
    list.style.display = matches.length ? 'block' : 'none';
    list.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        input.value = li.textContent;
        list.style.display = 'none';
        applyRouteFilter(li.textContent);
      });
    });

    applyRouteFilter(q);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; clearRouteFilter(); }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#route-search')) list.style.display = 'none';
  });
}

// ─── Crash pins layer ─────────────────────────────────────────────────────────
function buildPopupHTML(props) {
  const vehicles = [];
  if ((props.PASSENGER_VEHICLE ?? 0) > 0) vehicles.push('Passenger Vehicle');
  if ((props.SUV_PICKUP_VAN ?? 0) > 0)    vehicles.push('SUV / Pickup');
  if ((props.MOTORCYCLE_MOPED ?? 0) > 0)  vehicles.push('Motorcycle');
  if ((props.HEAVY_TRUCK ?? 0) > 0)       vehicles.push('Heavy Truck');
  if ((props.BUS ?? 0) > 0)               vehicles.push('Bus');
  if ((props.OTHER_VEHICLE ?? 0) > 0)     vehicles.push('Other Vehicle');
  if (props.SOLO_CRASH || vehicles.length === 0) vehicles.push('No Vehicle Recorded');

  const reportDt = new Date(props.REPORTDATE);
  const dateStr  = reportDt.toLocaleDateString('en-US',
    { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const timeStr  = reportDt.toLocaleTimeString('en-US',
    { hour: 'numeric', minute: '2-digit', timeZone: 'UTC', hour12: true });

  let ageStr;
  if (props.CYCLIST_COUNT > 1 && props.CYCLIST_AGE_OLDEST !== props.CYCLIST_AGE_YOUNGEST) {
    ageStr = `${props.CYCLIST_AGE_YOUNGEST}–${props.CYCLIST_AGE_OLDEST} (${props.CYCLIST_COUNT} cyclists)`;
  } else if (props.CYCLIST_AGE_YOUNGEST != null) {
    ageStr = `${props.CYCLIST_AGE_YOUNGEST}`;
  } else {
    ageStr = '—';
  }

  const flags = [];
  if (props.SPEEDING_INVOLVED)  flags.push('Speeding');
  if (props.BICYCLISTSIMPAIRED) flags.push('Cyclist Impaired');
  if (props.DRIVERSIMPAIRED)    flags.push('Driver Impaired');

  const sevClass = `sev-${(props.SEVERITY ?? '').replace(/\s+/g, '-').toLowerCase()}`;
  return `
    <div class="crash-popup">
      <div class="popup-date">${dateStr}</div>
      <div class="popup-row"><span>Severity</span><span class="popup-val ${sevClass}">${props.SEVERITY ?? '—'}</span></div>
      <div class="popup-row"><span>Cyclist Age</span><span>${ageStr}</span></div>
      <div class="popup-row"><span>Vehicle</span><span>${vehicles.join(', ')}</span></div>
      <div class="popup-row"><span>Report Time</span><span>${timeStr}</span></div>
      <div class="popup-row"><span>Road Type</span><span>${props.ROAD_TYPE ?? '—'}</span></div>
      ${flags.length ? `<div class="popup-flags">${flags.join(' · ')}</div>` : ''}
    </div>`;
}

function initCrashPins() {
  map.addSource('crash-pins', { type: 'geojson', data: crashGeoJSON, promoteId: 'CRIMEID' });

  map.addLayer({
    id: 'crash-circles',
    type: 'circle',
    source: 'crash-pins',
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        11, ['case', ['boolean', ['feature-state', 'hover'], false], 7,  3],
        16, ['case', ['boolean', ['feature-state', 'hover'], false], 12, 6]
      ],
      'circle-color': '#ffffff',
      'circle-opacity': 0,
      'circle-opacity-transition': { duration: 2000, delay: 0 },
      'circle-stroke-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0],
      'circle-stroke-color': 'rgba(232, 178, 0, 0.8)',
    }
  });

  document.getElementById('pins-check').addEventListener('change', e => {
    if (!map.getLayer('crash-circles')) return;
    pinsVisible = e.target.checked;
    map.setLayoutProperty('crash-circles', 'visibility', pinsVisible ? 'visible' : 'none');
    map.setPaintProperty('crash-circles', 'circle-opacity', pinsVisible ? 0.7 : 0);
    document.getElementById('pins-legend').classList.toggle('visible', pinsVisible);
  });

  map.on('click', 'crash-circles', e => {
    e.preventDefault();
    const features = e.features;
    if (!features.length) return;
    const total = features.length;
    let idx = 0;

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
      .setLngLat(features[0].geometry.coordinates.slice())
      .addTo(map);

    function renderPopup() {
      const nav = total > 1
        ? `<div class="popup-nav"><button data-nav="-1">&#8249;</button><span>${idx + 1} / ${total}</span><button data-nav="1">&#8250;</button></div>`
        : '';
      popup.setHTML(nav + buildPopupHTML(features[idx].properties));
      if (total > 1) {
        popup.getElement().querySelectorAll('[data-nav]').forEach(btn => {
          btn.addEventListener('click', ev => {
            ev.stopPropagation();
            idx = (idx + parseInt(btn.dataset.nav) + total) % total;
            renderPopup();
          });
        });
      }
    }

    renderPopup();
  });

  let hoveredCrashId = null;
  map.on('mouseenter', 'crash-circles', e => {
    map.getCanvas().style.cursor = 'pointer';
    if (e.features.length > 0) {
      if (hoveredCrashId !== null) {
        map.setFeatureState({ source: 'crash-pins', id: hoveredCrashId }, { hover: false });
      }
      hoveredCrashId = e.features[0].id;
      map.setFeatureState({ source: 'crash-pins', id: hoveredCrashId }, { hover: true });
    }
  });
  map.on('mouseleave', 'crash-circles', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredCrashId !== null) {
      map.setFeatureState({ source: 'crash-pins', id: hoveredCrashId }, { hover: false });
      hoveredCrashId = null;
    }
  });

}
