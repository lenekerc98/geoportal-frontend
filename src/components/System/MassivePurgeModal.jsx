import React, { useState, useEffect, useContext } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw, Database, CheckSquare, Square, ShieldAlert } from 'lucide-react';
import { API_URL } from '../../services/api';
import { AppContext } from '../../context/AppContext';
import { showSuccess, showError } from '../../utils/swal';
import Swal from 'sweetalert2';

export default function MassivePurgeModal({ isOpen, onClose, onPurged }) {
  const { activeEmpresa } = useContext(AppContext);
  const [empresasList, setEmpresasList] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(activeEmpresa?.id || '');
  const [eliminarPredios, setEliminarPredios] = useState(true);
  const [eliminarPosesionarios, setEliminarPosesionarios] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const currentDbEnv = localStorage.getItem('catastro_db_env') || 'prod';
  const isTestDb = currentDbEnv === 'test';

  // Cargar empresas
  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('catastro_token');
    if (!token) return;

    fetch(`${API_URL}/api/empresas`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmpresasList(data);
        }
      })
      .catch(console.error);
  }, [isOpen]);

  // Sincronizar empresa seleccionada si cambia la empresa activa
  useEffect(() => {
    if (activeEmpresa?.id) {
      setSelectedEmpresaId(activeEmpresa.id);
    }
  }, [activeEmpresa]);

  // Cargar estadísticas
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const url = selectedEmpresaId 
        ? `${API_URL}/api/system/purge-stats?empresa_id=${selectedEmpresaId}`
        : `${API_URL}/api/system/purge-stats`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setStats(null);
      }
    } catch (e) {
      console.error("Error al cargar estadísticas:", e);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
      setConfirmText('');
    }
  }, [isOpen, selectedEmpresaId]);

  if (!isOpen) return null;

  const canExecute = 
    confirmText.trim().toUpperCase() === 'ELIMINAR' &&
    (eliminarPredios || eliminarPosesionarios) &&
    !isPurging;

  const handleExecutePurge = async () => {
    if (!canExecute) return;

    const targetEmpresa = empresasList.find(e => e.id === parseInt(selectedEmpresaId));
    const empresaNombre = targetEmpresa ? targetEmpresa.nombre : 'TODAS las empresas';
    const envNombre = isTestDb ? 'BASE DE PRUEBAS (catastro-db-test)' : 'BASE DE PRODUCCIÓN (catastro-db)';

    const result = await Swal.fire({
      title: '¿Confirmación Definitiva?',
      html: `
        <div style="text-align: left; font-size: 0.9rem; line-height: 1.5;">
          <p style="color: #ef4444; font-weight: bold;">¡ATENCIÓN! Esta acción es irreversible.</p>
          <p><strong>Entorno:</strong> ${envNombre}</p>
          <p><strong>Empresa objetivo:</strong> ${empresaNombre}</p>
          <p><strong>Elementos a borrar:</strong></p>
          <ul>
            ${eliminarPredios ? '<li><strong>Predios:</strong> ' + (stats?.predios || 0) + ' registros (con ' + (stats?.vertices || 0) + ' vértices y ' + (stats?.linderos || 0) + ' linderos)</li>' : ''}
            ${eliminarPosesionarios ? '<li><strong>Posesionarios:</strong> ' + (stats?.posesionarios || 0) + ' fichas catastrales y códigos asociados</li>' : ''}
          </ul>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, Eliminar Definitivamente',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    setIsPurging(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/system/purge-catastro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          empresa_id: selectedEmpresaId ? parseInt(selectedEmpresaId) : null,
          eliminar_predios: eliminarPredios,
          eliminar_posesionarios: eliminarPosesionarios,
          confirmacion: confirmText.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        await Swal.fire({
          title: 'Eliminación Exitosa',
          html: `
            <div style="text-align: center; font-size: 0.9rem;">
              <p>${data.message}</p>
              <div style="background: var(--bg-lighter, #f1f5f9); padding: 10px; border-radius: 6px; margin-top: 10px; text-align: left;">
                <div>✔ Predios eliminados: <strong>${data.deleted?.predios || 0}</strong></div>
                <div>✔ Posesionarios eliminados: <strong>${data.deleted?.posesionarios || 0}</strong></div>
                <div>✔ Vértices eliminados: <strong>${data.deleted?.vertices || 0}</strong></div>
                <div>✔ Linderos eliminados: <strong>${data.deleted?.linderos || 0}</strong></div>
              </div>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#10b981'
        });

        // Notificar a toda la app para recargar datos
        window.dispatchEvent(new Event('catastro_data_purged'));
        if (onPurged) onPurged(data.deleted);
        onClose();
      } else {
        showError(data.detail || 'Error al ejecutar la eliminación masiva');
      }
    } catch (err) {
      showError('Error de red al conectar con el servidor');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-panel, #ffffff)',
        color: 'var(--text-main, #1e293b)',
        borderRadius: '12px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        border: '1px solid var(--card-border, #e2e8f0)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Cabecera del Modal */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.05) 100%)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#ef4444',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)'
            }}>
              <Trash2 size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#dc2626' }}>
                Limpieza Masiva de Catastro
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                Herramienta exclusiva de Superadministrador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div style={{ padding: '20px 24px', maxHeight: '75vh', overflowY: 'auto' }}>
          
          {/* Banner Indicador de Entorno */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: isTestDb ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isTestDb ? '#f59e0b' : '#ef4444'}`,
            marginBottom: '18px',
            fontSize: '0.85rem'
          }}>
            <Database size={18} color={isTestDb ? '#d97706' : '#ef4444'} />
            <div>
              <span>Operando sobre: </span>
              <strong style={{ color: isTestDb ? '#d97706' : '#dc2626' }}>
                {isTestDb ? 'Base de Pruebas (catastro-db-test)' : 'Base Oficial de Producción (catastro-db)'}
              </strong>
            </div>
          </div>

          {/* Selector de Empresa */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.88rem' }}>
              Empresa a Intervenir:
            </label>
            <select
              value={selectedEmpresaId}
              onChange={(e) => setSelectedEmpresaId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid var(--card-border, #cbd5e1)',
                background: 'var(--bg-lighter, #f8fafc)',
                color: 'var(--text-main, #1e293b)',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              <option value="">-- Todas las Empresas (Global) --</option>
              {empresasList.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
              ))}
            </select>
          </div>

          {/* Estadísticas de la selección */}
          <div style={{
            background: 'var(--bg-lighter, #f8fafc)',
            border: '1px solid var(--card-border, #e2e8f0)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted, #64748b)' }}>
                Registros Detectados Actualmente:
              </span>
              <button
                onClick={fetchStats}
                disabled={loadingStats}
                style={{ background: 'none', border: 'none', color: 'var(--primary, #3b82f6)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={12} className={loadingStats ? 'spin' : ''} /> Refrescar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-panel, #fff)', borderRadius: '6px', border: '1px solid var(--card-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Predios:</span>
                <strong>{loadingStats ? '...' : (stats?.predios || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-panel, #fff)', borderRadius: '6px', border: '1px solid var(--card-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Posesionarios:</span>
                <strong>{loadingStats ? '...' : (stats?.posesionarios || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-panel, #fff)', borderRadius: '6px', border: '1px solid var(--card-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Vértices:</span>
                <strong>{loadingStats ? '...' : (stats?.vertices || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-panel, #fff)', borderRadius: '6px', border: '1px solid var(--card-border, #e2e8f0)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Linderos:</span>
                <strong>{loadingStats ? '...' : (stats?.linderos || 0)}</strong>
              </div>
            </div>
          </div>

          {/* Opciones de Selección de Borrado */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.88rem' }}>
              Selecciona qué deseas eliminar:
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                onClick={() => setEliminarPredios(!eliminarPredios)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${eliminarPredios ? 'rgba(239, 68, 68, 0.4)' : 'var(--card-border, #e2e8f0)'}`,
                  background: eliminarPredios ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-lighter, #f8fafc)',
                  cursor: 'pointer'
                }}
              >
                {eliminarPredios ? <CheckSquare size={20} color="#ef4444" /> : <Square size={20} color="var(--text-muted)" />}
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: eliminarPredios ? '#dc2626' : 'inherit' }}>
                    Eliminar todos los Predios
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Elimina polígonos, vértices topológicos, linderos y su historial cartográfico.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setEliminarPosesionarios(!eliminarPosesionarios)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${eliminarPosesionarios ? 'rgba(239, 68, 68, 0.4)' : 'var(--card-border, #e2e8f0)'}`,
                  background: eliminarPosesionarios ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-lighter, #f8fafc)',
                  cursor: 'pointer'
                }}
              >
                {eliminarPosesionarios ? <CheckSquare size={20} color="#ef4444" /> : <Square size={20} color="var(--text-muted)" />}
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: eliminarPosesionarios ? '#dc2626' : 'inherit' }}>
                    Eliminar todos los Posesionarios
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Elimina fichas de propietarios, cédulas registradas y sus códigos catastrales.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bloque de Confirmación Textual de Seguridad */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#dc2626', fontWeight: 'bold', fontSize: '0.85rem' }}>
              <ShieldAlert size={18} />
              <span>Verificación de Seguridad Obligatoria</span>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: 'var(--text-main)' }}>
              Para habilitar el borrado masivo, por favor escribe la palabra <strong style={{ color: '#dc2626' }}>ELIMINAR</strong> en el siguiente campo:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Escribe ELIMINAR"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: confirmText.trim().toUpperCase() === 'ELIMINAR' ? '2px solid #ef4444' : '1px solid var(--card-border, #cbd5e1)',
                background: 'var(--bg-panel, #ffffff)',
                color: '#dc2626',
                fontWeight: 'bold',
                letterSpacing: '1px',
                fontSize: '0.9rem'
              }}
            />
          </div>

        </div>

        {/* Footer con Acciones */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--card-border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: 'var(--bg-lighter, #f8fafc)'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPurging}
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              border: '1px solid var(--card-border, #cbd5e1)',
              background: 'var(--bg-panel, #ffffff)',
              color: 'var(--text-main, #1e293b)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExecutePurge}
            disabled={!canExecute}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              background: canExecute ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
              color: 'white',
              cursor: canExecute ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: canExecute ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Trash2 size={16} />
            {isPurging ? 'Eliminando Registros...' : 'Ejecutar Eliminación Masiva'}
          </button>
        </div>
      </div>
    </div>
  );
}
