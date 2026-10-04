const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const movilRoot = path.join(repoRoot, 'movil');
const frontendRoot = path.join(repoRoot, 'frontend');

console.log('Repo Root:', repoRoot);
console.log('Movil Root:', movilRoot);
console.log('Frontend Root:', frontendRoot);

// ============================================================================
// 1. UPDATE movil/src/pages/Login/LoginMobile.jsx
// ============================================================================
const loginPath = path.join(movilRoot, 'src', 'pages', 'Login', 'LoginMobile.jsx');
if (fs.existsSync(loginPath)) {
  let content = fs.readFileSync(loginPath, 'utf8');

  // Fix white text on white background
  content = content.replace(
    /<h1 style=\{\{ fontSize: '20px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px', margin: 0 \}\}>\s*Catastro Móvil 2026\s*<\/h1>/g,
    `<h1 style={{ fontSize: '21px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.4px', margin: 0 }}>
            Catastro Móvil 2026
          </h1>
          <div style={{ display: 'inline-block', margin: '4px auto 0', padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', fontSize: '10.5px', fontWeight: '800' }}>
            v4.7.0 · Campo Oficial
          </div>`
  );

  // Fix accent-cyan
  content = content.replace(/var\(--accent-cyan\)/g, '#0284c7');

  // Fix dark background in SweetAlert
  content = content.replace(/background: '#131d33',/g, "background: '#ffffff',");

  fs.writeFileSync(loginPath, content, 'utf8');
  console.log('✓ Updated movil/src/pages/Login/LoginMobile.jsx');
}

// ============================================================================
// 2. UPDATE movil/src/components/MobileHeader.jsx
// ============================================================================
const headerPath = path.join(movilRoot, 'src', 'components', 'MobileHeader.jsx');
if (fs.existsSync(headerPath)) {
  let content = fs.readFileSync(headerPath, 'utf8');

  // Add prominent version badge next to title
  if (!content.includes('v4.7.0')) {
    content = content.replace(
      /<h1>Catastro Móvil<\/h1>/g,
      `<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1>Catastro Móvil</h1>
              <span style={{ background: '#0284c7', color: '#ffffff', fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '999px', letterSpacing: '0.2px' }}>v4.7.0</span>
            </div>`
    );
  }

  // Fix white text on white card in project modal
  content = content.replace(/color:#ffffff !important;/g, 'color:#0f172a !important;');

  fs.writeFileSync(headerPath, content, 'utf8');
  console.log('✓ Updated movil/src/components/MobileHeader.jsx');
}

// ============================================================================
// 3. UPDATE movil/src/pages/MapTab/MapTab.jsx
// ============================================================================
const mapTabPath = path.join(movilRoot, 'src', 'pages', 'MapTab', 'MapTab.jsx');
if (fs.existsSync(mapTabPath)) {
  let content = fs.readFileSync(mapTabPath, 'utf8');

  // A) Fix createSegmentMeasureIcon to have real hitbox [60, 24] and clear styling
  const oldIconRegex = /const createSegmentMeasureIcon = [\s\S]*?iconAnchor: \[0, 0\]\s*\}\);[\s\S]*?\};/;
  const newIconCode = `const createSegmentMeasureIcon = (distMeters, angle = 0, strokeColor = '#8b5cf6') => {
  const safeText = distMeters < 1000 
    ? \`\${distMeters.toFixed(1)} m\` 
    : \`\${(distMeters / 1000).toFixed(2)} km\`;
  return L.divIcon({
    className: 'segment-measure-badge-wrapper',
    html: \`
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 24px;
        transform: rotate(\${angle}deg);
        cursor: pointer;
        pointer-events: auto;
      ">
        <div style="
          background: #ffffff;
          color: #0f172a;
          border: 1.5px solid \${strokeColor};
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          pointer-events: auto;
        " title="Medida del tramo. Toca para insertar punto en esta línea">
          \${safeText}
        </div>
      </div>
    \`,
    iconSize: [60, 24],
    iconAnchor: [30, 12]
  });
};`;

  content = content.replace(oldIconRegex, newIconCode);

  // B) Ensure mapInstanceRef is always kept in MapTab
  if (!content.includes('const mapInstanceRef = useRef(null);')) {
    content = content.replace(
      /const hasCenteredGPS = useRef\(false\);/g,
      `const hasCenteredGPS = useRef(false);\n  const mapInstanceRef = useRef(null);`
    );
  }

  // C) Ensure MapDrawingEvents stores map in mapInstanceRef and passes map to onMapClick
  content = content.replace(
    /function MapDrawingEvents\(\{ isManualDrawing, onMapClick \}\) \{[\s\S]*?useMapEvents\(\{[\s\S]*?click\(e\) \{[\s\S]*?\}\s*\}\);\s*return null;\s*\}/,
    `function MapDrawingEvents({ isManualDrawing, onMapClick, onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (isManualDrawing) {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [isManualDrawing, map]);

  useMapEvents({
    click(e) {
      if (isManualDrawing) {
        onMapClick(e.latlng, map);
      }
    }
  });

  return null;
}`
  );

  // D) Update MapDrawingEvents usage in JSX
  content = content.replace(
    /<MapDrawingEvents isManualDrawing=\{isManualDrawing\} onMapClick=\{handleMapClick\} \/>/g,
    `<MapDrawingEvents isManualDrawing={isManualDrawing} onMapClick={handleMapClick} onMapReady={(m) => { mapInstanceRef.current = m; }} />`
  );

  // E) Ensure handleMapClick always falls back to mapInstanceRef.current if mapInstance is missing
  content = content.replace(
    /const handleMapClick = \(latlng, mapInstance\) => \{/g,
    `const handleMapClick = (latlng, mapInstanceParam) => {
    const mapInstance = mapInstanceParam || mapInstanceRef.current;`
  );

  // F) Ensure SweetAlert in vertex delete always has consistent white theme
  content = content.replace(
    /background: '#ffffff',\s*color: '#0f172a',\s*backdrop: 'rgba\(255, 255, 255, 0\.72\)'/g,
    `background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b'`
  );

  fs.writeFileSync(mapTabPath, content, 'utf8');
  console.log('✓ Updated movil/src/pages/MapTab/MapTab.jsx');
}

// ============================================================================
// 4. UPDATE movil/android/app/src/main/java/.../MainActivity.java
// ============================================================================
const mainActivityPath = path.join(movilRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'gad', 'catastromovil', 'MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  let content = fs.readFileSync(mainActivityPath, 'utf8');

  // Fix onCreate lifecycle order (super.onCreate first)
  content = content.replace(
    /@Override\s*public void onCreate\(Bundle savedInstanceState\) \{\s*\/\/ Purgar carpetas[\s\S]*?super\.onCreate\(savedInstanceState\);/g,
    `@Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        purgeStaleCacheDirectories();`
  );

  // Use LOAD_DEFAULT instead of LOAD_NO_CACHE to ensure Capacitor asset loader streams smoothly
  content = content.replace(
    /webSettings\.setCacheMode\(WebSettings\.LOAD_NO_CACHE\);/g,
    `webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);`
  );
  content = content.replace(
    /swController\.getServiceWorkerWebSettings\(\)\.setCacheMode\(WebSettings\.LOAD_NO_CACHE\);/g,
    `swController.getServiceWorkerWebSettings().setCacheMode(WebSettings.LOAD_DEFAULT);`
  );

  fs.writeFileSync(mainActivityPath, content, 'utf8');
  console.log('✓ Updated MainActivity.java');
}

// ============================================================================
// 5. UPDATE movil/android/app/build.gradle
// ============================================================================
const gradlePath = path.join(movilRoot, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/versionCode\s+\d+/g, 'versionCode 40');
  content = content.replace(/versionName\s+"[^"]+"/g, 'versionName "4.7.0"');
  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log('✓ Updated movil/android/app/build.gradle (versionCode 40, versionName 4.7.0)');
}

// ============================================================================
// 6. UPDATE movil/package.json
// ============================================================================
const movilPkgPath = path.join(movilRoot, 'package.json');
if (fs.existsSync(movilPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(movilPkgPath, 'utf8'));
  pkg.version = '4.7.0';
  fs.writeFileSync(movilPkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  console.log('✓ Updated movil/package.json to version 4.7.0');
}

// ============================================================================
// 7. UPDATE movil/build_apk.js
// ============================================================================
const buildApkPath = path.join(movilRoot, 'build_apk.js');
if (fs.existsSync(buildApkPath)) {
  let content = fs.readFileSync(buildApkPath, 'utf8');

  // Ensure npm run build is always run BEFORE sync
  if (!content.includes("execSync('npm run build'")) {
    content = content.replace(
      /console\.log\('1\. Sincronizando assets web compilados con Capacitor\.\.\.'\);/g,
      `console.log('0. Compilando bundle web moderno de producción (npm run build)...');
execSync('npm run build', { cwd: movilRoot, stdio: 'inherit', shell: true });

console.log('1. Sincronizando assets web compilados con Capacitor...');`
    );
  }

  // Ensure clean build in assembleDebug
  content = content.replace(
    /execSync\('\.\\gradlew\.bat assembleDebug --no-daemon'/g,
    `execSync('.\\\\gradlew.bat clean assembleDebug --no-daemon'`
  );

  fs.writeFileSync(buildApkPath, content, 'utf8');
  console.log('✓ Updated movil/build_apk.js with clean compilation pipeline');
}

console.log('\n=== ALL UPDATES APPLIED TO MOVIL SUCCESSFULLY ===');
