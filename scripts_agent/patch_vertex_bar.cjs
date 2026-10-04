const fs = require('fs');
const path = require('path');

const MAP_TAB_PATH = path.resolve(__dirname, '../../movil/src/pages/MapTab/MapTab.jsx');

let mapTab = fs.readFileSync(MAP_TAB_PATH, 'utf8');

const barMarker = '{/* Barra Flotante Superior: Modificación de Vértice Seleccionado */}';
const barIndex = mapTab.indexOf(barMarker);
const drawerMarker = '{/* Drawer de Inspección al Tocar un Predio */}';
const drawerIndex = mapTab.indexOf(drawerMarker);

if (barIndex !== -1 && drawerIndex !== -1) {
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

  mapTab = mapTab.substring(0, barIndex) + newBarCode + mapTab.substring(drawerIndex);
  fs.writeFileSync(MAP_TAB_PATH, mapTab, 'utf8');
  console.log('✓ Barra de vértice flotante actualizada exitosamente con icono sin texto, colapsable y formato P03 limpio.');
} else {
  console.error('Error: No se encontraron los marcadores de la barra flotante.');
}
