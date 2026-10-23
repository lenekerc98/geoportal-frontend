const fs = require('fs');
const path = require('path');

const movilDir = 'C:\\LNCZ\\proyecto-catastro-2026\\movil';
console.log('--- Aplicando Cambio a P01/Puntos y Eliminando Linderos Manuales Repetidos ---');

// 1. ACTUALIZAR PredioFormMobile.jsx
const predioFormPath = path.join(movilDir, 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
if (fs.existsSync(predioFormPath)) {
  let content = fs.readFileSync(predioFormPath, 'utf8');

  // Cambiar modal de edición de vértice a punto P01
  content = content.replace(
    'title: `Editar Vértice V${index + 1}`,',
    'title: `Editar Punto P${String(index + 1).padStart(2, "0")}`,`'
  );
  content = content.replace(
    'title: `Nuevo Vértice V${vertices.length + 1}`,',
    'title: `Nuevo Punto P${String(vertices.length + 1).padStart(2, "0")}`,`'
  );

  // Botones de agregar coordenadas
  content = content.replace('+ Vértice GPS Actual', '+ Punto GPS Actual');
  content = content.replace('+ Coordenada (X, Y)', '+ Coordenada (Pto)');

  // Tabla de coordenadas
  content = content.replace('<th style={{ padding: \'6px\' }}>V#</th>', '<th style={{ padding: \'6px\' }}>Pto</th>');
  content = content.replace(
    '<td style={{ padding: \'6px\', fontWeight: \'bold\', color: \'var(--accent-cyan)\' }}>V{i + 1}</td>',
    '<td style={{ padding: \'6px\', fontWeight: \'bold\', color: \'var(--accent-cyan)\' }}>P{String(i + 1).padStart(2, \'0\')}</td>'
  );
  content = content.replace('title="Editar Coordenadas"', 'title="Editar Coordenadas del Punto"');
  content = content.replace('title="Eliminar Vértice"', 'title="Eliminar Punto"');

  // Sección de colindantes por tramo
  content = content.replace(
    'Colindantes por Tramo de Vértices:',
    'Colindantes por Tramo de Puntos:'
  );
  content = content.replace(
    'Tramo V{i + 1} ➔ V{nextIdx + 1} ({dist} m)',
    'Tramo P{String(i + 1).padStart(2, \'0\')} ➔ P{String(nextIdx + 1).padStart(2, \'0\')} ({dist} m)'
  );
  content = content.replace(
    'placeholder={`Colindante del tramo V${i + 1}-V${nextIdx + 1} (ej: Juan Pérez / Calle pública)`}',
    'placeholder={`Colindante del tramo P${String(i + 1).padStart(2, "0")}-P${String(nextIdx + 1).padStart(2, "0")} (ej: Juan Pérez / Calle pública)`}'
  );

  // ELIMINAR EL BLOQUE MANUAL DE NORTE, SUR, ESTE, OESTE (IMAGEN 1)
  // Reemplazar la tarjeta 4 de "Linderos y Colindantes" por únicamente "Observaciones de Campo"
  const startIdx = content.indexOf('{/* 4. LINDEROS */}');
  const endIdx = content.indexOf('{/* 5. FOTOGRAFÍAS */}');
  if (startIdx !== -1 && endIdx !== -1) {
    const newCard = `{/* 4. OBSERVACIONES DE CAMPO */}
      <div className="form-card">
        <div className="form-card-title">
          <Info size={16} /> Observaciones de Campo
        </div>

        <div className="form-group">
          <textarea 
            className="form-input" 
            rows="3"
            placeholder="Detalles del predio, estado de la vivienda o posesión..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>
      </div>

      `;
    content = content.substring(0, startIdx) + newCard + content.substring(endIdx);
    console.log('✅ PredioFormMobile.jsx: Bloque repetitivo de Linderos manuales eliminado exitosamente.');
  }

  fs.writeFileSync(predioFormPath, content, 'utf8');
  console.log('✅ PredioFormMobile.jsx: Cambiado V01 a P01 y títulos actualizados.');
}

// 2. ACTUALIZAR DrawingToolbarMobile.jsx
const drawingToolbarPath = path.join(movilDir, 'src', 'components', 'DrawingToolbarMobile.jsx');
if (fs.existsSync(drawingToolbarPath)) {
  let content = fs.readFileSync(drawingToolbarPath, 'utf8');

  // Título del modal
  content = content.replace("title: '📐 Coordenadas y Colindantes',", "title: '📐 Puntos (P01, P02...) y Colindantes',");
  content = content.replace('+ Añadir Vértice', '+ Añadir Punto');
  content = content.replace('📍 Vértices y Colindantes:', '📍 Puntos y Colindantes:');

  // Tarjeta dinámica del modal (V${idx} a P01, P02...)
  content = content.replace(
    '<span class="swal-v-lbl" style="font-size:11px; font-weight:800; color:#38bdf8; background:rgba(56,189,248,0.15); padding:3px 6px; border-radius:6px; flex-shrink:0;">V${idx}</span>',
    '<span class="swal-v-lbl" style="font-size:11px; font-weight:800; color:#0284c7; background:#e0f2fe; padding:3px 6px; border-radius:6px; flex-shrink:0;">P${String(idx).padStart(2, "0")}</span>'
  );
  content = content.replace(
    'Lado V${idx}➔V${nextIdx}:',
    'Lado P${String(idx).padStart(2, "0")}➔P${String(nextIdx).padStart(2, "0")}:'
  );
  content = content.replace(
    'if (lbl) lbl.textContent = `V${idx}`;',
    'if (lbl) lbl.textContent = `P${String(idx).padStart(2, "0")}`;'
  );
  content = content.replace(
    'if (tramoLbl) tramoLbl.textContent = `Lado V${idx}➔V${nextIdx}:`;',
    'if (tramoLbl) tramoLbl.textContent = `Lado P${String(idx).padStart(2, "0")}➔P${String(nextIdx).padStart(2, "0")}:`;'
  );

  // Mensaje de validación
  content = content.replace(
    'Ingresa al menos 3 vértices con Este (X) y Norte (Y).',
    'Ingresa al menos 3 puntos con Este (X) y Norte (Y).'
  );

  // Menú de opciones
  content = content.replace(
    '1. Coordenadas y Colindantes',
    '1. Coordenadas (Puntos P01, P02...) y Colindantes'
  );

  fs.writeFileSync(drawingToolbarPath, content, 'utf8');
  console.log('✅ DrawingToolbarMobile.jsx: Vértices actualizados a P01, P02...');
}

// 3. ACTUALIZAR MapTab.jsx (Marcadores visuales en el mapa)
const mapTabPath = path.join(movilDir, 'src', 'pages', 'MapTab', 'MapTab.jsx');
if (fs.existsSync(mapTabPath)) {
  let content = fs.readFileSync(mapTabPath, 'utf8');

  // Marcador de caminata
  content = content.replace(
    /const walkingVertexIcon = \(num\) => L\.divIcon\(\{[\s\S]*?iconAnchor: \[9, 9\]\s*\}\);/,
    `const walkingVertexIcon = (num) => {
  const label = 'P' + String(num).padStart(2, '0');
  return L.divIcon({
    className: 'walking-vertex-marker',
    html: '<div style="background: #10b981; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">' + label + '</div>',
    iconSize: [28, 18],
    iconAnchor: [14, 9]
  });
};`
  );

  // Marcador de dibujo manual
  content = content.replace(
    /const manualVertexIcon = \(num\) => L\.divIcon\(\{[\s\S]*?iconAnchor: \[10, 10\]\s*\}\);/,
    `const manualVertexIcon = (num) => {
  const label = 'P' + String(num).padStart(2, '0');
  return L.divIcon({
    className: 'manual-vertex-marker',
    html: '<div style="background: #8b5cf6; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">' + label + '</div>',
    iconSize: [28, 18],
    iconAnchor: [14, 9]
  });
};`
  );

  fs.writeFileSync(mapTabPath, content, 'utf8');
  console.log('✅ MapTab.jsx: Marcadores del mapa cambiados a etiquetas P01, P02...');
}

// 4. ACTUALIZAR PredioBottomSheet.jsx
const sheetPath = path.join(movilDir, 'src', 'components', 'PredioBottomSheet.jsx');
if (fs.existsSync(sheetPath)) {
  let content = fs.readFileSync(sheetPath, 'utf8');
  content = content.replace('`${predio.vertices.length} vértices`', '`${predio.vertices.length} puntos`');
  fs.writeFileSync(sheetPath, content, 'utf8');
  console.log('✅ PredioBottomSheet.jsx: Texto actualizado a puntos.');
}

// 5. BUMP VERSION EN build.gradle A v2.6 (code 16)
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/versionCode\s+\d+/, 'versionCode 16');
  content = content.replace(/versionName\s+"[^"]+"/, 'versionName "2.6"');
  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log('✅ build.gradle: Versión actualizada a v2.6 (Code 16).');
}

console.log('--- Proceso de actualización terminado con éxito ---');
