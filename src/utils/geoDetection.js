/**
 * Detección espacial y territorial de Parroquia y Clave Catastral para el cantón Urdaneta (1206)
 * Parroquias: 50 Catarama, 51 Ricaurte, 52 Pijullo
 */

export function detectarUbicacionCliente(rawCoords) {
  if (!rawCoords) return null;

  let x = null;
  let y = null;
  let lat = null;
  let lng = null;

  try {
    // Caso 1: Array de puntos Leaflet [{lat, lng}, ...]
    if (Array.isArray(rawCoords) && rawCoords.length > 0) {
      const p0 = rawCoords[0];
      if (p0 && typeof p0 === 'object') {
        if (p0.lat !== undefined && p0.lng !== undefined) {
          lat = Number(p0.lat);
          lng = Number(p0.lng);
        } else if (p0.x !== undefined && p0.y !== undefined) {
          x = Number(p0.x);
          y = Number(p0.y);
        } else if (Array.isArray(p0) && p0.length >= 2) {
          const c0 = Number(p0[0]);
          const c1 = Number(p0[1]);
          if (Math.abs(c0) <= 180 && Math.abs(c1) <= 90) {
            lng = c0;
            lat = c1;
          } else {
            x = c0;
            y = c1;
          }
        }
      }
    }
    // Caso 2: Objeto GeoJSON
    else if (typeof rawCoords === 'object' && rawCoords !== null) {
      const geom = rawCoords.geometry || rawCoords;
      let ring = null;
      if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
        ring = geom.coordinates[0];
      } else if (geom.type === 'MultiPolygon' && geom.coordinates && geom.coordinates[0] && geom.coordinates[0][0]) {
        ring = geom.coordinates[0][0];
      }
      if (ring && ring.length > 0 && Array.isArray(ring[0])) {
        const c0 = Number(ring[0][0]);
        const c1 = Number(ring[0][1]);
        if (Math.abs(c0) <= 180 && Math.abs(c1) <= 90) {
          lng = c0;
          lat = c1;
        } else {
          x = c0;
          y = c1;
        }
      }
    }
    // Caso 3: String de texto de coordenadas (ej: "677000.00 9825000.00\n...")
    else if (typeof rawCoords === 'string' && rawCoords.trim().length > 3) {
      const lines = rawCoords.trim().split(/\r?\n/);
      for (const line of lines) {
        const parts = line.trim().split(/[\s,;]+/);
        if (parts.length >= 2) {
          const c0 = parseFloat(parts[0]);
          const c1 = parseFloat(parts[1]);
          if (!isNaN(c0) && !isNaN(c1)) {
            if (Math.abs(c0) <= 180 && Math.abs(c1) <= 90) {
              lng = c0;
              lat = c1;
            } else {
              x = c0;
              y = c1;
            }
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error parsing coords for local geo detection:', err);
  }

  // Si no se extrajeron coordenadas válidas
  if (x === null && lng === null) return null;

  let cod_parroquia = '50';
  let parroquia = 'CATARAMA';

  // Delimitación territorial basada en la cartografía oficial DPA 1206:
  // Pijullo (120652): Este de Urdaneta (X >= 672600 en UTM 17S, o Lng >= -79.448)
  // Ricaurte (120651): Centro de Urdaneta (669350 <= X < 672600, o -79.477 <= Lng < -79.448)
  // Catarama (120650): Oeste cabecera cantonal (X < 669350, o Lng < -79.477)
  if (x !== null) {
    if (x >= 672600) {
      cod_parroquia = '52';
      parroquia = 'PIJULLO';
    } else if (x >= 669350) {
      cod_parroquia = '51';
      parroquia = 'RICAURTE';
    } else {
      cod_parroquia = '50';
      parroquia = 'CATARAMA';
    }
  } else if (lng !== null) {
    if (lng >= -79.448) {
      cod_parroquia = '52';
      parroquia = 'PIJULLO';
    } else if (lng >= -79.477) {
      cod_parroquia = '51';
      parroquia = 'RICAURTE';
    } else {
      cod_parroquia = '50';
      parroquia = 'CATARAMA';
    }
  }

  return {
    cod_provincia: '12',
    provincia: 'LOS RÍOS',
    cod_canton: '06',
    canton: 'URDANETA',
    cod_parroquia,
    parroquia,
    prefijo_clave: `1206${cod_parroquia}`,
    id_provincia: 12,
    id_canton: 127,
    id_ciudad: cod_parroquia === '52' ? 1401 : (cod_parroquia === '51' ? 808 : 807)
  };
}
