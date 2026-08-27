import React, { useState, useRef } from 'react';
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Trash2, StopCircle, Check, Info } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';

export default function CadUploaderModal({ onClose, onSuccess, authToken }) {
  const [fileList, setFileList] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [overallError, setOverallError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, percent: 0, currentFileName: '', statusText: '' });
  const xhrRef = useRef(null);
  const isCancelledRef = useRef(false);

  const parseDxfDefaults = (fileName) => {
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    const codMatch = baseName.match(/^([A-Za-z0-9]+-[A-Za-z0-9]+)/i);
    const detectedCod = codMatch ? codMatch[1].toUpperCase() : "NIV-D3";

    let cleanName = baseName.replace(/^[A-Za-z0-9]+-[A-Za-z0-9]+/i, '');
    cleanName = cleanName.replace(/[-_]/g, ' ').trim().toUpperCase();
    if (!cleanName) cleanName = baseName.toUpperCase();

    return {
      codigo: detectedCod,
      nombre: cleanName,
      cuadricula: detectedCod,
      escala: '1:50000'
    };
  };

  const addFiles = (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = [];
    const existingNames = new Set(fileList.map(f => f.file.name));

    Array.from(selectedFiles).forEach(file => {
      if (file.name.toLowerCase().endsWith('.dxf')) {
        if (!existingNames.has(file.name)) {
          const defaults = parseDxfDefaults(file.name);
          newFiles.push({
            id: `${file.name}_${Date.now()}_${Math.random()}`,
            file: file,
            name: file.name,
            size: file.size,
            codigo: defaults.codigo,
            nombre: defaults.nombre,
            cuadricula: defaults.cuadricula,
            escala: defaults.escala,
            status: 'pending', // 'pending', 'uploading', 'success', 'error', 'cancelled'
            message: '',
            percent: 0,
            statusText: 'Listo para subir'
          });
          existingNames.add(file.name);
        }
      }
    });

    if (newFiles.length === 0 && selectedFiles.length > 0) {
      alert("Por favor selecciona o arrastra archivos de AutoCAD con extensión .dxf");
      return;
    }

    setFileList(prev => [...prev, ...newFiles]);
    setOverallError(null);
  };

  const updateFileMeta = (id, field, value) => {
    setFileList(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id) => {
    setFileList(prev => prev.filter(f => f.id !== id));
  };

  const handleCancelUpload = () => {
    isCancelledRef.current = true;
    if (xhrRef.current) {
      try { xhrRef.current.abort(); } catch (e) { }
    }
    setIsUploading(false);
    setFileList(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'cancelled', message: 'Cancelado', statusText: 'Cancelado' } : f));
  };

  const uploadSingleFileXHR = (item, token) => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('codigo', item.codigo || '');
      formData.append('nombre', item.nombre || '');
      formData.append('cuadricula', item.cuadricula || '');
      formData.append('escala', item.escala || '1:50000');

      // Tracking progreso de subida por red
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          const isFinishedUpload = percentComplete >= 100;
          const statusText = isFinishedUpload
            ? 'Analizando capas e insertando en PostGIS...'
            : `Subiendo archivo: ${percentComplete}% (${formatFileSize(event.loaded)} / ${formatFileSize(event.total)})`;

          setFileList(prev => prev.map(f => f.id === item.id ? {
            ...f,
            percent: percentComplete,
            statusText: statusText
          } : f));

          setUploadProgress(prev => ({
            ...prev,
            statusText: statusText
          }));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ ok: true, data });
          } catch (e) {
            resolve({ ok: true, data: {} });
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ ok: false, error: data.detail || 'Error al procesar archivo' });
          } catch (e) {
            resolve({ ok: false, error: `Error ${xhr.status} en el servidor` });
          }
        }
      };

      xhr.onerror = () => {
        resolve({ ok: false, error: 'Error de red o conexión perdida' });
      };

      xhr.onabort = () => {
        resolve({ ok: false, error: 'Subida cancelada por el usuario' });
      };

      xhr.open('POST', `${API_URL}/api/gis/import-dxf`, true);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  };

  const handleUploadAll = async () => {
    if (fileList.length === 0) {
      alert("Selecciona al menos un archivo .dxf.");
      return;
    }

    try {
      setIsUploading(true);
      isCancelledRef.current = false;
      setOverallError(null);
      const token = authToken || localStorage.getItem('catastro_token');

      let successCount = 0;
      let errorCount = 0;

      const pendingItems = fileList.filter(f => f.status !== 'success');
      const totalToUpload = pendingItems.length;

      for (let i = 0; i < pendingItems.length; i++) {
        if (isCancelledRef.current) break;

        const item = pendingItems[i];
        const currentOverallPercent = Math.round((i / totalToUpload) * 100);

        setUploadProgress({
          current: i + 1,
          total: totalToUpload,
          percent: currentOverallPercent,
          currentFileName: item.name,
          statusText: `Iniciando subida de ${item.name} (${formatFileSize(item.size)})...`
        });

        // Marcar en proceso
        setFileList(prev => prev.map(f => f.id === item.id ? {
          ...f,
          status: 'uploading',
          percent: 5,
          statusText: `Enviando ${formatFileSize(item.size)} al servidor...`
        } : f));

        const result = await uploadSingleFileXHR(item, token);

        if (isCancelledRef.current) break;

        if (result.ok) {
          successCount++;
          setFileList(prev => prev.map(f => f.id === item.id ? {
            ...f,
            status: 'success',
            percent: 100,
            statusText: 'Completado',
            message: `${result.data?.data?.total_entidades || 0} entidades guardadas`
          } : f));
        } else {
          errorCount++;
          setFileList(prev => prev.map(f => f.id === item.id ? {
            ...f,
            status: 'error',
            percent: 100,
            statusText: 'Error',
            message: result.error || 'Error al procesar'
          } : f));
        }

        const nextOverallPercent = Math.round(((i + 1) / totalToUpload) * 100);
        setUploadProgress(prev => ({ ...prev, percent: nextOverallPercent }));
      }

      if (successCount > 0) {
        showSuccess(
          '¡Importación Exitosa!',
          `Se importaron ${successCount} carta(s) CAD y sus entidades vectoriales se guardaron en PostGIS.`
        );
        if (onSuccess) onSuccess();
        if (errorCount === 0 && !isCancelledRef.current) {
          setTimeout(onClose, 1200);
        }
      } else if (!isCancelledRef.current) {
        setOverallError('No se pudo importar ningún archivo CAD. Revisa los mensajes de error.');
      }
    } catch (err) {
      setOverallError('Error durante la subida de archivos.');
    } finally {
      setIsUploading(false);
      xhrRef.current = null;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const successCount = fileList.filter(f => f.status === 'success').length;
  const errorCount = fileList.filter(f => f.status === 'error').length;
  const overallPercent = fileList.length > 0 ? Math.round((successCount / fileList.length) * 100) : 0;

  return (
    <div
      className="shapefile-uploader-overlay"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div
        className="shapefile-uploader-modal"
        style={{ maxWidth: '650px', width: '92%' }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <button className="close-btn" onClick={onClose} disabled={isUploading}><X size={20} /></button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <FileSpreadsheet color="#0284c7" size={24} /> Cargar Cartas Topográficas / CAD
        </h2>
        <p className="subtitle" style={{ marginBottom: '14px' }}>
          Arrastra uno o varios planos <b>.dxf</b> (AutoCAD) para almacenar sus geometrías y capas nativas (ej. <b>VALORCUADRICULAR, INFORMACIONMARGI, CUADRICULAUTM, PROYECCION</b>) en la base de datos.
        </p>

        {/* Dropzone Múltiple */}
        <div
          className="upload-box"
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
          onDrop={handleDrop}
          style={{
            border: isDragOver ? '2px solid #0284c7' : (fileList.length > 0 ? '2px solid #10b981' : '2px dashed var(--card-border)'),
            background: isDragOver ? 'rgba(2, 132, 199, 0.08)' : (fileList.length > 0 ? 'rgba(16, 185, 129, 0.04)' : 'transparent'),
            padding: fileList.length > 0 ? '16px 14px' : '32px 20px',
            textAlign: 'center',
            borderRadius: '10px',
            marginBottom: '14px',
            position: 'relative',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
        >
          <UploadCloud
            size={fileList.length > 0 ? 28 : 40}
            color={isDragOver ? "#0284c7" : (fileList.length > 0 ? "#10b981" : "#64748b")}
            style={{ marginBottom: '6px', transition: 'transform 0.2s', transform: isDragOver ? 'scale(1.15)' : 'scale(1)' }}
          />
          <p style={{ margin: 0, fontWeight: (isDragOver || fileList.length > 0) ? 'bold' : 'normal', color: isDragOver ? '#0284c7' : (fileList.length > 0 ? '#059669' : 'inherit'), fontSize: '0.88rem' }}>
            {isDragOver
              ? "¡Suelta tus archivos DXF aquí!"
              : (fileList.length > 0 ? "+ Arrastra más archivos .dxf o haz clic aquí" : "Arrastra o selecciona uno o varios archivos .dxf aquí")}
          </p>
          <input
            type="file"
            accept=".dxf"
            multiple
            disabled={isUploading}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
          />
        </div>

        {/* BARRA DE ESTADO Y PROGRESO GENERAL */}
        {fileList.length > 0 && (
          <div style={{ marginBottom: '14px', background: 'var(--bg-panel)', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="spin" color="#0284c7" />
                    <span>
                      ({uploadProgress.current}/{uploadProgress.total}) <span style={{ color: '#0284c7' }}>{uploadProgress.statusText || 'Procesando...'}</span>
                    </span>
                  </>
                ) : successCount === fileList.length && fileList.length > 0 ? (
                  <>
                    <CheckCircle2 size={14} color="#166534" />
                    <span style={{ color: '#166534' }}>¡Todas las cartas importadas exitosamente!</span>
                  </>
                ) : (
                  <>
                    <Info size={14} color="var(--text-muted)" />
                    <span>Estado: <b>{fileList.length}</b> archivo{fileList.length !== 1 ? 's' : ''} preparado{fileList.length !== 1 ? 's' : ''}</span>
                  </>
                )}
              </div>

              <div style={{ fontWeight: 'bold', color: isUploading ? '#0284c7' : (successCount === fileList.length && fileList.length > 0 ? '#166534' : 'var(--text-main)') }}>
                {isUploading ? `${uploadProgress.percent}%` : `${overallPercent}%`}
              </div>
            </div>

            {/* Barra Visual de Progreso con Animación */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
              <div
                style={{
                  height: '100%',
                  width: `${isUploading ? (uploadProgress.percent || 10) : overallPercent}%`,
                  background: successCount === fileList.length && fileList.length > 0
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                  boxShadow: '0 0 8px rgba(2, 132, 199, 0.5)'
                }}
              />
            </div>
          </div>
        )}

        {/* Lista de Archivos Seleccionados */}
        {fileList.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Detalle por archivo ({fileList.length}):</span>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => setFileList([])}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.76rem', cursor: 'pointer', padding: '2px 6px', fontWeight: 'bold' }}
                >
                  Vaciar lista
                </button>
              )}
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
              {fileList.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px 12px',
                    background: item.status === 'success' ? '#f0fdf4' : (item.status === 'error' ? '#fef2f2' : (item.status === 'uploading' ? 'rgba(2, 132, 199, 0.06)' : 'var(--bg-panel)')),
                    border: '1px solid ' + (item.status === 'success' ? '#bbf7d0' : (item.status === 'error' ? '#fecaca' : (item.status === 'uploading' ? '#bae6fd' : 'var(--card-border)'))),
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, marginRight: '10px' }}>
                      <FileSpreadsheet size={16} color="#0284c7" style={{ flexShrink: 0 }} />
                      <span style={{ fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                        {item.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                        ({formatFileSize(item.size)})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {item.status === 'uploading' && (
                        <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Loader2 size={13} className="spin" /> {item.statusText || 'Procesando...'}
                        </span>
                      )}
                      {item.status === 'success' && (
                        <span style={{ color: '#166534', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> {item.message || 'Completado'}
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span style={{ color: '#991b1b', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={14} /> {item.message || 'Error'}
                        </span>
                      )}
                      {item.status === 'cancelled' && (
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Cancelado</span>
                      )}

                      {/* Botón de Cancelar / Quitar individual */}
                      {item.status !== 'uploading' && (
                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          disabled={isUploading}
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#ef4444',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            transition: 'all 0.2s'
                          }}
                          title="Cancelar y quitar este archivo de la lista"
                        >
                          <Trash2 size={12} /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Formulario editable y Previsualización del Nombre/Código antes de guardar */}
                  {item.status !== 'uploading' && item.status !== 'success' && (
                    <div style={{ marginTop: '6px', borderTop: '1px solid rgba(203, 213, 225, 0.5)', paddingTop: '6px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '8px', marginBottom: '6px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            Código:
                          </label>
                          <input
                            type="text"
                            value={item.codigo || ''}
                            onChange={(e) => updateFileMeta(item.id, 'codigo', e.target.value.toUpperCase())}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'white' }}
                            placeholder="Ej: NIV-D3"
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            Nombre de la Carta:
                          </label>
                          <input
                            type="text"
                            value={item.nombre || ''}
                            onChange={(e) => updateFileMeta(item.id, 'nombre', e.target.value.toUpperCase())}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'white', fontWeight: 'bold' }}
                            placeholder="Ej: CATARAMA o JUAN MONTALVO"
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            Cuadrícula:
                          </label>
                          <input
                            type="text"
                            value={item.cuadricula || ''}
                            onChange={(e) => updateFileMeta(item.id, 'cuadricula', e.target.value.toUpperCase())}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: 'white' }}
                            placeholder="Ej: NIV-D3"
                          />
                        </div>
                      </div>

                      {/* Recuadro de Previsualización en Reporte */}
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '5px 10px', fontSize: '0.74rem', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 'bold', color: '#0284c7' }}>🏷️ Previsualización:</span>
                          <span>CARTA TOPOGRÁFICA: <b style={{ color: '#0f172a' }}>{item.nombre || item.name}</b></span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', color: '#64748b' }}>
                          <span>ESCALA: <b>1:50000</b></span>
                          <span>CÓDIGO: <b>{item.cuadricula || item.codigo}</b></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {overallError && (
          <div style={{ marginBottom: '14px', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {overallError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <div>
            {isUploading && (
              <button
                type="button"
                onClick={handleCancelUpload}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #f87171',
                  background: '#fef2f2',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <StopCircle size={15} /> Detener Subida
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: isUploading ? 'not-allowed' : 'pointer' }}
            >
              {fileList.some(f => f.status === 'success') ? 'Cerrar' : 'Cancelar'}
            </button>

            <button
              type="button"
              onClick={handleUploadAll}
              disabled={fileList.length === 0 || isUploading}
              style={{
                padding: '9px 20px',
                borderRadius: '6px',
                border: 'none',
                background: (fileList.length === 0 || isUploading) ? '#94a3b8' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: 'white',
                fontWeight: 'bold',
                cursor: (fileList.length === 0 || isUploading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isUploading && <Loader2 size={16} className="spin" />}
              {isUploading
                ? `Importando ${uploadProgress.current}/${uploadProgress.total}...`
                : `Guardar en BD (${fileList.length} carta${fileList.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
