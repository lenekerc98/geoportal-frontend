import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  Trash2,
  Edit2,
  X,
  Check,
  Eye,
  Map,
  Layers,
  RefreshCw,
  Loader2,
  CheckCircle2,
  FileText,
  Search,
  ShieldAlert,
  Star,
  Building2
} from 'lucide-react';
import { API_URL } from '../../services/api';
import { confirmDelete, showSuccess, showError } from '../../utils/swal';
import { AppContext } from '../../context/AppContext';
import CadUploaderModal from '../../components/MapViewer/CadUploaderModal';
import './CartasTopograficas.css';

export default function CartasTopograficas() {
  const { activeEmpresa, setGlobalEmpresa } = useContext(AppContext);
  const [archivosCad, setArchivosCad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [editingCarta, setEditingCarta] = useState(null); // { nombre_archivo, codigo, nombre, cuadricula, escala }
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingDefault, setSavingDefault] = useState(null);
  const [hasAccess, setHasAccess] = useState(true);
  const authToken = localStorage.getItem('catastro_token');

  useEffect(() => {
    if (!authToken) return;
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      const role = (payload.role || '').toLowerCase();
      if (role !== 'superadmin' && role !== 'superadministrador') {
        if (payload.permisos && payload.permisos.cartas_topograficas === false) {
          setHasAccess(false);
        }
      }
    } catch (e) {}

    fetch(`${API_URL}/api/users/me/`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(userData => {
        const role = (userData?.rol?.nombre || '').toLowerCase();
        if (role !== 'superadmin' && role !== 'superadministrador') {
          if (userData?.rol?.permisos?.cartas_topograficas === false) {
            setHasAccess(false);
          } else {
            setHasAccess(true);
          }
        }
      })
      .catch(console.error);
  }, [authToken]);

  const fetchArchivos = useCallback(async () => {
    try {
      setLoading(true);
      const empIdParam = activeEmpresa?.id ? `?empresa_id=${activeEmpresa.id}` : '';
      const res = await fetch(`${API_URL}/api/gis/cad-archivos${empIdParam}`, {
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
  }, [authToken, activeEmpresa?.id]);

  useEffect(() => {
    fetchArchivos();
  }, [fetchArchivos]);

  // Establecer o desmarcar carta predeterminada para la empresa activa
  const handleToggleDefault = async (archivo, setAsDefault) => {
    if (!activeEmpresa) {
      showError('Selecciona una empresa activa para asociar la carta predeterminada.');
      return;
    }

    try {
      setSavingDefault(archivo.nombre_archivo);
      const res = await fetch(`${API_URL}/api/gis/cad-archivos/predeterminada`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          empresa_id: activeEmpresa.id,
          nombre_archivo: setAsDefault ? archivo.nombre_archivo : null
        })
      });

      if (res.ok) {
        const result = await res.json();
        // Sincronizar en AppContext para que el reporte planimétrico lo detecte de inmediato
        const updatedEmpresa = {
          ...activeEmpresa,
          parametros: result.parametros
        };
        setGlobalEmpresa(updatedEmpresa);
        showSuccess(
          setAsDefault
            ? `Carta "${archivo.nombre || archivo.nombre_archivo}" fijada como predeterminada para ${activeEmpresa.nombre}.`
            : `Se quitó la carta predeterminada de ${activeEmpresa.nombre}.`
        );
        fetchArchivos();
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.detail || 'No se pudo configurar la carta predeterminada.');
      }
    } catch (e) {
      showError('Error de conexión al guardar carta predeterminada.');
    } finally {
      setSavingDefault(null);
    }
  };

  // Eliminar la carta CAD completa
  const handleDelete = async (nombreArchivo) => {
    const confirmed = await confirmDelete(
      `¿Eliminar la carta "${nombreArchivo}"?`,
      'Se eliminarán permanentemente todas las entidades, capas vectoriales y registros asociados de la base de datos.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/gis/cad-archivos/${encodeURIComponent(nombreArchivo)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showSuccess(`Carta "${nombreArchivo}" eliminada correctamente.`);
        // Si estaba asignada como predeterminada, actualizar empresa local
        if (activeEmpresa?.parametros?.carta_predeterminada?.toLowerCase() === nombreArchivo.toLowerCase()) {
          const newParams = { ...activeEmpresa.parametros };
          delete newParams.carta_predeterminada;
          setGlobalEmpresa({ ...activeEmpresa, parametros: newParams });
        }
        fetchArchivos();
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.detail || 'No se pudo eliminar la carta.');
      }
    } catch (e) {
      showError('Error de conexión al eliminar la carta.');
    }
  };

  // Eliminar una capa específica dentro del archivo CAD
  const handleDeleteCapa = async (e, nombreArchivo, capa) => {
    e.stopPropagation();
    const confirmed = await confirmDelete(
      `¿Eliminar la capa "${capa}"?`,
      `Se borrarán todos los elementos geométricos de la capa "${capa}" pertenecientes al archivo "${nombreArchivo}".`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/gis/cad-archivos/${encodeURIComponent(nombreArchivo)}/capas/${encodeURIComponent(capa)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showSuccess(`Capa "${capa}" eliminada correctamente.`);
        fetchArchivos();
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.detail || 'No se pudo eliminar la capa.');
      }
    } catch (e) {
      showError('Error de conexión al eliminar la capa.');
    }
  };

  const handleOpenEdit = (archivo) => {
    const baseName = (archivo.nombre_archivo || '').replace(/\.[^/.]+$/, '');
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
        const err = await res.json().catch(() => ({}));
        showError(err.detail || 'No se pudieron actualizar los datos.');
      }
    } catch (e) {
      showError('Error de conexión al guardar cambios.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredArchivos = useMemo(() => {
    if (!searchTerm.trim()) return archivosCad;
    const term = searchTerm.toLowerCase();
    return archivosCad.filter(a =>
      a.nombre_archivo?.toLowerCase().includes(term) ||
      (a.nombre && a.nombre.toLowerCase().includes(term)) ||
      (a.codigo && a.codigo.toLowerCase().includes(term)) ||
      (a.capas && a.capas.some(c => c.toLowerCase().includes(term)))
    );
  }, [archivosCad, searchTerm]);

  if (!hasAccess) {
    return (
      <div className="cartas-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '40px 20px' }}>
        <ShieldAlert size={64} style={{ color: 'var(--danger, #ef4444)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-main)', margin: '0 0 8px 0' }}>Acceso Restringido</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '440px', margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.5' }}>
          Tu rol no cuenta con los permisos necesarios para visualizar o administrar el módulo de Cartas Topográficas.
        </p>
        <button 
          onClick={() => window.location.href = '/geoportal'}
          className="btn-upload-cad"
          style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Map size={18} /> Volver al Geoportal
        </button>
      </div>
    );
  }

  return (
    <div className="cartas-container">
      <div className="cartas-header">
        <div>
          <h1 className="cartas-title">Cartas Topográficas y CAD</h1>
          <p className="cartas-subtitle">
            Gestión y almacenamiento de planos cartográficos (.dxf), cuadrículas UTM y asignación de carta predeterminada para reportes planimétricos.
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', flexGrow: 1 }}>
          <div className="cartas-search">
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Buscar por nombre de carta, archivo o capa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="cartas-empresa-indicator">
            <Building2 size={16} />
            <span>
              Empresa activa: <b>{activeEmpresa?.nombre || 'General / Todas'}</b>
            </span>
          </div>
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
            const displayName = archivo.nombre || (archivo.nombre_archivo || '').replace(/\.[^/.]+$/, '').toUpperCase();

            // Determinar si es la predeterminada para la empresa activa
            const empDefCarta = activeEmpresa?.parametros?.carta_predeterminada;
            const isDefault = Boolean(
              archivo.es_predeterminada ||
              (empDefCarta && archivo.nombre_archivo && archivo.nombre_archivo.toLowerCase() === empDefCarta.toLowerCase())
            );

            return (
              <div
                key={archivo.nombre_archivo}
                className={`carta-card ${isDefault ? 'is-default' : ''}`}
              >
                {/* CABECERA DE LA CARTA */}
                <div className="carta-card-header">
                  <div className="carta-header-top">
                    <div className="carta-icon-box">
                      <FileSpreadsheet size={22} color="#0284c7" />
                    </div>
                    <div className="carta-title-group">
                      <div className="carta-title-row">
                        <h3 className="carta-card-title" title={displayName}>
                          {displayName}
                        </h3>
                        {isDefault && (
                          <span className="badge-default-carta" title={`Carta predeterminada para ${activeEmpresa?.nombre || 'la empresa activa'}`}>
                            <Star size={11} fill="#d97706" color="#b45309" /> PREDETERMINADA
                          </span>
                        )}
                      </div>
                      <div className="carta-filename-row" title={archivo.nombre_archivo}>
                        <FileText size={12} color="#94a3b8" />
                        <span>{archivo.nombre_archivo}</span>
                      </div>
                    </div>
                  </div>

                  {/* METADATOS Y BADGES */}
                  <div className="carta-meta-row">
                    <span className="carta-badge badge-code" title="Código de carta">
                      {archivo.codigo || 'CAD'}
                    </span>
                    {archivo.cuadricula && (
                      <span className="carta-badge badge-cuad" title={`Cuadrícula: ${archivo.cuadricula}`}>
                        <b>Cuad:</b> {archivo.cuadricula}
                      </span>
                    )}
                    <span className="carta-badge badge-entidades" title="Entidades vectoriales">
                      <b>{Number(archivo.total_elementos || 0).toLocaleString()}</b> entidades
                    </span>
                  </div>
                </div>

                {/* CUERPO: CAPAS DETECTADAS */}
                <div className="carta-card-body">
                  <div className="capas-summary">
                    <span className="capas-count-text">
                      <Layers size={13} color="#64748b" />
                      <b>{capas.length}</b> {capas.length === 1 ? 'capa detectada' : 'capas detectadas'}
                    </span>
                    {hasDefaults > 0 && (
                      <span className="badge-base-ok" title="Capas base topográficas estándar reconocidas">
                        <CheckCircle2 size={12} /> {hasDefaults} capas base
                      </span>
                    )}
                  </div>

                  {capas.length > 0 ? (
                    <div className="capas-tags">
                      {capas.map(capa => {
                        const isDef = defaultLayers.includes(capa.toUpperCase());
                        return (
                          <span key={capa} className={`capa-tag ${isDef ? 'base' : ''}`} title={capa}>
                            <span className="capa-tag-name">{capa}</span>
                            <button
                              type="button"
                              className="capa-delete-btn"
                              onClick={(e) => handleDeleteCapa(e, archivo.nombre_archivo, capa)}
                              title={`Eliminar únicamente la capa "${capa}"`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="capas-empty-note">
                      <span>Sin capas vectoriales detectadas</span>
                    </div>
                  )}
                </div>

                {/* FOOTER DE ACCIONES */}
                <div className="carta-card-footer">
                  <div className="footer-left">
                    {isDefault ? (
                      <button
                        type="button"
                        className="btn-toggle-default active"
                        onClick={() => handleToggleDefault(archivo, false)}
                        disabled={savingDefault === archivo.nombre_archivo}
                        title={`Quitar como predeterminada de ${activeEmpresa?.nombre || 'la empresa'}`}
                      >
                        {savingDefault === archivo.nombre_archivo ? <Loader2 size={13} className="spin" /> : <Star size={13} fill="#d97706" color="#d97706" />}
                        <span>Predeterminada</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-toggle-default"
                        onClick={() => handleToggleDefault(archivo, true)}
                        disabled={savingDefault === archivo.nombre_archivo}
                        title={`Fijar como predeterminada para ${activeEmpresa?.nombre || 'la empresa activa'}`}
                      >
                        {savingDefault === archivo.nombre_archivo ? <Loader2 size={13} className="spin" /> : <Star size={13} />}
                        <span>Predeterminada</span>
                      </button>
                    )}
                  </div>

                  <div className="footer-right">
                    <button
                      type="button"
                      className="btn-edit-carta"
                      onClick={() => handleOpenEdit(archivo)}
                      title="Editar metadatos de la carta"
                    >
                      <Edit2 size={13} />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      className="btn-delete-carta"
                      onClick={() => handleDelete(archivo.nombre_archivo)}
                      title="Eliminar carta y todas sus entidades de la base de datos"
                    >
                      <Trash2 size={14} />
                    </button>
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
