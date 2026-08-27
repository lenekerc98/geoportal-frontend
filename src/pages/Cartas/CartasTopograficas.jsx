import React, { useState, useEffect, useCallback } from 'react';
import { FileSpreadsheet, UploadCloud, Trash2, Edit2, X, Check, Eye, Map, Layers, RefreshCw, Loader2, CheckCircle2, FileText, Search } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';
import CadUploaderModal from '../../components/MapViewer/CadUploaderModal';
import './CartasTopograficas.css';

export default function CartasTopograficas() {
  const [archivosCad, setArchivosCad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedArchivo, setSelectedArchivo] = useState(null);
  const [editingCarta, setEditingCarta] = useState(null); // { nombre_archivo, codigo, nombre, cuadricula, escala }
  const [savingEdit, setSavingEdit] = useState(false);
  const authToken = localStorage.getItem('catastro_token');

  const fetchArchivos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/gis/cad-archivos`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArchivosCad(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error al cargar cartas topográficas:", err);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchArchivos();
  }, [fetchArchivos]);

  const handleDelete = async (nombreArchivo) => {
    if (!window.confirm(`¿Estás seguro de eliminar la carta "${nombreArchivo}" y todas sus geometrías asociadas?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/gis/cad-archivos/${encodeURIComponent(nombreArchivo)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showSuccess(`Carta "${nombreArchivo}" eliminada correctamente.`);
        fetchArchivos();
      } else {
        showError('No se pudo eliminar la carta.');
      }
    } catch (e) {
      showError('Error de conexión al eliminar la carta.');
    }
  };

  const handleOpenEdit = (archivo) => {
    const baseName = archivo.nombre_archivo.replace(/\.[^/.]+$/, '');
    const codMatch = baseName.match(/^([A-Za-z0-9]+-[A-Za-z0-9]+)/i);
    const defCod = codMatch ? codMatch[1].toUpperCase() : 'NIV-D3';
    let cleanName = baseName.replace(/^[A-Za-z0-9]+-[A-Za-z0-9]+/i, '').replace(/[-_]/g, ' ').trim().toUpperCase();
    if (!cleanName) cleanName = baseName.toUpperCase();

    setEditingCarta({
      nombre_archivo: archivo.nombre_archivo,
      codigo: archivo.codigo || defCod,
      nombre: archivo.nombre || cleanName,
      cuadricula: archivo.cuadricula || archivo.codigo || defCod,
      escala: archivo.escala || '1:50000'
    });
  };

  const handleSaveMetadata = async () => {
    if (!editingCarta) return;
    try {
      setSavingEdit(true);
      const res = await fetch(`${API_URL}/api/gis/cad-archivos/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(editingCarta)
      });
      if (res.ok) {
        showSuccess('Metadatos de la carta topográfica actualizados.');
        setEditingCarta(null);
        fetchArchivos();
      } else {
        const err = await res.json();
        showError(err.detail || 'No se pudieron actualizar los datos.');
      }
    } catch (e) {
      showError('Error de conexión al guardar cambios.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredArchivos = archivosCad.filter(a => 
    a.nombre_archivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.nombre && a.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.codigo && a.codigo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.capas && a.capas.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="cartas-container">
      <div className="cartas-header">
        <div>
          <h1 className="cartas-title">Cartas Topográficas y CAD</h1>
          <p className="cartas-subtitle">
            Gestión y almacenamiento de planos cartográficos (.dxf), cuadrículas UTM y datos marginales para reportes planimétricos.
          </p>
        </div>

        <div className="cartas-actions">
          <button 
            type="button" 
            className="btn-refresh" 
            onClick={fetchArchivos}
            title="Refrescar lista"
          >
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>

          <button 
            type="button" 
            className="btn-upload-cad"
            onClick={() => setShowUploader(true)}
          >
            <UploadCloud size={18} /> Cargar Carta CAD (.dxf)
          </button>
        </div>
      </div>

      <div className="cartas-toolbar">
        <div className="cartas-search">
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Buscar por nombre de carta, archivo o capa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="cartas-stats">
          Total Cartas: <b>{archivosCad.length}</b>
        </div>
      </div>

      {loading ? (
        <div className="cartas-loading">
          <Loader2 size={32} className="spin" color="var(--accent-color)" />
          <span>Cargando cartas topográficas...</span>
        </div>
      ) : filteredArchivos.length === 0 ? (
        <div className="cartas-empty">
          <FileSpreadsheet size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h3>No hay cartas topográficas registradas</h3>
          <p>Sube un archivo de AutoCAD (.dxf) para guardar sus entidades vectoriales y asociarlas a los reportes planimétricos.</p>
          <button 
            type="button" 
            className="btn-upload-cad"
            onClick={() => setShowUploader(true)}
            style={{ marginTop: '15px' }}
          >
            <UploadCloud size={18} /> Subir Primera Carta CAD
          </button>
        </div>
      ) : (
        <div className="cartas-grid">
          {filteredArchivos.map(archivo => {
            const capas = archivo.capas || [];
            const defaultLayers = ['VALORCUADRICULAR', 'INFORMACIONMARGI', 'VALORGEOGRAFICO', 'CUADRICULAUTM', 'PROYECCION'];
            const hasDefaults = capas.filter(c => defaultLayers.includes(c.toUpperCase())).length;
            const displayName = archivo.nombre || archivo.nombre_archivo.replace(/\.[^/.]+$/, '').toUpperCase();

            return (
              <div key={archivo.nombre_archivo} className="carta-card">
                <div className="carta-card-header">
                  <div className="carta-icon-box">
                    <FileSpreadsheet size={24} color="var(--accent-color)" />
                  </div>
                  <div className="carta-info">
                    <h3 title={displayName} style={{ color: '#0f172a', fontWeight: 'bold' }}>{displayName}</h3>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span className="carta-badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 'bold' }}>
                        {archivo.codigo || 'CAD'}
                      </span>
                      {archivo.cuadricula && (
                        <span className="carta-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                          Cuad: {archivo.cuadricula}
                        </span>
                      )}
                      <span className="carta-badge">{archivo.total_elementos || 0} entidades</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={archivo.nombre_archivo}>
                      Archivo: {archivo.nombre_archivo}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button 
                      type="button"
                      className="btn-edit-carta"
                      onClick={() => handleOpenEdit(archivo)}
                      style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}
                      title="Editar nombre y código de la carta"
                    >
                      <Edit2 size={14} /> Editar
                    </button>

                    <button 
                      type="button"
                      className="btn-delete-carta"
                      onClick={() => handleDelete(archivo.nombre_archivo)}
                      title="Eliminar carta de la base de datos"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="carta-card-body">
                  <div className="capas-summary">
                    <span><b>{capas.length}</b> capas detectadas</span>
                    {hasDefaults > 0 && (
                      <span className="badge-base-ok">
                        <CheckCircle2 size={12} /> {hasDefaults} capas base
                      </span>
                    )}
                  </div>

                  <div className="capas-tags">
                    {capas.map(capa => {
                      const isDef = defaultLayers.includes(capa.toUpperCase());
                      return (
                        <span key={capa} className={`capa-tag ${isDef ? 'base' : ''}`}>
                          {capa}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE EDICIÓN DE METADATOS (TEMA CLARO) */}
      {editingCarta && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}
          onClick={() => setEditingCarta(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                  Editar Carta Topográfica
                </h3>
              </div>
              <button 
                onClick={() => setEditingCarta(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Archivo CAD asociado: <b>{editingCarta.nombre_archivo}</b>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  Nombre Oficial de la Carta:
                </label>
                <input 
                  type="text"
                  value={editingCarta.nombre}
                  onChange={(e) => setEditingCarta({ ...editingCarta, nombre: e.target.value.toUpperCase() })}
                  placeholder="Ej: CATARAMA o JUAN MONTALVO"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', color: '#0f172a' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Este nombre exacto aparecerá en el cajetín de "CARTA TOPOGRÁFICA" del reporte planimétrico.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                    Código de Carta:
                  </label>
                  <input 
                    type="text"
                    value={editingCarta.codigo}
                    onChange={(e) => setEditingCarta({ ...editingCarta, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ej: NIV-D3"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                    Cuadrícula:
                  </label>
                  <input 
                    type="text"
                    value={editingCarta.cuadricula}
                    onChange={(e) => setEditingCarta({ ...editingCarta, cuadricula: e.target.value.toUpperCase() })}
                    placeholder="Ej: NIV-D3"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                  />
                </div>
              </div>

              {/* Previsualización en vivo */}
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px 14px', marginTop: '4px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#0284c7', marginBottom: '4px' }}>
                  🏷️ Previsualización en Cajetín de Reporte:
                </div>
                <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                  <div><b>CARTA TOPOGRÁFICA:</b> {editingCarta.nombre || 'SIN NOMBRE'}</div>
                  <div style={{ marginTop: '2px' }}><b>ESCALA:</b> 1:50000 &nbsp;|&nbsp; <b>CÓDIGO:</b> {editingCarta.cuadricula || editingCarta.codigo || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button 
                type="button"
                onClick={() => setEditingCarta(null)}
                style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveMetadata}
                disabled={savingEdit}
                style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: '#0284c7', color: 'white', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {savingEdit ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploader && (
        <CadUploaderModal 
          onClose={() => setShowUploader(false)}
          onSuccess={() => {
            fetchArchivos();
          }}
          authToken={authToken}
        />
      )}
    </div>
  );
}
