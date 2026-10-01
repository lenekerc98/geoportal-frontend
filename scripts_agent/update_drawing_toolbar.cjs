const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/components/DrawingToolbarMobile.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Check imports: add Move, ChevronUp, ChevronDown
content = content.replace(
  "import { Layers, Crosshair, CheckSquare, X, Plus, Undo2, PenTool } from 'lucide-react';",
  "import { Layers, Crosshair, CheckSquare, X, Plus, Undo2, PenTool, Move, ChevronUp, ChevronDown } from 'lucide-react';"
);

// 2. Destructure showToast from useMobile
content = content.replace(
  "setActiveTab \n  } = useMobile();",
  `setActiveTab,
    showToast 
  } = useMobile();`
);
if (!content.includes('showToast')) {
  content = content.replace(
    "setActiveTab\n  } = useMobile();",
    `setActiveTab,
    showToast 
  } = useMobile();`
  );
}

// 3. Add draggable state inside DrawingToolbarMobile component
const stateHookTarget = "const [manualArea, setManualArea] = useState(0);";
const stateHookInsert = `const [manualArea, setManualArea] = useState(0);
  const [panelPos, setPanelPos] = useState({ x: 14, y: 68 });
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const dragTouchRef = React.useRef({ startX: 0, startY: 0, initX: 14, initY: 68 });

  const handleDragStart = (e) => {
    const t = e.touches ? e.touches[0] : e;
    dragTouchRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      initX: panelPos.x,
      initY: panelPos.y
    };
  };

  const handleDragMove = (e) => {
    if (!dragTouchRef.current) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - dragTouchRef.current.startX;
    const dy = t.clientY - dragTouchRef.current.startY;
    const newX = Math.max(6, Math.min(window.innerWidth - 220, dragTouchRef.current.initX + dx));
    const newY = Math.max(50, Math.min(window.innerHeight - 100, dragTouchRef.current.initY + dy));
    setPanelPos({ x: newX, y: newY });
  };`;

if (content.includes("const [manualArea, setManualArea] = useState(0);")) {
  content = content.replace(stateHookTarget, stateHookInsert);
} else {
  // Find where hooks start
  content = content.replace(
    "export default function DrawingToolbarMobile({ onRecenterGPS }) {",
    `export default function DrawingToolbarMobile({ onRecenterGPS }) {
  const [panelPos, setPanelPos] = React.useState({ x: 14, y: 68 });
  const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);
  const dragTouchRef = React.useRef({ startX: 0, startY: 0, initX: 14, initY: 68 });

  const handleDragStart = (e) => {
    const t = e.touches ? e.touches[0] : e;
    dragTouchRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      initX: panelPos.x,
      initY: panelPos.y
    };
  };

  const handleDragMove = (e) => {
    if (!dragTouchRef.current) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - dragTouchRef.current.startX;
    const dy = t.clientY - dragTouchRef.current.startY;
    const newX = Math.max(6, Math.min(window.innerWidth - 220, dragTouchRef.current.initX + dx));
    const newY = Math.max(50, Math.min(window.innerHeight - 100, dragTouchRef.current.initY + dy));
    setPanelPos({ x: newX, y: newY });
  };`
  );
}

// 4. Replace handleStartManualDrawing Swal with showToast
const oldStartDrawing = `    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'info',
      title: '✏️ Modo Dibujo en Mapa',
      text: 'Toca sobre el mapa para marcar cada esquina del predio.',
      showConfirmButton: false,
      timer: 3500,
      background: '#ffffff',
      color: '#0f172a'
    });`;

const newStartDrawing = `    if (showToast) {
      showToast({
        type: 'info',
        title: '✏️ Modo Dibujo en Mapa',
        message: 'Toca el mapa para marcar esquinas. Puedes mover esta ventana con el dedo.',
        duration: 3500
      });
    }`;

content = content.replace(oldStartDrawing, newStartDrawing);

// 5. Replace handleFinishManualDrawing Swal with showToast
const oldFinishDrawing = `    Swal.fire({
      icon: 'success',
      title: 'Polígono Capturado',
      text: \`\${manualVertices.length} vértices (\${area.toFixed(1)} m²). Completa los datos en la ficha.\`,
      timer: 2000,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#0f172a'
    });`;

const newFinishDrawing = `    if (showToast) {
      showToast({
        type: 'success',
        title: '✓ Polígono Capturado',
        message: \`\${manualVertices.length} vértices (\${area.toFixed(1)} m²). Ficha lista para guardar.\`,
        duration: 4000
      });
    }`;

content = content.replace(oldFinishDrawing, newFinishDrawing);

// 6. Replace handleFinishWalking Swal with showToast
content = content.replace(
  "setActiveTab('form');\n  };",
  `setActiveTab('form');
    if (showToast) {
      showToast({
        type: 'success',
        title: '✓ Caminata GPS Completada',
        message: \`\${perimeterVertices.length} vértices (\${area.toFixed(1)} m²). Ficha lista para guardar.\`,
        duration: 4000
      });
    }
  };`
);

// 7. Replace the manual drawing panel JSX with Draggable, Compact Floating Widget
const oldPanelRegex = /\{\/\* Banner de Dibujo Manual en Pantalla[\s\S]*?\{\/\* Barra Inferior del Mapa/;

const newPanel = `{/* Widget Flotante de Dibujo en Pantalla (Compacto, Draggable y Desplazable) */}
      {isManualDrawing && (
        <div 
          style={{
            position: 'fixed',
            left: \`\${panelPos.x}px\`,
            top: \`\${panelPos.y}px\`,
            zIndex: 9999,
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1.5px solid #0284c7',
            borderRadius: '14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(8px)',
            padding: isPanelCollapsed ? '6px 10px' : '8px 12px',
            width: isPanelCollapsed ? 'auto' : '260px',
            touchAction: 'none',
            userSelect: 'none'
          }}
        >
          {/* Cabecera / Agarradera para arrastrar */}
          <div 
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              paddingBottom: isPanelCollapsed ? 0 : '6px',
              borderBottom: isPanelCollapsed ? 'none' : '1px solid #f1f5f9',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                <Move size={14} />
              </span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
                ✏️ {manualVertices.length} pts {currentManualArea > 0 ? \`(\${currentManualArea.toFixed(0)}m²)\` : ''}
              </span>
            </div>

            <button 
              type="button"
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '6px',
                padding: '2px 6px',
                fontSize: '10px',
                color: '#475569',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title={isPanelCollapsed ? 'Expandir opciones' : 'Minimizar'}
            >
              {isPanelCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {!isPanelCollapsed && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', textAlign: 'center' }}>
                👆 Toca el mapa para marcar esquinas. Puedes arrastrar esta ventana.
              </div>

              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                {manualVertices.length > 0 && (
                  <button 
                    type="button"
                    className="btn-secondary-mobile" 
                    style={{ height: '34px', fontSize: '11px', padding: '0 8px', gap: '4px' }}
                    onClick={handleUndoManualVertex}
                  >
                    <Undo2 size={13} /> Deshacer
                  </button>
                )}

                {manualVertices.length >= 3 && (
                  <button 
                    type="button"
                    className="btn-primary-mobile" 
                    style={{ height: '34px', fontSize: '11px', padding: '0 10px', background: 'linear-gradient(135deg, #10b981, #059669)', gap: '4px' }}
                    onClick={handleFinishManualDrawing}
                  >
                    <CheckSquare size={13} /> Finalizar
                  </button>
                )}

                <button 
                  type="button"
                  className="map-fab" 
                  style={{ width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0 }}
                  onClick={handleCancelManualDrawing}
                  title="Cancelar Dibujo"
                >
                  <X size={15} color="#f43f5e" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra Inferior del Mapa`;

content = content.replace(oldPanelRegex, newPanel);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('DrawingToolbarMobile.jsx updated with draggable chip and swipeable toast!');
