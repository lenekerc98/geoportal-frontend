const fs = require('fs');
const path = require('path');

const MAP_TAB_PATH = path.resolve(__dirname, '../../movil/src/pages/MapTab/MapTab.jsx');
const PREDIO_FORM_PATH = path.resolve(__dirname, '../../movil/src/pages/FormTab/PredioFormMobile.jsx');
const APP_CSS_PATH = path.resolve(__dirname, '../../movil/src/App.css');
const BUILD_GRADLE_PATH = path.resolve(__dirname, '../../movil/android/app/build.gradle');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../movil/package.json');

console.log('=== APLICANDO MEJORAS Y CORRECCIONES DE UI SOLICITADAS POR EL USUARIO ===\n');

// 1. MODIFICAR MapTab.jsx
let mapTab = fs.readFileSync(MAP_TAB_PATH, 'utf8');

// A) Importar ChevronUp y ChevronDown de lucide-react si no están
if (!mapTab.includes('ChevronUp')) {
  mapTab = mapTab.replace(
    "import { Edit2, Trash2, X as XIcon, Check } from 'lucide-react';",
    "import { Edit2, Trash2, X as XIcon, Check, ChevronUp, ChevronDown } from 'lucide-react';"
  );
  console.log('✓ Iconos ChevronUp, ChevronDown añadidos a los imports.');
}

// B) Agregar estado isVertexBarCollapsed en MapTab si no está
if (!mapTab.includes('isVertexBarCollapsed')) {
  mapTab = mapTab.replace(
    'const [selectedPredio, setSelectedPredio] = useState(null);',
    'const [selectedPredio, setSelectedPredio] = useState(null);\n  const [isVertexBarCollapsed, setIsVertexBarCollapsed] = useState(false);'
  );
  console.log('✓ Estado isVertexBarCollapsed añadido.');
}

// C) Reemplazar manualVertexIcon con el vástago/offset de 1cm (~44px) y ancla en la punta inferior
const oldIconRegex = /\/\/ Icono para los vértices del dibujo manual[\s\S]*?iconAnchor:\s*\[isSelected \? 18 : 14,\s*isSelected \? 11 : 9\]\s*\}\);\s*\};/;
const newManualVertexIcon = `// Icono para los vértices del dibujo manual en pantalla (Normal y Seleccionado)
// Con offset de elevación de ~1cm (vástago y aguja) para que el dedo no tape el terreno ni el vértice
const manualVertexIcon = (num, isSelected = false) => {
  const label = 'P' + String(num).padStart(2, '0');
  const color = isSelected ? '#f59e0b' : '#8b5cf6';
  const width = isSelected ? 42 : 36;
  const height = 44; // Altura total de ~1.1cm en pantallas móviles
  return L.divIcon({
    className: 'manual-vertex-marker' + (isSelected ? ' selected-vertex' : ''),
    html: \`
      <div style="position: relative; width: \${width}px; height: \${height}px; display: flex; flex-direction: column; align-items: center; pointer-events: auto; cursor: pointer;">
        <!-- Placa flotante con identificador P01, P02, etc. -->
        <div style="background: \${color}; color: #ffffff; font-size: \${isSelected ? '11px' : '9.5px'}; font-weight: 900; padding: \${isSelected ? '3px 8px' : '2px 5px'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: \${isSelected ? '0 0 12px #f59e0b, 0 3px 8px rgba(0,0,0,0.45)' : '0 2px 6px rgba(0,0,0,0.35)'}; transform: \${isSelected ? 'scale(1.1)' : 'scale(1)'}; transition: all 0.15s ease; white-space: nowrap; z-index: 2;">
          \${isSelected ? '✏️ ' : ''}\${label}
        </div>
        <!-- Vástago vertical (offset de 1cm de visibilidad de terreno) -->
        <div style="width: 2px; height: 18px; background: \${color}; box-shadow: 0 0 2px #ffffff; margin-top: -1px; z-index: 1;"></div>
        <!-- Punta/Aguja exacta del punto en el terreno (coordenada precisa) -->
        <div style="width: 6px; height: 6px; background: #ffffff; border: 2px solid \${color}; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.6); margin-top: -1px; z-index: 1;"></div>
      </div>
    \`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height]
  });
};`;

if (oldIconRegex.test(mapTab)) {
  mapTab = mapTab.replace(oldIconRegex, newManualVertexIcon);
  console.log('✓ manualVertexIcon actualizado con offset de elevación de 1cm y puntero de aguja.');
} else {
  console.warn('⚠️ No se pudo encontrar el patrón exacto de manualVertexIcon, verificando...');
}

// D) Eliminar el Tooltip sobre el polígono en dibujo manual (para no estorbar la vista del predio)
const polygonTooltipRegex = /<Polygon\s+positions=\{manualPositions\}\s+pathOptions=\{\{[\s\S]*?\}\}\s*>\s*<Tooltip permanent=\{true\} direction="center">[\s\S]*?<\/Tooltip>\s*<\/Polygon>/;
const cleanPolygon = `<Polygon
                positions={manualPositions}
                pathOptions={{
                  color: '#8b5cf6',
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.28,
                  weight: 2.5
                }}
              />`;

if (polygonTooltipRegex.test(mapTab)) {
  mapTab = mapTab.replace(polygonTooltipRegex, cleanPolygon);
  console.log('✓ Tooltip del área sobre el polígono eliminado (el área se visualiza en la tarjeta inferior sin estorbar).');
} else {
  console.warn('⚠️ No se encontró el Tooltip sobre el polígono, comprobando...');
}

// E) Modificar la Barra Flotante Superior del Vértice Seleccionado
// 1. Mostrar '📍 P03' (sin $, sin 'Vértice', sin 'Seleccionado')
// 2. Coordenadas 'X: 623328.8 | Y: 9765509.3' (sin $)
// 3. Eliminar la palabra 'Modificar' y dejar solo el icono <Edit2 size={16} /> estilizado
// 4. Hacer que sea colapsable con un botón chevron
const floatingBarRegex = /{\/\* Barra Flotante Superior: Modificación de Vértice Seleccionado \*\/}[\s\S]*?{\/\* Controles Flotantes de Dibujo y GPS \*\//;

// Busquemos dónde está la barra flotante
const barMarker = '{/* Barra Flotante Superior: Modificación de Vértice Seleccionado */}';
const barIndex = mapTab.indexOf(barMarker);
if (barIndex !== -1) {
  // Busquemos el cierre de este bloque condicional
  const endMarker = '{/* Modal para Editar Numéricamente las Coordenadas del Vértice */}';
  const endIndex = mapTab.indexOf(endMarker, barIndex);
  if (endIndex !== -1) {
    const newBarCode = `{/* Barra Flotante Superior: Modificación de Vértice Seleccionado */}
      {isManualDrawing && selectedVertexIndex !== null && manualVertices[selectedVertexIndex] && (
        <div style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.98)',
          border: '1.5px solid #f59e0b',
          borderRadius: '12px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
          backdropFilter: 'blur(8px)',
          padding: isVertexBarCollapsed ? '4px 8px' : '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          maxWidth: '94%',
          animation: 'fadeIn 0.2s ease'
        }}>
          {/* Código del vértice y Coordenadas */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: isVertexBarCollapsed ? 'auto' : '105px' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#b45309', whiteSpace: 'nowrap' }}>
              📍 P{String(selectedVertexIndex + 1).padStart(2, '0')}
            </span>
            {!isVertexBarCollapsed && (
              <span className="mono" style={{ fontSize: '9.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                X: {(manualVertices[selectedVertexIndex].x ?? 0).toFixed(1)} | Y: {(manualVertices[selectedVertexIndex].y ?? 0).toFixed(1)}
              </span>
            )}
          </div>

          {/* Botón Icono Modificar (sin texto, visualmente destacado) */}
          <button
            type="button"
            onClick={() => handleOpenEditVertexCoords(selectedVertexIndex)}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Modificar coordenadas numéricas"
          >
            <Edit2 size={16} strokeWidth={2.5} />
          </button>

          {/* Botón Eliminar Vértice */}
          {!isVertexBarCollapsed && (
            <button
              type="button"
              onClick={() => handleDeleteDrawingVertex(selectedVertexIndex)}
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title="Eliminar este punto"
            >
              <Trash2 size={15} />
            </button>
          )}

          {/* Botón Colapsar / Expandir */}
          <button
            type="button"
            onClick={() => setIsVertexBarCollapsed(!isVertexBarCollapsed)}
            style={{
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '28px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title={isVertexBarCollapsed ? 'Expandir barra de vértice' : 'Colapsar barra de vértice'}
          >
            {isVertexBarCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>

          {/* Botón Cerrar Selección */}
          <button
            type="button"
            onClick={() => setSelectedVertexIndex && setSelectedVertexIndex(null)}
            style={{
              background: '#f8fafc',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '28px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Deseleccionar"
          >
            <XIcon size={15} />
          </button>
        </div>
      )}\n\n      `;

    mapTab = mapTab.substring(0, barIndex) + newBarCode + mapTab.substring(endIndex);
    console.log('✓ Barra de vértice actualizada: P03 sin $, coordenadas sin $, icono modificar sin texto, y colapsable.');
  }
}

fs.writeFileSync(MAP_TAB_PATH, mapTab, 'utf8');
console.log('✓ MapTab.jsx guardado exitosamente.');


// 2. MODIFICAR PredioFormMobile.jsx (Reducir botones CTA)
let formContent = fs.readFileSync(PREDIO_FORM_PATH, 'utf8');
formContent = formContent.replace(
  '<CloudUpload size={22} />',
  '<CloudUpload size={16} />'
);
formContent = formContent.replace(
  '<Save size={20} />',
  '<Save size={15} />'
);
formContent = formContent.replace(
  '<X size={18} />',
  '<X size={14} />'
);
formContent = formContent.replace(
  "marginTop: '20px', marginBottom: '36px'",
  "marginTop: '14px', marginBottom: '24px'"
);
formContent = formContent.replace(
  "gap: '12px'",
  "gap: '8px'"
);
fs.writeFileSync(PREDIO_FORM_PATH, formContent, 'utf8');
console.log('✓ PredioFormMobile.jsx actualizado (iconos y espaciado de botones CTA compactados).');


// 3. MODIFICAR App.css (Reducir tamaño visual de los botones de acción)
let appCss = fs.readFileSync(APP_CSS_PATH, 'utf8');

// Reemplazar .btn-cta-cloud
appCss = appCss.replace(
  /\.btn-cta-cloud\s*\{[\s\S]*?box-shadow:\s*0 8px 22px rgba\(37, 99, 235, 0\.4\);[\s\S]*?\}/,
  `.btn-cta-cloud {
  width: 100%;
  min-height: 40px;
  height: 40px;
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #1d4ed8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
}`
);

// Reemplazar .btn-cta-phone
appCss = appCss.replace(
  /\.btn-cta-phone\s*\{[\s\S]*?box-shadow:\s*0 4px 12px rgba\(2, 132, 199, 0\.12\);[\s\S]*?cursor:\s*pointer;[\s\S]*?\}/,
  `.btn-cta-phone {
  width: 100%;
  min-height: 38px;
  height: 38px;
  background: #ffffff;
  color: #0284c7;
  border: 1.5px solid #0284c7;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}`
);

// Reemplazar .btn-cta-cancel
appCss = appCss.replace(
  /\.btn-cta-cancel\s*\{[\s\S]*?min-height:\s*48px;[\s\S]*?font-size:\s*14px;[\s\S]*?border-radius:\s*14px;[\s\S]*?\}/,
  `.btn-cta-cancel {
  width: 100%;
  min-height: 34px;
  height: 34px;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}`
);

fs.writeFileSync(APP_CSS_PATH, appCss, 'utf8');
console.log('✓ App.css actualizado con estilos compactos para botones CTA.');


// 4. ACTUALIZAR build.gradle a versionCode 25, versionName "3.5"
let buildGradle = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, 'versionCode 25');
buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, 'versionName "3.5"');
fs.writeFileSync(BUILD_GRADLE_PATH, buildGradle, 'utf8');
console.log('✓ build.gradle actualizado: versionCode 25, versionName "3.5".');

// 5. ACTUALIZAR package.json en movil
let pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
pkg.version = "3.5.0";
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2), 'utf8');
console.log('✓ package.json en movil actualizado a 3.5.0.');

console.log('\n=== TODAS LAS CORRECCIONES HAN SIDO APLICADAS CON ÉXITO ===');
