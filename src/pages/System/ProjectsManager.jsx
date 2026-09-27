import React, { useState, useEffect } from 'react';
import { FolderGit2, Plus, Edit2, Trash2, Loader2, Calendar } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';

export default function ProjectsManager() {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', empresas_ids: [] });
  const [empresas, setEmpresas] = useState([]);

  const fetchProyectos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/proyectos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar proyectos');
      const data = await res.json();
      setProyectos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProyectos();
    const token = localStorage.getItem('catastro_token');
    fetch(`${API_URL}/api/empresas`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(setEmpresas)
      .catch(console.error);
  }, []);

  const openModal = (proj = null) => {
    if (proj) {
      setFormData({ 
        nombre: proj.nombre, 
        descripcion: proj.descripcion || '',
        empresas_ids: proj.empresas_ids || []
      });
      setEditingId(proj.id);
    } else {
      setFormData({ nombre: '', descripcion: '', empresas_ids: [] });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('catastro_token');
      const url = editingId ? `${API_URL}/api/proyectos/${editingId}` : `${API_URL}/api/proyectos`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Error al guardar proyecto');
      }
      
      showSuccess('Proyecto guardado con éxito');
      setShowModal(false);
      fetchProyectos();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm('¿Está seguro de eliminar este proyecto?')) return;
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/proyectos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Error al eliminar');
      }
      showSuccess('Proyecto eliminado con éxito');
      fetchProyectos();
    } catch (err) {
      showError(err.message);
    }
  };

  if (loading && proyectos.length === 0) return <div style={{padding:'20px', color:'white'}}><Loader2 className="spin" /> Cargando proyectos...</div>;

  return (
    <div style={{ padding: '25px 35px', color: 'var(--text-main)', minHeight: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
      <header className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', padding: '20px', gap: '15px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderGit2 size={24} color="var(--primary)" /> Gestión de Proyectos
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Administra los proyectos cartográficos y catastrales del sistema
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-dynamic" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Nuevo Proyecto
        </button>
      </header>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '15px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
      )}

      <div className="table-container glass-panel" style={{ overflowX: 'auto', borderRadius: '16px' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>ID</th>
              <th style={{ minWidth: '200px' }}>Nombre del Proyecto</th>
              <th style={{ minWidth: '220px' }}>Descripción</th>
              <th style={{ minWidth: '200px' }}>Empresas Asociadas</th>
              <th style={{ minWidth: '180px' }}>Fecha Creación</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map(proj => (
              <tr key={proj.id}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }}>#{proj.id}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <FolderGit2 size={16} />
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{proj.nombre}</span>
                  </div>
                </td>
                <td>
                  <span style={{ color: proj.descripcion ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.88rem' }}>
                    {proj.descripcion || '—'}
                  </span>
                </td>
                <td>
                  {proj.empresas_ids && proj.empresas_ids.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {proj.empresas_ids.map(id => {
                        const emp = empresas.find(e => e.id === id);
                        return (
                          <span key={id} style={{ 
                            fontSize: '0.75rem', 
                            padding: '3px 9px', 
                            borderRadius: '12px', 
                            background: 'rgba(16, 185, 129, 0.12)', 
                            color: '#10b981', 
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            fontWeight: '600'
                          }}>
                            {emp ? emp.nombre : `Empresa ${id}`}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Calendar size={14} color="var(--accent-color)" />
                    <span>{new Date(proj.fecha_creacion).toLocaleString()}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <button 
                      onClick={() => openModal(proj)} 
                      title="Editar Proyecto"
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        border: '1px solid var(--card-border)', 
                        color: 'var(--text-main)', 
                        padding: '6px 10px', 
                        cursor: 'pointer', 
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.8rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      onClick={() => handleDelete(proj.id)} 
                      title="Eliminar Proyecto"
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)', 
                        color: '#ef4444', 
                        padding: '6px 10px', 
                        cursor: 'pointer', 
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.8rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#ffffff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {proyectos.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No hay proyectos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Nombre del Proyecto</label>
                <input 
                  type="text" 
                  value={formData.nombre} 
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  required
                  className="input-dynamic"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Descripción</label>
                <textarea 
                  value={formData.descripcion} 
                  onChange={e => setFormData({...formData, descripcion: e.target.value})}
                  rows="3"
                  className="input-dynamic"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Empresas Asociadas</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', background: 'var(--bg-main)', padding: '10px', borderRadius: '5px', border: '1px solid var(--card-border)', maxHeight: '150px', overflowY: 'auto' }}>
                  {empresas.map(emp => (
                    <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.empresas_ids.includes(emp.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            empresas_ids: isChecked 
                              ? [...prev.empresas_ids, emp.id] 
                              : prev.empresas_ids.filter(id => id !== emp.id)
                          }));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      {emp.nombre}
                    </label>
                  ))}
                  {empresas.length === 0 && <span style={{ fontSize: '12px', color: 'gray' }}>No hay empresas disponibles</span>}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 15px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '5px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-dynamic" style={{ padding: '10px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
