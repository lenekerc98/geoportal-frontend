import React, { useState, useEffect } from 'react';
import { X, Cloud, RefreshCw, CheckCircle, File as FileIcon } from 'lucide-react';
import { API_URL } from '../services/api';

export default function S3BrowserModal({ isOpen, onClose, onSelect, authToken }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/gis/s3/list`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Error al listar archivos S3');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'auto'
    }} onClick={(e) => e.stopPropagation()}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--card-border)',
        borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          padding: '20px', borderBottom: '1px solid var(--card-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
            <Cloud size={24} color="var(--accent-color)" /> Explorador S3 (Ortofotos)
          </h2>
          <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onClose} />
        </div>
        
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Selecciona una ortofoto no procesada para generarle pirámides (.ovr).</span>
            <button 
              onClick={fetchFiles} 
              disabled={loading} 
              style={{ 
                background: 'rgba(56, 189, 248, 0.1)', 
                color: 'var(--accent-color)', 
                border: '1px solid var(--accent-color)',
                padding: '6px 12px', 
                borderRadius: '8px',
                display: 'flex', 
                gap: '8px', 
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
            </button>
          </div>
          
          {error && <div style={{ color: '#ef4444', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginBottom: '15px' }}>{error}</div>}
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando archivos desde Amazon S3...</div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No se encontraron archivos en la carpeta Ortofotos de S3.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map((f, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px', background: 'var(--bg-main)', borderRadius: '8px',
                  border: '1px solid var(--card-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                    <FileIcon size={18} color="var(--accent-color)" />
                    <span style={{ wordBreak: 'break-all' }}>{f.filename}</span>
                  </div>
                  {f.procesado ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '0.85rem' }}>
                      <CheckCircle size={14} /> Catalogada
                    </span>
                  ) : (
                    <button 
                      className="btn-primary" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(f.filename);
                      }} 
                      style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer', position: 'relative', zIndex: 10001, pointerEvents: 'auto' }}
                    >
                      Procesar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
