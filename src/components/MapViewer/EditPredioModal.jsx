import React, { useState, useEffect } from 'react';
import { X, Save, Search, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';

export default function EditPredioModal({ predio, isOpen, onClose, onSaved }) {
  const [codigo, setCodigo] = useState('');
  const [cedula, setCedula] = useState('');
  const [nombrePosesionario, setNombrePosesionario] = useState('');
  const [posesionarioId, setPosesionarioId] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchMsg, setSearchMsg] = useState(null);

  useEffect(() => {
    if (predio && isOpen) {
      setCodigo(predio.codigo || predio.cod_catastral || '');
      setCedula(predio.cedula_posesionario || predio.cedula || '');
      setNombrePosesionario(predio.nombre_posesionario || '');
      setPosesionarioId(predio.posesionario_id || null);
      setSearchMsg(null);
    }
  }, [predio, isOpen]);

  if (!isOpen || !predio) return null;

  const handleBuscarCedula = async () => {
    const cleanCedula = cedula.trim();
    if (!cleanCedula) return;
    setLoadingSearch(true);
    setSearchMsg(null);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/posesionarios/buscar/${cleanCedula}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNombrePosesionario(data.nombre);
        setPosesionarioId(data.id);
        setSearchMsg({ type: 'success', text: 'Posesionario encontrado en la base de datos' });
      } else {
        setSearchMsg({ type: 'info', text: 'Cédula no registrada aún. Se creará al guardar.' });
      }
    } catch (e) {
      setSearchMsg({ type: 'error', text: 'Error al consultar la cédula' });
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!codigo.trim()) {
      showError('El código catastral no puede estar vacío');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('catastro_token');
      let finalPosesionarioId = posesionarioId;

      // 1. Si se ingresó cédula y nombre pero no tiene posesionario_id o se modificó
      if (cedula.trim() && nombrePosesionario.trim()) {
        if (posesionarioId) {
          // Actualizar posesionario existente
          await fetch(`${API_URL}/api/gis/posesionarios/${posesionarioId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              cedula: cedula.trim(),
              nombre: nombrePosesionario.trim()
            })
          });
        } else {
          // Crear nuevo posesionario
          const posRes = await fetch(`${API_URL}/api/gis/posesionarios`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              cedula: cedula.trim(),
              nombre: nombrePosesionario.trim()
            })
          });
          if (posRes.ok) {
            const newPos = await posRes.json();
            finalPosesionarioId = newPos.id;
          }
        }
      }

      // 2. Actualizar predio si tenemos su predio_id
      const pId = predio.predio_id || predio.id;
      if (pId) {
        const updateData = {
          cod_catastral: codigo.trim()
        };
        if (finalPosesionarioId) {
          updateData.posesionario_id = finalPosesionarioId;
        }

        const resPredio = await fetch(`${API_URL}/api/gis/predios/${pId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updateData)
        });

        if (!resPredio.ok) {
          const errData = await resPredio.json();
          throw new Error(errData.detail || 'Error al actualizar el predio');
        }
      }

      showSuccess('Predio actualizado correctamente');
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      showError(err.message || 'Error de conexión');
    } finally {
      setSaving(false);
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
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        border: '1px solid var(--card-border, #e2e8f0)',
        overflow: 'hidden'
      }}>
        {/* Cabecera */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
          borderBottom: '1px solid var(--card-border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--primary, #2563eb)', fontWeight: 'bold' }}>
              Editar Información del Predio
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
              Código actual: <strong>{predio.codigo || predio.cod_catastral}</strong>
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} style={{ padding: '20px' }}>
          {/* Código Catastral */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '6px' }}>
              Código Catastral:
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: 1206515102014688000"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid var(--card-border, #cbd5e1)',
                background: 'var(--bg-lighter, #f8fafc)',
                color: 'var(--text-main, #1e293b)',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                fontWeight: 'bold'
              }}
              required
            />
          </div>

          {/* Sección Posesionario */}
          <div style={{
            background: 'var(--bg-lighter, #f8fafc)',
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid var(--card-border, #e2e8f0)',
            marginBottom: '18px'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--primary, #2563eb)' }}>
              Datos del Posesionario / Propietario
            </div>

            {/* Cédula con botón de búsqueda */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', marginBottom: '4px' }}>
                Cédula de Identidad:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={cedula}
                  onChange={(e) => {
                    setCedula(e.target.value);
                    setSearchMsg(null);
                  }}
                  placeholder="Ej: 0968574123"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--card-border, #cbd5e1)',
                    background: 'var(--bg-panel, #ffffff)',
                    color: 'var(--text-main, #1e293b)',
                    fontSize: '0.88rem'
                  }}
                />
                <button
                  type="button"
                  onClick={handleBuscarCedula}
                  disabled={loadingSearch || !cedula.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--primary, #3b82f6)',
                    background: 'var(--primary, #3b82f6)',
                    color: 'white',
                    cursor: cedula.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '0.82rem',
                    fontWeight: 'bold'
                  }}
                >
                  <Search size={14} />
                  {loadingSearch ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              {searchMsg && (
                <div style={{
                  fontSize: '0.78rem',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: searchMsg.type === 'success' ? '#10b981' : (searchMsg.type === 'error' ? '#ef4444' : '#64748b')
                }}>
                  {searchMsg.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {searchMsg.text}
                </div>
              )}
            </div>

            {/* Nombre del Posesionario */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', marginBottom: '4px' }}>
                Nombre Completo del Posesionario:
              </label>
              <input
                type="text"
                value={nombrePosesionario}
                onChange={(e) => setNombrePosesionario(e.target.value)}
                placeholder="Ej: Jesus Cañarte Pinto"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--card-border, #cbd5e1)',
                  background: 'var(--bg-panel, #ffffff)',
                  color: 'var(--text-main, #1e293b)',
                  fontSize: '0.88rem',
                  textTransform: 'uppercase'
                }}
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '9px 16px',
                borderRadius: '6px',
                border: '1px solid var(--card-border, #cbd5e1)',
                background: 'var(--bg-lighter, #f8fafc)',
                color: 'var(--text-main, #1e293b)',
                cursor: 'pointer',
                fontSize: '0.88rem'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--primary, #2563eb)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.88rem',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
