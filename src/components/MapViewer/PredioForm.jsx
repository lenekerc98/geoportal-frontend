import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Check, MousePointer2, Upload, FileDown } from 'lucide-react';
import { API_URL } from '../../services/api';
import * as XLSX from 'xlsx';

export default function PredioForm({ onSubmit, onCancel, initialData, onStartDrawing }) {
  const formatInitialCoords = (geoJsonStr) => {
    if (!geoJsonStr) return '';
    try {
      if (typeof geoJsonStr === 'object') geoJsonStr = JSON.stringify(geoJsonStr);
      const parsed = JSON.parse(geoJsonStr);
      if (parsed.type === 'Polygon' && parsed.coordinates && parsed.coordinates[0]) {
        return parsed.coordinates[0].map(coord => `${coord[0]} ${coord[1]}`).join('\n');
      } else if (parsed.type === 'MultiPolygon' && parsed.coordinates && parsed.coordinates[0] && parsed.coordinates[0][0]) {
        return parsed.coordinates[0][0].map(coord => `${coord[0]} ${coord[1]}`).join('\n');
      }
    } catch(e) {
      return geoJsonStr;
    }
    return geoJsonStr;
  };

  const [formData, setFormData] = useState({
    posesionario_id: initialData?.posesionario_id || '',
    cod_catastral: initialData?.cod_catastral || '',
    geom_geojson: initialData?.geom_text || formatInitialCoords(initialData?.geom_geojson),
  });
  const [colindantes, setColindantes] = useState([]);

  const [cedula, setCedula] = useState('');
  const [nombrePosesionario, setNombrePosesionario] = useState('');
  const [loadingCedula, setLoadingCedula] = useState(false);
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [codigoMsg, setCodigoMsg] = useState('');
  const [inputMode, setInputMode] = useState('table');
  const [isNewPosesionario, setIsNewPosesionario] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (cedula && cedula.length >= 10) {
      buscarPosesionario();
    } else {
      setNombrePosesionario('');
      setFormData(prev => ({ ...prev, posesionario_id: '' }));
    }
  }, [cedula]);

  const buscarPosesionario = async () => {
    setLoadingCedula(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/posesionarios/buscar/${cedula}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNombrePosesionario(data.nombre);
        setFormData(prev => ({ ...prev, posesionario_id: data.id }));
        setIsNewPosesionario(false);
      } else {
        setNombrePosesionario('');
        setFormData(prev => ({ ...prev, posesionario_id: '' }));
        setIsNewPosesionario(true);
      }
    } catch (e) {
      setNombrePosesionario('');
      setIsNewPosesionario(true);
    } finally {
      setLoadingCedula(false);
    }
  };

  useEffect(() => {
    if (formData.cod_catastral && formData.cod_catastral.length >= 5) {
      const delay = setTimeout(() => {
        buscarCodigo();
      }, 500);
      return () => clearTimeout(delay);
    } else {
      setCodigoMsg('');
    }
  }, [formData.cod_catastral]);

  const buscarCodigo = async () => {
    setLoadingCodigo(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/codigos/buscar/${formData.cod_catastral}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCodigoMsg('Registrado');
        if (data.cedula_posesionario) {
          setCedula(data.cedula_posesionario); // Esto activará el otro useEffect
        } else {
          setCedula('');
        }
      } else {
        setCodigoMsg('Código libre');
      }
    } catch (e) {
      setCodigoMsg('Error');
    } finally {
      setLoadingCodigo(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        setFormData(prev => ({ ...prev, geom_geojson: text }));
        setInputMode('table');
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length > 1) {
          const rows = json.slice(1);
          let text = rows.map(r => `${r[0] || ''} ${r[1] || ''}`).filter(r => r.trim().length > 3).join('\n');
          setFormData(prev => ({ ...prev, geom_geojson: text }));
          setInputMode('table');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = null;
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Coordenada X (Este)": "", "Coordenada Y (Norte)": "" }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Coordenadas.xlsx");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let finalPosesionarioId = formData.posesionario_id;
    if (!finalPosesionarioId && cedula && nombrePosesionario) {
      try {
        const token = localStorage.getItem('catastro_token');
        const res = await fetch(`${API_URL}/api/gis/posesionarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ cedula, nombre: nombrePosesionario })
        });
        if (res.ok) {
          const data = await res.json();
          finalPosesionarioId = data.id;
        } else {
          alert('Error al registrar nuevo posesionario.');
          return;
        }
      } catch (err) {
        alert('Error al registrar posesionario.');
        return;
      }
    }

    let parsedGeojson = null;
    let esUtm = false;
    
    if (formData.geom_geojson) {
      const rawText = formData.geom_geojson.trim();
      
      if (rawText.startsWith('{')) {
        // Asume GeoJSON normal
        try {
          parsedGeojson = JSON.parse(rawText);
        } catch (err) {
          alert('El GeoJSON ingresado no es válido');
          return;
        }
      } else {
        // Parsea texto plano (X Y por línea, detecta si es UTM)
        try {
          const lines = rawText.split('\n');
          let isUtmCoords = false;
          let coords = lines.map(line => {
            const parts = line.trim().split(/[\s,;\t]+/).filter(Boolean);
            if (parts.length < 2) return null;
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            if (Math.abs(x) > 180 || Math.abs(y) > 180) isUtmCoords = true;
            return [x, y];
          }).filter(c => c !== null && !isNaN(c[0]) && !isNaN(c[1]));

          if (coords.length < 3) {
            alert('Se necesitan al menos 3 coordenadas para formar un polígono.');
            return;
          }

          // Asegurar que el polígono esté cerrado
          if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push([...coords[0]]);
          }

          parsedGeojson = {
            type: "Polygon",
            coordinates: [coords]
          };
          esUtm = isUtmCoords;
        } catch (err) {
          alert('Error al procesar las coordenadas UTM. Asegúrate de usar el formato X Y por cada línea.');
          return;
        }
      }
    }

    onSubmit({
      ...formData,
      posesionario_id: finalPosesionarioId ? parseInt(finalPosesionarioId, 10) : null,
      geom_geojson: parsedGeojson,
      es_utm: esUtm,
      colindantes: colindantes
    });
  };


  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    }}>
      <div className="glass-panel" style={{ padding: '30px', maxWidth: '600px', width: '90%', margin: '0 auto', border: '1px solid var(--card-border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>
          <h2 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '20px' }}>{initialData ? 'Editar Predio' : 'Nuevo Predio (Coordenadas)'}</h2>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {initialData && initialData.id && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {initialData.id}</span>
            )}
            <button type="button" onClick={onCancel} style={{ background: 'var(--bg-main)', border: '1px solid var(--card-border)', color: 'var(--text-main)', cursor: 'pointer', padding: '5px', borderRadius: '50%', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="predio-form-header">
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Código Catastral *</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={formData.cod_catastral} 
                  onChange={e => setFormData({...formData, cod_catastral: e.target.value})} 
                  className="input-dynamic"
                  placeholder="Ej. 17-01-..." 
                  required
                />
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                  {loadingCodigo && <Loader2 size={16} className="spin" color="var(--accent-color)" />}
                  {!loadingCodigo && codigoMsg === 'Registrado' && <Check size={16} color="var(--warning)" />}
                </div>
              </div>
              <small style={{ color: codigoMsg === 'Código libre' ? 'var(--success)' : 'var(--text-muted)', marginTop: '5px', display: 'block', minHeight: '15px' }}>
                {codigoMsg === 'Registrado' ? 'Código existente (asignando posesionario...)' : codigoMsg}
              </small>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Cédula Posesionario *</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={cedula} 
                  onChange={e => setCedula(e.target.value)} 
                  className="input-dynamic"
                  placeholder="Ej. 1712345678" 
                  required
                  maxLength={10}
                />
                {loadingCedula && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}><Loader2 size={16} className="spin" color="var(--accent-color)" /></div>}
              </div>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Nombre Posesionario</label>
              <input 
                type="text" 
                value={nombrePosesionario || ''} 
                onChange={e => isNewPosesionario && setNombrePosesionario(e.target.value)}
                className="input-dynamic"
                placeholder={isNewPosesionario ? "Escriba el nombre..." : "Se autocompleta..."} 
                disabled={!isNewPosesionario}
                style={{ opacity: isNewPosesionario ? 1 : 0.7 }}
                required={isNewPosesionario}
              />
            </div>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Coordenadas del Predio
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setInputMode('table')} style={{ background: inputMode === 'table' ? 'var(--accent-color)' : 'transparent', color: inputMode === 'table' ? 'white' : 'var(--text-muted)', border: `1px solid ${inputMode === 'table' ? 'var(--accent-color)' : 'var(--card-border)'}`, padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Tabla de Puntos</button>
                  <button type="button" onClick={() => setInputMode('text')} style={{ background: inputMode === 'text' ? 'var(--accent-color)' : 'transparent', color: inputMode === 'text' ? 'white' : 'var(--text-muted)', border: `1px solid ${inputMode === 'text' ? 'var(--accent-color)' : 'var(--card-border)'}`, padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Pegar Texto</button>
                  
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".txt,.xlsx" onChange={handleFileUpload} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Upload size={14} /> Subir Archivo
                  </button>
                  <button type="button" onClick={handleDownloadTemplate} style={{ background: 'transparent', color: 'var(--success)', border: '1px solid var(--card-border)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FileDown size={14} /> Plantilla Excel
                  </button>
                </div>
              </div>
              {!initialData && onStartDrawing && (
                <button 
                  type="button" 
                  onClick={onStartDrawing}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--primary-glow)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  <MousePointer2 size={16} /> Dibujar en el Mapa
                </button>
              )}
            </div>

            {inputMode === 'text' ? (
              <>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Ej. <code>599202.0 9796078.0</code> o separadas por tabulador/comas.
                </p>
                <textarea 
                  value={formData.geom_geojson} 
                  onChange={e => setFormData({...formData, geom_geojson: e.target.value})} 
                  className="input-dynamic"
                  style={{ height: '200px', fontFamily: 'monospace', padding: '15px', resize: 'vertical' }} 
                  placeholder={"599202.0 9796078.0\n599245.9 9796098.8\n599287.0 9796030.0"}
                  required={!initialData}
                />
              </>
            ) : (
              <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div className="predio-table-container" style={{ maxHeight: '250px' }}>
                  <div className="predio-table-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>N°</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Coordenada X (Este)</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Coordenada Y (Norte)</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Colindantes</th>
                        <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const lines = formData.geom_geojson ? formData.geom_geojson.split('\n') : [];
                        if (lines.length === 0) lines.push('');
                        return lines.map((line, index) => {
                          const parts = line.trim().split(/[\s,;\t]+/).filter(Boolean);
                          const x = parts[0] || '';
                          const y = parts[1] || '';
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                              <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{index + 1}</td>
                              <td style={{ padding: '8px' }}>
                                <input type="number" step="any" value={x} className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                  const newLines = [...lines];
                                  newLines[index] = `${e.target.value} ${y}`;
                                  setFormData({...formData, geom_geojson: newLines.join('\n')});
                                }} />
                              </td>
                              <td style={{ padding: '8px' }}>
                                <input type="number" step="any" value={y} className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                  const newLines = [...lines];
                                  newLines[index] = `${x} ${e.target.value}`;
                                  setFormData({...formData, geom_geojson: newLines.join('\n')});
                                }} />
                              </td>
                              <td style={{ padding: '8px' }}>
                                <input type="text" value={colindantes[index] || ''} placeholder={`P${String(index+1).padStart(2, '0')} - P${String((index+1)%lines.length + 1).padStart(2, '0')}`} className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                  const newCols = [...colindantes];
                                  newCols[index] = e.target.value;
                                  setColindantes(newCols);
                                }} />
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <button type="button" onClick={() => {
                                  const newLines = [...lines];
                                  newLines.splice(index, 1);
                                  setFormData({...formData, geom_geojson: newLines.join('\n')});
                                  const newCols = [...colindantes];
                                  newCols.splice(index, 1);
                                  setColindantes(newCols);
                                }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}>
                                  <X size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="table-footer">
                  <button type="button" onClick={() => {
                    const current = formData.geom_geojson ? formData.geom_geojson : '';
                    setFormData({...formData, geom_geojson: current + (current.endsWith('\n') || !current ? '' : '\n') + ' '});
                  }} className="btn-add-vertex">
                    + Añadir Vértice
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px' }}>
              Cancelar
            </button>
            <button type="submit" className="btn-dynamic">
              <Save size={18} /> Guardar Predio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
