import React, { useState, useEffect, useRef, useContext } from 'react';
import Draggable from 'react-draggable';
//, useEffect, useRef, useContext } from 'react';
import { X, Save, Loader2, Check, MousePointer2, Upload, FileDown, Building2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../services/api';
import * as XLSX from 'xlsx';
import proj4 from 'proj4';

proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

export default function PredioForm({ onSubmit, onCancel, initialData, onStartDrawing }) {
  const formatInitialCoords = (geoJsonStr) => {
    if (!geoJsonStr) return '';
    try {
      if (typeof geoJsonStr === 'object') geoJsonStr = JSON.stringify(geoJsonStr);
      const parsed = JSON.parse(geoJsonStr);
      if (parsed.type === 'Polygon' && parsed.coordinates && parsed.coordinates[0]) {
        return parsed.coordinates[0].map(coord => {
          if (Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90) {
            const utm = proj4('EPSG:4326', 'EPSG:32717', [coord[0], coord[1]]);
            return `${utm[0].toFixed(2)} ${utm[1].toFixed(2)}`;
          }
          return `${coord[0]} ${coord[1]}`;
        }).join('\n');
      } else if (parsed.type === 'MultiPolygon' && parsed.coordinates && parsed.coordinates[0] && parsed.coordinates[0][0]) {
        return parsed.coordinates[0][0].map(coord => {
          if (Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90) {
            const utm = proj4('EPSG:4326', 'EPSG:32717', [coord[0], coord[1]]);
            return `${utm[0].toFixed(2)} ${utm[1].toFixed(2)}`;
          }
          return `${coord[0]} ${coord[1]}`;
        }).join('\n');
      }
    } catch (e) {
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
  
  useEffect(() => {
    if (initialData && initialData.id) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/gis/predios/detalle-id/${initialData.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(data => {
        if (data && data.linderos && data.linderos.length > 0) {
          const sorted = data.linderos.sort((a, b) => a.id - b.id);
          setColindantes(sorted.map(l => l.colindante || ''));
        }
      })
      .catch(e => console.error("Error cargando colindantes:", e));
    }
  }, [initialData]);

  const { activeEmpresa, activeProyecto } = useContext(AppContext);
  const [empresasList, setEmpresasList] = useState([]);
  const [proyectosList, setProyectosList] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(initialData?.empresa_id || activeEmpresa?.id || '');
  const [selectedProyectoId, setSelectedProyectoId] = useState(initialData?.proyecto_id || activeProyecto?.id || '');

  useEffect(() => {
    if (!activeEmpresa) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/empresas`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setEmpresasList(data);
            if (data.length === 1 && !selectedEmpresaId) {
              setSelectedEmpresaId(data[0].id);
            }
          }
        })
        .catch(console.error);
    }
  }, [activeEmpresa, selectedEmpresaId]);

  useEffect(() => {
    const targetEmpresaId = activeEmpresa?.id || selectedEmpresaId;
    if (targetEmpresaId && (!activeProyecto || !activeProyecto.empresas_ids || !activeProyecto.empresas_ids.includes(parseInt(targetEmpresaId)))) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/proyectos`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const filtered = data.filter(p => p.empresas_ids && p.empresas_ids.includes(parseInt(targetEmpresaId)));
            setProyectosList(filtered);
            if (filtered.length === 1 && !selectedProyectoId) {
              setSelectedProyectoId(filtered[0].id);
            }
          }
        })
        .catch(console.error);
    }
  }, [activeProyecto, selectedEmpresaId, activeEmpresa]);

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
    if (formData.cod_catastral && formData.cod_catastral.trim().length >= 5) {
      const delay = setTimeout(() => {
        buscarCodigo();
      }, 500);
      return () => clearTimeout(delay);
    } else {
      setCodigoMsg('');
    }
  }, [formData.cod_catastral]);

  // Auto-llenado de Provincia y Cantón basado en la Empresa activa
  useEffect(() => {
    if (!initialData?.id && activeEmpresa && formData.cod_catastral.replace(/\s/g, '').length === 0) {
      const autoFillDPA = async () => {
        try {
          const provRes = await fetch(`${API_URL}/api/system/dpa/provincias`);
          const provincias = await provRes.json();
          const normalize = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
          
          const provMatch = provincias.find(p => normalize(p.nombre) === normalize(activeEmpresa.provincia));
          
          if (provMatch) {
            let newCod = provMatch.codigo_dpa;
            const cantRes = await fetch(`${API_URL}/api/system/dpa/cantones?provincia_id=${provMatch.id}`);
            const cantones = await cantRes.json();
            const cantMatch = cantones.find(c => normalize(c.nombre) === normalize(activeEmpresa.canton));
            
            if (cantMatch && cantMatch.codigo_dpa) {
              // El código de cantón tiene 4 dígitos (ej: 1211), tomamos los dos últimos
              newCod += cantMatch.codigo_dpa.substring(2, 4);
            }
            
            setFormData(prev => ({
               ...prev,
               cod_catastral: (newCod + prev.cod_catastral.substring(newCod.length)).padEnd(19, ' ').substring(0, 19)
            }));
          }
        } catch (e) {
          console.error('Error auto-llenando DPA:', e);
        }
      };
      autoFillDPA();
    }
  }, [activeEmpresa, initialData]);

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

  const calcularRumbo = (x1, y1, x2, y2) => {
    if (!x1 || !y1 || !x2 || !y2) return '-';
    const dx = parseFloat(x2) - parseFloat(x1);
    const dy = parseFloat(y2) - parseFloat(y1);
    if (dx === 0 && dy === 0) return '-';
    
    let ang = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
    const g = Math.floor(ang);
    const m = Math.floor((ang - g) * 60);
    const s = ((ang - g - m / 60) * 3600).toFixed(1);
    
    let ns = dy >= 0 ? 'N' : 'S';
    let ew = dx >= 0 ? 'E' : 'W';
    
    return `${ns} ${g}°${m}'${s}" ${ew}`;
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

    const finalCod = formData.cod_catastral.replace(/\s/g, '');
    if (finalCod.length !== 19) {
      alert('La Clave Catastral debe tener exactamente 19 dígitos.');
      return;
    }

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
      cod_catastral: finalCod,
      posesionario_id: finalPosesionarioId ? parseInt(finalPosesionarioId, 10) : null,
      empresa_id: selectedEmpresaId ? parseInt(selectedEmpresaId, 10) : null,
      proyecto_id: activeProyecto ? activeProyecto.id : (selectedProyectoId ? parseInt(selectedProyectoId, 10) : null),
      geom_geojson: parsedGeojson,
      es_utm: esUtm,
      colindantes: colindantes
    });
  };


  const nodeRef = useRef(null);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    }}>
      <Draggable nodeRef={nodeRef} handle=".drag-handle" cancel="button, input, select, textarea, .no-drag">
      <div ref={nodeRef} className="glass-panel" style={{ padding: '30px', maxWidth: '600px', width: '90%', margin: '0 auto', border: '1px solid var(--card-border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px', cursor: 'move' }}>
          <h2 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '20px' }}>{initialData && initialData.id ? 'Editar Predio' : 'Nuevo Predio (Coordenadas)'}</h2>

          <div style={{ display: 'flex', gap: '10px' }}>
            {initialData && initialData.id && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {initialData.id}</span>
            )}
            <button type="button" onClick={onCancel} style={{ background: 'var(--bg-main)', border: '1px solid var(--card-border)', color: 'var(--text-main)', cursor: 'pointer', padding: '5px', borderRadius: '50%', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        {((!activeEmpresa && empresasList.length > 1) || (!activeProyecto && proyectosList.length > 1)) && (
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
            {!activeEmpresa && empresasList.length > 1 && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Empresa *</label>
                <select className="input-dynamic" value={selectedEmpresaId} onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedProyectoId(''); }} required>
                  <option value="">Seleccione Empresa...</option>
                  {empresasList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            )}
            {!activeProyecto && proyectosList.length > 1 && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Proyecto *</label>
                <select className="input-dynamic" value={selectedProyectoId} onChange={e => setSelectedProyectoId(e.target.value)} required disabled={!selectedEmpresaId}>
                  <option value="">Seleccione Proyecto...</option>
                  {proyectosList.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
              <span>Clave Catastral (19 dígitos) *</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Prov-Cant-Parr-Zona-Sect-Pol-Pred-Div</span>
            </label>
            <div style={{ display: 'flex', gap: '4px', position: 'relative', width: '100%', overflowX: 'auto', paddingBottom: '5px' }}>
              <input id="cc-0" type="text" maxLength="2" placeholder="Pr" title="Provincia (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(0, 2).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let newCod = (val + formData.cod_catastral.substring(2)).padEnd(19, ' ').substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
                if (val.length === 2) document.getElementById('cc-1')?.focus();
              }} required />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
              <input id="cc-1" type="text" maxLength="2" placeholder="Ca" title="Cantón (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(2, 4).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let curr = formData.cod_catastral.padEnd(19, ' ');
                let newCod = (curr.substring(0, 2) + val.padEnd(2, ' ') + curr.substring(4)).substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
                if (val.length === 2) document.getElementById('cc-2')?.focus();
              }} required />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
              <input id="cc-2" type="text" maxLength="2" placeholder="Pa" title="Parroquia (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(4, 6).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let curr = formData.cod_catastral.padEnd(19, ' ');
                let newCod = (curr.substring(0, 4) + val.padEnd(2, ' ') + curr.substring(6)).substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
                if (val.length === 2) document.getElementById('cc-3')?.focus();
              }} required />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
              <input id="cc-3" type="text" maxLength="2" placeholder="Zo" title="Zona (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(6, 8).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let curr = formData.cod_catastral.padEnd(19, ' ');
                let newCod = (curr.substring(0, 6) + val.padEnd(2, ' ') + curr.substring(8)).substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
                if (val.length === 2) document.getElementById('cc-4')?.focus();
              }} required />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
              <input id="cc-4" type="text" maxLength="2" placeholder="Se" title="Sector (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(8, 10).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let curr = formData.cod_catastral.padEnd(19, ' ');
                let newCod = (curr.substring(0, 8) + val.padEnd(2, ' ') + curr.substring(10)).substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
                if (val.length === 2) document.getElementById('cc-5')?.focus();
              }} required />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
              <input id="cc-5" type="text" maxLength="3" placeholder="Pol" title="Polígono (3 dígitos)" className="input-dynamic" style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(10, 13).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let curr = formData.cod_catastral.padEnd(19, ' ');
                let newCod = (curr.substring(0, 10) + val.padEnd(3, ' ') + curr.substring(13)).substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
                if (val.length === 3) document.getElementById('cc-6')?.focus();
              }} required />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
              <input id="cc-6" type="text" maxLength="3" placeholder="Pre" title="Predio (3 dígitos)" className="input-dynamic" style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(13, 16).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let curr = formData.cod_catastral.padEnd(19, ' ');
                let newCod = (curr.substring(0, 13) + val.padEnd(3, ' ') + curr.substring(16)).substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
                if (val.length === 3) document.getElementById('cc-7')?.focus();
              }} required />
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
              <input id="cc-7" type="text" maxLength="3" placeholder="Div" title="División (3 dígitos)" className="input-dynamic" style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={formData.cod_catastral.substring(16, 19).trim()} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                let curr = formData.cod_catastral.padEnd(19, ' ');
                let newCod = (curr.substring(0, 16) + val.padEnd(3, ' ') + curr.substring(19)).substring(0, 19);
                setFormData({ ...formData, cod_catastral: newCod });
              }} required />
              
              <div style={{ position: 'absolute', right: '-25px', top: '50%', transform: 'translateY(-50%)' }}>
                {loadingCodigo && <Loader2 size={16} className="spin" color="var(--accent-color)" />}
                {!loadingCodigo && codigoMsg === 'Registrado' && <Check size={16} color="var(--warning)" />}
              </div>
            </div>
            <small style={{ color: codigoMsg === 'Código libre' ? 'var(--success)' : 'var(--text-muted)', marginTop: '5px', display: 'block', minHeight: '15px' }}>
              {codigoMsg === 'Registrado' ? 'Código existente (asignando posesionario...)' : (formData.cod_catastral.replace(/\s/g, '').length !== 19 && formData.cod_catastral.length > 0 ? 'Faltan dígitos (19 obligatorios)' : codigoMsg)}
            </small>
          </div>

          <div className="predio-form-header">
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
              {!(initialData && initialData.id) && onStartDrawing && (
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
                  onChange={e => setFormData({ ...formData, geom_geojson: e.target.value })}
                  className="input-dynamic"
                  style={{ height: '200px', fontFamily: 'monospace', padding: '15px', resize: 'vertical' }}
                  placeholder={"599202.0 9796078.0\n599245.9 9796098.8\n599287.0 9796030.0"}
                  required={!(initialData && initialData.id)}
                />
              </>
            ) : (
              <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div className="predio-table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <div className="predio-table-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>N°</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Coordenada X (Este)</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Coordenada Y (Norte)</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Rumbo</th>
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
                                  <input type="text" value={x} className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                    const newLines = [...lines];
                                    newLines[index] = `${e.target.value} ${y}`;
                                    setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                  }} />
                                </td>
                                <td style={{ padding: '8px' }}>
                                  <input type="text" value={y} className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                    const newLines = [...lines];
                                    newLines[index] = `${x} ${e.target.value}`;
                                    setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                  }} />
                                </td>
                                <td style={{ padding: '8px', color: 'var(--text-main)' }}>
                                  {(() => {
                                    const nextLine = lines[index + 1];
                                    if (!nextLine) return '-';
                                    const nextParts = nextLine.trim().split(/[\s,;\t]+/).filter(Boolean);
                                    const nx = nextParts[0] || '';
                                    const ny = nextParts[1] || '';
                                    return calcularRumbo(x, y, nx, ny);
                                  })()}
                                </td>
                                <td style={{ padding: '8px' }}>
                                  <input type="text" value={colindantes[index] || ''} placeholder="Pedro Castillo" className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                    const newCols = [...colindantes];
                                    newCols[index] = e.target.value;
                                    setColindantes(newCols);
                                  }} />
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                  <button type="button" onClick={() => {
                                    const newLines = [...lines];
                                    newLines.splice(index, 1);
                                    setFormData({ ...formData, geom_geojson: newLines.join('\n') });
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
                    setFormData({ ...formData, geom_geojson: current + (current.endsWith('\n') || !current ? '' : '\n') + ' ' });
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
      </Draggable>
    </div>
  );
}
