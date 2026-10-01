const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/utils/geoUtils.js');

const code = `import proj4 from 'proj4';

const WGS84 = 'EPSG:4326';
const UTM17S = '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs';

export function wgs84ToUtm(lng, lat) {
  try {
    const [x, y] = proj4(WGS84, UTM17S, [lng, lat]);
    return {
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000
    };
  } catch (e) {
    console.error('Error en wgs84ToUtm:', e);
    return { x: 0, y: 0 };
  }
}

export function utmToWgs84(x, y) {
  try {
    const [lng, lat] = proj4(UTM17S, WGS84, [x, y]);
    return { lat, lng };
  } catch (e) {
    console.error('Error en utmToWgs84:', e);
    return { lat: 0, lng: 0 };
  }
}

export function computePolygonArea(vertices) {
  if (!vertices || vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = vertices[i].x ?? (Array.isArray(vertices[i]) ? vertices[i][0] : 0);
    const yi = vertices[i].y ?? (Array.isArray(vertices[i]) ? vertices[i][1] : 0);
    const xj = vertices[j].x ?? (Array.isArray(vertices[j]) ? vertices[j][0] : 0);
    const yj = vertices[j].y ?? (Array.isArray(vertices[j]) ? vertices[j][1] : 0);
    area += (xi * yj);
    area -= (xj * yi);
  }
  return Math.abs(area) / 2;
}

export function computePerimeter(vertices) {
  if (!vertices || vertices.length < 2) return 0;
  let perim = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = vertices[i].x ?? (Array.isArray(vertices[i]) ? vertices[i][0] : 0);
    const yi = vertices[i].y ?? (Array.isArray(vertices[i]) ? vertices[i][1] : 0);
    const xj = vertices[j].x ?? (Array.isArray(vertices[j]) ? vertices[j][0] : 0);
    const yj = vertices[j].y ?? (Array.isArray(vertices[j]) ? vertices[j][1] : 0);
    perim += Math.hypot(xj - xi, yj - yi);
  }
  return perim;
}

export function generateRectangleAtGPS(lat, lng, widthMeters = 15, heightMeters = 20) {
  const center = wgs84ToUtm(lng, lat);
  const halfW = widthMeters / 2;
  const halfH = heightMeters / 2;

  const v1 = { x: Math.round((center.x - halfW) * 100) / 100, y: Math.round((center.y + halfH) * 100) / 100, orden: 1 };
  const v2 = { x: Math.round((center.x + halfW) * 100) / 100, y: Math.round((center.y + halfH) * 100) / 100, orden: 2 };
  const v3 = { x: Math.round((center.x + halfW) * 100) / 100, y: Math.round((center.y - halfH) * 100) / 100, orden: 3 };
  const v4 = { x: Math.round((center.x - halfW) * 100) / 100, y: Math.round((center.y - halfH) * 100) / 100, orden: 4 };

  const vertices = [v1, v2, v3, v4];
  const area = computePolygonArea(vertices);
  const perimetro = computePerimeter(vertices);

  return {
    vertices,
    area: Math.round(area * 100) / 100,
    perimetro: Math.round(perimetro * 100) / 100,
    centerUtm: center,
    centerWgs84: { lat, lng }
  };
}

export function getSegmentOrientation(p1, p2) {
  const x1 = p1.x ?? (Array.isArray(p1) ? p1[0] : 0);
  const y1 = p1.y ?? (Array.isArray(p1) ? p1[1] : 0);
  const x2 = p2.x ?? (Array.isArray(p2) ? p2[0] : 0);
  const y2 = p2.y ?? (Array.isArray(p2) ? p2[1] : 0);
  const dx = x2 - x1;
  const dy = y2 - y1;
  let angleDeg = Math.atan2(dx, dy) * (180 / Math.PI);
  if (angleDeg < 0) angleDeg += 360;
  if (angleDeg >= 315 || angleDeg < 45) return 'Norte';
  if (angleDeg >= 45 && angleDeg < 135) return 'Este';
  if (angleDeg >= 135 && angleDeg < 225) return 'Sur';
  return 'Oeste';
}

export function getSegmentDistance(p1, p2) {
  const x1 = p1.x ?? (Array.isArray(p1) ? p1[0] : 0);
  const y1 = p1.y ?? (Array.isArray(p1) ? p1[1] : 0);
  const x2 = p2.x ?? (Array.isArray(p2) ? p2[0] : 0);
  const y2 = p2.y ?? (Array.isArray(p2) ? p2[1] : 0);
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy).toFixed(1);
}

export function calculateLinderosAndTramos(vertices) {
  if (!vertices || vertices.length < 3) return [];
  const tramos = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    const p1 = vertices[i];
    const p2 = vertices[nextIdx];
    const c1 = p1.codigo || ('P' + String(i + 1).padStart(2, '0'));
    const c2 = p2.codigo || ('P' + String(nextIdx + 1).padStart(2, '0'));
    const dist = getSegmentDistance(p1, p2);
    const orient = getSegmentOrientation(p1, p2);
    tramos.push({
      index: i,
      desde: c1,
      hasta: c2,
      tramo: c1 + ' ➔ ' + c2,
      distancia: dist,
      orientacion: orient,
      colindante: p1.colindante || ''
    });
  }
  return tramos;
}

/**
 * Normaliza cualquier polígono para que:
 * 1. P01 sea estrictamente el vértice Nor-Oeste (NW) - "el que esté más al norte de izquierda a derecha".
 * 2. La secuencia de vértices (P01, P02, P03... Pn) recorra en SENTIDO HORARIO (Clockwise).
 */
export function normalizeVerticesClockwiseFromNW(vertices) {
  if (!vertices || vertices.length < 3) return vertices || [];

  const n = vertices.length;
  const pts = vertices.map((v, i) => {
    const x = v.x ?? (Array.isArray(v) ? v[0] : 0);
    const y = v.y ?? (Array.isArray(v) ? v[1] : 0);
    return { ...v, x: Number(x) || 0, y: Number(y) || 0 };
  });

  // 1. Cálculo de área con signo (Shoelace)
  // SignedArea < 0: Sentido Horario (CW). SignedArea > 0: Antihorario (CCW).
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    signedArea += (p1.x * p2.y - p2.x * p1.y);
  }
  signedArea *= 0.5;

  let ordered = [...pts];
  if (signedArea > 0) {
    ordered.reverse();
  }

  // 2. Bounding box planar
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = ordered[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  // 3. Selección del punto Nor-Oeste (NW): maximiza normY - normX
  let nwIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = ordered[i];
    const normX = (x - minX) / spanX;
    const normY = (y - minY) / spanY;
    const score = normY - normX;
    if (score > bestScore + 1e-4) {
      bestScore = score;
      nwIdx = i;
    } else if (Math.abs(score - bestScore) <= 1e-4) {
      const best = ordered[nwIdx];
      if (y > best.y || (Math.abs(y - best.y) <= 1e-4 && x < best.x)) {
        nwIdx = i;
      }
    }
  }

  // 4. Rotar para que P01 sea el vértice Nor-Oeste y enumerar P01, P02...
  const rotated = [];
  for (let i = 0; i < n; i++) {
    const idx = (nwIdx + i) % n;
    const item = { ...ordered[idx] };
    const pCode = 'P' + String(i + 1).padStart(2, '0');
    item.orden = i + 1;
    item.codigo = pCode;
    rotated.push(item);
  }

  return rotated;
}

export function extractVerticesFromPredio(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.vertices) && raw.vertices.length >= 3) {
    return normalizeVerticesClockwiseFromNW(raw.vertices);
  }

  const geom = raw.geometry || (raw.type === 'Feature' ? raw.geometry : (raw.type === 'Polygon' ? raw : null));
  if (geom && geom.coordinates) {
    let rawCoords = [];
    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
      rawCoords = geom.coordinates[0] || [];
    } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
      rawCoords = geom.coordinates[0]?.[0] || [];
    }

    if (rawCoords.length >= 3) {
      let clean = [...rawCoords];
      if (clean.length > 3) {
        const first = clean[0];
        const last = clean[clean.length - 1];
        if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
          clean = clean.slice(0, -1);
        }
      }

      const colindantesList = Array.isArray(raw.properties?.colindantes) 
        ? raw.properties.colindantes 
        : (Array.isArray(raw.colindantes) ? raw.colindantes : []);

      const utmVerts = clean.map(([lng, lat], idx) => {
        const utm = wgs84ToUtm(lng, lat);
        return {
          orden: idx + 1,
          x: Math.round(utm.x * 100) / 100,
          y: Math.round(utm.y * 100) / 100,
          lat,
          lng,
          colindante: colindantesList[idx] || ''
        };
      });
      return normalizeVerticesClockwiseFromNW(utmVerts);
    }
  }

  if (Array.isArray(raw.positions) && raw.positions.length >= 3) {
    let clean = [...raw.positions];
    if (clean.length > 3) {
      const first = clean[0];
      const last = clean[clean.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
        clean = clean.slice(0, -1);
      }
    }
    const utmVerts = clean.map(([lat, lng], idx) => {
      const utm = wgs84ToUtm(lng, lat);
      return {
        orden: idx + 1,
        x: Math.round(utm.x * 100) / 100,
        y: Math.round(utm.y * 100) / 100,
        lat,
        lng
      };
    });
    return normalizeVerticesClockwiseFromNW(utmVerts);
  }

  return [];
}
`;

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully wrote', targetPath);
