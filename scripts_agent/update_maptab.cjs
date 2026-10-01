const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/pages/MapTab/MapTab.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Update imports
content = content.replace(
  "import { utmToWgs84, wgs84ToUtm } from '../../utils/geoUtils';",
  "import { utmToWgs84, wgs84ToUtm, extractVerticesFromPredio, normalizeVerticesClockwiseFromNW, computePolygonArea, computePerimeter } from '../../utils/geoUtils';"
);

// 2. Replace normalizePredio implementation
const oldNormalizeRegex = /\/\/ Normalizar cualquier predio[\s\S]*?return null;\s*\};/;

const newNormalize = `// Normalizar cualquier predio (GeoJSON Feature del servidor o predio local offline) a polígono WGS84
  const normalizePredio = (raw) => {
    if (!raw) return null;

    // Caso 1: GeoJSON Feature desde el servidor (PostGIS ST_AsGeoJSON) o caché
    if (raw.type === 'Feature' && raw.geometry) {
      let rawCoords = [];
      const geom = raw.geometry;
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        rawCoords = geom.coordinates[0] || [];
      } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        rawCoords = geom.coordinates[0]?.[0] || [];
      }
      if (rawCoords.length < 3) return null;

      // Quitar punto de cierre duplicado si existe
      let cleanCoords = [...rawCoords];
      if (cleanCoords.length > 3) {
        const first = cleanCoords[0];
        const last = cleanCoords[cleanCoords.length - 1];
        if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
          cleanCoords = cleanCoords.slice(0, -1);
        }
      }

      const latlngs = cleanCoords.map(([lng, lat]) => [lat, lng]);
      const props = raw.properties || {};
      const colindantesList = Array.isArray(props.colindantes) 
        ? props.colindantes 
        : (Array.isArray(raw.colindantes) ? raw.colindantes : []);

      const utmVerts = cleanCoords.map(([lng, lat], idx) => {
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

      const normalizedVerts = normalizeVerticesClockwiseFromNW(utmVerts);
      const areaM2 = props.area_ha ? Number(props.area_ha) * 10000 : (Number(props.area) || computePolygonArea(normalizedVerts));
      const perimM = Number(props.perimetro) || computePerimeter(normalizedVerts);

      return {
        id: props.id || raw.id,
        isServer: true,
        codigo: props.cod_catastral || props.codigo || \`PREDIO-\${props.id || raw.id}\`,
        propietario: props.nombre_posesionario || props.propietario || 'Sin posesionario',
        cedula: props.cedula || 'N/D',
        telefono: props.telefono || props.celular || '',
        norte: props.lindero_norte || props.norte || '',
        sur: props.lindero_sur || props.sur || '',
        este: props.lindero_este || props.este || '',
        oeste: props.lindero_oeste || props.oeste || '',
        observaciones: props.observaciones || '',
        area: areaM2,
        perimetro: perimM,
        creador_nombre: props.creador_nombre || props.creado_por_nombre,
        positions: latlngs,
        vertices: normalizedVerts,
        raw
      };
    }

    // Caso 2: Predio local offline levantado en el móvil
    const rawVertices = raw.vertices || [];
    if (Array.isArray(rawVertices) && rawVertices.length >= 3) {
      const normalizedVerts = normalizeVerticesClockwiseFromNW(rawVertices);
      const latlngs = normalizedVerts.map(v => {
        if (v.lat !== undefined && v.lng !== undefined) return [v.lat, v.lng];
        const x = v.x ?? (Array.isArray(v) ? v[0] : 0);
        const y = v.y ?? (Array.isArray(v) ? v[1] : 0);
        const wgs = utmToWgs84(x, y);
        return [wgs.lat, wgs.lng];
      });

      return {
        id: raw.id || raw.offline_id,
        offline_id: raw.offline_id,
        isServer: false,
        codigo: raw.codigo || raw.clave_catastral || 'Sin Clave',
        propietario: raw.propietario || 'N/D',
        cedula: raw.cedula || 'N/D',
        telefono: raw.telefono || '',
        norte: raw.norte || '',
        sur: raw.sur || '',
        este: raw.este || '',
        oeste: raw.oeste || '',
        observaciones: raw.observaciones || '',
        area: Number(raw.area) || computePolygonArea(normalizedVerts),
        perimetro: Number(raw.perimetro) || computePerimeter(normalizedVerts),
        creador_nombre: raw.creador_nombre,
        sync_status: raw.sync_status,
        positions: latlngs,
        vertices: normalizedVerts,
        raw
      };
    }

    return null;
  };`;

content = content.replace(oldNormalizeRegex, newNormalize);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('MapTab.jsx successfully updated with full vertex and lindero extraction!');
