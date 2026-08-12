import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';
import { Save, Plus, Edit, Trash2 } from 'lucide-react';

export default function ProyectosManager() {
  const { activeEmpresa } = useContext(AppContext);
  const [proyectos, setProyectos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    map_lat: -1.5833,
    map_lng: -79.4667,
    map_zoom: 14,
    map_basemap: 'osm'
  });

  useEffect(() => {
    if (activeEmpresa) fetchProyectos();
  }, [activeEmpresa]);

  const fetchProyectos = async () => {
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/proyectos`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setProyectos(data.filter(p => p.empresas_ids && p.empresas_ids.includes(activeEmpresa.id)));
    } catch(e) {
      console.error(e);
    }
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setFormData({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      map_lat: p.map_lat,
      map_lng: p.map_lng,
      map_zoom: p.map_zoom,
      map_basemap: p.map_basemap
    });
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({
      nombre: '',
      descripcion: '',
      map_lat: -1.5833,
      map_lng: -79.4667,
      map_zoom: 14,
      map_basemap: 'osm'
    });
  };

  const handleSave = async () => {
    if (!formData.nombre) return showError('El nombre es obligatorio');
    
    try {
      const token = localStorage.getItem('catastro_token');
      const method = editingId === 'new' ? 'POST' : 'PUT';
      const url = editingId === 'new' ? `${API_URL}/api/proyectos` : `${API_URL}/api/proyectos/${editingId}`;
      const payload = {
          ...formData,
          empresas_ids: [activeEmpresa.id]
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showSuccess('Proyecto guardado exitosamente');
        setEditingId(null);
        fetchProyectos();
      } else {
        const err = await res.json();
        showError(err.detail || 'Error al guardar proyecto');
      }
    } catch(e) {
      showError('Error de conexión');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que desea eliminar este proyecto? Se perderá la asociación con sus predios.')) return;
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/proyectos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        showSuccess('Proyecto eliminado');
        fetchProyectos();
      }
    } catch(e) {
      showError('Error de conexión');
    }
  };

  if (!activeEmpresa) {
    return <p style={{ color: '#ef4444', padding: '20px' }}>Debes seleccionar una Empresa en el menú lateral (Contexto Global) para gestionar sus proyectos.</p>;
  }

  return (
    <div style={{ background: 'var(--bg-panel)', padding: '25px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Proyectos de {activeEmpresa.nombre}</h2>
        {!editingId && (
          <button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            <Plus size={16} /> Nuevo Proyecto
          </button>
        )}
      </div>

      {editingId ? (
        <div style={{ background: 'var(--bg-lighter)', padding: '20px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px' }}>{editingId === 'new' ? 'Crear Nuevo Proyecto' : 'Editar Proyecto'}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nombre</label>
              <input 
                type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Descripción</label>
              <input 
                type="text" value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <h4 style={{ marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid var(--card-border)', paddingBottom: '5px' }}>Parámetros de Geoportal Iniciales</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Latitud Centro</label>
              <input 
                type="number" step="0.000001" value={formData.map_lat} onChange={(e) => setFormData({...formData, map_lat: parseFloat(e.target.value)})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Longitud Centro</label>
              <input 
                type="number" step="0.000001" value={formData.map_lng} onChange={(e) => setFormData({...formData, map_lng: parseFloat(e.target.value)})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nivel de Zoom</label>
              <input 
                type="number" value={formData.map_zoom} onChange={(e) => setFormData({...formData, map_zoom: parseInt(e.target.value)})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Mapa Base por Defecto</label>
              <select 
                value={formData.map_basemap} onChange={(e) => setFormData({...formData, map_basemap: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
              >
                <option value="osm">OpenStreetMap</option>
                <option value="satellite">Satélite (Esri)</option>
                <option value="topo">Topográfico (OpenTopo)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              <Save size={18} /> Guardar
            </button>
            <button onClick={() => setEditingId(null)} style={{ padding: '10px 20px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '6px', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="table-container glass-panel" style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Nombre del Proyecto</th>
                <th>Descripción</th>
                <th>Mapa Inicial</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.map(p => (
                <tr key={p.id}>
                  <td data-label="Nombre del Proyecto" style={{ fontWeight: '600' }}>{p.nombre}</td>
                  <td data-label="Descripción" style={{ color: 'var(--text-muted)' }}>{p.descripcion}</td>
                  <td data-label="Mapa Inicial" style={{ color: 'var(--text-muted)' }}>Lat: {p.map_lat}, Lng: {p.map_lng}</td>
                  <td data-label="Acciones" style={{ textAlign: 'center' }}>
                    <button onClick={() => handleEdit(p)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', marginRight: '10px' }} title="Editar"><Edit size={18}/></button>
                    <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Eliminar"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
              {proyectos.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay proyectos registrados para esta empresa.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
