// ─── Phase 4: Spatial index ───────────────────────────────────────────────────
function buildSpatialIndex(features) {
  features.forEach((feat, idx) => {
    const geom = feat.geometry;
    if (!geom) return;
    const lines = geom.type === 'MultiLineString' ? geom.coordinates : [geom.coordinates];
    const allCoords = lines.flat();
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    allCoords.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    const midLon = (minLon + maxLon) / 2;
    const midLat = (minLat + maxLat) / 2;
    segmentMids[idx] = { lon: midLon, lat: midLat, fid: feat.properties.OBJECTID, coords: allCoords };

    const cellX = Math.floor(midLon / GRID_RES);
    const cellY = Math.floor(midLat / GRID_RES);
    const key   = `${cellX},${cellY}`;
    if (!gridIndex.has(key)) gridIndex.set(key, []);
    gridIndex.get(key).push(idx);
  });
}

// ─── Phase 4b: Road index (corridor fill) ────────────────────────────────────
function buildRoadIndex(features) {
  features.forEach(feat => {
    const { OBJECTID, ROUTEID, FROMMEASURE, TOMEASURE, ROUTENAME } = feat.properties;
    if (OBJECTID != null) {
      fidProps.set(OBJECTID, {
        rid:    ROUTEID,
        from_m: FROMMEASURE ?? 0,
        to_m:   TOMEASURE   ?? 0
      });
    }
    if (!ROUTEID) return;
    if (ROUTENAME) {
      ridToName.set(ROUTEID, ROUTENAME);
      routeNameSet.add(ROUTENAME);
    }
    if (!roadIndex.has(ROUTEID)) roadIndex.set(ROUTEID, []);
    roadIndex.get(ROUTEID).push({ fid: OBJECTID, from_m: FROMMEASURE ?? 0, to_m: TOMEASURE ?? 0 });
  });
  roadIndex.forEach(segs => segs.sort((a, b) => a.from_m - b.from_m));
}

function fillRoadCorridor(fid) {
  const props = fidProps.get(fid);
  if (!props?.rid) return;
  const { rid, from_m, to_m } = props;

  const midM = (from_m + to_m) / 2;
  const lo   = midM - MAX_CORRIDOR_M / 2;
  const hi   = midM + MAX_CORRIDOR_M / 2;

  const segs = roadIndex.get(rid) ?? [];
  segs.forEach(seg => {
    const segMid = (seg.from_m + seg.to_m) / 2;
    if (segMid >= lo && segMid <= hi) revealSegment(seg.fid);
  });
}

// Minimum distance from point (px,py) to line segment (ax,ay)→(bx,by)
function ptSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function findNearbySegments(lon, lat) {
  const x0  = Math.floor((lon - SEARCH_RADIUS) / GRID_RES);
  const x1  = Math.floor((lon + SEARCH_RADIUS) / GRID_RES);
  const y0  = Math.floor((lat - SEARCH_RADIUS) / GRID_RES);
  const y1  = Math.floor((lat + SEARCH_RADIUS) / GRID_RES);
  const seen = new Set();
  const results = [];

  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const segs = gridIndex.get(`${cx},${cy}`);
      if (!segs) continue;
      segs.forEach(idx => {
        if (seen.has(idx)) return;
        seen.add(idx);
        const seg = segmentMids[idx];
        // Quick bounding-box pre-filter using stored midpoint
        if (Math.hypot(seg.lon - lon, seg.lat - lat) > SEARCH_RADIUS * 2) return;
        // True point-to-polyline distance
        let dist = Infinity;
        for (let i = 0; i < seg.coords.length - 1; i++) {
          const [ax, ay] = seg.coords[i];
          const [bx, by] = seg.coords[i + 1];
          dist = Math.min(dist, ptSegDist(lon, lat, ax, ay, bx, by));
        }
        if (dist <= SEARCH_RADIUS) results.push({ fid: seg.fid, dist });
      });
    }
  }

  return results.sort((a, b) => a.dist - b.dist);
}
