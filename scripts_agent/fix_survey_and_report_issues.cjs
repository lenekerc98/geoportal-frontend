const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '../../movil');

console.log('--- APLICANDO CORRECCIONES PARA LEVANTAMIENTO Y REPORTE PLANIMÉTRICO ---');

// 1. Crear ErrorBoundary.jsx en movil/src/components/ErrorBoundary.jsx
const errorBoundaryPath = path.join(movilDir, 'src/components/ErrorBoundary.jsx');
const errorBoundaryContent = `import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '220px',
          padding: '24px 16px',
          margin: '16px auto',
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1.5px solid #fecaca',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          color: '#0f172a'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <AlertTriangle size={26} />
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 6px 0', color: '#991b1b' }}>
            {this.props.title || 'Inconveniente al cargar esta sección'}
          </h3>

          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', lineHeight: '1.4' }}>
            {this.state.error?.message || 'Se produjo un error al procesar las coordenadas o datos de este predio.'}
          </p>

          <button
            type="button"
            onClick={this.handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2,132,199,0.3)'
            }}
          >
            <RefreshCw size={15} /> Reintentar / Volver
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
`;
fs.writeFileSync(errorBoundaryPath, errorBoundaryContent, 'utf8');
console.log('1. Creado ErrorBoundary.jsx exitosamente.');

// 2. Actualizar App.jsx con ErrorBoundary
const appJsxPath = path.join(movilDir, 'src/App.jsx');
let appJsx = fs.readFileSync(appJsxPath, 'utf8');
if (!appJsx.includes('ErrorBoundary')) {
  appJsx = appJsx.replace(
    "import SwipeableToast from './components/SwipeableToast';",
    "import SwipeableToast from './components/SwipeableToast';\nimport ErrorBoundary from './components/ErrorBoundary';"
  );
  appJsx = appJsx.replace(
    '<main className="main-content" style={{ position: \'relative\', width: \'100%\', height: \'100%\', overflow: \'hidden\' }}>\n        <div style={{ display: activeTab === \'map\' ? \'block\' : \'none\', height: \'100%\', width: \'100%\' }}>\n          <MapTab />\n        </div>\n        {activeTab === \'form\' && <PredioFormMobile />}\n        {activeTab === \'sync\' && <SyncCenterMobile />}\n        {activeTab === \'settings\' && <SettingsMobile />}\n      </main>',
    `<main className="main-content" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        <ErrorBoundary title="Error en visualización">
          <div style={{ display: activeTab === 'map' ? 'block' : 'none', height: '100%', width: '100%' }}>
            <MapTab />
          </div>
          {activeTab === 'form' && <PredioFormMobile />}
          {activeTab === 'sync' && <SyncCenterMobile />}
          {activeTab === 'settings' && <SettingsMobile />}
        </ErrorBoundary>
      </main>`
  );
  fs.writeFileSync(appJsxPath, appJsx, 'utf8');
  console.log('2. App.jsx actualizado con ErrorBoundary.');
} else {
  console.log('2. App.jsx ya contenía ErrorBoundary.');
}

// 3. Actualizar PredioFormMobile.jsx
const predioFormPath = path.join(movilDir, 'src/pages/FormTab/PredioFormMobile.jsx');
let predioForm = fs.readFileSync(predioFormPath, 'utf8');

// Añadir import de ErrorBoundary si no está
if (!predioForm.includes('import ErrorBoundary')) {
  predioForm = predioForm.replace(
    "import ReportePlanimetricoModal from '../../components/ReportePlanimetricoModal';",
    "import ReportePlanimetricoModal from '../../components/ReportePlanimetricoModal';\nimport ErrorBoundary from '../../components/ErrorBoundary';"
  );
}

// Añadir handleOpenReport
if (!predioForm.includes('const handleOpenReport =')) {
  const handleOpenReportCode = `
  // Abrir reporte planimétrico oficial para un predio con validación estricta
  const handleOpenReport = (p) => {
    try {
      if (!p) return;
      const verts = extractVerticesFromPredio(p);
      if (!verts || verts.length < 3) {
        Swal.fire({
          icon: 'info',
          title: 'Vértices Insuficientes',
          text: 'Este predio aún no cuenta con al menos 3 vértices para generar el plano cartográfico oficial.',
          confirmButtonColor: '#0284c7',
          background: '#ffffff',
          color: '#0f172a'
        });
        return;
      }
      const cod = p.codigo || p.clave_catastral || p.properties?.cod_catastral || 'S/C';
      const prop = p.propietario || p.nombre_posesionario || p.properties?.nombre_posesionario || 'Sin Propietario';
      const ced = p.cedula || p.properties?.cedula || '';
      const areaVal = Number(p.area) || (p.properties?.area_ha ? Number(p.properties.area_ha) * 10000 : 0);
      const perimVal = Number(p.perimetro) || 0;
      setSelectedPredioForReport({
        ...p,
        id: p.id || p.properties?.id || p.offline_id,
        codigo: cod,
        propietario: prop,
        cedula: ced,
        area: areaVal,
        perimetro: perimVal,
        vertices: verts
      });
      setShowReporteModal(true);
    } catch (e) {
      console.error('Error al preparar reporte:', e);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo abrir el reporte planimétrico.',
        confirmButtonColor: '#0284c7',
        background: '#ffffff',
        color: '#0f172a'
      });
    }
  };
`;
  // Insertar antes de handleEditFromList o tras él
  predioForm = predioForm.replace(
    'setViewMode(\'form\');\n  };',
    'setViewMode(\'form\');\n  };\n' + handleOpenReportCode
  );
  console.log('3.1 handleOpenReport agregado a PredioFormMobile.jsx.');
}

// Proteger botón de Reporte en el formulario
const oldFormReportBtn = `onClick={() => {
            const currentObj = {
              codigo,
              propietario,
              cedula,
              telefono,
              norte,
              sur,
              este,
              oeste,
              observaciones,
              vertices,
              area: areaCalc,
              perimetro: perimCalc
            };
            setSelectedPredioForReport(currentObj);
            setShowReporteModal(true);
          }}`;

const newFormReportBtn = `onClick={() => {
            if (!vertices || vertices.length < 3) {
              Swal.fire({
                icon: 'info',
                title: 'Vértices Insuficientes',
                text: 'Ingresa al menos 3 vértices (P01, P02, P03...) para poder generar el reporte planimétrico oficial.',
                confirmButtonColor: '#0284c7',
                background: '#ffffff',
                color: '#0f172a'
              });
              return;
            }
            const currentObj = {
              id: offlineId,
              codigo: codigo || 'BORRADOR',
              propietario: propietario || 'Sin Propietario',
              cedula: cedula || '',
              telefono,
              norte,
              sur,
              este,
              oeste,
              observaciones,
              vertices,
              area: areaCalc,
              perimetro: perimCalc
            };
            setSelectedPredioForReport(currentObj);
            setShowReporteModal(true);
          }}`;

if (predioForm.includes(oldFormReportBtn)) {
  predioForm = predioForm.replace(oldFormReportBtn, newFormReportBtn);
  console.log('3.2 Botón de reporte en formulario protegido con validación de vértices.');
}

// Quitar renderizado duplicado de ReportePlanimetricoModal al final de PredioFormMobile
const oldModals = `      {/* Modal de Reporte Planimétrico Oficial */}
      {showReporteModal && (
        <ReportePlanimetricoModal 
          predio={selectedPredioForReport} 
          onClose={() => {
            setShowReporteModal(false);
            setSelectedPredioForReport(null);
          }} 
        />
      )}
    </div>
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
      )}`;

const singleModal = `    </div>
      )}

      {/* Modal de Reporte Planimétrico Oficial Disponible en Todas las Vistas con ErrorBoundary */}
      {showReporteModal && (
        <ErrorBoundary title="Error en Reporte Planimétrico" onReset={() => setShowReporteModal(false)}>
          <ReportePlanimetricoModal 
            predio={selectedPredioForReport} 
            onClose={() => {
              setShowReporteModal(false);
              setSelectedPredioForReport(null);
            }} 
          />
        </ErrorBoundary>
      )}`;

if (predioForm.includes(oldModals)) {
  predioForm = predioForm.replace(oldModals, singleModal);
  console.log('3.3 Eliminado modal duplicado y envuelto en ErrorBoundary.');
}

fs.writeFileSync(predioFormPath, predioForm, 'utf8');

// 4. Actualizar PredioBottomSheet.jsx
const bottomSheetPath = path.join(movilDir, 'src/components/PredioBottomSheet.jsx');
let bottomSheet = fs.readFileSync(bottomSheetPath, 'utf8');

if (!bottomSheet.includes('import ErrorBoundary')) {
  bottomSheet = bottomSheet.replace(
    "import ReportePlanimetricoModal from './ReportePlanimetricoModal';",
    "import ReportePlanimetricoModal from './ReportePlanimetricoModal';\nimport ErrorBoundary from './ErrorBoundary';"
  );
}

// Validación de vértices al tocar "Ver Reporte Planimétrico Oficial"
const oldBsReportBtn = `        {/* Botón Ver Reporte Planimétrico Oficial */}
        <button
          onClick={() => setShowReporte(true)}`;

const newBsReportBtn = `        {/* Botón Ver Reporte Planimétrico Oficial con Validación */}
        <button
          onClick={() => {
            const verts = extractVerticesFromPredio(predio);
            if (!verts || verts.length < 3) {
              Swal.fire({
                icon: 'info',
                title: 'Vértices Insuficientes',
                text: 'Este predio aún no cuenta con al menos 3 vértices para generar el plano cartográfico oficial.',
                confirmButtonColor: '#0284c7',
                background: '#ffffff',
                color: '#0f172a'
              });
              return;
            }
            setShowReporte(true);
          }}`;

if (bottomSheet.includes(oldBsReportBtn)) {
  bottomSheet = bottomSheet.replace(oldBsReportBtn, newBsReportBtn);
  console.log('4.1 Botón de reporte en PredioBottomSheet protegido.');
}

// Envolver modal en ErrorBoundary
const oldBsModal = `{showReporte && (
        <ReportePlanimetricoModal 
          predio={predio} 
          onClose={() => setShowReporte(false)} 
        />
      )}`;

const newBsModal = `{showReporte && (
        <ErrorBoundary title="Error en Reporte Planimétrico" onReset={() => setShowReporte(false)}>
          <ReportePlanimetricoModal 
            predio={predio} 
            onClose={() => setShowReporte(false)} 
          />
        </ErrorBoundary>
      )}`;

if (bottomSheet.includes(oldBsModal)) {
  bottomSheet = bottomSheet.replace(oldBsModal, newBsModal);
  console.log('4.2 Modal en PredioBottomSheet envuelto en ErrorBoundary.');
}

fs.writeFileSync(bottomSheetPath, bottomSheet, 'utf8');

// 5. Actualizar ReportePlanimetricoModal.jsx
const modalPath = path.join(movilDir, 'src/components/ReportePlanimetricoModal.jsx');
let modalContent = fs.readFileSync(modalPath, 'utf8');

if (!modalContent.includes('import ErrorBoundary')) {
  modalContent = modalContent.replace(
    "import ReportePlanimetricoSheet from './ReportePlanimetricoSheet';",
    "import ReportePlanimetricoSheet from './ReportePlanimetricoSheet';\nimport ErrorBoundary from './ErrorBoundary';"
  );
}

const oldModalSheet = `<ReportePlanimetricoSheet
            predio={predio}
            rawVertices={predio.vertices || []}
            sheetToShow={activeSheet}
          />`;

const newModalSheet = `<ErrorBoundary title="Error al renderizar la lámina del reporte" onReset={onClose}>
            <ReportePlanimetricoSheet
              predio={predio}
              rawVertices={predio.vertices || []}
              sheetToShow={activeSheet}
            />
          </ErrorBoundary>`;

if (modalContent.includes(oldModalSheet)) {
  modalContent = modalContent.replace(oldModalSheet, newModalSheet);
  fs.writeFileSync(modalPath, modalContent, 'utf8');
  console.log('5. ReportePlanimetricoModal envuelto en ErrorBoundary.');
}

// 6. Actualizar ReportePlanimetricoSheet.jsx con protecciones completas
const sheetPath = path.join(movilDir, 'src/components/ReportePlanimetricoSheet.jsx');
let sheetContent = fs.readFileSync(sheetPath, 'utf8');

// Corrección de interpolaciones literales ${...} a {...} en el JSX
sheetContent = sheetContent
  .replace(/<div>\$\{institucionNombre\}<\/div>/g, '<div>{institucionNombre}</div>')
  .replace(/<b>\$\{predio\?\.propietario \|\| predio\?\.nombre_posesionario \|\| 'SIN NOMBRE'\}<\/b>/g, "<b>{predio?.propietario || predio?.nombre_posesionario || 'SIN NOMBRE'}</b>")
  .replace(/C\.C\.: \$\{predio\?\.cedula \|\| 'S\/D'\}/g, "C.C.: {predio?.cedula || 'S/D'}")
  .replace(/<div className="box-content" style=\{\{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px' \}\}>\s*\$\{predio\?\.codigo \|\| predio\?\.cod_catastral \|\| 'S\/D'\}\s*<\/div>/g, `<div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>{predio?.codigo || predio?.cod_catastral || 'S/D'}</div>`)
  .replace(/\$\{dpaProvincia\}/g, '{dpaProvincia}')
  .replace(/\$\{dpaCanton\}/g, '{dpaCanton}')
  .replace(/\$\{dpaParroquia\}/g, '{dpaParroquia}')
  .replace(/\$\{dpaSector\}/g, '{dpaSector}')
  .replace(/\$\{predio\?\.nombre_predio \|\| predio\?\.nombre \|\| 'SIN NOMBRE'\}/g, "{predio?.nombre_predio || predio?.nombre || 'SIN NOMBRE'}")
  .replace(/\$\{directorNombre\}/g, '{directorNombre}')
  .replace(/\$\{predio\.propietario \|\| predio\.nombre_posesionario \|\| 'SIN NOMBRE'\}/g, "{predio?.propietario || predio?.nombre_posesionario || 'SIN NOMBRE'}")
  .replace(/\$\{predio\.cedula \|\| 'S\/D'\}/g, "{predio?.cedula || 'S/D'}")
  .replace(/\$\{predio\?\.codigo \|\| predio\?\.cod_catastral \|\| 'S\/D'\}/g, "{predio?.codigo || predio?.cod_catastral || 'S/D'}")
  .replace(/<td style=\{\{ fontWeight: 'bold' \}\}>\$\{currentCode\}<\/td>/g, "<td style={{ fontWeight: 'bold' }}>{currentCode}</td>")
  .replace(/<td style=\{\{ fontFamily: 'monospace' \}\}>\$\{v\.coord_x \? Number\(v\.coord_x\)\.toFixed\(2\) : '-'\}<\/td>/g, "<td style={{ fontFamily: 'monospace' }}>{v.coord_x ? Number(v.coord_x).toFixed(2) : '-'}</td>")
  .replace(/<td style=\{\{ fontFamily: 'monospace' \}\}>\$\{v\.coord_y \? Number\(v\.coord_y\)\.toFixed\(2\) : '-'\}<\/td>/g, "<td style={{ fontFamily: 'monospace' }}>{v.coord_y ? Number(v.coord_y).toFixed(2) : '-'}</td>")
  .replace(/<td style=\{\{ fontWeight: '600' \}\}>\$\{desdeHasta\}<\/td>/g, "<td style={{ fontWeight: '600' }}>{desdeHasta}</td>")
  .replace(/<td style=\{\{ fontFamily: 'monospace' \}\}>\$\{l\.longitud \? Number\(l\.longitud\)\.toFixed\(2\) : '-'\}<\/td>/g, "<td style={{ fontFamily: 'monospace' }}>{l.longitud ? Number(l.longitud).toFixed(2) : '-'}</td>")
  .replace(/<td style=\{\{ fontSize: '8px' \}\}>\$\{l\.rumbo \|\| '-'\}<\/td>/g, "<td style={{ fontSize: '8px' }}>{l.rumbo || '-'}</td>")
  .replace(/<td style=\{\{ fontSize: '8px', textAlign: 'left', paddingLeft: '4px' \}\}>\$\{l\.colindante \|\| '-'\}<\/td>/g, "<td style={{ fontSize: '8px', textAlign: 'left', paddingLeft: '4px' }}>{l.colindante || '-'}</td>");

// Corrección de map render para evitar excepciones con menos de 3 puntos
sheetContent = sheetContent.replace(
  `                    {polygonCoords.length > 0 && (
                      <MapContainer
                        preferCanvas={true}
                        center={center}
                        zoom={18}
                        maxZoom={22}
                        zoomSnap={0.1}
                        style={{ width: '100%', height: '100%', zIndex: 1 }}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}
                      >`,
  `                    {polygonCoords.length >= 3 && isFinite(center[0]) && isFinite(center[1]) ? (
                      <MapContainer
                        preferCanvas={true}
                        center={center}
                        zoom={18}
                        maxZoom={22}
                        zoomSnap={0.1}
                        style={{ width: '100%', height: '100%', zIndex: 1 }}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}
                      >`
);

sheetContent = sheetContent.replace(
  `                      </MapContainer>
                    )}`,
  `                      </MapContainer>
                    ) : (
                      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                        ⚠️ Se requieren al menos 3 vértices con coordenadas válidas para generar el plano cartográfico.
                      </div>
                    )}`
);

// Minimap corrección
sheetContent = sheetContent.replace(
  `                      {polygonCoords.length > 0 && (
                        <MapContainer
                          preferCanvas={true}
                          center={center}
                          zoom={13}
                          style={{ width: '100%', height: '100%' }}
                          zoomControl={false}
                          scrollWheelZoom={false}
                          doubleClickZoom={false}
                          dragging={false}
                          touchZoom={false}
                        >`,
  `                      {polygonCoords.length >= 3 && isFinite(center[0]) && isFinite(center[1]) ? (
                        <MapContainer
                          preferCanvas={true}
                          center={center}
                          zoom={13}
                          style={{ width: '100%', height: '100%' }}
                          zoomControl={false}
                          scrollWheelZoom={false}
                          doubleClickZoom={false}
                          dragging={false}
                          touchZoom={false}
                        >`
);

sheetContent = sheetContent.replace(
  `                        </MapContainer>
                      )}`,
  `                        </MapContainer>
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '9px', textAlign: 'center' }}>
                          Sin coordenadas
                        </div>
                      )}`
);

fs.writeFileSync(sheetPath, sheetContent, 'utf8');
console.log('6. ReportePlanimetricoSheet.jsx protegido y textos JSX normalizados.');

// 7. Actualizar MapTab.jsx
const mapTabPath = path.join(movilDir, 'src/pages/MapTab/MapTab.jsx');
let mapTabContent = fs.readFileSync(mapTabPath, 'utf8');

// Reemplazar highlight-selected-predio para que solo renderice con >= 3 puntos
const oldSelectedPolygon = `{/* Polígono del Predio Enfocado (Ver en Mapa) */}
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
        )}`;

const newSelectedPolygon = `{/* Polígono del Predio Enfocado (Ver en Mapa) */}
        {selectedPredio && (() => {
          const latlngs = getLatLngsFromPredio(selectedPredio);
          if (!latlngs || latlngs.length < 3) return null;
          return (
            <Polygon
              key="highlight-selected-predio"
              positions={latlngs}
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
          );
        })()}`;

if (mapTabContent.includes(oldSelectedPolygon)) {
  mapTabContent = mapTabContent.replace(oldSelectedPolygon, newSelectedPolygon);
  console.log('7.1 MapTab: Polígono de predio seleccionado protegido contra < 3 puntos.');
}

// Proteger polylines de caminata y dibujo manual
mapTabContent = mapTabContent.replace(
  `<Polyline
              positions={walkingPositions}
              pathOptions={{ color: '#10b981', weight: 3, dashArray: '6, 6' }}
            />`,
  `{walkingPositions.length >= 2 && (
              <Polyline
                positions={walkingPositions}
                pathOptions={{ color: '#10b981', weight: 3, dashArray: '6, 6' }}
              />
            )}`
);

mapTabContent = mapTabContent.replace(
  `<Polyline
              positions={manualPositions}
              pathOptions={{ color: '#8b5cf6', weight: 3, dashArray: '5, 5' }}
            />`,
  `{manualPositions.length >= 2 && (
              <Polyline
                positions={manualPositions}
                pathOptions={{ color: '#8b5cf6', weight: 3, dashArray: '5, 5' }}
              />
            )}`
);

fs.writeFileSync(mapTabPath, mapTabContent, 'utf8');
console.log('7.2 MapTab.jsx protegido.');

// 8. Bump Version a v3.3 (versionCode 23)
const buildGradlePath = path.join(movilDir, 'android/app/build.gradle');
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, 'versionCode 23');
buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, 'versionName "3.3"');
fs.writeFileSync(buildGradlePath, buildGradle, 'utf8');
console.log('8. build.gradle actualizado a versionCode 23, versionName "3.3".');

const packageJsonPath = path.join(movilDir, 'package.json');
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = '3.3.0';
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
console.log('8. package.json actualizado a version 3.3.0.');

console.log('--- ¡TODAS LAS CORRECCIONES APLICADAS SATISFACTORIAMENTE! ---');
