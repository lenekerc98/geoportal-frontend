/**
 * Utilidades geométricas y cartográficas para levantamientos planimétricos y catastro.
 */

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

  const n = rawVertices.length;

  // Extraer coordenadas de cada vértice para análisis planar
  const coords = rawVertices.map(v => {
    let x = v.coord_x;
    let y = v.coord_y;
    if ((x === undefined || y === undefined || x === null || y === null) && v.geom_wkt) {
      try {
        const parts = v.geom_wkt.replace('POINT(', '').replace(')', '').trim().split(' ');
        x = parseFloat(parts[0]);
        y = parseFloat(parts[1]);
      } catch (e) {}
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
      orderedVerts.push({ ...rawVertices[idx] });
      if (rawLinderos[idx]) {
        orderedLins.push({ ...rawLinderos[idx] });
      }
    }
  } else {
    // Si era antihorario, invertimos el recorrido para asegurar sentido horario
    for (let i = 0; i < n; i++) {
      const idx = (nwIdx - i + n) % n;
      orderedVerts.push({ ...rawVertices[idx] });
      const linIdx = (idx - 1 + n) % n;
      if (rawLinderos[linIdx]) {
        orderedLins.push({ ...rawLinderos[linIdx] });
      }
    }
  }

  // 4. Prefijo unificado 'P' (P01, P02, ...) y recodificar secuencialmente desde 01
  const prefix = 'P';

  for (let i = 0; i < orderedVerts.length; i++) {
    const newCode = `${prefix}${String(i + 1).padStart(2, '0')}`;
    orderedVerts[i].codigo = newCode;
  }

  // 5. Ajustar los tramos correspondientes en los linderos
  for (let i = 0; i < orderedLins.length; i++) {
    const currentCode = orderedVerts[i]?.codigo || `${prefix}${String(i + 1).padStart(2, '0')}`;
    const nextCode = (i < orderedVerts.length - 1)
      ? (orderedVerts[i + 1]?.codigo || `${prefix}${String(i + 2).padStart(2, '0')}`)
      : (orderedVerts[0]?.codigo || `${prefix}01`);
    orderedLins[i].tramo = `${currentCode} - ${nextCode}`;
  }

  return { vertices: orderedVerts, linderos: orderedLins };
}
