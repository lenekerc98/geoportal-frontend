const fs = require('fs');
const path = require('path');

const MAP_TAB_PATH = path.resolve(__dirname, '../../movil/src/pages/MapTab/MapTab.jsx');
const DRAWING_TOOLBAR_PATH = path.resolve(__dirname, '../../movil/src/components/DrawingToolbarMobile.jsx');
const BUILD_GRADLE_PATH = path.resolve(__dirname, '../../movil/android/app/build.gradle');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../movil/package.json');

console.log('=== CORRIGIENDO isVertexBarCollapsed Y OPTIMIZANDO CARGA RASTER ===\n');

// 1. CORREGIR MapTab.jsx
let mapTab = fs.readFileSync(MAP_TAB_PATH, 'utf8');

// A) Insertar const [isVertexBarCollapsed, setIsVertexBarCollapsed] = useState(false);
if (!mapTab.includes('const [isVertexBarCollapsed, setIsVertexBarCollapsed]')) {
  mapTab = mapTab.replace(
    'const [mapBounds, setMapBounds] = useState(null);',
    'const [mapBounds, setMapBounds] = useState(null);\n  const [isVertexBarCollapsed, setIsVertexBarCollapsed] = useState(false);'
  );
  console.log('✓ useState isVertexBarCollapsed añadido correctamente en MapTab.');
}

// B) Reemplazar getTileUrl con getTileConfig optimizado (Google Hybrid por defecto + Esri con maxNativeZoom 18)
const oldGetTileRegex = /\/\/ URL de la capa base seleccionada[\s\S]*?const getTileUrl = \(\) => \{[\s\S]*?return 'https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png';\s*\};/;

const newTileConfigCode = `// Configuración de la capa base optimizada con subdominios y sobre-zoom para evitar pantallas blancas
  const getTileConfig = () => {
    // 1. Google Híbrido (Satélite HD + Nombres de vías): Carga ultra-rápida en conexiones móviles 3G/4G
    if (activeBaseMap === 'satellite' || activeBaseMap === 'google' || activeBaseMap === 'google-hybrid') {
      return {
        url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxNativeZoom: 20,
        maxZoom: 22,
        attribution: '&copy; Google Maps'
      };
    }
    // 2. Esri World Imagery: Con maxNativeZoom 18 para evitar pantallas blancas o 404s en zoom profundo
    if (activeBaseMap === 'esri') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        subdomains: ['server', 'services'],
        maxNativeZoom: 18,
        maxZoom: 22,
        attribution: 'Tiles &copy; Esri'
      };
    }
    // 3. Carto Dark
    if (activeBaseMap === 'dark') {
      return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: 'abcd',
        maxNativeZoom: 19,
        maxZoom: 22,
        attribution: '&copy; CARTO'
      };
    }
    // 4. OpenStreetMap estándar
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: 'abc',
      maxNativeZoom: 19,
      maxZoom: 22,
      attribution: '&copy; OpenStreetMap'
    };
  };`;

if (oldGetTileRegex.test(mapTab)) {
  mapTab = mapTab.replace(oldGetTileRegex, newTileConfigCode);
  console.log('✓ getTileConfig optimizado implementado.');
} else {
  // Búsqueda alternativa
  const altIndex = mapTab.indexOf('const getTileUrl = () => {');
  if (altIndex !== -1) {
    const endFn = mapTab.indexOf('};', altIndex);
    mapTab = mapTab.substring(0, altIndex) + newTileConfigCode + mapTab.substring(endFn + 2);
    console.log('✓ getTileUrl reemplazado con getTileConfig.');
  }
}

// C) Actualizar <TileLayer> en el JSX de MapTab
const oldTileLayerRegex = /<TileLayer\s+url=\{getTileUrl\(\)\}\s+maxZoom=\{19\}\s*\/>/;
const newTileLayerCode = `{(() => {
          const cfg = getTileConfig();
          return (
            <TileLayer
              key={\`tile-\${activeBaseMap}\`}
              url={cfg.url}
              subdomains={cfg.subdomains || 'abc'}
              maxNativeZoom={cfg.maxNativeZoom || 18}
              maxZoom={cfg.maxZoom || 22}
              keepBuffer={4}
              updateWhenZooming={false}
              updateWhenIdle={true}
              attribution={cfg.attribution}
            />
          );
        })()}`;

if (oldTileLayerRegex.test(mapTab)) {
  mapTab = mapTab.replace(oldTileLayerRegex, newTileLayerCode);
  console.log('✓ <TileLayer> actualizado con key dinámica, subdominios paralelos y maxNativeZoom.');
}

fs.writeFileSync(MAP_TAB_PATH, mapTab, 'utf8');
console.log('✓ MapTab.jsx guardado exitosamente.');


// 2. ACTUALIZAR DrawingToolbarMobile.jsx para soporte de capas
let toolbar = fs.readFileSync(DRAWING_TOOLBAR_PATH, 'utf8');
const oldCycleRegex = /const handleCycleBaseMap = \(\) => \{[\s\S]*?else setActiveBaseMap\('satellite'\);\s*\};/;
const newCycleCode = `const handleCycleBaseMap = () => {
    if (activeBaseMap === 'satellite' || activeBaseMap === 'google' || activeBaseMap === 'google-hybrid') {
      setActiveBaseMap('esri');
      if (showToast) showToast({ type: 'info', title: 'Capa Satelital', message: 'Cambiado a Esri World Imagery', duration: 2000 });
    } else if (activeBaseMap === 'esri') {
      setActiveBaseMap('osm');
      if (showToast) showToast({ type: 'info', title: 'Capa Callejero', message: 'Cambiado a OpenStreetMap', duration: 2000 });
    } else {
      setActiveBaseMap('satellite');
      if (showToast) showToast({ type: 'info', title: 'Capa Satelital HD', message: 'Cambiado a Google Satélite Híbrido (Rápido)', duration: 2000 });
    }
  };`;

if (oldCycleRegex.test(toolbar)) {
  toolbar = toolbar.replace(oldCycleRegex, newCycleCode);
  fs.writeFileSync(DRAWING_TOOLBAR_PATH, toolbar, 'utf8');
  console.log('✓ DrawingToolbarMobile.jsx actualizado con selector de capas de alta velocidad.');
}


// 3. ACTUALIZAR build.gradle a versionCode 27, versionName "3.7"
let buildGradle = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, 'versionCode 27');
buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, 'versionName "3.7"');
fs.writeFileSync(BUILD_GRADLE_PATH, buildGradle, 'utf8');

let pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
pkg.version = "3.7.0";
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2), 'utf8');

console.log('✓ Versión actualizada a v3.7 (versionCode 27).');

console.log('\n=== LISTO PARA COMPILAR VITE Y APK NATIVO ===');
