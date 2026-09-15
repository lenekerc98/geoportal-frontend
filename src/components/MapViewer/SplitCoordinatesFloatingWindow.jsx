import React, { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { X, MapPin, Plus, Trash2, Check, FileSpreadsheet, ArrowRight, Minimize2, Maximize2 } from 'lucide-react';
import proj4 from 'proj4';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

// Definición oficial UTM Zona 17S Ecuador
proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

export default function SplitCoordinatesFloatingWindow({
  isOpen,
  onClose,
  onApplyCoordinates,
  existingPoints = []
}) {
  const nodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const [coordType, setCoordType] = useState('UTM'); // 'UTM' o 'WGS84'
  const [inputTab, setInputTab] = useState('table'); // 'table' o 'text'
  const [isMinimized, setIsMinimized] = useState(false);

  // Vértices de la tabla (por defecto 2 vértices mínimos: Entrada y Salida)
  const [vertices, setVertices] = useState([
    { id: 1, label: 'P1 (Entrada)', x: '', y: '' },
    { id: 2, label: 'P2 (Salida)', x: '', y: '' }
  ]);

  // Texto plano para pegar coordenadas
  const [rawText, setRawText] = useState('');

  if (!isOpen) return null;

  // Agregar fila a la tabla de vértices
  const handleAddRow = () => {
    setVertices(prev => [
      ...prev,
      { id: Date.now(), label: `P${prev.length + 1}`, x: '', y: '' }
    ]);
  };

  // Eliminar fila de la tabla
  const handleRemoveRow = (id) => {
    if (vertices.length <= 2) {
      Swal.fire({
        icon: 'info',
        title: 'Mínimo 2 puntos',
        text: 'La línea de corte requiere al menos 2 puntos para atravesar el lote.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }
    setVertices(prev => prev.filter(v => v.id !== id));
  };

  // Actualizar coordenadas en la fila
  const handleCoordChange = (id, field, value) => {
    setVertices(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  // Subir archivo Excel o TXT
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === 'string') {
          setRawText(text);
          setInputTab('text');
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result);
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (json.length > 0) {
            const rows = json.filter(r => r && r.length >= 2 && !isNaN(Number(r[0])) && !isNaN(Number(r[1])));
            if (rows.length >= 2) {
              const newVerts = rows.map((r, i) => ({
                id: Date.now() + i,
                label: i === 0 ? 'P1 (Entrada)' : (i === rows.length - 1 ? `P${i + 1} (Salida)` : `P${i + 1}`),
                x: String(r[0]).trim(),
                y: String(r[1]).trim()
              }));
              setVertices(newVerts);
              setInputTab('table');
              Swal.fire({
                icon: 'success',
                title: 'Archivo cargado',
                text: `Se importaron ${newVerts.length} vértices correctamente.`,
                timer: 1800,
                showConfirmButton: false
              });
            }
          }
        } catch (err) {
          console.error(err);
          Swal.fire('Error', 'No se pudo leer el archivo Excel', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  // Procesar y aplicar las coordenadas al visor
  const handleApply = () => {
    let parsedPoints = [];

    if (inputTab === 'table') {
      for (let i = 0; i < vertices.length; i++) {
        const vx = parseFloat(vertices[i].x);
        const vy = parseFloat(vertices[i].y);
        if (isNaN(vx) || isNaN(vy)) {
          Swal.fire('Coordenadas incompletas', `El punto ${vertices[i].label} tiene valores inválidos.`, 'warning');
          return;
        }
        parsedPoints.push({ x: vx, y: vy });
      }
    } else {
      // Parsear desde texto plano
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (const line of lines) {
        const parts = line.split(/[\s,;\t]+/).filter(Boolean);
        if (parts.length >= 2) {
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          if (!isNaN(x) && !isNaN(y)) {
            parsedPoints.push({ x, y });
          }
        }
      }
    }

    if (parsedPoints.length < 2) {
      Swal.fire('Línea incompleta', 'Se requieren al menos 2 pares de coordenadas (X, Y).', 'warning');
      return;
    }

    // Convertir si es UTM a Lat/Lng WGS84 para Leaflet
    const latLngResult = [];
    try {
      for (const pt of parsedPoints) {
        if (coordType === 'UTM') {
          // UTM Zona 17S (X: Este, Y: Norte) -> [lng, lat]
          const wgs = proj4('EPSG:32717', 'EPSG:4326', [pt.x, pt.y]);
          latLngResult.push({ lat: wgs[1], lng: wgs[0] });
        } else {
          // Si es WGS84 directa: asume X = Lng, Y = Lat
          // O si X está en rango [-5, 5] y Y en [-90, -70] invierte inteligentemente
          let lat = pt.y;
          let lng = pt.x;
          if (Math.abs(pt.x) <= 10 && Math.abs(pt.y) > 50) {
            lat = pt.x;
            lng = pt.y;
          }
          latLngResult.push({ lat, lng });
        }
      }
    } catch (projErr) {
      console.error(projErr);
      Swal.fire('Error de Proyección', 'Error al transformar coordenadas UTM: ' + projErr.message, 'error');
      return;
    }

    onApplyCoordinates(latLngResult);
    Swal.fire({
      icon: 'success',
      title: 'Línea de corte trazada',
      text: `Se aplicaron ${latLngResult.length} vértices en el mapa. Pulse "Cortar Lote" en la barra superior.`,
      timer: 2000,
      showConfirmButton: false
    });
  };

  return (
    <Draggable nodeRef={nodeRef} handle=".drag-handle" cancel="button, input, select, textarea, .no-drag">
      <div
        ref={nodeRef}
        style={{
          position: 'fixed',
          top: '90px',
          right: '25px',
          zIndex: 99999,
          width: '370px',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {/* Barra superior / Drag Handle */}
        <div
          className="drag-handle"
          style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'move',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} color="#38bdf8" />
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff' }}>
              Corte por Coordenadas
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setIsMinimized(prev => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title="Cerrar ventana"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Selector de Sistema de Coordenadas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                Sistema
              </span>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setCoordType('UTM')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: 'none',
                    background: coordType === 'UTM' ? '#ffffff' : 'transparent',
                    color: coordType === 'UTM' ? '#0284c7' : '#64748b',
                    boxShadow: coordType === 'UTM' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  UTM (17S Metros)
                </button>
                <button
                  type="button"
                  onClick={() => setCoordType('WGS84')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: 'none',
                    background: coordType === 'WGS84' ? '#ffffff' : 'transparent',
                    color: coordType === 'WGS84' ? '#0284c7' : '#64748b',
                    boxShadow: coordType === 'WGS84' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  Lat / Lng
                </button>
              </div>
            </div>

            {/* Pestañas: Tabla vs Pegar Texto */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setInputTab('table')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: 'none',
                  background: 'transparent',
                  color: inputTab === 'table' ? '#0284c7' : '#64748b',
                  borderBottom: inputTab === 'table' ? '2px solid #0284c7' : '2px solid transparent',
                  cursor: 'pointer'
                }}
              >
                Tabla de Vértices
              </button>
              <button
                type="button"
                onClick={() => setInputTab('text')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: 'none',
                  background: 'transparent',
                  color: inputTab === 'text' ? '#0284c7' : '#64748b',
                  borderBottom: inputTab === 'text' ? '2px solid #0284c7' : '2px solid transparent',
                  cursor: 'pointer'
                }}
              >
                Pegar / Importar
              </button>
            </div>

            {/* Contenido Pestaña 1: TABLA */}
            {inputTab === 'table' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 28px', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#64748b', paddingBottom: '2px' }}>
                  <span>Vértice</span>
                  <span>{coordType === 'UTM' ? 'X (Este)' : 'Longitud'}</span>
                  <span>{coordType === 'UTM' ? 'Y (Norte)' : 'Latitud'}</span>
                  <span></span>
                </div>

                {vertices.map((v, idx) => (
                  <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 28px', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155' }}>
                      {v.label}
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder={coordType === 'UTM' ? 'ej. 669335' : '-79.123'}
                      value={v.x}
                      onChange={(e) => handleCoordChange(v.id, 'x', e.target.value)}
                      style={{
                        padding: '6px 8px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder={coordType === 'UTM' ? 'ej. 9823134' : '-1.045'}
                      value={v.y}
                      onChange={(e) => handleCoordChange(v.id, 'y', e.target.value)}
                      style={{
                        padding: '6px 8px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(v.id)}
                      disabled={vertices.length <= 2}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: vertices.length <= 2 ? '#cbd5e1' : '#ef4444',
                        cursor: vertices.length <= 2 ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Eliminar fila"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddRow}
                  style={{
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#0284c7',
                    background: '#f0f9ff',
                    border: '1px dashed #bae6fd',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Agregar Vértice Intermedio
                </button>
              </div>
            )}

            {/* Contenido Pestaña 2: PEGAR / ARCHIVO */}
            {inputTab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  rows={6}
                  placeholder={`Pegue coordenadas aquí (un par por línea):\n${coordType === 'UTM' ? '669334.98 9823133.67\n669371.85 9823003.47' : '-79.456123 -1.045612\n-79.457200 -1.046100'}`}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls,.txt"
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#475569',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <FileSpreadsheet size={14} color="#16a34a" /> Importar desde Excel (.xlsx) o TXT
                </button>
              </div>
            )}

            {/* Botón de Aplicar Línea de Corte */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleApply}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#ffffff',
                  background: '#0284c7',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
                }}
              >
                <Check size={16} /> Trazar Línea en el Mapa
              </button>
            </div>

          </div>
        )}
      </div>
    </Draggable>
  );
}
