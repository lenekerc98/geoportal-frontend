import React, { useState, useEffect } from 'react';
import { FolderGit2, Plus, Edit2, Trash2, Loader2, Calendar } from 'lucide-react';
import { API_URL } from '../../services/api';

export default function ProjectsManager() {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });

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
  }, []);

  const openModal = (proj = null) => {
    if (proj) {
      setFormData({ 
        nombre: proj.nombre, 
        descripcion: proj.descripcion || ''
      });
      setEditingId(proj.id);
    } else {
      setFormData({ nombre: '', descripcion: '' });
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
      
      setShowModal(false);
      fetchProyectos();
    } catch (err) {
      alert(err.message);
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
      fetchProyectos();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && proyectos.length === 0) return <div style={{padding:'20px', color:'white'}}><Loader2 className="spin" /> Cargando proyectos...</div>;

  return (
    <div className="system-logs-container" style={{ padding: '20px', color: 'var(--text-main)', minHeight: '100vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2><FolderGit2 style={{ verticalAlign: 'middle', marginRight: '10px' }}/> Gestión de Proyectos</h2>
        <button onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', background: 'var(--accent-color)', color: '#1a1a2e', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          <Plus size={18} /> Nuevo Proyecto
        </button>
      </div>

      {error && <div style={{ color: '#ff4444', marginBottom: '15px' }}>{error}</div>}

      <div className="logs-table-container glass-panel">
        <table className="logs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Fecha Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map(proj => (
              <tr key={proj.id}>
                <td>{proj.id}</td>
                <td style={{ fontWeight: 'bold' }}>{proj.nombre}</td>
                <td>{proj.descripcion || '-'}</td>
                <td><Calendar size={14} style={{marginRight:5, verticalAlign:'middle', color:'gray'}}/> {new Date(proj.fecha_creacion).toLocaleString()}</td>
                <td>
                  <button onClick={() => openModal(proj)} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', padding: '5px', cursor: 'pointer', marginRight: '5px', borderRadius: '3px' }}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(proj.id)} style={{ background: 'rgba(255,50,50,0.2)', border: '1px solid #ff4444', color: '#ff4444', padding: '5px', cursor: 'pointer', borderRadius: '3px' }}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {proyectos.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center' }}>No hay proyectos registrados</td></tr>}
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
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 15px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '5px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '10px 15px', background: 'var(--accent-color)', color: '#1a1a2e', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
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
