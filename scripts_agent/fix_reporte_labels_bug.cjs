const fs = require('fs');
const path = require('path');

const SHEET_PATH = path.resolve(__dirname, '../../movil/src/components/ReportePlanimetricoSheet.jsx');
const MODAL_PATH = path.resolve(__dirname, '../../movil/src/components/ReportePlanimetricoModal.jsx');
const BUILD_GRADLE_PATH = path.resolve(__dirname, '../../movil/android/app/build.gradle');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../movil/package.json');

console.log('=== CORRIGIENDO BUG labels is not defined Y ENLAZANDO CON EL REPORTE DEL GEOPORTAL ===\n');

// 1. CORREGIR ReportePlanimetricoSheet.jsx (Declarar labels fuera del try y asegurar alcance)
let sheet = fs.readFileSync(SHEET_PATH, 'utf8');

const oldUtmGrid = `const UtmGrid = ({ setMapGridLabels, isMinimap = false }) => {
  const map = useMap();
  const [gridLines, setGridLines] = useState([]);

  useEffect(() => {
    const updateGrid = () => {
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
      } catch (err) {}
      if (setMapGridLabels) setMapGridLabels(labels);
    };

    updateGrid();
    map.on('moveend zoomend', updateGrid);
    return () => map.off('moveend zoomend', updateGrid);
  }, [map, setMapGridLabels, isMinimap]);`;

const newUtmGrid = `const UtmGrid = ({ setMapGridLabels, isMinimap = false }) => {
  const map = useMap();
  const [gridLines, setGridLines] = useState([]);

  useEffect(() => {
    const updateGrid = () => {
      let labels = { top: [], bottom: [], left: [], right: [] };
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

        const minX = Math.floor(swUtm[0] / step) * step;
        const maxX = Math.ceil(neUtm[0] / step) * step;
        const minY = Math.floor(swUtm[1] / step) * step;
        const maxY = Math.ceil(neUtm[1] / step) * step;

        if (Math.abs(maxX - minX) / step <= 30 && Math.abs(maxY - minY) / step <= 30) {
          for (let x = minX; x <= maxX; x += step) {
            if (x === 0) continue;
            const bottom = proj4('EPSG:32717', 'EPSG:4326', [x, minY]);
            const top = proj4('EPSG:32717', 'EPSG:4326', [x, maxY]);
            lines.push([[bottom[1], bottom[0]], [top[1], top[0]]]);
            const ptTop = map.latLngToContainerPoint([top[1], top[0]]);
            labels.top.push({ text: x.toString(), val: ptTop.x });
            const ptBottom = map.latLngToContainerPoint([bottom[1], bottom[0]]);
            labels.bottom.push({ text: x.toString(), val: ptBottom.x });
          }

          for (let y = minY; y <= maxY; y += step) {
            if (y === 0) continue;
            const left = proj4('EPSG:32717', 'EPSG:4326', [minX, y]);
            const right = proj4('EPSG:32717', 'EPSG:4326', [maxX, y]);
            lines.push([[left[1], left[0]], [right[1], right[0]]]);
            const ptLeft = map.latLngToContainerPoint([left[1], left[0]]);
            labels.left.push({ text: y.toString(), val: ptLeft.y });
            const ptRight = map.latLngToContainerPoint([right[1], right[0]]);
            labels.right.push({ text: y.toString(), val: ptRight.y });
          }

          setGridLines(lines);
        }
      } catch (err) {
        console.warn('Grid error:', err);
      }
      if (setMapGridLabels) setMapGridLabels(labels);
    };

    updateGrid();
    map.on('moveend zoomend', updateGrid);
    return () => map.off('moveend zoomend', updateGrid);
  }, [map, setMapGridLabels, isMinimap]);`;

if (sheet.includes(oldUtmGrid)) {
  sheet = sheet.replace(oldUtmGrid, newUtmGrid);
  fs.writeFileSync(SHEET_PATH, sheet, 'utf8');
  console.log('✓ UtmGrid corregido: labels declarado fuera del bloque try con soporte top/bottom/left/right.');
} else {
  // Regex fallback
  const regex = /const UtmGrid =[\s\S]*?return \(\)\s*=>\s*map\.off\('moveend zoomend', updateGrid\);\s*\}, \[map, setMapGridLabels, isMinimap\]\);/;
  if (regex.test(sheet)) {
    sheet = sheet.replace(regex, newUtmGrid);
    fs.writeFileSync(SHEET_PATH, sheet, 'utf8');
    console.log('✓ UtmGrid corregido por regex.');
  }
}

// 2. ACTUALIZAR ReportePlanimetricoModal.jsx (Añadir botón "Abrir en Geoportal Oficial" para sincronización total con la ventana web)
let modal = fs.readFileSync(MODAL_PATH, 'utf8');
if (!modal.includes('handleOpenGeoportalReport')) {
  // Insertar función para abrir en el visor del geoportal
  const insertFuncMarker = 'const handlePrint = () => {';
  const newFuncCode = `// Abrir el mismo reporte directamente en la ventana web del Geoportal Oficial
  const handleOpenGeoportalReport = () => {
    const cod = predio.codigo || predio.clave_catastral || predio.id;
    if (!cod) return;
    const url = \`https://geoportal-frontend-3zti.onrender.com/reporte/planimetrico/codigo/\${encodeURIComponent(cod)}\`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {`;
  modal = modal.replace(insertFuncMarker, newFuncCode);

  // Añadir botón en la barra superior del modal
  const toolbarMarker = `<button 
            type="button" 
            className="btn-report-tool btn-print"
            onClick={handlePrint}
            title="Imprimir Láminas Oficiales"
          >
            <Printer size={15} />
            <span>Imprimir</span>
          </button>`;

  const newToolbarCode = `<button 
            type="button" 
            className="btn-report-tool btn-print"
            onClick={handlePrint}
            title="Imprimir Láminas Oficiales"
          >
            <Printer size={15} />
            <span>Imprimir</span>
          </button>

          <button 
            type="button" 
            className="btn-report-tool"
            onClick={handleOpenGeoportalReport}
            style={{ background: '#7c3aed', color: '#ffffff', border: 'none' }}
            title="Abrir este mismo reporte en la web del Geoportal"
          >
            <Share2 size={15} />
            <span>Geoportal Web</span>
          </button>`;

  modal = modal.replace(toolbarMarker, newToolbarCode);
  fs.writeFileSync(MODAL_PATH, modal, 'utf8');
  console.log('✓ Botón "Geoportal Web" integrado en la barra de herramientas del Reporte Planimétrico.');
}

// 3. INCREMENTAR A v3.9 (versionCode 29)
let buildGradle = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, 'versionCode 29');
buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, 'versionName "3.9"');
fs.writeFileSync(BUILD_GRADLE_PATH, buildGradle, 'utf8');

let pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
pkg.version = "3.9.0";
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2), 'utf8');

console.log('✓ Versión actualizada a v3.9 (versionCode 29).');
console.log('\n=== LISTO PARA COMPILAR VITE Y APK NATIVO ===');
