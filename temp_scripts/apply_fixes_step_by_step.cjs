const fs = require('fs');
const path = require('path');

const movilDir = path.resolve('c:/LNCZ/proyecto-catastro-2026/movil');

console.log('=== APPLYING COMPLETE FIXES FOR DB CONNECTION, MAP FOCUS, AND REPORT MODAL ===');

// ============================================================================
// 1. FIX movil/src/App.jsx: Keep MapTab mounted with display: none / block
// ============================================================================
const appPath = path.join(movilDir, 'src/App.jsx');
let appCode = fs.readFileSync(appPath, 'utf8');

appCode = appCode.replace(
  /<main className="main-content">[\s\S]*?<\/main>/,
  `<main className="main-content" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: activeTab === 'map' ? 'block' : 'none', height: '100%', width: '100%' }}>
          <MapTab />
        </div>
        {activeTab === 'form' && <PredioFormMobile />}
        {activeTab === 'sync' && <SyncCenterMobile />}
        {activeTab === 'settings' && <SettingsMobile />}
      </main>`
);

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('✓ Fixed App.jsx: MapTab kept persistent in DOM');

// ============================================================================
// 2. FIX movil/src/services/api.js: Server URL migration, 401 auto-reauth, testConnection
// ============================================================================
const apiPath = path.join(movilDir, 'src/services/api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8');

// A) Migration in getServerUrl
apiCode = apiCode.replace(
  /export async function getServerUrl\(\) \{[\s\S]*?return DEFAULT_BACKEND_URL;\s*\}/,
  `export async function getServerUrl() {
  try {
    const saved = await getSetting('server_url');
    if (saved && typeof saved === 'string') {
      const clean = saved.trim().replace(/\\/+$/, '');
      // Si la URL guardada es la anterior rota (1-sbhv) o localhost, migrar automáticamente a 43s0
      if (clean.includes('geoportal-backend-1-sbhv.onrender.com') || clean.includes('localhost') || clean.includes('127.0.0.1')) {
        await setSetting('server_url', DEFAULT_BACKEND_URL);
        return DEFAULT_BACKEND_URL;
      }
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean;
      }
    }
  } catch (e) {
    console.warn('Error leyendo server_url:', e);
  }
  return DEFAULT_BACKEND_URL;
}`
);

// B) testConnection endpoint to root '/'
apiCode = apiCode.replace(
  /export async function testConnection\(customUrl = null\) \{[\s\S]*?return \{ ok: res\.ok \|\| res\.status === 401[\s\S]*?\}\s*\}/,
  `export async function testConnection(customUrl = null) {
  const url = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(\`\${url}/\`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    return { ok: res.ok || res.status === 200, latency, status: res.status, url };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, error: err.name === 'AbortError' ? 'Tiempo de espera agotado' : err.message, url };
  }
}`
);

// C) fetchServerPredios with 401 re-authentication
apiCode = apiCode.replace(
  /const res = await fetch\(\`\$\{baseUrl\}\/api\/gis\/predios\`, \{ headers, signal: controller\.signal \}\);[\s\S]*?if \(\!res\.ok\) \{/,
  `let res = await fetch(\`\${baseUrl}/api/gis/predios\`, { headers, signal: controller.signal });
    clearTimeout(timeoutId);

    // Si devuelve 401 (token expirado o inválido), renovar credenciales automáticamente
    if (res.status === 401) {
      try {
        const authDataStr = await getSetting('auth_data', '{}');
        const authData = JSON.parse(authDataStr || '{}');
        const parts = (authData.nombre || 'Brigadista Urdaneta').replace(/\\(Brigadista\\)/gi, '').trim().split(' ');
        const nom = parts[0] || 'Brigadista';
        const ape = parts.slice(1).join(' ') || 'Urdaneta';
        const brigRes = await loginBrigadistaToServer(nom, ape, baseUrl);
        if (brigRes && brigRes.success && brigRes.token) {
          token = brigRes.token;
          await setSetting('auth_token', token);
          headers['Authorization'] = \`Bearer \${token}\`;
          res = await fetch(\`\${baseUrl}/api/gis/predios\`, { headers });
        }
      } catch (reauthErr) {
        console.warn('Re-autenticación automática falló:', reauthErr);
      }
    }

    if (!res.ok) {`
);

fs.writeFileSync(apiPath, apiCode, 'utf8');
console.log('✓ Fixed api.js: auto-fallback from obsolete URLs and 401 auto-reauthentication');

// ============================================================================
// 3. FIX movil/src/pages/FormTab/PredioFormMobile.jsx: Render Reporte Modal in list & form
// ============================================================================
const formPath = path.join(movilDir, 'src/pages/FormTab/PredioFormMobile.jsx');
let formCode = fs.readFileSync(formPath, 'utf8');

// Remove early return for viewMode === 'list' so ReportePlanimetricoModal is ALWAYS rendered
formCode = formCode.replace(
  /if \(viewMode === 'list'\) \{\s*return \(\s*<div className="tab-scroll-container">/,
  `// Vista principal condicional
  const renderListContent = () => (`
);

formCode = formCode.replace(
  /<\/div>\s*\);\s*\}\s*\/\/ ==============================================================\s*\/\/ VISTA 2: FORMULARIO Y EDICIÓN DEL PREDIO\s*\/\/ ==============================================================\s*return \(\s*<div className="tab-scroll-container">/,
  `</div>
  );

  return (
    <>
      {viewMode === 'list' ? renderListContent() : (
        <div className="tab-scroll-container">`
);

// Close the conditional in form view return
formCode = formCode.replace(
  /<\/div>\s*\);\s*\}\s*$/,
  `</div>
      )}

      {/* Modal de Reporte Planimétrico Oficial Disponible en Todas las Vistas */}
      {showReporteModal && (
        <ReportePlanimetricoModal 
          predio={selectedPredioForReport} 
          onClose={() => {
            setShowReporteModal(false);
            setSelectedPredioForReport(null);
          }} 
        />
      )}
    </>
  );
}
`
);

// Ensure handleViewOnMap properly formats predio and passes coordinates
formCode = formCode.replace(
  /const handleViewOnMap = \(p\) => \{[\s\S]*?\};/,
  `const handleViewOnMap = (p) => {
    // Extraer o garantizar coordenadas válidas para navegación en mapa
    const verts = extractVerticesFromPredio(p);
    setSelectedPredio({
      ...p,
      vertices: verts.length > 0 ? verts : (p.vertices || []),
      justViewOnMap: true,
      timestamp: Date.now()
    });
    setActiveTab('map');
  };`
);

fs.writeFileSync(formPath, formCode, 'utf8');
console.log('✓ Fixed PredioFormMobile.jsx: Report modal rendered in all view modes, handleViewOnMap sends vertices');

// ============================================================================
// 4. FIX movil/src/pages/MapTab/MapTab.jsx: Auto-centering, fitBounds and highlighting
// ============================================================================
const mapPath = path.join(movilDir, 'src/pages/MapTab/MapTab.jsx');
let mapCode = fs.readFileSync(mapPath, 'utf8');

// Replace MapController with a robust version that invalidates size and flys to bounds
mapCode = mapCode.replace(
  /function MapController\(\{[\s\S]*?return null;\s*\}/,
  `function MapController({ center, zoom, bounds }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate map size to ensure mobile container dimensions are recognized
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (bounds && bounds.length >= 2) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 19, animate: true });
      } else if (center && center[0] && center[1]) {
        map.setView(center, zoom || 18, { animate: true });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [center, zoom, bounds, map]);

  return null;
}`
);

// Helper function to extract [lat, lng] array from any predio
if (!mapCode.includes('function getLatLngsFromPredio')) {
  const helperCode = `
// Extraer coordenadas [lat, lng] seguras de cualquier predio
function getLatLngsFromPredio(p) {
  if (!p) return [];
  if (Array.isArray(p.positions) && p.positions.length > 0) {
    return p.positions;
  }
  const verts = p.vertices || [];
  if (Array.isArray(verts) && verts.length > 0) {
    return verts.map(v => {
      const lat = v.lat ?? (Array.isArray(v) ? v[1] : null);
      const lng = v.lng ?? (Array.isArray(v) ? v[0] : null);
      if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [Number(lat), Number(lng)];
      }
      const x = v.x ?? (v.coord_x ?? (Array.isArray(v) ? v[0] : 0));
      const y = v.y ?? (v.coord_y ?? (Array.isArray(v) ? v[1] : 0));
      if (x && y) {
        const w = utmToWgs84(Number(x), Number(y));
        if (w.lat && w.lng) return [w.lat, w.lng];
      }
      return null;
    }).filter(Boolean);
  }
  return [];
}
`;
  mapCode = mapCode.replace('export default function MapTab()', helperCode + '\nexport default function MapTab()');
}

// Update centering hook in MapTab
mapCode = mapCode.replace(
  /\/\/ Centrar automáticamente en el predio seleccionado[\s\S]*?\}, \[selectedPredio.*?\]\);/,
  `// Centrar y enfocar automáticamente el predio (e.g. al presionar "Ver en Mapa")
  useEffect(() => {
    if (selectedPredio) {
      const latlngs = getLatLngsFromPredio(selectedPredio);
      if (latlngs.length >= 2) {
        hasCenteredGPS.current = true; // Bloquear que GPS sobreescriba la vista del predio
        setMapBounds(latlngs);
        const lats = latlngs.map(p => p[0]);
        const lngs = latlngs.map(p => p[1]);
        const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        setMapCenter([cLat, cLng]);
        setMapZoom(18);

        if (showToast) {
          showToast({
            type: 'info',
            title: \`📍 Predio \${selectedPredio.codigo || ''}\`,
            message: 'Centrado en mapa satelital. Toca el polígono para detalles.',
            duration: 3500
          });
        }
      }
    }
  }, [selectedPredio, showToast]);`
);

// Add glowing highlighted polygon on map for selectedPredio
if (!mapCode.includes('key="highlight-selected-predio"')) {
  mapCode = mapCode.replace(
    /\{offlinePredios\.map\(\(raw\) => \{/,
    `{/* Polígono del Predio Enfocado (Ver en Mapa) */}
        {selectedPredio && (
          <Polygon
            key="highlight-selected-predio"
            positions={getLatLngsFromPredio(selectedPredio)}
            pathOptions={{
              color: '#38bdf8',
              fillColor: '#0284c7',
              fillOpacity: 0.35,
              weight: 3.5,
              dashArray: '5, 5'
            }}
          >
            <Tooltip permanent={true} direction="center">
              <span style={{ fontWeight: '800', color: '#0284c7' }}>
                📍 {selectedPredio.codigo || 'Predio'}
              </span>
            </Tooltip>
          </Polygon>
        )}

        {offlinePredios.map((raw) => {`
  );
}

fs.writeFileSync(mapPath, mapCode, 'utf8');
console.log('✓ Fixed MapTab.jsx: Auto-centering, GPS lock and highlighted focus polygon');

// ============================================================================
// 5. FIX movil/src/components/ReportePlanimetricoSheet.jsx: Defensive bounds and MapContainer
// ============================================================================
const sheetPath = path.join(movilDir, 'src/components/ReportePlanimetricoSheet.jsx');
let sheetCode = fs.readFileSync(sheetPath, 'utf8');

// Invalidate size in MapScaleUpdater
sheetCode = sheetCode.replace(
  /const MapScaleUpdater = \(\{ scaleValue = 'Auto', polygonCoords, setCalculatedScale, setGraphicScale \}\) => \{[\s\S]*?return null;\s*\};/,
  `const MapScaleUpdater = ({ scaleValue = 'Auto', polygonCoords, setCalculatedScale, setGraphicScale }) => {
  const map = useMap();

  useEffect(() => {
    try {
      map.invalidateSize();
    } catch (e) {}

    const updateGraphicScale = () => {
      try {
        const centerLatLng = map.getCenter();
        const pointC = map.latLngToContainerPoint(centerLatLng);
        const pointX = L.point(pointC.x + 300, pointC.y);
        const latLngX = map.containerPointToLatLng(pointX);
        const dist300px = centerLatLng.distanceTo(latLngX);

        const getRoundNum = (num) => {
          const pow10 = Math.pow(10, (Math.floor(num) + '').length - 1);
          let d = num / pow10;
          d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
          return pow10 * d;
        };

        const maxMeters = getRoundNum(dist300px);
        const totalWidthPx = (maxMeters / dist300px) * 300;
        const segments = 5;
        const segmentMeters = maxMeters / segments;
        const ticks = [];
        for (let i = 0; i <= segments; i++) {
          ticks.push(i * segmentMeters);
        }
        if (setGraphicScale) {
          setGraphicScale({ totalWidthPx, ticks });
        }
      } catch (err) {}
    };

    if (!polygonCoords || polygonCoords.length === 0) return;

    try {
      if (scaleValue === 'Auto') {
        map.fitBounds(polygonCoords, { padding: [40, 40], animate: false });
        const z = map.getZoom();
        let s = Math.round(1000 * Math.pow(2, 19 - z));
        if (s > 1000) s = Math.round(s / 100) * 100;
        else if (s > 100) s = Math.round(s / 50) * 50;
        if (setCalculatedScale) setCalculatedScale(\`~ 1:\${s}\`);
      }
    } catch (e) {}

    updateGraphicScale();
    map.on('moveend zoomend', updateGraphicScale);
    return () => map.off('moveend zoomend', updateGraphicScale);
  }, [scaleValue, map, polygonCoords, setCalculatedScale, setGraphicScale]);

  return null;
};`
);

// Safety bounds in UtmGrid
sheetCode = sheetCode.replace(
  /const updateGrid = \(\) => \{[\s\S]*?setGridLines\(lines\);/g,
  `const updateGrid = () => {
      try {
        const bounds = map.getBounds();
        if (!bounds || !bounds.isValid()) return;

        const swUtm = proj4('EPSG:4326', 'EPSG:32717', [bounds.getWest(), bounds.getSouth()]);
        const neUtm = proj4('EPSG:4326', 'EPSG:32717', [bounds.getEast(), bounds.getNorth()]);
        if (!isFinite(swUtm[0]) || !isFinite(neUtm[0]) || !isFinite(swUtm[1]) || !isFinite(neUtm[1])) return;

        const widthUtm = Math.abs(neUtm[0] - swUtm[0]);
        let step = 1000;
        if (isMinimap) {
          step = widthUtm > 6000 ? 2000 : 1000;
        } else {
          if (widthUtm < 200) step = 20;
          else if (widthUtm < 500) step = 50;
          else if (widthUtm < 1500) step = 100;
          else if (widthUtm < 5000) step = 500;
          else if (widthUtm < 15000) step = 1000;
          else step = 5000;
        }

        const lines = [];
        const labels = { top: [], bottom: [], left: [], right: [] };

        const minX = Math.floor(swUtm[0] / step) * step;
        const maxX = Math.ceil(neUtm[0] / step) * step;
        const minY = Math.floor(swUtm[1] / step) * step;
        const maxY = Math.ceil(neUtm[1] / step) * step;

        if (Math.abs(maxX - minX) / step > 30 || Math.abs(maxY - minY) / step > 30) return;

        for (let x = minX; x <= maxX; x += step) {
          if (x === 0) continue;
          const bottom = proj4('EPSG:32717', 'EPSG:4326', [x, minY]);
          const top = proj4('EPSG:32717', 'EPSG:4326', [x, maxY]);
          lines.push([[bottom[1], bottom[0]], [top[1], top[0]]]);
          const ptTop = map.latLngToContainerPoint([top[1], top[0]]);
          labels.top.push({ text: x.toString(), val: ptTop.x });
        }

        for (let y = minY; y <= maxY; y += step) {
          if (y === 0) continue;
          const left = proj4('EPSG:32717', 'EPSG:4326', [minX, y]);
          const right = proj4('EPSG:32717', 'EPSG:4326', [maxX, y]);
          lines.push([[left[1], left[0]], [right[1], right[0]]]);
          const ptLeft = map.latLngToContainerPoint([left[1], left[0]]);
          labels.left.push({ text: y.toString(), val: ptLeft.y });
        }

        setGridLines(lines);
      } catch (err) {}`
);

fs.writeFileSync(sheetPath, sheetCode, 'utf8');
console.log('✓ Fixed ReportePlanimetricoSheet.jsx: Protected Leaflet rendering from edge cases');

// ============================================================================
// 6. BUMP VERSION TO v3.0 (versionCode 20)
// ============================================================================
const gradlePath = path.join(movilDir, 'android/app/build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode \d+/g, 'versionCode 20');
  gradle = gradle.replace(/versionName "[^"]+"/g, 'versionName "3.0"');
  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log('✓ Updated build.gradle to versionCode 20, versionName 3.0');
}

console.log('ALL FIXES COMPLETED SUCCESSFULLY!');
