import Swal from 'sweetalert2';
import cantonData from './cantonUrdanetaBoundary.json';

const UTM_RING = cantonData.utm?.coordinates?.[0] || [];
const WGS_RING = cantonData.wgs84?.coordinates?.[0] || [];

// Bounding boxes con un pequeño margen (~150m) para chequeo ultrarrápido
const BBOX_UTM = {
  minX: 666000,
  maxX: 696000,
  minY: 9814000,
  maxY: 9839500
};

const BBOX_WGS = {
  minLng: -79.510,
  maxLng: -79.235,
  minLat: -1.685,
  maxLat: -1.450
};

/**
 * Algoritmo Ray-Casting Point-in-Polygon (0ms, 100% offline)
 */
function isPointInRing(px, py, ring) {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  const n = ring.length;
  let p1x = ring[0][0];
  let p1y = ring[0][1];

  for (let i = 1; i <= n; i++) {
    const p2 = ring[i % n];
    const p2x = p2[0];
    const p2y = p2[1];

    if (py > Math.min(p1y, p2y) && py <= Math.max(p1y, p2y)) {
      if (px <= Math.max(p1x, p2x)) {
        if (p1y !== p2y) {
          const xinters = (py - p1y) * (p2x - p1x) / (p2y - p1y) + p1x;
          if (p1x === p2x || px <= xinters) {
            inside = !inside;
          }
        }
      }
    }
    p1x = p2x;
    p1y = p2y;
  }
  return inside;
}

/**
 * Verifica si un punto (UTM o WGS84) está dentro de los límites cantonales de Urdaneta
 */
export function isPointInsideUrdaneta(pt) {
  if (!pt) return false;

  let x = pt.x ?? (Array.isArray(pt) ? pt[0] : null);
  let y = pt.y ?? (Array.isArray(pt) ? pt[1] : null);
  let lat = pt.lat;
  let lng = pt.lng;

  // Si se pasaron como números sueltos o strings
  if (x !== null) x = Number(x);
  if (y !== null) y = Number(y);
  if (lat !== undefined && lat !== null) lat = Number(lat);
  if (lng !== undefined && lng !== null) lng = Number(lng);

  // Evaluar en UTM 17S
  if (x !== null && !isNaN(x) && y !== null && !isNaN(y) && Math.abs(x) > 1000) {
    if (x < BBOX_UTM.minX || x > BBOX_UTM.maxX || y < BBOX_UTM.minY || y > BBOX_UTM.maxY) {
      return false;
    }
    return isPointInRing(x, y, UTM_RING);
  }

  // Evaluar en WGS84
  const testLng = lng !== null && !isNaN(lng) ? lng : (x !== null && Math.abs(x) <= 180 ? x : null);
  const testLat = lat !== null && !isNaN(lat) ? lat : (y !== null && Math.abs(y) <= 90 ? y : null);

  if (testLng !== null && testLat !== null) {
    if (testLng < BBOX_WGS.minLng || testLng > BBOX_WGS.maxLng || testLat < BBOX_WGS.minLat || testLat > BBOX_WGS.maxLat) {
      return false;
    }
    return isPointInRing(testLng, testLat, WGS_RING);
  }

  return true;
}

/**
 * Valida un array de vértices de un predio y detecta cuáles están fuera de Urdaneta
 */
export function validateVerticesWithinUrdaneta(vertices) {
  if (!vertices || !Array.isArray(vertices) || vertices.length === 0) {
    return {
      isValid: true,
      totalCount: 0,
      outsideCount: 0,
      outsideVertices: [],
      summaryMessage: 'Sin vértices'
    };
  }

  const outside = [];

  vertices.forEach((v, idx) => {
    const isInside = isPointInsideUrdaneta(v);
    if (!isInside) {
      const pCode = v.codigo || ('P' + String(idx + 1).padStart(2, '0'));
      const xVal = v.x ?? (Array.isArray(v) ? v[0] : null);
      const yVal = v.y ?? (Array.isArray(v) ? v[1] : null);
      const latVal = v.lat;
      const lngVal = v.lng;

      outside.push({
        index: idx,
        codigo: pCode,
        x: xVal,
        y: yVal,
        lat: latVal,
        lng: lngVal,
        texto: xVal && yVal 
          ? `X: ${Number(xVal).toFixed(2)}, Y: ${Number(yVal).toFixed(2)}`
          : (latVal && lngVal ? `Lat: ${Number(latVal).toFixed(5)}, Lng: ${Number(lngVal).toFixed(5)}` : 'Coordenada inválida')
      });
    }
  });

  return {
    isValid: outside.length === 0,
    totalCount: vertices.length,
    outsideCount: outside.length,
    outsideVertices: outside,
    summaryMessage: outside.length === 0
      ? 'Todas las coordenadas están dentro de Urdaneta'
      : `${outside.length} vértice(s) fuera del cantón Urdaneta`
  };
}

/**
 * Emite una alerta visual interactiva con SweetAlert2 detallando coordenadas fuera de Urdaneta
 */
export function showOutsideUrdanetaAlert(validationResult, customTitle = '⚠️ Coordenada Fuera de Rango') {
  const outside = validationResult?.outsideVertices || [];
  const count = outside.length;

  const listHtml = outside.slice(0, 6).map(v => `
    <div style="font-family: monospace; font-size: 12px; color: #991b1b; padding: 4px 6px; background: #ffffff; border-radius: 6px; margin-bottom: 4px; border: 1px solid #fecaca; display: flex; justify-content: space-between; align-items: center;">
      <b style="color: #b91c1c;">📍 ${v.codigo}</b>
      <span>${v.texto}</span>
    </div>
  `).join('');

  const moreMsg = count > 6 ? `<div style="font-size: 11px; color: #991b1b; font-style: italic; margin-top: 4px;">... y ${count - 6} vértice(s) más fuera de rango.</div>` : '';

  return Swal.fire({
    icon: 'warning',
    title: customTitle,
    html: `
      <div style="text-align: left; font-size: 13.5px; color: #334155; line-height: 1.45;">
        <p style="margin: 0 0 10px 0;">
          El predio contiene <b>${count} coordenada(s)</b> que se encuentran <b>fuera de los límites cantonales de Urdaneta</b>.
        </p>
        <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 10px; padding: 10px; margin-bottom: 12px;">
          <div style="font-size: 11.5px; font-weight: 700; color: #b91c1c; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.3px;">
            Vértices Detectados Fuera de Urdaneta:
          </div>
          ${listHtml}
          ${moreMsg}
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0;">
          ⚠️ Por favor verifica las coordenadas ingresadas, el archivo importado o la señal del GPS antes de continuar.
        </p>
      </div>
    `,
    confirmButtonText: 'Entendido, Revisar Coordenadas',
    confirmButtonColor: '#f59e0b',
    background: '#ffffff',
    color: '#0f172a'
  });
}
