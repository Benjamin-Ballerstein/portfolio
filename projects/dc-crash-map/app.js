// ─── Map ──────────────────────────────────────────────────────────────────────
const isMobile = window.innerWidth <= 768;
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#111111' } }]
  },
  bounds: DC_BOUNDS,
  fitBoundsOptions: {
    padding: isMobile
      ? { top: 30, bottom: 50, left: 20, right: 20 }
      : { top: 40, bottom: 100, left: 200, right: 40 }
  },
  bearing: 0,
  pitch: 0,
  attributionControl: true
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
map.on('load', async () => {

  const centerlinesTopo = await d3.json('data/centerlinesFinalTopo.json');
  const centerlinesData = topojson.feature(centerlinesTopo, centerlinesTopo.objects['1152am']); // Time of export.

  map.addSource('centerlines', {
    type: 'geojson',
    data: centerlinesData,
    promoteId: 'OBJECTID'
  });

  const colorExpr = [
    'interpolate', ['linear'],
    ['coalesce', ['feature-state', 'hits'], 0],
    ...DENSITY_STOPS.flat()
  ];

  map.addLayer({
    id: 'centerlines-layer',
    type: 'line',
    source: 'centerlines',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': colorExpr,
      'line-color-transition':   { duration: 2000, delay: 0 },
      'line-opacity': 1,
      'line-width': [
        'interpolate', ['linear'],
        ['coalesce', ['feature-state', 'hits'], 0],
        0, 0.5, 1, 1.5, 3, 2, 6, 2.5
      ],
      'line-width-transition':   { duration: 2000, delay: 0 }
    }
  });

  buildSpatialIndex(centerlinesData.features);
  buildRoadIndex(centerlinesData.features);

  map.addLayer({
    id: 'centerlines-labels',
    type: 'symbol',
    source: 'centerlines',
    minzoom: 14,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'ROUTENAME'],
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': 9,
      'text-rotation-alignment': 'map',
      'symbol-spacing': 300,
      'text-padding': 5,
      'visibility': 'visible'
    },
    paint: {
      'text-color': 'rgba(255, 255, 255, 0.45)',
      'text-halo-color': 'rgba(0, 0, 0, 0.6)',
      'text-halo-width': 1
    }
  });

  await loadCrashes();
  await initWards();
  await initBikeLanes();
  initAnimation();
  initCrashPins();
  initRouteSearch();
  startCanvasLoop();
});
