/**
 * Utilidades geométricas y cartográficas para levantamientos planimétricos y catastro.
 */

// Helper: Función para calcular rumbo sexagesimal estándar catastral
export function calcularRumboTopografico(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return "N 00° 00' 00\" E";
  const ns = dy >= 0 ? 'N' : 'S';
  const ew = dx >= 0 ? 'E' : 'W';
  const anguloRad = Math.atan2(Math.abs(dx), Math.abs(dy));
  const anguloDeg = (anguloRad * 180) / Math.PI;
  let d = Math.floor(anguloDeg);
  let m = Math.floor((anguloDeg - d) * 60);
  let s = Math.round((anguloDeg - d - m / 60) * 3600);
  if (s === 60) { s = 0; m += 1; }
  if (m === 60) { m = 0; d += 1; }
  const dStr = String(d).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  return `${ns} ${dStr}° ${mStr}' ${sStr}" ${ew}`;
}

/**
 * Normaliza y reordena los vértices y linderos de un predio:
 * 1. El Punto 1 (P01 o V01) se asigna obligatoriamente al vértice que esté más a la izquierda (menor coordenada X).
 * 2. La numeración y secuencia de linderos continúa estrictamente en SENTIDO HORARIO (Clockwise).
 * 
 * @param {Array} rawVertices Lista de vértices del predio
 * @param {Array} rawLinderos Lista de linderos / tramos del predio
 * @returns {{ vertices: Array, linderos: Array }} Vértices y linderos reordenados y recodificados
 */
export function normalizeVerticesAndLinderos(rawVertices = [], rawLinderos = []) {
  if (!rawVertices || rawVertices.length < 3) {
    return { vertices: rawVertices || [], linderos: rawLinderos || [] };
  }

  // Ordenar naturalmente por código numérico para garantizar secuencia topológica
  const sortedRawVertices = [...rawVertices].sort((a, b) => {
    const numA = parseInt(String(a.codigo || '').replace(/\D/g, '')) || 0;
    const numB = parseInt(String(b.codigo || '').replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const sortedRawLinderos = [...rawLinderos].sort((a, b) => {
    const numA = parseInt(String(a.tramo || '').replace(/^[^\d]*(\d+).*$/, '$1')) || (a.id || 0);
    const numB = parseInt(String(b.tramo || '').replace(/^[^\d]*(\d+).*$/, '$1')) || (b.id || 0);
    return numA - numB;
  });

  const n = sortedRawVertices.length;

  // Extraer coordenadas de cada vértice para análisis planar
  const coords = sortedRawVertices.map(v => {
    let x = v.coord_x;
    let y = v.coord_y;
    if ((x === undefined || y === undefined || x === null || y === null) && v.geom_wkt) {
      const pt = parseWktPointCoords(v.geom_wkt);
      if (pt) {
        x = pt.lng; // Nota: en WKT 'POINT(X Y)', primer valor es X / Lng
        y = pt.lat; // segundo valor es Y / Lat
      }
    }
    return { x: Number(x) || 0, y: Number(y) || 0 };
  });

  // 1. Determinar orientación mediante la fórmula de Shoelace (Área con signo)
  // En coordenadas cartesianas normales (X este, Y norte):
  // Si signedArea < 0: Sentido Horario (Clockwise - CW)
  // Si signedArea > 0: Sentido Antihorario (Counter-Clockwise - CCW)
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % n];
    signedArea += (p1.x * p2.y - p2.x * p1.y);
  }
  signedArea *= 0.5;
  const isClockwise = signedArea < 0;

  // 2. Bounding box para normalización y búsqueda del vértice Nor-Oeste (NW)
  // Convención topográfica/catastral: El punto P01 es el que esté más al norte de izquierda a derecha (NW).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = coords[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  // Encontrar el vértice más al Noroeste (más al norte de izquierda a derecha: maximiza normY - normX)
  let nwIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = coords[i];
    const normX = (x - minX) / spanX;
    const normY = (y - minY) / spanY;
    const score = normY - normX;
    if (score > bestScore + 1e-4) {
      bestScore = score;
      nwIdx = i;
    } else if (Math.abs(score - bestScore) <= 1e-4) {
      const best = coords[nwIdx];
      if (y > best.y || (Math.abs(y - best.y) <= 1e-4 && x < best.x)) {
        nwIdx = i;
      }
    }
  }

  // 3. Reordenar vértices y linderos iniciando en el vértice Nor-Oeste (P01) y en sentido horario
  const orderedVerts = [];
  const orderedLins = [];

  if (isClockwise) {
    for (let i = 0; i < n; i++) {
      const idx = (nwIdx + i) % n;
      orderedVerts.push({ ...sortedRawVertices[idx] });
      const lin = sortedRawLinderos[idx] || {};
      orderedLins.push({ ...lin });
    }
  } else {
    // Si era antihorario, invertimos el recorrido para asegurar sentido horario
    for (let i = 0; i < n; i++) {
      const idx = (nwIdx - i + n) % n;
      orderedVerts.push({ ...sortedRawVertices[idx] });
      const linIdx = (idx - 1 + n) % n;
      const lin = sortedRawLinderos[linIdx] || {};
      orderedLins.push({ ...lin });
    }
  }

  // 4. Prefijo unificado 'P' (P01, P02, ...) y recodificar secuencialmente desde 01
  const prefix = 'P';

  for (let i = 0; i < orderedVerts.length; i++) {
    const newCode = `${prefix}${String(i + 1).padStart(2, '0')}`;
    orderedVerts[i].codigo = newCode;
  }

  // 5. Ajustar los tramos correspondientes en los linderos y garantizar cálculo de rumbo/distancia
  for (let i = 0; i < orderedVerts.length; i++) {
    const currentCode = orderedVerts[i]?.codigo || `${prefix}${String(i + 1).padStart(2, '0')}`;
    const nextCode = (i < orderedVerts.length - 1)
      ? (orderedVerts[i + 1]?.codigo || `${prefix}${String(i + 2).padStart(2, '0')}`)
      : (orderedVerts[0]?.codigo || `${prefix}01`);
    
    if (!orderedLins[i]) {
      orderedLins[i] = {};
    }
    orderedLins[i].tramo = `${currentCode} - ${nextCode}`;

    // Si falta longitud o rumbo, calcular geométricamente
    const v1 = orderedVerts[i];
    const v2 = orderedVerts[(i + 1) % orderedVerts.length];
    const x1 = Number(v1?.coord_x) || 0;
    const y1 = Number(v1?.coord_y) || 0;
    const x2 = Number(v2?.coord_x) || 0;
    const y2 = Number(v2?.coord_y) || 0;

    if ((!orderedLins[i].longitud || Number(orderedLins[i].longitud) === 0) && (x1 !== 0 || y1 !== 0) && (x2 !== 0 || y2 !== 0)) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      orderedLins[i].longitud = Math.sqrt(dx * dx + dy * dy);
    }
    if ((!orderedLins[i].rumbo || orderedLins[i].rumbo === '-') && (x1 !== 0 || y1 !== 0) && (x2 !== 0 || y2 !== 0)) {
      orderedLins[i].rumbo = calcularRumboTopografico(x1, y1, x2, y2);
    }
  }

  return { vertices: orderedVerts, linderos: orderedLins };
}

/**
 * Parsea un WKT POLYGON o MULTIPOLYGON de forma tolerante y segura.
 * Devuelve un array de pares [lat, lng] válidos para Leaflet.
 * Garantiza que NINGÚN elemento sea NaN o null.
 */
export function parseWktPolygonCoords(wkt) {
  if (!wkt || typeof wkt !== 'string') return [];
  try {
    const trimmed = wkt.trim();
    if (!trimmed.toUpperCase().includes('POLYGON')) return [];

    // Remover prefijos tipo 'MULTIPOLYGON (((', 'POLYGON ((', etc.
    // Quita cualquier letra inicial y paréntesis de apertura consecutivos
    let cleaned = trimmed.replace(/^[A-Za-z\s_]+\(+/, '');

    // Si tiene múltiples anillos o polígonos, tomamos el anillo exterior principal
    if (cleaned.includes(')')) {
      cleaned = cleaned.split(')')[0];
    }
    cleaned = cleaned.replace(/[()]/g, '').trim();

    const coords = [];
    const pairs = cleaned.split(',');
    for (let i = 0; i < pairs.length; i++) {
      const parts = pairs[i].trim().split(/\s+/);
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          coords.push([lat, lng]);
        }
      }
    }
    return coords;
  } catch (err) {
    console.error('Error parseando WKT polygon:', err, wkt);
    return [];
  }
}

/**
 * Parsea un WKT POINT ('POINT(lng lat)' o 'POINT (lng lat)')
 * Devuelve { lat, lng } garantizando números válidos, o null si falla.
 */
export function parseWktPointCoords(wkt) {
  if (!wkt || typeof wkt !== 'string') return null;
  try {
    const cleaned = wkt.trim().replace(/^[A-Za-z\s_]+\(+/, '').replace(/\)+$/, '').trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
        return { lat, lng };
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Parsea un WKT LINESTRING ('LINESTRING(lng1 lat1, lng2 lat2, ...)')
 * Devuelve un array de [lat, lng] válidos para Polyline de Leaflet.
 */
export function parseWktLineCoords(wkt) {
  if (!wkt || typeof wkt !== 'string') return [];
  try {
    const cleaned = wkt.trim().replace(/^[A-Za-z\s_]+\(+/, '').replace(/\)+$/, '').trim();
    const coords = [];
    const pairs = cleaned.split(',');
    for (let i = 0; i < pairs.length; i++) {
      const parts = pairs[i].trim().split(/\s+/);
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          coords.push([lat, lng]);
        }
      }
    }
    return coords;
  } catch (err) {
    return [];
  }
}

export const cadGeoJsonMemoryCache = new Map();

/**
 * Consulta de forma ultra-optimizada el GeoJSON de una carta CAD para un punto central (lat, lng),
 * discretizando a un bounding box de ~4km para maximizar aciertos de caché entre predios cercanos.
 */
export async function fetchCadGeoJsonForCenter(apiUrl, token, archivo, centerPoint) {
  if (!archivo || !centerPoint || !centerPoint[0] || !centerPoint[1] || isNaN(centerPoint[0]) || isNaN(centerPoint[1])) {
    return null;
  }
  const step = 0.02;
  const snapLng = (Math.round(centerPoint[1] / step) * step).toFixed(4);
  const snapLat = (Math.round(centerPoint[0] / step) * step).toFixed(4);
  const pad = 0.04;
  const minLng = (parseFloat(snapLng) - pad).toFixed(4);
  const minLat = (parseFloat(snapLat) - pad).toFixed(4);
  const maxLng = (parseFloat(snapLng) + pad).toFixed(4);
  const maxLat = (parseFloat(snapLat) + pad).toFixed(4);
  const bboxQuery = `&bbox=${minLng},${minLat},${maxLng},${maxLat}`;
  const cacheKey = `${archivo}_${bboxQuery}`;

  if (cadGeoJsonMemoryCache.has(cacheKey)) {
    return cadGeoJsonMemoryCache.get(cacheKey);
  }

  try {
    const res = await fetch(`${apiUrl}/api/gis/cad-layers/geojson?archivo=${encodeURIComponent(archivo)}&simplify=2.0${bboxQuery}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const json = await res.json();
      cadGeoJsonMemoryCache.set(cacheKey, json);
      return json;
    }
  } catch (e) {
    console.error('Error al cargar GeoJSON CAD para centro:', e);
  }
  return null;
}


