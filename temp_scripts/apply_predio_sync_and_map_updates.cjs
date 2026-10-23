const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '..', 'movil');

console.log('Applying predio sync and map updates to movil at:', movilDir);

// ==========================================
// 1. UPDATE movil/src/services/api.js (EXTRACT data.features)
// ==========================================
const apiPath = path.join(movilDir, 'src', 'services', 'api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8');

const oldFetchServerPrediosRegex = /export async function fetchServerPredios\(\) \{[\s\S]*?return \[\];\s*\}\s*\}/;

const newFetchServerPredios = `export async function fetchServerPredios() {
  const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
  const token = await getSetting('auth_token', '');
  const headers = {
    'Content-Type': 'application/json',
    'X-Database-Env': 'prod'
  };
  if (token) headers['Authorization'] = \`Bearer \${token}\`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(\`\${baseUrl}/api/gis/predios\`, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(\`Error HTTP \${res.status}\`);
    const data = await res.json();
    const list = Array.isArray(data) 
      ? data 
      : (Array.isArray(data.features) ? data.features : (data.predios || []));
    
    if (list.length > 0) {
      await saveCachedPredios(list);
    }
    return list;
  } catch (e) {
    console.warn('No se pudo descargar predios del servidor (usando caché local):', e.message);
    const cached = await getCachedPredios();
    return cached || [];
  }
}`;

if (oldFetchServerPrediosRegex.test(apiCode)) {
  apiCode = apiCode.replace(oldFetchServerPrediosRegex, newFetchServerPredios);
  fs.writeFileSync(apiPath, apiCode, 'utf8');
  console.log('1. Updated api.js: fetchServerPredios now parses data.features properly');
} else {
  console.log('1. api.js regex did not match');
}

// ==========================================
// 2. UPDATE movil/src/pages/MapTab/MapTab.jsx
// ==========================================
const mapTabPath = path.join(movilDir, 'src', 'pages', 'MapTab', 'MapTab.jsx');
let mapCode = fs.readFileSync(mapTabPath, 'utf8');

// Replace parsePredioCoordinates with robust normalizePredio
const oldParseRegex = /\/\/ Convertir vértices de un predio a lat\/lng de WGS84 para Leaflet[\s\S]*?return \[wgs\.lat, wgs\.lng\];\s*\}\);\s*\};/;

const newNormalizeCode = `// Normalizar cualquier predio (GeoJSON Feature del servidor o predio local offline) a polígono WGS84
  const normalizePredio = (raw) => {
    if (!raw) return null;

    // Caso 1: GeoJSON Feature desde el servidor (PostGIS ST_AsGeoJSON)
    if (raw.type === 'Feature' && raw.geometry) {
      let latlngs = [];
      const geom = raw.geometry;
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        latlngs = (geom.coordinates[0] || []).map(([lng, lat]) => [lat, lng]);
      } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        latlngs = (geom.coordinates[0]?.[0] || []).map(([lng, lat]) => [lat, lng]);
      }
      if (latlngs.length < 3) return null;

      const props = raw.properties || {};
      const areaM2 = props.area_ha ? Number(props.area_ha) * 10000 : (Number(props.area) || 0);

      return {
        id: props.id || raw.id,
        isServer: true,
        codigo: props.cod_catastral || props.codigo || \`PREDIO-\${props.id || raw.id}\`,
        propietario: props.nombre_posesionario || props.propietario || 'Sin posesionario',
        cedula: props.cedula || 'N/D',
        area: areaM2,
        perimetro: Number(props.perimetro) || 0,
        creador_nombre: props.creador_nombre || props.creado_por_nombre,
        positions: latlngs,
        raw
      };
    }

    // Caso 2: Predio local offline levantado en el móvil
    const rawVertices = raw.vertices || [];
    if (Array.isArray(rawVertices) && rawVertices.length >= 3) {
      const latlngs = rawVertices.map(v => {
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
        area: Number(raw.area) || 0,
        perimetro: Number(raw.perimetro) || 0,
        creador_nombre: raw.creador_nombre,
        sync_status: raw.sync_status,
        positions: latlngs,
        vertices: rawVertices,
        raw
      };
    }

    return null;
  };`;

if (oldParseRegex.test(mapCode)) {
  mapCode = mapCode.replace(oldParseRegex, newNormalizeCode);
  console.log('2. Updated MapTab.jsx with robust normalizePredio');
} else {
  console.log('2. MapTab.jsx parse regex did not match');
}

// Now replace the polygon rendering blocks for offlinePredios and cachedPredios
const oldPolygonRenderingRegex = /\{\/\* Polígonos de Predios Offline[\s\S]*?\{\/\* Elementos de Caminata de Perímetro/;

const newPolygonRendering = `{/* Polígonos de Predios Offline Guardados en el Teléfono (Color Ámbar) */}
        {offlinePredios.map((raw) => {
          const p = normalizePredio(raw);
          if (!p) return null;
          return (
            <Polygon
              key={\`off-\${p.offline_id || p.id}\`}
              positions={p.positions}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.35,
                weight: 2.5,
                dashArray: p.sync_status === 'synced' ? null : '4, 4'
              }}
              eventHandlers={{
                click: (e) => {
                  if (isManualDrawing) {
                    handleMapClick(e.latlng);
                  } else {
                    setSelectedPredio(p);
                  }
                }
              }}
            >
              <Tooltip permanent={false} direction="center">
                <span>📦 {p.codigo}</span>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* Polígonos de Predios Vectoriales del Servidor / Caché Offline (Color Cian) */}
        {cachedPredios.map((raw) => {
          const p = normalizePredio(raw);
          if (!p) return null;
          return (
            <Polygon
              key={\`srv-\${p.id}\`}
              positions={p.positions}
              pathOptions={{
                color: '#06b6d4',
                fillColor: '#06b6d4',
                fillOpacity: 0.22,
                weight: 2
              }}
              eventHandlers={{
                click: (e) => {
                  if (isManualDrawing) {
                    handleMapClick(e.latlng);
                  } else {
                    setSelectedPredio(p);
                  }
                }
              }}
            >
              <Tooltip permanent={false} direction="center">
                <span>{p.codigo}</span>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* Elementos de Caminata de Perímetro`;

if (oldPolygonRenderingRegex.test(mapCode)) {
  mapCode = mapCode.replace(oldPolygonRenderingRegex, newPolygonRendering);
  fs.writeFileSync(mapTabPath, mapCode, 'utf8');
  console.log('2.2 Updated MapTab.jsx polygon rendering for both server & offline predios');
} else {
  console.log('2.2 MapTab.jsx polygon regex did not match');
}

// ==========================================
// 3. UPDATE movil/src/pages/SettingsTab/SettingsMobile.jsx (DOWNLOAD PREDIOS BUTTON)
// ==========================================
const settingsPath = path.join(movilDir, 'src', 'pages', 'SettingsTab', 'SettingsMobile.jsx');
let settingsCode = fs.readFileSync(settingsPath, 'utf8');

// Ensure Download and Database icons are imported
if (!settingsCode.includes('Download,')) {
  settingsCode = settingsCode.replace("import {\n", "import {\n  Download,\n  Database,\n");
}

// Add downloading state and handleDownloadPredios
const oldClearCacheHandlerRegex = /const handleClearCache = async \(\) => \{[\s\S]*?\}\s*\};/;

const newDownloadAndClearHandlers = `const [downloading, setDownloading] = useState(false);

  const handleDownloadPredios = async () => {
    setDownloading(true);
    try {
      const list = await fetchServerPredios();
      setCachedCount(list.length);
      Swal.fire({
        icon: 'success',
        title: 'Predios Descargados',
        text: \`Se descargaron \${list.length} predios vectoriales en la memoria del teléfono para trabajar offline.\`,
        confirmButtonColor: '#10b981',
        background: '#131d33',
        color: '#fff'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Fallo al Descargar',
        text: err.message || 'Verifica la conexión con el servidor.',
        confirmButtonColor: '#ef4444',
        background: '#131d33',
        color: '#fff'
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleClearCache = async () => {
    const result = await Swal.fire({
      title: '¿Limpiar Caché de Predios?',
      text: 'Se borrarán los predios descargados del servidor para liberar espacio. Los predios nuevos que hayas levantado offline NO se borrarán.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Limpiar Caché',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      background: '#131d33',
      color: '#fff'
    });

    if (result.isConfirmed) {
      await clearCachedPredios();
      setCachedCount(0);
      Swal.fire({
        icon: 'success',
        title: 'Caché Limpia',
        background: '#131d33',
        color: '#fff'
      });
    }
  };`;

if (oldClearCacheHandlerRegex.test(settingsCode)) {
  settingsCode = settingsCode.replace(oldClearCacheHandlerRegex, newDownloadAndClearHandlers);
}

// Ensure fetchServerPredios is imported in SettingsMobile.jsx
if (!settingsCode.includes('fetchServerPredios')) {
  settingsCode = settingsCode.replace(
    "import { getServerUrl, getDefaultServerUrl, testConnection } from '../../services/api';",
    "import { getServerUrl, getDefaultServerUrl, testConnection, fetchServerPredios } from '../../services/api';"
  );
}

// Update the cache UI card in SettingsMobile.jsx
const oldCacheCardRegex = /\{\/\* 4\. CACHÉ DE PREDIOS \*\/\}[\s\S]*?\{\/\* 5\. SESIÓN Y ACCIONES \*\/\}/;

const newCacheCard = `{/* 4. CACHÉ DE PREDIOS Y MAPA OFFLINE */}
      <div className="settings-section">
        <h2 className="section-title">
          <Database size={16} /> Predios y Geometría Offline
        </h2>
        <div className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>
                Predios en Memoria
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                {cachedCount} polígonos disponibles para visualización offline
              </div>
            </div>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {cachedCount}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button 
              className="btn-primary-mobile"
              style={{ flex: 1, height: '44px', fontSize: '13px', background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
              onClick={handleDownloadPredios}
              disabled={downloading}
            >
              <Download size={16} className={downloading ? 'animate-spin' : ''} />
              {downloading ? 'Descargando Predios...' : 'Descargar Predios'}
            </button>

            {cachedCount > 0 && (
              <button 
                className="btn-secondary-mobile"
                style={{ height: '44px', fontSize: '13px', padding: '0 14px' }}
                onClick={handleClearCache}
                title="Limpiar predios en caché"
              >
                <Trash2 size={16} color="#f43f5e" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. SESIÓN Y ACCIONES */}`;

if (oldCacheCardRegex.test(settingsCode)) {
  settingsCode = settingsCode.replace(oldCacheCardRegex, newCacheCard);
  fs.writeFileSync(settingsPath, settingsCode, 'utf8');
  console.log('3. Updated SettingsMobile.jsx with [Descargar Predios] button');
} else {
  console.log('3. SettingsMobile.jsx cache card regex did not match');
}

// ==========================================
// 4. BUMP VERSION IN build.gradle TO 2.2 (versionCode 12)
// ==========================================
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 12');
gradle = gradle.replace(/versionName\s+"[^"]+"/, 'versionName "2.2"');
fs.writeFileSync(gradlePath, gradle, 'utf8');
console.log('4. Bumped version in build.gradle to 2.2 (versionCode 12)');

console.log('ALL UPDATES COMPLETE!');
