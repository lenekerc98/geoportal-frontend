import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { API_URL } from '../../services/api';
import './ShapefileUploader.css';

export default function ShapefileUploader({ onClose, onSuccess, authToken, user }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  
  const isSuperAdmin = user?.rol === 'Superadministrador';

  // Mapping state
  const [colCedula, setColCedula] = useState('NUMERO_IDE');
  const [colNombre, setColNombre] = useState('NOMBRE_PRO');
  const [colCodigo, setColCodigo] = useState('CLAVE_CATA');

  useEffect(() => {
    if (isSuperAdmin) {
      fetch(`${API_URL}/api/system/empresas`, {
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
    } else {
      alert("Por favor selecciona un archivo .zip que contenga el shapefile.");
      setFile(null);
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
    
    // Si no es superadmin, se usa 0 y el backend debería usar el del current_user (pero para evitar errores le mandamos el de user.id_empresa)
    const empId = isSuperAdmin ? selectedEmpresa : (user?.id_empresa || 0);

    const mapping = {
      cedula: colCedula,
      nombre_posesionario: colNombre,
      cod_catastral: colCodigo
    };

    try {
      const response = await fetch(`${API_URL}/api/gis/import-shapefile?empresa_id=${empId}&mapping=${encodeURIComponent(JSON.stringify(mapping))}`, {
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
            <select className="input-dynamic" value={selectedEmpresa} onChange={(e) => setSelectedEmpresa(e.target.value)}>
              <option value="">-- Seleccionar Empresa --</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mapping-section">
          <h3 style={{marginBottom: '10px', fontSize: '1rem'}}>Mapeo de Columnas (Atributos Originales)</h3>
          <div className="mapping-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px'}}>
            <div className="mapping-item">
              <label style={{display: 'block', fontSize: '0.8rem', color: 'gray', marginBottom: '3px'}}>Para Cédula:</label>
              <input type="text" className="input-dynamic" value={colCedula} onChange={e => setColCedula(e.target.value)} placeholder="Ej: NUMERO_IDE" />
            </div>
            <div className="mapping-item">
              <label style={{display: 'block', fontSize: '0.8rem', color: 'gray', marginBottom: '3px'}}>Para Propietario:</label>
              <input type="text" className="input-dynamic" value={colNombre} onChange={e => setColNombre(e.target.value)} placeholder="Ej: NOMBRE_PRO" />
            </div>
            <div className="mapping-item">
              <label style={{display: 'block', fontSize: '0.8rem', color: 'gray', marginBottom: '3px'}}>Para Cód. Catastral:</label>
              <input type="text" className="input-dynamic" value={colCodigo} onChange={e => setColCodigo(e.target.value)} placeholder="Ej: CLAVE_CATA" />
            </div>
          </div>
        </div>

        <div className="upload-box" style={{ border: file ? '2px solid var(--primary)' : '2px dashed var(--card-border)', padding: '30px', textAlign: 'center', borderRadius: '8px', marginBottom: '15px', position: 'relative' }}>
          <UploadCloud size={40} color={file ? "var(--primary)" : "gray"} style={{marginBottom: '10px'}} />
          <p style={{margin: 0}}>{file ? file.name : "Selecciona el archivo ZIP aquí"}</p>
          <input type="file" accept=".zip" onChange={handleFileChange} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer'}} />
        </div>

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
