import * as turf from '@turf/turf';

/**
 * Extiende los extremos de una línea para garantizar que atraviese limpiamente
 * los bordes del polígono incluso si el operador hizo clic sobre el borde o ligeramente adentro.
 */
export function extendLine(coords, factor = 0.15) {
  if (!coords || coords.length < 2) return coords;

  const p0 = coords[0];
  const p1 = coords[1];
  const pn_1 = coords[coords.length - 2];
  const pn = coords[coords.length - 1];

  const dx0 = p0[0] - p1[0];
  const dy0 = p0[1] - p1[1];
  const len0 = Math.hypot(dx0, dy0) || 1e-6;
  const extP0 = [p0[0] + (dx0 / len0) * factor, p0[1] + (dy0 / len0) * factor];

  const dxn = pn[0] - pn_1[0];
  const dyn = pn[1] - pn_1[1];
  const lenn = Math.hypot(dxn, dyn) || 1e-6;
  const extPn = [pn[0] + (dxn / lenn) * factor, pn[1] + (dyn / lenn) * factor];

  return [extP0, ...coords.slice(1, -1), extPn];
}

/**
 * Normaliza cualquier entrada de polígono (Feature, Geometry, o Array de coordenadas) a un Feature Polygon/MultiPolygon.
 */
function normalizeToPolygonFeature(input) {
  if (!input) return null;
  if (input.type === 'Feature') return input;
  if (input.type === 'Polygon' || input.type === 'MultiPolygon') {
    return turf.feature(input);
  }
  if (Array.isArray(input)) {
    return turf.polygon(input);
  }
  return null;
}

/**
 * Divide un polígono mediante una línea de corte (desmembración / fraccionamiento).
 * 
 * @param {Object} polygonInput - Feature o Geometría del polígono matriz
 * @param {Array|Object} lineInput - Array de coordenadas [lng, lat] o Feature LineString
 * @returns {Object} Resultado con { success, parts, originalArea_m2, originalArea_ha, error }
 */
export function splitPolygonByLine(polygonInput, lineInput) {
  try {
    const polyFeature = normalizeToPolygonFeature(polygonInput);
    if (!polyFeature) {
      return { success: false, error: 'Polígono matriz no válido.' };
    }

    // Normalizar coordenadas de la línea de corte a [[lng, lat], ...]
    let lineCoords = [];
    if (Array.isArray(lineInput)) {
      lineCoords = lineInput.map(pt => {
        if (Array.isArray(pt)) return [Number(pt[0]), Number(pt[1])];
        if (pt && typeof pt === 'object' && 'lng' in pt && 'lat' in pt) return [Number(pt.lng), Number(pt.lat)];
        return pt;
      });
    } else if (lineInput && lineInput.geometry && lineInput.geometry.coordinates) {
      lineCoords = lineInput.geometry.coordinates;
    }

    if (lineCoords.length < 2) {
      return { success: false, error: 'La línea de corte debe tener al menos 2 vértices.' };
    }

    const originalAreaM2 = turf.area(polyFeature);
    if (originalAreaM2 <= 0) {
      return { success: false, error: 'El predio matriz tiene un área inválida o nula.' };
    }

    // Calcular extensión dinámica basada en el tamaño del predio
    const bbox = turf.bbox(polyFeature);
    const diag = Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1]);
    const extDistance = Math.max(diag * 0.2, 0.0001); // 20% de la diagonal

    const extendedCoords = extendLine(lineCoords, extDistance);
    const cuttingLine = turf.lineString(extendedCoords);

    // Obtener contorno perimetral del polígono
    let polyLine = turf.polygonToLine(polyFeature);
    if (polyLine.type === 'FeatureCollection') {
      polyLine = polyLine.features[0];
    }

    // Verificar intersecciones
    const intersections = turf.lineIntersect(polyLine, cuttingLine);
    if (!intersections || intersections.features.length < 2) {
      return {
        success: false,
        error: 'La línea de corte no atraviesa completamente el predio. Asegúrese de que entre por un lindero y salga por otro.'
      };
    }

    // MÉTODO 1: Polygonize a través de lineSplit (Preserva 100% el área exacta y coordenadas sin desfases)
    let validPolygons = [];
    try {
      const boundarySplits = turf.lineSplit(polyLine, cuttingLine);
      const lineSplits = turf.lineSplit(cuttingLine, polyLine);

      const insideSegments = (lineSplits.features || []).filter(seg => {
        const coords = seg.geometry.coordinates;
        if (!coords || coords.length < 2) return false;
        const mid = turf.midpoint(turf.point(coords[0]), turf.point(coords[coords.length - 1]));
        return turf.booleanPointInPolygon(mid, polyFeature);
      });

      if (boundarySplits && boundarySplits.features && boundarySplits.features.length > 0) {
        const allSegments = turf.featureCollection([...boundarySplits.features, ...insideSegments]);
        const polygonized = turf.polygonize(allSegments);

        if (polygonized && polygonized.features && polygonized.features.length >= 2) {
          validPolygons = polygonized.features.filter(p => {
            const pt = turf.pointOnFeature(p);
            const inside = turf.booleanPointInPolygon(pt, polyFeature);
            const a = turf.area(p);
            return inside && a > 0.05; // Filtrar artefactos despreciables
          });
        }
      }
    } catch (err) {
      console.warn('Método polygonize falló, intentando fallback de diferencia geométrica:', err);
    }

    // MÉTODO 2 (FALLBACK): turf.difference con buffer micrométrico
    if (validPolygons.length < 2) {
      try {
        const lineBuffer = turf.buffer(cuttingLine, 0.000002, { units: 'kilometers' }); // ~2mm
        const diff = turf.difference(turf.featureCollection([polyFeature, lineBuffer]));
        if (diff) {
          if (diff.geometry.type === 'MultiPolygon') {
            validPolygons = diff.geometry.coordinates.map(coords => turf.polygon(coords));
          } else if (diff.geometry.type === 'Polygon') {
            validPolygons = [diff];
          }
        }
      } catch (diffErr) {
        console.error('Fallback difference también falló:', diffErr);
      }
    }

    if (validPolygons.length < 2) {
      return {
        success: false,
        error: 'No se pudo dividir el polígono en partes válidas. Intente trazar la línea de corte con mayor claridad a través del lote.'
      };
    }

    // Ordenar por área descendente: Lote 1 (mayor o remanente) y Lote 2 (desmembrado)
    validPolygons.sort((a, b) => turf.area(b) - turf.area(a));

    const totalCalculatedArea = validPolygons.reduce((acc, p) => acc + turf.area(p), 0);

    const parts = validPolygons.map((p, index) => {
      const areaM2 = turf.area(p);
      let perimeterM = 0;
      try {
        const pLine = turf.polygonToLine(p);
        perimeterM = turf.length(pLine, { units: 'meters' });
      } catch (e) {
        perimeterM = 0;
      }
      const percentage = totalCalculatedArea > 0 ? (areaM2 / totalCalculatedArea) * 100 : 0;

      return {
        index: index + 1,
        label: index === 0 ? 'Lote 1 (Remanente)' : ('Lote ' + (index + 1) + ' (Fracción Desmembrada)'),
        geometry: p.geometry,
        area_m2: areaM2,
        area_ha: areaM2 / 10000,
        perimeter_m: perimeterM,
        percentage: percentage
      };
    });

    return {
      success: true,
      originalArea_m2: originalAreaM2,
      originalArea_ha: originalAreaM2 / 10000,
      parts
    };
  } catch (globalErr) {
    console.error('Error en splitPolygonByLine:', globalErr);
    return {
      success: false,
      error: 'Error inesperado al fraccionar el polígono: ' + globalErr.message
    };
  }
}
