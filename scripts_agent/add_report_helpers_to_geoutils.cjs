const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/utils/geoUtils.js');
let content = fs.readFileSync(targetPath, 'utf8');

const additionalHelpers = `
export function calculateRumbo(dx, dy) {
  let angle = Math.atan2(dx, dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  let quad = 'N';
  let deg = 0;
  let suff = 'E';
  if (angle >= 0 && angle <= 90) {
    quad = 'N'; deg = angle; suff = 'E';
  } else if (angle > 90 && angle <= 180) {
    quad = 'S'; deg = 180 - angle; suff = 'E';
  } else if (angle > 180 && angle <= 270) {
    quad = 'S'; deg = angle - 180; suff = 'W';
  } else {
    quad = 'N'; deg = 360 - angle; suff = 'W';
  }
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return \`\${quad} \${d}°\${String(m).padStart(2, '0')}' \${suff === 'W' ? 'O' : suff}\`;
}

/**
 * Normaliza y reordena los vértices y linderos de un predio con las mismas reglas oficiales del Geoportal:
 * 1. P01 es obligatoriamente el vértice Nor-Oeste (NW) de izquierda a derecha.
 * 2. Recorrido estrictamente en SENTIDO HORARIO (Clockwise).
 */
export function normalizeVerticesAndLinderos(rawVertices = [], rawLinderos = []) {
  if (!rawVertices || rawVertices.length < 3) {
    return { vertices: rawVertices || [], linderos: rawLinderos || [] };
  }

  const n = rawVertices.length;

  const coords = rawVertices.map(v => {
    let x = v.coord_x ?? v.x;
    let y = v.coord_y ?? v.y;
    return { x: Number(x) || 0, y: Number(y) || 0 };
  });

  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % n];
    signedArea += (p1.x * p2.y - p2.x * p1.y);
  }
  signedArea *= 0.5;
  const isClockwise = signedArea < 0;

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
    for (let i = 0; i < n; i++) {
      const idx = (nwIdx - i + n) % n;
      orderedVerts.push({ ...rawVertices[idx] });
      const linIdx = (idx - 1 + n) % n;
      if (rawLinderos[linIdx]) {
        orderedLins.push({ ...rawLinderos[linIdx] });
      }
    }
  }

  const prefix = 'P';
  for (let i = 0; i < orderedVerts.length; i++) {
    const newCode = \`\${prefix}\${String(i + 1).padStart(2, '0')}\`;
    orderedVerts[i].codigo = newCode;
    orderedVerts[i].coord_x = orderedVerts[i].coord_x ?? orderedVerts[i].x;
    orderedVerts[i].coord_y = orderedVerts[i].coord_y ?? orderedVerts[i].y;
  }

  for (let i = 0; i < orderedLins.length; i++) {
    const currentCode = orderedVerts[i]?.codigo || \`\${prefix}\${String(i + 1).padStart(2, '0')}\`;
    const nextCode = (i < orderedVerts.length - 1)
      ? (orderedVerts[i + 1]?.codigo || \`\${prefix}\${String(i + 2).padStart(2, '0')}\`)
      : (orderedVerts[0]?.codigo || \`\${prefix}01\`);
    orderedLins[i].tramo = \`\${currentCode} - \${nextCode}\`;
  }

  return { vertices: orderedVerts, linderos: orderedLins };
}
`;

if (!content.includes('normalizeVerticesAndLinderos')) {
  content += additionalHelpers;
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Added normalizeVerticesAndLinderos to geoUtils.js in movil!');
} else {
  console.log('geoUtils.js already has normalizeVerticesAndLinderos!');
}
