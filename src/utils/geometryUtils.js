/**
 * Utilidades geométricas y cartográficas para levantamientos planimétricos y catastro.
 */
import proj4 from 'proj4';

proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

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
  if (!centerPoint || !centerPoint[0] || !centerPoint[1] || isNaN(centerPoint[0]) || isNaN(centerPoint[1])) {
    return null;
  }
  const step = 0.02;
  const snapLng = (Math.round(centerPoint[1] / step) * step).toFixed(4);
  const snapLat = (Math.round(centerPoint[0] / step) * step).toFixed(4);
  const pad = 0.05; // ~5.5 km para asegurar cobertura completa de la lámina A4
  const minLng = (parseFloat(snapLng) - pad).toFixed(4);
  const minLat = (parseFloat(snapLat) - pad).toFixed(4);
  const maxLng = (parseFloat(snapLng) + pad).toFixed(4);
  const maxLat = (parseFloat(snapLat) + pad).toFixed(4);
  const archivoParam = archivo ? `archivo=${encodeURIComponent(archivo)}&` : '';
  const bboxQuery = `&bbox=${minLng},${minLat},${maxLng},${maxLat}`;
  const cacheKey = `${archivo || 'any'}_${bboxQuery}`;

  if (cadGeoJsonMemoryCache.has(cacheKey)) {
    return cadGeoJsonMemoryCache.get(cacheKey);
  }

  try {
    const headers = {};
    if (token && token !== 'null' && token !== 'undefined' && !token.startsWith('offline_')) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${apiUrl}/api/gis/cad-layers/geojson?${archivoParam}simplify=1.5${bboxQuery}`, {
      headers
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

/**
 * Construye en memoria la estructura completa { predio, vertices, linderos } a partir de cualquier
 * Feature GeoJSON (o elemento normalizado del Asistente Atlas) sin tocar la base de datos.
 */
export function buildTransientPredioReportData(featureOrNormalized, customDraft = {}, index = 0, layerName = '') {
  if (!featureOrNormalized) return null;

  const latToUtm = (lat, lng) => proj4('EPSG:4326', 'EPSG:32717', [lng, lat]);
  const utmToLatLng = (x, y) => {
    const pt = proj4('EPSG:32717', 'EPSG:4326', [x, y]);
    return [pt[1], pt[0]];
  };

  let uniqueUtm = [];
  let closedLatLngs = [];
  let props = {};

  if (Array.isArray(featureOrNormalized.utmCoords) && featureOrNormalized.utmCoords.length >= 4 && Array.isArray(featureOrNormalized.latLngs)) {
    // Viene ya normalizado desde ShapefileAtlasModal
    uniqueUtm = featureOrNormalized.utmCoords.slice(0, -1);
    closedLatLngs = featureOrNormalized.latLngs;
    props = featureOrNormalized.originalProperties || {};
  } else {
    // Viene como Feature GeoJSON crudo
    const geom = featureOrNormalized.geometry || featureOrNormalized;
    props = featureOrNormalized.properties || {};
    let ring = null;

    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
      ring = geom.coordinates[0];
    } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates?.[0]?.[0])) {
      ring = geom.coordinates[0][0];
    } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 3) {
      ring = geom.coordinates;
    } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates?.[0]) && geom.coordinates[0].length >= 3) {
      ring = geom.coordinates[0];
    }

    if (!ring || ring.length < 3) return null;

    let closedRing = [...ring];
    const first = closedRing[0];
    const last = closedRing[closedRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      closedRing.push(first);
    }

    const isUtm = Math.abs(closedRing[0][0]) > 180 || Math.abs(closedRing[0][1]) > 90;
    const rawUtm = isUtm ? closedRing : closedRing.map(pt => latToUtm(pt[1], pt[0]));

    for (let i = 0; i < rawUtm.length - 1; i++) {
      const pt = rawUtm[i];
      if (uniqueUtm.length === 0) {
        uniqueUtm.push(pt);
      } else {
        const prev = uniqueUtm[uniqueUtm.length - 1];
        if (Math.abs(pt[0] - prev[0]) > 1e-4 || Math.abs(pt[1] - prev[1]) > 1e-4) {
          uniqueUtm.push(pt);
        }
      }
    }
    if (uniqueUtm.length > 2) {
      const fPt = uniqueUtm[0];
      const lPt = uniqueUtm[uniqueUtm.length - 1];
      if (Math.abs(fPt[0] - lPt[0]) < 1e-4 && Math.abs(fPt[1] - lPt[1]) < 1e-4) {
        uniqueUtm.pop();
      }
    }
    if (uniqueUtm.length < 3) return null;

    // Asegurar sentido horario (Clockwise: signedArea < 0)
    let signedArea = 0;
    for (let i = 0; i < uniqueUtm.length; i++) {
      const p1 = uniqueUtm[i];
      const p2 = uniqueUtm[(i + 1) % uniqueUtm.length];
      signedArea += (p1[0] * p2[1]) - (p2[0] * p1[1]);
    }
    if (signedArea > 0) {
      uniqueUtm.reverse();
    }

    // Buscar P01 más al Noroeste (maximiza normY - normX)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    uniqueUtm.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const spanX = (maxX - minX) || 1;
    const spanY = (maxY - minY) || 1;

    let nwIdx = 0;
    let bestScore = -Infinity;
    uniqueUtm.forEach(([x, y], idx) => {
      const score = ((y - minY) / spanY) - ((x - minX) / spanX);
      if (score > bestScore + 1e-4) {
        bestScore = score;
        nwIdx = idx;
      }
    });

    if (nwIdx > 0) {
      uniqueUtm = uniqueUtm.slice(nwIdx).concat(uniqueUtm.slice(0, nwIdx));
    }

    const closedUtm = [...uniqueUtm, uniqueUtm[0]];
    closedLatLngs = closedUtm.map(pt => utmToLatLng(pt[0], pt[1]));
  }

  const n = uniqueUtm.length;
  let areaAccum = 0;
  let perimetro = 0;
  const vertices = [];
  const linderos = [];

  for (let i = 0; i < n; i++) {
    const p1 = uniqueUtm[i];
    const p2 = uniqueUtm[(i + 1) % n];
    areaAccum += (p1[0] * p2[1]) - (p2[0] * p1[1]);
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    perimetro += dist;

    const latLng = closedLatLngs[i] || utmToLatLng(p1[0], p1[1]);
    const codigoVert = `P${String(i + 1).padStart(2, '0')}`;
    const nextCodigoVert = `P${String(((i + 1) % n) + 1).padStart(2, '0')}`;

    vertices.push({
      id: i + 1,
      codigo: codigoVert,
      coord_x: Number(p1[0].toFixed(2)),
      coord_y: Number(p1[1].toFixed(2)),
      geom_wkt: `POINT(${latLng[1]} ${latLng[0]})`
    });

    const draftLindero = Array.isArray(customDraft.linderos) ? customDraft.linderos[i] : null;
    linderos.push({
      id: i + 1,
      tramo: `${codigoVert} - ${nextCodigoVert}`,
      longitud: Number((draftLindero?.distancia ?? draftLindero?.longitud ?? dist).toFixed ? (draftLindero?.distancia ?? draftLindero?.longitud ?? dist) : parseFloat(draftLindero?.distancia ?? draftLindero?.longitud ?? dist) || dist),
      rumbo: draftLindero?.rumbo || calcularRumboTopografico(p1[0], p1[1], p2[0], p2[1]),
      colindante: draftLindero?.colindante || ''
    });
  }

  const areaM2 = Math.abs(areaAccum) / 2.0;
  const areaHa = areaM2 / 10000.0;

  // Extraer metadatos automáticos de las propiedades del DBF/GeoJSON si no vienen en customDraft
  let autoCod = '';
  let autoNombre = '';
  let autoCedula = '';
  let autoSector = '';
  let autoParroquia = '';

  Object.keys(props).forEach(k => {
    const val = String(props[k] ?? '').trim();
    if (!val || val === 'null' || val === 'undefined') return;
    const upper = k.toUpperCase();
    if (!autoCod && (upper.includes('CLAVE') || upper.includes('CATAST') || upper.includes('COD_CAT') || upper === 'CODIGO')) autoCod = val;
    if (!autoCedula && (upper.includes('CEDULA') || upper.includes('RUC') || upper.includes('IDENT') || upper === 'DNI')) autoCedula = val;
    if (!autoNombre && (upper.includes('NOMBRE') || upper.includes('PROPIETARIO') || upper.includes('POSESION') || upper.includes('TITULAR'))) autoNombre = val;
    if (!autoSector && (upper.includes('SECTOR') || upper.includes('RECINTO') || upper.includes('BARRIO'))) autoSector = val;
    if (!autoParroquia && (upper.includes('PARROQ') || upper.includes('CIUDAD') || upper.includes('DPA_DESPAR'))) autoParroquia = val;
  });

  const combinedNomApe = [props.nombres || props.NOMBRES, props.apellidos || props.APELLIDOS].filter(Boolean).map(v => String(v).trim()).join(' ').trim();
  if (combinedNomApe) autoNombre = combinedNomApe;

  const cleanDraftCod = (customDraft.cod_catastral || '').replace(/\s/g, '');
  const finalCodigo = cleanDraftCod || autoCod || `CAPA-${String(index + 1).padStart(3, '0')}`;
  const finalNombre = (customDraft.nombre_posesionario || '').trim() || autoNombre || layerName || `Polígono #${index + 1}`;
  const finalCedula = (customDraft.cedula || '').trim() || autoCedula || 'S/N';
  const finalSector = (customDraft.sector || '').trim() || autoSector || '';
  const finalParroquia = (customDraft.parroquia || '').trim() || autoParroquia || '';

  const wktPairs = closedLatLngs.map(pt => `${pt[1]} ${pt[0]}`).join(', ');
  const geom_wkt = `POLYGON((${wktPairs}))`;

  return {
    predio: {
      id: `TEMP_PRINT_${index}`,
      codigo: finalCodigo,
      cod_catastral: finalCodigo,
      cedula: finalCedula,
      nombre_posesionario: finalNombre,
      area_ha: Number(areaHa.toFixed(4)),
      area_m2: Number(areaM2.toFixed(2)),
      perimetro: Number(perimetro.toFixed(2)),
      sector: finalSector,
      parroquia: finalParroquia,
      geom_wkt,
      isTransient: true
    },
    vertices,
    linderos
  };
}



