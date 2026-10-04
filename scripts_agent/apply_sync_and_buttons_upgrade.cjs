const fs = require('fs');
const path = require('path');

console.log('=== APLICANDO ACTUALIZACIONES EN MOVIL: SINCRONIZACION Y BOTONES ===');

// 1. MODIFICAR DrawingToolbarMobile.jsx
const toolbarPath = path.resolve('..', 'movil', 'src', 'components', 'DrawingToolbarMobile.jsx');
if (fs.existsSync(toolbarPath)) {
  let content = fs.readFileSync(toolbarPath, 'utf8');

  // Cambiar la opción 3 (abajo) de caminata a satélite / GPS de campo
  content = content.replace(
    /<div id="swal-opt-walk"[\s\S]*?<!-- Fin Opción 3 -->|<!-- Opción 3: Agregar en Camino \(Caminata GPS\) -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
    `<!-- Opción 3: Levantamiento con GPS en Campo -->
          <div id="swal-opt-walk" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: #f8fafc; border: 1.5px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-radius: 14px; cursor: pointer;">
            <div style="background: rgba(16, 185, 129, 0.15); color: #059669; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">🛰️</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #0f172a !important;">3. Levantamiento con GPS en Campo</div>
              <div style="font-size: 11px; color: #64748b; line-height: 1.3;">Capturar cada esquina con posicionamiento satelital de alta precisión</div>
            </div>
          </div>
        </div>`
  );

  // Asegurar reverseButtons: true en handleOpenCoordinatesAndColindantesModal
  if (!content.includes('reverseButtons: true,')) {
    content = content.replace(
      "confirmButtonText: 'Continuar a Ficha ➔',",
      "reverseButtons: true,\n      confirmButtonText: 'Guardar Coordenadas ➔',"
    );
  }

  fs.writeFileSync(toolbarPath, content, 'utf8');
  console.log('✓ DrawingToolbarMobile.jsx actualizado (icono de opción de abajo cambiado a 🛰️ GPS de Campo)');
} else {
  console.warn('! No se encontró DrawingToolbarMobile.jsx');
}

// 2. MODIFICAR PredioFormMobile.jsx
const predioFormPath = path.resolve('..', 'movil', 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
if (fs.existsSync(predioFormPath)) {
  let content = fs.readFileSync(predioFormPath, 'utf8');

  // Asegurar importación de Loader2 si no está
  if (!content.includes('Loader2')) {
    content = content.replace(
      "import { \n  Edit2,",
      "import { \n  Loader2,\n  Edit2,"
    ).replace(
      "import {\n  Edit2,",
      "import {\n  Loader2,\n  Edit2,"
    );
  }

  // Cambiar opción 3 en el menú Agregar Predio de la pestaña Predios
  content = content.replace(
    /<!-- Opción 3: Agregar en Camino \(Caminata GPS\) -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
    `<!-- Opción 3: Levantamiento con GPS en Campo -->
          <div id="swal-form-opt-walk" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: #f8fafc; border: 1.5px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-radius: 14px; cursor: pointer;">
            <div style="background: rgba(16, 185, 129, 0.15); color: #059669; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">🛰️</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #0f172a !important;">3. Levantamiento con GPS en Campo</div>
              <div style="font-size: 11px; color: #64748b; line-height: 1.3;">Capturar cada esquina con posicionamiento satelital de alta precisión</div>
            </div>
          </div>
        </div>`
  );

  // Reemplazar los botones de abajo por botones horizontales: Cancelar (izquierda) y Guardar (derecha)
  const buttonsRegex = /{\/\* BOTONES PRINCIPALES DE ACCIÓN \*\/}[\s\S]*?<div style={{ display: 'flex', flexDirection: 'column'[\s\S]*?<\/div>\s*<\/div>\s*\)\s*}/;
  
  const newButtonsMarkup = `{/* BOTONES PRINCIPALES DE ACCIÓN: CANCELAR (IZQUIERDA) Y GUARDAR (DERECHA) */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: '12px', 
        marginTop: '16px', 
        marginBottom: '28px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Botón Izquierda: Cancelar */}
        <button 
          type="button" 
          onClick={handleCancelEdit}
          disabled={isSaving}
          style={{
            flex: 1,
            height: '48px',
            minHeight: '48px',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '15px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <X size={18} color="#64748b" />
          <span>Cancelar</span>
        </button>

        {/* Botón Derecha: Guardar */}
        <button 
          type="button" 
          onClick={handleSaveAndUpload}
          disabled={isSaving}
          style={{
            flex: 1,
            height: '48px',
            minHeight: '48px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            transition: 'all 0.15s ease'
          }}
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
        </button>
      </div>

    </div>
      )}`;

  content = content.replace(buttonsRegex, newButtonsMarkup);

  fs.writeFileSync(predioFormPath, content, 'utf8');
  console.log('✓ PredioFormMobile.jsx actualizado (botones Cancelar a la izquierda y Guardar a la derecha)');
} else {
  console.warn('! No se encontró PredioFormMobile.jsx');
}

console.log('=== PROCESO COMPLETADO EXITOSAMENTE ===');
