const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '../../movil');
console.log('--- APLICANDO MEJORAS AL REPORTE PLANIMÉTRICO Y DIBUJO DE PREDIOS ---');

// =========================================================================
// 1. ACTUALIZAR MobileContext.jsx con selectedVertexIndex
// =========================================================================
const contextPath = path.join(movilDir, 'src/context/MobileContext.jsx');
let contextContent = fs.readFileSync(contextPath, 'utf8');

if (!contextContent.includes('selectedVertexIndex')) {
  contextContent = contextContent.replace(
    'const [manualVertices, setManualVertices] = useState([]);',
    `const [manualVertices, setManualVertices] = useState([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState(null);`
  );

  contextContent = contextContent.replace(
    'manualVertices,\n      setManualVertices,',
    `manualVertices,\n      setManualVertices,\n      selectedVertexIndex,\n      setSelectedVertexIndex,`
  );

  fs.writeFileSync(contextPath, contextContent, 'utf8');
  console.log('1. MobileContext.jsx actualizado con selectedVertexIndex.');
} else {
  console.log('1. MobileContext.jsx ya contenía selectedVertexIndex.');
}

// =========================================================================
// 2. ACTUALIZAR ReportePlanimetricoModal.jsx (Ambas páginas por defecto, exportar/descargar HTML/PDF)
// =========================================================================
const modalPath = path.join(movilDir, 'src/components/ReportePlanimetricoModal.jsx');
const newModalContent = `import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Download, Share2, ZoomIn, ZoomOut, FileText, Map, Layers } from 'lucide-react';
import ReportePlanimetricoSheet from './ReportePlanimetricoSheet';
import ErrorBoundary from './ErrorBoundary';
import Swal from 'sweetalert2';
import './ReportePlanimetrico.css';

/**
 * ReportePlanimetricoModal
 * Modal visor del Formato Oficial Planimétrico A4 Horizontal (297mm x 209mm)
 * Incluye Página 1 (Plano Cartográfico) y Página 2 (Informe de Linderación)
 */
export default function ReportePlanimetricoModal({ predio, onClose }) {
  // AMBAS PÁGINAS POR DEFECTO para que se generen y visualicen tanto el Plano como el Informe de Linderación
  const [activeSheet, setActiveSheet] = useState('both'); // 'both', 'page1', 'page2'
  const [fitToScreen, setFitToScreen] = useState(true);
  const [scaleFactor, setScaleFactor] = useState(0.85);
  const reportContainerRef = useRef(null);

  // Calcular factor de escala para que la lámina A4 (297mm ~ 1122px) quepa en la pantalla del teléfono
  useEffect(() => {
    const updateScale = () => {
      if (fitToScreen) {
        const screenW = window.innerWidth;
        const a4WidthPx = 1122;
        const availableW = screenW - 16;
        const factor = Math.min(1, Math.max(0.28, availableW / a4WidthPx));
        setScaleFactor(factor);
      } else {
        setScaleFactor(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [fitToScreen]);

  if (!predio) return null;

  // Imprimir nativo / Diálogo de impresión del navegador
  const handlePrint = () => {
    window.print();
  };

  // Descargar reporte completo como archivo HTML imprimible autónomo
  const handleDownloadReport = () => {
    try {
      const container = reportContainerRef.current;
      if (!container) {
        window.print();
        return;
      }

      const codigo = predio.codigo || predio.clave_catastral || 'PREDIO';
      const posesionario = predio.propietario || predio.nombre_posesionario || 'Posesionario';
      
      // Obtener CSS de estilos del reporte
      let cssStyles = '';
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
        if (el.tagName === 'STYLE') {
          cssStyles += el.innerHTML + '\\n';
        }
      });

      const fullHtml = \`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Planimétrico - \${codigo}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    \${cssStyles}
    @page {
      size: 297mm 210mm;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Inter', sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-page {
      width: 297mm !important;
      height: 209mm !important;
      margin: 0 auto !important;
      padding: 8mm !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
      page-break-after: always !important;
      overflow: hidden !important;
      position: relative !important;
    }
    .print-page:last-child {
      page-break-after: avoid !important;
    }
    .no-print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #0f172a;
      color: #ffffff;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div style="font-weight: bold; font-size: 14px;">
      📄 Reporte Oficial A4 - Clave: \${codigo} (\${posesionario})
    </div>
    <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
      🖨️ Imprimir / Guardar como PDF
    </button>
  </div>
  \${container.innerHTML}
</body>
</html>\`;

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`Reporte_Planimetrico_\${codigo}.html\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'Reporte Descargado',
        html: \`
          <div style="text-align: left; font-size: 13px; color: #334155;">
            Se ha descargado el archivo <b>Reporte_Planimetrico_\${codigo}.html</b> con las 2 páginas (Plano e Informe de Linderación).<br/><br/>
            Puedes abrirlo en el navegador de tu teléfono o PC y presionar <b>Imprimir</b> para guardarlo como <b>PDF</b> oficial.
          </div>
        \`,
        confirmButtonColor: '#0284c7',
        background: '#ffffff',
        color: '#0f172a'
      });
    } catch (e) {
      console.error('Error al exportar reporte:', e);
      window.print();
    }
  };

  // Compartir mediante Web Share API nativa si está disponible en el teléfono
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: \`Reporte Planimétrico - \${predio.codigo || 'Predio'}\`,
          text: \`Reporte oficial de levantamiento planimétrico del predio \${predio.codigo || ''} - Posesionario: \${predio.propietario || ''}.\`,
          url: window.location.href
        });
      } catch (err) {
        handleDownloadReport();
      }
    } else {
      handleDownloadReport();
    }
  };

  return (
    <div 
      className="report-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* BARRA SUPERIOR DE CONTROL INSTITUCIONAL */}
      <div 
        className="no-print"
        style={{
          minHeight: '52px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          gap: '8px',
          flexShrink: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <X size={16} /> Cerrar
          </button>

          <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📄 {predio.codigo || 'Reporte Oficial'}
          </span>
        </div>

        {/* SELECTOR DE LÁMINAS: AMBAS (PÁG 1 Y PÁG 2), PLANO O LINDEROS */}
        <div style={{ display: 'flex', gap: '4px', background: '#0f172a', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveSheet('both')}
            style={{
              background: activeSheet === 'both' ? '#0284c7' : 'transparent',
              color: activeSheet === 'both' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <FileText size={13} /> Ambas Páginas
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('page1')}
            style={{
              background: activeSheet === 'page1' ? '#0284c7' : 'transparent',
              color: activeSheet === 'page1' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 9px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Map size={13} /> Pág 1: Plano
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('page2')}
            style={{
              background: activeSheet === 'page2' ? '#0284c7' : 'transparent',
              color: activeSheet === 'page2' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 9px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Layers size={13} /> Pág 2: Linderos
          </button>
        </div>

        {/* ACCIONES: AJUSTAR A PANTALLA, DESCARGAR & IMPRIMIR */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setFitToScreen(!fitToScreen)}
            title={fitToScreen ? 'Ver a tamaño real 100%' : 'Ajustar a pantalla del teléfono'}
            style={{
              background: fitToScreen ? '#334155' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 9px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {fitToScreen ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
            <span>{fitToScreen ? '100%' : 'Ajustar'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Descargar archivo con Página 1 y Página 2"
          >
            <Download size={14} /> Descargar (PDF/HTML)
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Imprimir reporte oficial"
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      {/* ÁREA DE VISUALIZACIÓN DE LÁMINAS */}
      <div 
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#334155',
          padding: '16px 8px 40px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}
      >
        <div 
          ref={reportContainerRef}
          style={{
            zoom: fitToScreen ? scaleFactor : 1,
            transformOrigin: 'top center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            width: '100%',
            maxWidth: '1122px'
          }}
        >
          <ErrorBoundary title="Error al renderizar la lámina del reporte" onReset={onClose}>
            <ReportePlanimetricoSheet
              predio={predio}
              rawVertices={predio.vertices || []}
              sheetToShow={activeSheet}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(modalPath, newModalContent, 'utf8');
console.log('2. ReportePlanimetricoModal.jsx actualizado con ambas páginas por defecto y descarga.');

// =========================================================================
// 3. ACTUALIZAR ReportePlanimetricoSheet.jsx (Página 2 exacta al screenshot del usuario)
// =========================================================================
const sheetPath = path.join(movilDir, 'src/components/ReportePlanimetricoSheet.jsx');
let sheetContent = fs.readFileSync(sheetPath, 'utf8');

// Ajustar director por defecto a 'Ing. Mauricio Basantes Rodriguez'
sheetContent = sheetContent.replace(
  "const directorNombre = activeEmpresa?.nombre_director || 'ING. MARCO CHÓEZ';",
  "const directorNombre = activeEmpresa?.nombre_director || predio?.director_catastro || 'Ing. Mauricio Basantes Rodriguez';"
);

// Mapear colindantes por defecto si los vértices no traen colindante individual
sheetContent = sheetContent.replace(
  `      return {
        ...l,
        tramo: \`\${currentCode} - \${nextCode}\`,
        orientacion,
        points: (v1 && v2 && isFinite(v1.lat) && isFinite(v2.lat)) ? [[v1.lat, v1.lng], [v2.lat, v2.lng]] : []
      };`,
  `      let colText = l.colindante || v1?.colindante || '';
      if (!colText) {
        if (orientacion === 'NORTE' && predio?.norte) colText = \`Norte: \${predio.norte}\`;
        else if (orientacion === 'SUR' && predio?.sur) colText = \`Sur: \${predio.sur}\`;
        else if (orientacion === 'ESTE' && predio?.este) colText = \`Este: \${predio.este}\`;
        else if (orientacion === 'OESTE' && predio?.oeste) colText = \`Oeste: \${predio.oeste}\`;
      }
      return {
        ...l,
        tramo: \`\${currentCode} - \${nextCode}\`,
        orientacion,
        colindante: colText,
        points: (v1 && v2 && isFinite(v1.lat) && isFinite(v2.lat)) ? [[v1.lat, v1.lng], [v2.lat, v2.lng]] : []
      };`
);

// Asegurar formato de coordenadas X y Y con 1 decimal como en el screenshot
sheetContent = sheetContent.replace(
  "{v.coord_x ? Number(v.coord_x).toFixed(2) : '-'}",
  "{v.coord_x ? Number(v.coord_x).toFixed(1) : '-'}"
);
sheetContent = sheetContent.replace(
  "{v.coord_y ? Number(v.coord_y).toFixed(2) : '-'}",
  "{v.coord_y ? Number(v.coord_y).toFixed(1) : '-'}"
);

fs.writeFileSync(sheetPath, sheetContent, 'utf8');
console.log('3. ReportePlanimetricoSheet.jsx actualizado con formato exacto.');

// =========================================================================
// 4. ACTUALIZAR MapTab.jsx (Modificación de puntos seleccionados + Área visible)
// =========================================================================
const mapTabPath = path.join(movilDir, 'src/pages/MapTab/MapTab.jsx');
let mapTabContent = fs.readFileSync(mapTabPath, 'utf8');

// Añadir Edit2, Trash2, Check a los imports si faltan
if (!mapTabContent.includes('Edit2')) {
  mapTabContent = mapTabContent.replace(
    "import DrawingToolbarMobile from '../../components/DrawingToolbarMobile';",
    "import { Edit2, Trash2, X as XIcon, Check } from 'lucide-react';\nimport Swal from 'sweetalert2';\nimport DrawingToolbarMobile from '../../components/DrawingToolbarMobile';"
  );
}

// Consumir selectedVertexIndex y setSelectedVertexIndex de useMobile
if (!mapTabContent.includes('selectedVertexIndex')) {
  mapTabContent = mapTabContent.replace(
    'manualVertices,\n    setManualVertices,',
    'manualVertices,\n    setManualVertices,\n    selectedVertexIndex,\n    setSelectedVertexIndex,'
  );
}

// Actualizar manualVertexIcon para soportar estado seleccionado
const oldManualVertexIcon = `// Icono para los vértices del dibujo manual en pantalla (Admin / Superadmin)
const manualVertexIcon = (num) => {
  const label = 'P' + String(num).padStart(2, '0');
  return L.divIcon({
    className: 'manual-vertex-marker',
    html: '<div style="background: #8b5cf6; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">' + label + '</div>',
    iconSize: [28, 18],
    iconAnchor: [14, 9]
  });
};`;

const newManualVertexIcon = `// Icono para los vértices del dibujo manual en pantalla (Normal y Seleccionado para modificar)
const manualVertexIcon = (num, isSelected = false) => {
  const label = 'P' + String(num).padStart(2, '0');
  return L.divIcon({
    className: 'manual-vertex-marker' + (isSelected ? ' selected-vertex' : ''),
    html: \`<div style="background: \${isSelected ? '#f59e0b' : '#8b5cf6'}; color: #fff; font-size: \${isSelected ? '11px' : '9.5px'}; font-weight: 900; padding: \${isSelected ? '3px 7px' : '2px 5px'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: \${isSelected ? '2.5px solid #ffffff' : '1.5px solid #ffffff'}; box-shadow: \${isSelected ? '0 0 14px #f59e0b, 0 3px 6px rgba(0,0,0,0.4)' : '0 2px 5px rgba(0,0,0,0.3)'}; transform: \${isSelected ? 'scale(1.25)' : 'scale(1)'}; transition: all 0.15s ease; white-space: nowrap;">\${isSelected ? '✏️ ' : ''}\${label}</div>\`,
    iconSize: [isSelected ? 36 : 28, isSelected ? 22 : 18],
    iconAnchor: [isSelected ? 18 : 14, isSelected ? 11 : 9]
  });
};`;

mapTabContent = mapTabContent.replace(oldManualVertexIcon, newManualVertexIcon);

// En MapTab component, añadir handlers para modificar vértice seleccionado
const handlersCode = `
  const currentManualArea = computePolygonArea(manualVertices);
  const currentManualPerim = computePerimeter(manualVertices);

  // Modificar coordenadas numéricas de un vértice seleccionado
  const handleOpenEditVertexCoords = async (idx) => {
    const v = manualVertices[idx];
    if (!v) return;
    const pCode = 'P' + String(idx + 1).padStart(2, '0');
    const curX = (v.x ?? 0).toFixed(2);
    const curY = (v.y ?? 0).toFixed(2);

    const { value: formValues } = await Swal.fire({
      title: \`✏️ Modificar Vértice \${pCode}\`,
      html: \`
        <div style="display:flex; flex-direction:column; gap:12px; text-align:left; padding:6px 0;">
          <div style="font-size:11px; color:#64748b;">
            Ingresa las nuevas coordenadas UTM 17S o arrastra el punto con el dedo directamente en el mapa.
          </div>
          <div>
            <label style="font-size:12px; color:#0f172a; font-weight:700;">Coordenada Este (X) - Metros:</label>
            <input id="swal-edit-vx" class="swal2-input" type="number" step="0.01" value="\${curX}" style="width:100%; margin:4px 0 0 0; background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; border-radius:8px; height:42px; font-size:14px; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; color:#0f172a; font-weight:700;">Coordenada Norte (Y) - Metros:</label>
            <input id="swal-edit-vy" class="swal2-input" type="number" step="0.01" value="\${curY}" style="width:100%; margin:4px 0 0 0; background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; border-radius:8px; height:42px; font-size:14px; box-sizing:border-box;">
          </div>
        </div>
      \`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar Cambios',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      background: '#ffffff',
      color: '#0f172a',
      preConfirm: () => {
        const x = parseFloat(document.getElementById('swal-edit-vx').value);
        const y = parseFloat(document.getElementById('swal-edit-vy').value);
        if (isNaN(x) || isNaN(y)) {
          Swal.showValidationMessage('Ingresa números válidos para Este (X) y Norte (Y)');
          return false;
        }
        return { x, y };
      }
    });

    if (formValues) {
      const wgs = utmToWgs84(formValues.x, formValues.y);
      setManualVertices(prev => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          x: formValues.x,
          y: formValues.y,
          lat: wgs.lat,
          lng: wgs.lng
        };
        return copy;
      });
      if (showToast) {
        showToast({
          type: 'success',
          title: \`✓ Vértice \${pCode} Modificado\`,
          message: \`Nuevas coordenadas: X: \${formValues.x.toFixed(1)}, Y: \${formValues.y.toFixed(1)}\`,
          duration: 3000
        });
      }
    }
  };

  // Eliminar vértice individual del dibujo
  const handleDeleteDrawingVertex = (idx) => {
    const pCode = 'P' + String(idx + 1).padStart(2, '0');
    setManualVertices(prev => prev.filter((_, i) => i !== idx));
    if (setSelectedVertexIndex) setSelectedVertexIndex(null);
    if (showToast) {
      showToast({
        type: 'info',
        title: \`Vértice \${pCode} Eliminado\`,
        message: 'El polígono ha sido recalculado automáticamente.',
        duration: 2500
      });
    }
  };
`;

mapTabContent = mapTabContent.replace(
  'const walkingPositions = perimeterVertices.map(v => [v.lat, v.lng]);',
  handlersCode + '\n  const walkingPositions = perimeterVertices.map(v => [v.lat, v.lng]);'
);

// Reemplazar los markers de dibujo manual para hacerlos arrastrables y seleccionables
const oldManualMarkers = `{manualVertices.map((v, i) => (
              <Marker
                key={\`manual-\${i}\`}
                position={[v.lat, v.lng]}
                icon={manualVertexIcon(i + 1)}
              />
            ))}`;

const newManualMarkers = `{manualVertices.map((v, i) => (
              (isFinite(v.lat) && isFinite(v.lng)) ? (
                <Marker
                  key={\`manual-\${i}\`}
                  position={[v.lat, v.lng]}
                  draggable={isManualDrawing}
                  icon={manualVertexIcon(i + 1, selectedVertexIndex === i)}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      if (setSelectedVertexIndex) setSelectedVertexIndex(i);
                    },
                    dragstart: () => {
                      if (setSelectedVertexIndex) setSelectedVertexIndex(i);
                    },
                    dragend: (e) => {
                      const newLatLng = e.target.getLatLng();
                      const utm = wgs84ToUtm(newLatLng.lng, newLatLng.lat);
                      setManualVertices(prev => {
                        const copy = [...prev];
                        if (copy[i]) {
                          copy[i] = {
                            ...copy[i],
                            lat: newLatLng.lat,
                            lng: newLatLng.lng,
                            x: Math.round(utm.x * 100) / 100,
                            y: Math.round(utm.y * 100) / 100
                          };
                        }
                        return copy;
                      });
                    }
                  }}
                />
              ) : null
            ))}`;

mapTabContent = mapTabContent.replace(oldManualMarkers, newManualMarkers);

// Añadir Tooltip con Área permanente en el centro del polígono manual
const oldManualPolygon = `{manualVertices.length >= 3 && (
              <Polygon
                positions={manualPositions}
                pathOptions={{
                  color: '#8b5cf6',
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.25,
                  weight: 2
                }}
              />
            )}`;

const newManualPolygon = `{manualVertices.length >= 3 && (
              <Polygon
                positions={manualPositions}
                pathOptions={{
                  color: '#8b5cf6',
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.28,
                  weight: 2.5
                }}
              >
                <Tooltip permanent={true} direction="center">
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid #8b5cf6',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)',
                    pointerEvents: 'none'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#6d28d9' }}>
                      📐 {currentManualArea.toLocaleString('es-EC', { maximumFractionDigits: 1 })} m²
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b' }}>
                      ({(currentManualArea / 10000).toFixed(4)} Ha)
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
            )}`;

mapTabContent = mapTabContent.replace(oldManualPolygon, newManualPolygon);

// Añadir tarjeta flotante de modificación de punto seleccionado en MapTab
const floatingCardCode = `
      {/* Barra Flotante Superior: Modificación de Vértice Seleccionado */}
      {isManualDrawing && selectedVertexIndex !== null && manualVertices[selectedVertexIndex] && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.98)',
          border: '2px solid #f59e0b',
          borderRadius: '14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          backdropFilter: 'blur(8px)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '92%',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#b45309' }}>
              📍 Vértice P\${String(selectedVertexIndex + 1).padStart(2, '0')} Seleccionado
            </span>
            <span className="mono" style={{ fontSize: '10px', color: '#64748b' }}>
              X: \${(manualVertices[selectedVertexIndex].x ?? 0).toFixed(1)} | Y: \${(manualVertices[selectedVertexIndex].y ?? 0).toFixed(1)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleOpenEditVertexCoords(selectedVertexIndex)}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Modificar coordenadas numéricas"
          >
            <Edit2 size={13} /> Modificar
          </button>

          <button
            type="button"
            onClick={() => handleDeleteDrawingVertex(selectedVertexIndex)}
            style={{
              background: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '6px 8px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            title="Eliminar este punto"
          >
            <Trash2 size={13} />
          </button>

          <button
            type="button"
            onClick={() => setSelectedVertexIndex && setSelectedVertexIndex(null)}
            style={{
              background: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            title="Deseleccionar"
          >
            <XIcon size={14} />
          </button>
        </div>
      )}
`;

mapTabContent = mapTabContent.replace(
  '{/* Drawer de Inspección al Tocar un Predio */}',
  floatingCardCode + '\n      {/* Drawer de Inspección al Tocar un Predio */}'
);

fs.writeFileSync(mapTabPath, mapTabContent, 'utf8');
console.log('4. MapTab.jsx actualizado con drag, modificación de vértices y área del polígono.');

// =========================================================================
// 5. ACTUALIZAR DrawingToolbarMobile.jsx (Área visible destacada + acciones)
// =========================================================================
const toolbarPath = path.join(movilDir, 'src/components/DrawingToolbarMobile.jsx');
let toolbarContent = fs.readFileSync(toolbarPath, 'utf8');

if (!toolbarContent.includes('selectedVertexIndex')) {
  toolbarContent = toolbarContent.replace(
    'manualVertices,\n    setManualVertices,',
    'manualVertices,\n    setManualVertices,\n    selectedVertexIndex,\n    setSelectedVertexIndex,'
  );
}

// Reemplazar la sección de dibujo en pantalla con tarjeta de Área destacada y edición
const oldToolbarWidget = `          {!isPanelCollapsed && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', textAlign: 'center' }}>
                👆 Toca el mapa para marcar esquinas. Puedes arrastrar esta ventana.
              </div>`;

const newToolbarWidget = `          {!isPanelCollapsed && (
            <div style={{ marginTop: '6px' }}>
              {/* TARJETA DESTACADA DEL ÁREA DEL POLÍGONO EN EDICIÓN */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                border: '1.5px solid #86efac',
                borderRadius: '10px',
                padding: '6px 10px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>
                    📐 Área Calculada
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: '#15803d' }}>
                    {currentManualArea > 0 ? \`\${currentManualArea.toLocaleString('es-EC', { maximumFractionDigits: 1 })} m²\` : '0.0 m²'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>
                    Hectáreas
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534' }}>
                    {currentManualArea > 0 ? \`\${(currentManualArea / 10000).toFixed(4)} ha\` : '0.0000 ha'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '9.5px', color: '#64748b', marginBottom: '6px', textAlign: 'center' }}>
                👆 Toca el mapa para crear puntos. Toca un punto para <b>modificarlo</b> o <b>arrastrarlo</b>.
              </div>`;

toolbarContent = toolbarContent.replace(oldToolbarWidget, newToolbarWidget);

fs.writeFileSync(toolbarPath, toolbarContent, 'utf8');
console.log('5. DrawingToolbarMobile.jsx actualizado con métricas de área destacadas.');

// =========================================================================
// 6. BUMP VERSION A v3.4 (versionCode 24)
// =========================================================================
const buildGradlePath = path.join(movilDir, 'android/app/build.gradle');
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, 'versionCode 24');
buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, 'versionName "3.4"');
fs.writeFileSync(buildGradlePath, buildGradle, 'utf8');
console.log('6. build.gradle actualizado a versionCode 24, versionName "3.4".');

const packageJsonPath = path.join(movilDir, 'package.json');
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = '3.4.0';
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
console.log('6. package.json actualizado a version 3.4.0.');

console.log('--- ¡TODOS LOS CAMBIOS APLICADOS CON ÉXITO! ---');
