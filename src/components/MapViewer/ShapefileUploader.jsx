import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, X, Eye } from 'lucide-react';
import { API_URL } from '../../services/api';
import shp from 'shpjs';
import './ShapefileUploader.css';

export default function ShapefileUploader({ onClose, onSuccess, authToken, user }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  
  const isSuperAdmin = user?.role?.toLowerCase() === 'superadministrador' || user?.role?.toLowerCase() === 'superadmin';

  // Mapping state
  const [previewColumns, setPreviewColumns] = useState([]);
  const [mapping, setMapping] = useState({ cedula: '', nombre_posesionario: '', cod_catastral: '' });
  const [renames, setRenames] = useState({});
  const [isParsing, setIsParsing] = useState(false);

  // Custom Layer state
  const [importType, setImportType] = useState('catastro_base');
  const [nombreCapa, setNombreCapa] = useState('');

  useEffect(() => {
    if (isSuperAdmin) {
      fetch(`${API_URL}/api/empresas`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      .then(res => res.json())
      .then(data => {
        setEmpresas(data);
      })
      .catch(err => console.error("Error fetching empresas", err));
    }
  }, [isSuperAdmin, authToken]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith('.zip')) {
      setFile(selected);
      setUploadStatus(null);
      setPreviewColumns([]);
      setRenames({});
      setIsParsing(true);
      
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target.result;
          const geojson = await shp(buffer);
          if (geojson && geojson.features && geojson.features.length > 0) {
            const props = geojson.features[0].properties;
            const cols = Object.keys(props).map(key => ({
              original: key,
              sample: props[key]
            }));
            setPreviewColumns(cols);
            
            // Auto-detect common names
            const newMap = { cedula: '', nombre_posesionario: '', cod_catastral: '' };
            cols.forEach(c => {
               const k = c.original.toUpperCase();
               if (k.includes('CEDULA') || k === 'NUMERO_IDE') newMap.cedula = c.original;
               if (k.includes('NOMBRE') || k === 'NOMBRE_PRO') newMap.nombre_posesionario = c.original;
               if (k.includes('CLAVE') || k.includes('CATAST')) newMap.cod_catastral = c.original;
            });
            setMapping(newMap);
          }
        } catch (err) {
          console.error("Error parsing SHP", err);
          alert("Error leyendo el Shapefile para previsualización.");
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsArrayBuffer(selected);
    } else {
      alert("Por favor selecciona un archivo .zip que contenga el shapefile.");
      setFile(null);
      setPreviewColumns([]);
      setIsParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (isSuperAdmin && !selectedEmpresa) {
      alert("Por favor selecciona una Empresa.");
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("import_type", importType);
    if (nombreCapa) formData.append("nombre_capa", nombreCapa);
    
    // Si no es superadmin, se usa 0 y el backend debería usar el del current_user
    const empId = isSuperAdmin ? selectedEmpresa : (user?.empresa_id || 0);

    // Enviar mapping y renames
    const url = `${API_URL}/api/gis/import-shapefile?empresa_id=${empId}&mapping=${encodeURIComponent(JSON.stringify(mapping))}&renames=${encodeURIComponent(JSON.stringify(renames))}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        setUploadStatus({ type: 'success', message: 'Shapefile importado correctamente.', details: data.data });
        if (onSuccess) onSuccess();
      } else {
        setUploadStatus({ type: 'error', message: data.detail || 'Error al importar shapefile.' });
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: 'Error de conexión.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="shapefile-uploader-overlay">
      <div className="shapefile-uploader-modal">
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
        <h2>Importar Shapefile de Polígonos</h2>
        <p className="subtitle">Sube un archivo <b>.zip</b> que contenga el shapefile (.shp, .shx, .dbf, .prj) para generar Predios, Posesionarios, Vértices y Linderos dinámicamente.</p>
        
        {isSuperAdmin && (
          <div className="form-group" style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Asignar a Empresa:</label>
            <select className="input-dynamic" value={selectedEmpresa} onChange={(e) => setSelectedEmpresa(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
              <option value="">-- Seleccionar Empresa --</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre} {emp.sector ? `(${emp.sector})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group" style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Tipo de Importación:</label>
          <select 
            className="input-dynamic" 
            value={importType} 
            onChange={(e) => setImportType(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--card-border)' }}
          >
            <option value="catastro_base">Módulo Catastral Base (Predios, Linderos, Vértices)</option>
            <option value="capa_adicional">Capa Adicional (Visualización genérica)</option>
          </select>
        </div>

        <div className="upload-box" style={{ border: file ? '2px solid var(--primary)' : '2px dashed var(--card-border)', padding: '30px', textAlign: 'center', borderRadius: '8px', marginBottom: '15px', position: 'relative' }}>
          <UploadCloud size={40} color={file ? "var(--primary)" : "gray"} style={{marginBottom: '10px'}} />
          <p style={{margin: 0}}>{file ? file.name : "1. Selecciona el archivo ZIP aquí"}</p>
          <input type="file" accept=".zip" onChange={handleFileChange} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer'}} />
        </div>

        {isParsing && <div style={{textAlign: 'center', margin: '20px 0'}}><Loader2 className="spin" size={24} /> Analizando Shapefile...</div>}

        {importType === 'capa_adicional' && file && !isParsing && (
          <div className="form-group" style={{marginBottom: '20px', background: 'var(--bg-lighter)', padding: '15px', borderRadius: '8px'}}>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Nombre de la Capa:</label>
            <input 
              type="text" 
              className="input-dynamic" 
              placeholder="Ej: Postes de Luz, Vías Principales..." 
              value={nombreCapa}
              onChange={(e) => setNombreCapa(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--card-border)' }}
            />
          </div>
        )}

        {importType === 'catastro_base' && previewColumns.length > 0 && (
          <div className="mapping-section" style={{marginBottom: '20px', background: 'var(--bg-lighter)', padding: '15px', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '15px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Eye size={18} color="var(--primary)" /> Previsualización y Mapeo de Columnas
            </h3>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '6px' }}>
              <table className="logs-table" style={{width: '100%', fontSize: '0.9rem', margin: 0}}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
                  <tr>
                    <th style={{textAlign: 'left', padding: '10px'}}>Columna Original</th>
                    <th style={{textAlign: 'left', padding: '10px'}}>Valor de Ejemplo</th>
                    <th style={{textAlign: 'left', padding: '10px'}}>Vincular A (Sistema)</th>
                    <th style={{textAlign: 'left', padding: '10px'}}>Renombrar como (Opcional)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewColumns.map((col, idx) => (
                  <tr key={idx}>
                    <td style={{fontWeight: 'bold', color: 'var(--primary)'}}>{col.original}</td>
                    <td style={{color: 'var(--text-muted)'}}>{String(col.sample).substring(0, 30)}</td>
                    <td>
                      <select 
                        className="input-dynamic" 
                        style={{padding: '5px'}}
                        value={
                          mapping.cedula === col.original ? 'cedula' : 
                          mapping.nombre_posesionario === col.original ? 'nombre_posesionario' : 
                          mapping.cod_catastral === col.original ? 'cod_catastral' : ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          const newMap = { ...mapping };
                          if (val === 'cedula') { newMap.cedula = col.original; }
                          else if (val === 'nombre_posesionario') { newMap.nombre_posesionario = col.original; }
                          else if (val === 'cod_catastral') { newMap.cod_catastral = col.original; }
                          else {
                            if (newMap.cedula === col.original) newMap.cedula = '';
                            if (newMap.nombre_posesionario === col.original) newMap.nombre_posesionario = '';
                            if (newMap.cod_catastral === col.original) newMap.cod_catastral = '';
                          }
                          setMapping(newMap);
                        }}
                      >
                        <option value="">-- No vincular --</option>
                        <option value="cedula">Cédula</option>
                        <option value="nombre_posesionario">Nombre Propietario</option>
                        <option value="cod_catastral">Código Catastral</option>
                      </select>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className="input-dynamic" 
                        style={{padding: '5px', width: '100%'}} 
                        placeholder={col.original}
                        value={renames[col.original] || ''}
                        onChange={(e) => setRenames({...renames, [col.original]: e.target.value})}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {uploadStatus && (
          <div className={`status-banner ${uploadStatus.type}`} style={{padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '15px', background: uploadStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: uploadStatus.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${uploadStatus.type === 'success' ? '#10b981' : '#ef4444'}`}}>
            {uploadStatus.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <div>
              <strong style={{display: 'block', marginBottom: uploadStatus.details ? '10px' : '0'}}>{uploadStatus.message}</strong>
              {uploadStatus.details && (
                <ul className="details-list" style={{margin: 0, paddingLeft: '20px', fontSize: '0.9rem'}}>
                  <li>Posesionarios creados/actualizados: <b>{uploadStatus.details.posesionarios_creados}</b></li>
                  <li>Predios creados: <b>{uploadStatus.details.predios_creados}</b></li>
                  <li>Vértices generados: <b>{uploadStatus.details.vertices_creados}</b></li>
                  <li>Líneas generadas: <b>{uploadStatus.details.lineas_creadas}</b></li>
                  <li style={{color: 'var(--text-muted)', marginTop: '5px', fontSize: '0.8rem', listStyle: 'none', marginLeft: '-20px'}}>Tabla de respaldo: {uploadStatus.details.tabla_cruda}</li>
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
          <button className="btn-secondary" onClick={onClose} disabled={isUploading} style={{padding: '10px 20px', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer'}}>Cerrar</button>
          <button className="btn-dynamic" onClick={handleUpload} disabled={!file || isUploading} style={{padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            {isUploading ? <><Loader2 size={16} className="spin" /> Procesando...</> : 'Iniciar Importación'}
          </button>
        </div>
      </div>
    </div>
  );
}
