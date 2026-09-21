import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Compass, Ruler, AlertCircle } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';

export default function EditLinderosModal({ predio, isOpen, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [linderos, setLinderos] = useState([]);

  useEffect(() => {
    if (predio && isOpen) {
      fetchDetalle();
    }
  }, [predio, isOpen]);

  const fetchDetalle = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const codigo = predio.codigo || predio.cod_catastral;
      const res = await fetch(`${API_URL}/api/gis/predios/detalle/${codigo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDetalle(data);
        const sortedLinderos = (data.linderos || []).map((l, index) => ({
          id: l.id,
          tramo: `Tramo ${index + 1} (P${String(index + 1).padStart(2, '0')} - P${String(((index + 1) % data.linderos.length) + 1).padStart(2, '0')})`,
          longitud: l.longitud ? Number(l.longitud).toFixed(2) : '0.00',
          rumbo: l.rumbo || '',
          colindante: l.colindante || ''
        }));
        setLinderos(sortedLinderos);
      } else {
        setDetalle(null);
        setLinderos([]);
      }
    } catch (e) {
      console.error("Error al cargar detalle de linderos:", e);
      setDetalle(null);
      setLinderos([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !predio) return null;

  const handleLinderoChange = (index, field, value) => {
    setLinderos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSave = async () => {
    if (!detalle || !detalle.id) {
      showError('No se encontró el ID del predio para actualizar sus linderos');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const payload = {
        linderos: linderos.map(l => ({
          id: l.id,
          colindante: l.colindante.trim(),
          rumbo: l.rumbo.trim() || null
        }))
      };

      const res = await fetch(`${API_URL}/api/gis/predios/${detalle.id}/linderos`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showSuccess('Información de linderos actualizada exitosamente');
        if (onSaved) onSaved();
        onClose();
      } else {
        const err = await res.json();
        showError(err.detail || 'Error al guardar linderos');
      }
    } catch (e) {
      showError('Error de red al guardar linderos');
    } finally {
      setSaving(false);
    }
  };

  const totalLongitud = linderos.reduce((acc, l) => acc + (parseFloat(l.longitud) || 0), 0);

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
        maxWidth: '750px',
        width: '100%',
        maxHeight: '88vh',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        border: '1px solid var(--card-border, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Cabecera */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
          borderBottom: '1px solid var(--card-border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#f59e0b',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
            }}>
              <Ruler size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#b45309', fontWeight: 'bold' }}>
                Editar Información de Linderos y Colindantes
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                Predio: <strong style={{ color: 'var(--text-main)' }}>{predio.codigo || predio.cod_catastral}</strong> — Titular: <strong>{predio.nombre_posesionario || 'S/N'}</strong>
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

        {/* Resumen de Área y Linderos */}
        <div style={{
          padding: '12px 20px',
          background: 'var(--bg-lighter, #f8fafc)',
          borderBottom: '1px solid var(--card-border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
          flexShrink: 0
        }}>
          <div>
            Superficie: <strong>{detalle?.area_ha ? `${detalle.area_ha} Ha (${(detalle.area_ha * 10000).toFixed(2)} m²)` : 'Calculando...'}</strong>
          </div>
          <div>
            Perímetro Total: <strong>{totalLongitud.toFixed(2)} m</strong> ({linderos.length} tramos)
          </div>
        </div>

        {/* Cuerpo / Tabla de Linderos */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
              <div>Cargando coordenadas y linderos del predio...</div>
            </div>
          ) : linderos.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px',
              background: 'var(--bg-lighter, #f8fafc)',
              borderRadius: '8px',
              border: '1px dashed var(--card-border, #cbd5e1)',
              color: 'var(--text-muted)'
            }}>
              <AlertCircle size={24} style={{ margin: '0 auto 8px auto', color: '#f59e0b' }} />
              <p style={{ margin: 0, fontWeight: 'bold' }}>No se encontraron líneas de lindero para este predio.</p>
              <small>Asegúrate de que el predio cuente con un polígono geométrico cerrado registrado.</small>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--card-border, #e2e8f0)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg, #f1f5f9)', borderBottom: '1px solid var(--card-border, #e2e8f0)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', width: '120px' }}>Tramo</th>
                    <th style={{ padding: '10px 12px', width: '90px' }}>Distancia</th>
                    <th style={{ padding: '10px 12px', width: '140px' }}>Rumbo Topográfico</th>
                    <th style={{ padding: '10px 12px' }}>Colindante / Vecino</th>
                  </tr>
                </thead>
                <tbody>
                  {linderos.map((l, index) => (
                    <tr key={l.id || index} style={{ borderBottom: '1px solid var(--card-border, #e2e8f0)', background: index % 2 === 0 ? 'var(--bg-panel, #fff)' : 'var(--bg-lighter, #f8fafc)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: 'var(--primary, #3b82f6)' }}>
                        {l.tramo}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        {l.longitud} m
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Compass size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                          <input
                            type="text"
                            value={l.rumbo}
                            onChange={(e) => handleLinderoChange(index, 'rumbo', e.target.value)}
                            placeholder="Ej: N 45° 12' 30'' E"
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--card-border, #cbd5e1)',
                              background: 'var(--bg-panel, #fff)',
                              color: 'var(--text-main, #1e293b)',
                              fontSize: '0.8rem',
                              fontFamily: 'monospace'
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          type="text"
                          value={l.colindante}
                          onChange={(e) => handleLinderoChange(index, 'colindante', e.target.value)}
                          placeholder="Nombre del colindante o vía pública"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: '1px solid var(--card-border, #cbd5e1)',
                            background: 'var(--bg-panel, #fff)',
                            color: 'var(--text-main, #1e293b)',
                            fontSize: '0.85rem'
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--card-border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-lighter, #f8fafc)',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Los cambios se reflejarán automáticamente en todos los Reportes Planimétricos y el Geoportal.
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--card-border, #cbd5e1)',
                background: 'var(--bg-panel, #fff)',
                color: 'var(--text-main, #1e293b)',
                cursor: 'pointer',
                fontSize: '0.88rem'
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || linderos.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                background: '#f59e0b',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.88rem',
                cursor: (saving || linderos.length === 0) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
              }}
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Linderos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
