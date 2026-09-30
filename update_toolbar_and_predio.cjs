const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '..', 'movil');
const toolbarPath = path.join(movilDir, 'src', 'components', 'DrawingToolbarMobile.jsx');

const newToolbarCode = `import React from 'react';
import { useMobile } from '../context/MobileContext';
import { wgs84ToUtm, computePolygonArea, computePerimeter } from '../utils/geoUtils';
import { Layers, Crosshair, CheckSquare, X, Plus, Undo2, PenTool } from 'lucide-react';
import Swal from 'sweetalert2';

export default function DrawingToolbarMobile({ onRecenterGPS }) {
  const { 
    gps, 
    activeBaseMap, 
    setActiveBaseMap, 
    isPerimeterWalking, 
    setIsPerimeterWalking,
    perimeterVertices,
    setPerimeterVertices,
    isManualDrawing,
    setIsManualDrawing,
    manualVertices,
    setManualVertices,
    setFormPreloadData,
    setActiveTab 
  } = useMobile();

  // Cambiar capa base (Satélite, OpenStreetMap, Carto Dark)
  const handleCycleBaseMap = () => {
    if (activeBaseMap === 'satellite') setActiveBaseMap('osm');
    else if (activeBaseMap === 'osm') setActiveBaseMap('dark');
    else setActiveBaseMap('satellite');
  };

  // 1. INICIAR MODO CAMINAR PERÍMETRO CON GPS ("Agregar en Camino")
  const handleStartWalking = () => {
    if (!gps.hasFix) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin Señal GPS',
        text: 'Espera a que el dispositivo obtenga posición satelital con precisión.',
        confirmButtonColor: '#3b82f6',
        background: '#131d33',
        color: '#fff'
      });
      return;
    }

    if (isManualDrawing) {
      setIsManualDrawing(false);
      setManualVertices([]);
    }

    setIsPerimeterWalking(true);
    setPerimeterVertices([]);

    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'info',
      title: '🚶 Modo Caminar Activado',
      text: 'Camina a cada esquina del predio y presiona "+ Capturar Vértice".',
      showConfirmButton: false,
      timer: 3500,
      background: '#131d33',
      color: '#fff'
    });
  };

  // Capturar vértice en la posición actual con GPS
  const handleAddVertex = () => {
    if (!gps.hasFix) return;
    const utm = wgs84ToUtm(gps.lng, gps.lat);
    const newVertex = {
      x: utm.x,
      y: utm.y,
      lat: gps.lat,
      lng: gps.lng,
      orden: perimeterVertices.length + 1,
      accuracy: gps.accuracy
    };

    setPerimeterVertices(prev => [...prev, newVertex]);
  };

  // Finalizar levantamiento por caminata y pasar al formulario
  const handleFinishWalking = () => {
    if (perimeterVertices.length < 3) {
      Swal.fire({
        icon: 'warning',
        title: 'Vértices Insuficientes',
        text: 'Se requieren al menos 3 vértices para formar un predio cerrado.',
        confirmButtonColor: '#3b82f6',
        background: '#131d33',
        color: '#fff'
      });
      return;
    }

    const area = computePolygonArea(perimeterVertices);
    const perimetro = computePerimeter(perimeterVertices);

    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const autoCode = \`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`;

    setFormPreloadData({
      codigo: autoCode,
      vertices: perimeterVertices,
      area: Math.round(area * 100) / 100,
      perimetro: Math.round(perimetro * 100) / 100,
      tipo_levantamiento: 'GPS_CAMINATA'
    });

    setIsPerimeterWalking(false);
    setPerimeterVertices([]);
    setActiveTab('form');
  };

  const handleCancelWalking = () => {
    setIsPerimeterWalking(false);
    setPerimeterVertices([]);
  };

  // 2. INICIAR MODO DIBUJO MANUAL EN MAPA ("Dibujar en Mapa")
  const handleStartManualDrawing = () => {
    if (isPerimeterWalking) {
      setIsPerimeterWalking(false);
      setPerimeterVertices([]);
    }

    setIsManualDrawing(true);
    setManualVertices([]);

    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'info',
      title: '✏️ Modo Dibujo en Mapa',
      text: 'Toca sobre el mapa para marcar cada esquina del predio.',
      showConfirmButton: false,
      timer: 3500,
      background: '#131d33',
      color: '#fff'
    });
  };

  const handleUndoManualVertex = () => {
    setManualVertices(prev => prev.slice(0, -1));
  };

  const handleFinishManualDrawing = () => {
    if (manualVertices.length < 3) {
      Swal.fire({
        icon: 'warning',
        title: 'Vértices Insuficientes',
        text: 'Se requieren al menos 3 vértices para formar un predio cerrado.',
        confirmButtonColor: '#3b82f6',
        background: '#131d33',
        color: '#fff'
      });
      return;
    }

    const area = computePolygonArea(manualVertices);
    const perimetro = computePerimeter(manualVertices);

    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const autoCode = \`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`;

    setFormPreloadData({
      codigo: autoCode,
      vertices: manualVertices,
      area: Math.round(area * 100) / 100,
      perimetro: Math.round(perimetro * 100) / 100,
      tipo_levantamiento: 'DIBUJO_PANTALLA'
    });

    setIsManualDrawing(false);
    setManualVertices([]);
    setActiveTab('form');

    Swal.fire({
      icon: 'success',
      title: 'Polígono Capturado',
      text: \`\${manualVertices.length} vértices (\${area.toFixed(1)} m²). Completa los datos en la ficha.\`,
      timer: 2000,
      showConfirmButton: false,
      background: '#131d33',
      color: '#fff'
    });
  };

  const handleCancelManualDrawing = () => {
    setIsManualDrawing(false);
    setManualVertices([]);
  };

  // 3. MODAL DE COORDENADAS Y COLINDANTES (OPCIÓN 1 MANUAL)
  const handleOpenCoordinatesAndColindantesModal = async () => {
    const { value: formValues } = await Swal.fire({
      title: '📐 Coordenadas y Colindantes',
      html: \`
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left; font-size:12px;">
          <div style="background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); border-radius:10px; padding:10px 12px; color:#bae6fd; line-height:1.4;">
            Ingresa los límites colindantes del predio y sus coordenadas iniciales para la ficha catastral.
          </div>

          <div style="font-weight:700; color:#e2e8f0; margin-top:2px;">🧭 Límites y Colindantes:</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label style="color:#94a3b8; font-size:11px; font-weight:600;">Norte:</label>
              <input id="swal-norte" class="swal2-input" placeholder="ej: Calle A / Sr. Pérez" style="margin:2px 0 0 0; width:100%; height:40px; font-size:13px; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:8px; box-sizing:border-box;">
            </div>
            <div>
              <label style="color:#94a3b8; font-size:11px; font-weight:600;">Sur:</label>
              <input id="swal-sur" class="swal2-input" placeholder="ej: Lote 14 / Quebrada" style="margin:2px 0 0 0; width:100%; height:40px; font-size:13px; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:8px; box-sizing:border-box;">
            </div>
            <div>
              <label style="color:#94a3b8; font-size:11px; font-weight:600;">Este:</label>
              <input id="swal-este" class="swal2-input" placeholder="ej: Av. Principal" style="margin:2px 0 0 0; width:100%; height:40px; font-size:13px; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:8px; box-sizing:border-box;">
            </div>
            <div>
              <label style="color:#94a3b8; font-size:11px; font-weight:600;">Oeste:</label>
              <input id="swal-oeste" class="swal2-input" placeholder="ej: Lote 12 / Río" style="margin:2px 0 0 0; width:100%; height:40px; font-size:13px; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:8px; box-sizing:border-box;">
            </div>
          </div>

          <div style="font-weight:700; color:#e2e8f0; margin-top:6px;">📍 Primer Vértice UTM 17S (Opcional):</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label style="color:#94a3b8; font-size:11px; font-weight:600;">Este (X):</label>
              <input id="swal-vx" type="number" step="0.01" placeholder="Ej: 623280.00" style="margin:2px 0 0 0; width:100%; height:40px; font-size:13px; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:8px; box-sizing:border-box;">
            </div>
            <div>
              <label style="color:#94a3b8; font-size:11px; font-weight:600;">Norte (Y):</label>
              <input id="swal-vy" type="number" step="0.01" placeholder="Ej: 9765480.00" style="margin:2px 0 0 0; width:100%; height:40px; font-size:13px; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:8px; box-sizing:border-box;">
            </div>
          </div>
        </div>
      \`,
      showCancelButton: true,
      confirmButtonText: 'Continuar a Ficha ➔',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#334155',
      background: '#131d33',
      color: '#fff',
      preConfirm: () => {
        const norte = document.getElementById('swal-norte').value;
        const sur = document.getElementById('swal-sur').value;
        const este = document.getElementById('swal-este').value;
        const oeste = document.getElementById('swal-oeste').value;
        const vx = parseFloat(document.getElementById('swal-vx').value);
        const vy = parseFloat(document.getElementById('swal-vy').value);

        return {
          norte: norte ? norte.trim() : '',
          sur: sur ? sur.trim() : '',
          este: este ? este.trim() : '',
          oeste: oeste ? oeste.trim() : '',
          vx: !isNaN(vx) ? vx : null,
          vy: !isNaN(vy) ? vy : null
        };
      }
    });

    if (formValues) {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const autoCode = \`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`;

      const newVertices = [];
      if (formValues.vx !== null && formValues.vy !== null) {
        newVertices.push({
          x: formValues.vx,
          y: formValues.vy,
          orden: 1,
          accuracy: null
        });
      }

      setFormPreloadData({
        codigo: autoCode,
        norte: formValues.norte,
        sur: formValues.sur,
        este: formValues.este,
        oeste: formValues.oeste,
        vertices: newVertices,
        tipo_levantamiento: 'MANUAL_COORDENADAS'
      });

      setActiveTab('form');
    }
  };

  // 4. MENÚ UNIFICADO "+ AGREGAR PREDIO" (SIMILAR AL GEOPORTAL)
  const handleOpenAddPredioMenu = async () => {
    await Swal.fire({
      title: '➕ Agregar Predio',
      html: \`
        <div style="text-align: left; padding: 4px 0;">
          <div style="font-size: 13px; color: #94a3b8; margin-bottom: 14px;">
            Selecciona el método para registrar el nuevo predio:
          </div>

          <!-- Opción 1: Coordenadas Manuales y Colindantes -->
          <div id="swal-opt-manual" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: rgba(30, 41, 59, 0.9); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 14px; margin-bottom: 10px; cursor: pointer;">
            <div style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">📐</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #f8fafc;">1. Coordenadas y Colindantes</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">Ingresar vértices UTM (X, Y) y límites Norte, Sur, Este, Oeste</div>
            </div>
          </div>

          <!-- Opción 2: Dibujar Polígono en Mapa -->
          <div id="swal-opt-draw" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: rgba(30, 41, 59, 0.9); border: 1.5px solid rgba(168, 85, 247, 0.4); border-radius: 14px; margin-bottom: 10px; cursor: pointer;">
            <div style="background: rgba(168, 85, 247, 0.15); color: #c084fc; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">✏️</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #f8fafc;">2. Dibujar en el Mapa</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">Tocar directamente sobre el mapa satelital para trazar vértices</div>
            </div>
          </div>

          <!-- Opción 3: Agregar en Camino (Caminata GPS) -->
          <div id="swal-opt-walk" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: rgba(30, 41, 59, 0.9); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: 14px; cursor: pointer;">
            <div style="background: rgba(16, 185, 129, 0.15); color: #34d399; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">🚶</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #f8fafc;">3. Agregar en Camino (Caminata GPS)</div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">Caminar a cada esquina del terreno con el GPS del teléfono</div>
            </div>
          </div>
        </div>
      \`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      cancelButtonColor: '#334155',
      background: '#131d33',
      color: '#fff',
      didOpen: () => {
        const optManual = document.getElementById('swal-opt-manual');
        const optDraw = document.getElementById('swal-opt-draw');
        const optWalk = document.getElementById('swal-opt-walk');

        if (optManual) optManual.onclick = () => {
          Swal.close();
          handleOpenCoordinatesAndColindantesModal();
        };
        if (optDraw) optDraw.onclick = () => {
          Swal.close();
          handleStartManualDrawing();
        };
        if (optWalk) optWalk.onclick = () => {
          Swal.close();
          handleStartWalking();
        };
      }
    });
  };

  const currentArea = computePolygonArea(perimeterVertices);
  const currentManualArea = computePolygonArea(manualVertices);

  return (
    <>
      {/* Botones Flotantes Superiores Derecha (Limpio y Espacioso) */}
      <div className="map-floating-controls">
        <button 
          className="map-fab" 
          onClick={onRecenterGPS} 
          title="Centrar en mi GPS"
        >
          <Crosshair size={20} color={gps.hasFix ? '#38bdf8' : '#94a3b8'} />
        </button>

        <button 
          className="map-fab" 
          onClick={handleCycleBaseMap} 
          title={\`Mapa: \${activeBaseMap}\`}
        >
          <Layers size={20} />
        </button>
      </div>

      {/* Banner de Caminata de Perímetro con GPS (Agregar en Camino) */}
      {isPerimeterWalking && (
        <div className="walking-panel">
          <div className="walking-stats">
            <span style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
              🚶 Caminata GPS ({perimeterVertices.length} vértices)
            </span>
            <span className="mono" style={{ color: '#fff', fontSize: '11px' }}>
              {currentArea > 0 ? \`\${currentArea.toFixed(1)} m²\` : 'Defina 3+ pts'}
            </span>
          </div>

          <div className="walking-actions">
            <button 
              className="btn-primary-mobile" 
              style={{ height: '38px', fontSize: '12px' }}
              onClick={handleAddVertex}
            >
              <Plus size={16} /> + Vértice ({gps.accuracy ? \`±\${gps.accuracy}m\` : '...'})
            </button>

            {perimeterVertices.length >= 3 && (
              <button 
                className="btn-primary-mobile" 
                style={{ height: '38px', fontSize: '12px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                onClick={handleFinishWalking}
              >
                <CheckSquare size={16} /> Guardar
              </button>
            )}

            <button 
              className="map-fab" 
              style={{ width: '38px', height: '38px', borderRadius: '10px' }}
              onClick={handleCancelWalking}
              title="Cancelar Caminata"
            >
              <X size={16} color="#f43f5e" />
            </button>
          </div>
        </div>
      )}

      {/* Banner de Dibujo Manual en Pantalla (Dibujar en Mapa) */}
      {isManualDrawing && (
        <div className="walking-panel" style={{ border: '1px solid rgba(139, 92, 246, 0.4)', background: 'rgba(15, 23, 42, 0.96)' }}>
          <div className="walking-stats">
            <span style={{ color: '#c084fc', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PenTool size={15} /> ✏️ Dibujar Predio ({manualVertices.length} pts)
            </span>
            <span className="mono" style={{ color: '#fff', fontSize: '11px' }}>
              {currentManualArea > 0 ? \`\${currentManualArea.toFixed(1)} m²\` : 'Toca el mapa'}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#94a3b8', margin: '3px 0 8px 0' }}>
            👆 Toca sobre el mapa satelital para marcar cada esquina del predio.
          </div>

          <div className="walking-actions">
            {manualVertices.length > 0 && (
              <button 
                className="btn-secondary-mobile" 
                style={{ height: '38px', fontSize: '12px', flex: '0 0 auto', padding: '0 12px', gap: '4px' }}
                onClick={handleUndoManualVertex}
              >
                <Undo2 size={14} /> Deshacer
              </button>
            )}

            {manualVertices.length >= 3 && (
              <button 
                className="btn-primary-mobile" 
                style={{ height: '38px', fontSize: '12px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                onClick={handleFinishManualDrawing}
              >
                <CheckSquare size={16} /> Finalizar Predio
              </button>
            )}

            <button 
              className="map-fab" 
              style={{ width: '38px', height: '38px', borderRadius: '10px' }}
              onClick={handleCancelManualDrawing}
              title="Cancelar Dibujo"
            >
              <X size={16} color="#f43f5e" />
            </button>
          </div>
        </div>
      )}

      {/* Barra Inferior del Mapa: Botón Unificado "+ Agregar Predio" (Similar al Geoportal) */}
      {!isPerimeterWalking && !isManualDrawing && (
        <div className="map-bottom-bar">
          <button 
            className="btn-primary-mobile" 
            onClick={handleOpenAddPredioMenu}
            style={{
              height: '50px',
              fontSize: '15px',
              fontWeight: '700',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              boxShadow: '0 4px 18px rgba(37, 99, 235, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Plus size={20} />
            Agregar Predio
          </button>
        </div>
      )}
    </>
  );
}
`;

fs.writeFileSync(toolbarPath, newToolbarCode, 'utf8');
console.log('1. Updated DrawingToolbarMobile.jsx with unified "+ Agregar Predio" menu');

// Bump build.gradle to VersionCode 9, VersionName "1.9"
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 9');
gradle = gradle.replace(/versionName\s+"[^"]+"/, 'versionName "1.9"');
fs.writeFileSync(gradlePath, gradle, 'utf8');
console.log('2. Bumped version in build.gradle to 1.9 (versionCode 9)');
