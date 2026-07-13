import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Loader2, Calendar } from 'lucide-react';
import { API_URL } from '../../services/api';

export default function EmpresasManager() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', ruc: '', proyecto_id: '' });
  const [proyectos, setProyectos] = useState([]);

  const [provinciasList, setProvinciasList] = useState([]);
  const [cantonesList, setCantonesList] = useState([]);
  const [ciudadesList, setCiudadesList] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('catastro_token');
    fetch(`${API_URL}/api/system/dpa/provincias`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(setProvinciasList).catch(() => {});
  }, []);

  // Fetch cantones when provincia changes
  const selectedProvObj = provinciasList.find(p => p.nombre === formData.provincia);
  useEffect(() => {
    if (selectedProvObj) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/system/dpa/cantones?provincia_id=${selectedProvObj.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json()).then(setCantonesList).catch(() => {});
    } else {
      setCantonesList([]);
    }
  }, [selectedProvObj]);

  // Fetch ciudades when canton changes
  const selectedCantObj = cantonesList.find(c => c.nombre === formData.canton);
  useEffect(() => {
    if (selectedCantObj) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/system/dpa/ciudades?canton_id=${selectedCantObj.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json()).then(setCiudadesList).catch(() => {});
    } else {
      setCiudadesList([]);
    }
  }, [selectedCantObj, cantonesList]);

  const fetchEmpresas = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/empresas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar empresas');
      const data = await res.json();
      setEmpresas(data);
      
      const pRes = await fetch(`${API_URL}/api/proyectos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pRes.ok) {
        setProyectos(await pRes.json());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const openModal = (emp = null) => {
    if (emp) {
      setFormData({ 
        nombre: emp.nombre, 
        ruc: emp.ruc || '',
        telefono: emp.telefono || '',
        correo: emp.correo || '',
        direccion: emp.direccion || '',
        provincia: emp.provincia || '',
        canton: emp.canton || '',
        ciudad: emp.ciudad || '',
        sector: emp.sector || '',
        parametros: emp.parametros ? JSON.stringify(emp.parametros, null, 2) : '{}',
        proyecto_id: emp.proyecto_id || ''
      });
      setEditingId(emp.id);
    } else {
      setFormData({ nombre: '', ruc: '', telefono: '', correo: '', direccion: '', provincia: '', canton: '', ciudad: '', sector: '', parametros: '{}', proyecto_id: '' });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('catastro_token');
      const url = editingId ? `${API_URL}/api/empresas/${editingId}` : `${API_URL}/api/empresas`;
      const method = editingId ? 'PUT' : 'POST';
      
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(formData.parametros || '{}');
      } catch (err) {
        throw new Error('Parámetros JSON inválido');
      }

      const payload = {
        ...formData,
        parametros: parsedParams
      };
      if (payload.proyecto_id === '') {
        payload.proyecto_id = null;
      } else {
        payload.proyecto_id = parseInt(payload.proyecto_id);
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Error al guardar empresa');
      }
      
      setShowModal(false);
      fetchEmpresas();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && empresas.length === 0) return <div style={{padding:'20px', color:'white'}}><Loader2 className="spin" /> Cargando empresas...</div>;

  return (
    <div className="system-logs-container" style={{ padding: '20px', color: 'var(--text-main)', minHeight: '100vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2><Building2 style={{ verticalAlign: 'middle', marginRight: '10px' }}/> Gestión de Empresas</h2>
        <button onClick={() => openModal()} className="btn-dynamic" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Plus size={18} /> Nueva Empresa
        </button>
      </div>

      {error && <div style={{ color: '#ff4444', marginBottom: '15px' }}>{error}</div>}

      <div className="logs-table-container glass-panel">
        <table className="logs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>RUC</th>
              <th>Contacto</th>
              <th>Ubicación</th>
              <th>Proyecto</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map(emp => (
              <tr key={emp.id}>
                <td>{emp.id}</td>
                <td style={{ fontWeight: 'bold' }}>{emp.nombre}</td>
                <td>{emp.ruc || '-'}</td>
                <td>
                  <div style={{ fontSize: '0.8rem' }}>{emp.correo || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'gray' }}>{emp.telefono || '-'}</div>
                </td>
                <td>
                  <div>{emp.canton || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'gray' }}>{emp.sector || '-'}</div>
                </td>
                <td>{emp.proyecto_id ? proyectos.find(p => p.id === emp.proyecto_id)?.nombre || emp.proyecto_id : '-'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => openModal(emp)} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', padding: '5px', cursor: 'pointer', marginRight: '5px', borderRadius: '3px' }}>
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {empresas.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center' }}>No hay empresas registradas</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Nombre</label>
                  <input 
                    type="text" 
                    value={formData.nombre} 
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                    required
                    className="input-dynamic"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>RUC</label>
                  <input 
                    type="text" 
                    value={formData.ruc} 
                    onChange={e => setFormData({...formData, ruc: e.target.value})}
                    className="input-dynamic"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Teléfono</label>
                  <input 
                    type="text" 
                    value={formData.telefono} 
                    onChange={e => setFormData({...formData, telefono: e.target.value})}
                    className="input-dynamic"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Correo</label>
                  <input 
                    type="email" 
                    value={formData.correo} 
                    onChange={e => setFormData({...formData, correo: e.target.value})}
                    className="input-dynamic"
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Proyecto Vinculado</label>
                <select 
                  value={formData.proyecto_id} 
                  onChange={e => setFormData({...formData, proyecto_id: e.target.value})}
                  className="input-dynamic"
                >
                  <option value="">Ninguno</option>
                  {proyectos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Dirección</label>
                <input 
                  type="text" 
                  value={formData.direccion} 
                  onChange={e => setFormData({...formData, direccion: e.target.value})}
                  className="input-dynamic"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Provincia</label>
                  <select className="input-dynamic" value={formData.provincia || ''} onChange={e => setFormData({...formData, provincia: e.target.value, canton: '', ciudad: ''})}>
                    <option value="">Seleccionar...</option>
                    {provinciasList.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Cantón</label>
                  <select className="input-dynamic" value={formData.canton || ''} onChange={e => setFormData({...formData, canton: e.target.value, ciudad: ''})}>
                    <option value="">Seleccionar...</option>
                    {cantonesList.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Ciudad</label>
                  <select className="input-dynamic" value={formData.ciudad || ''} onChange={e => setFormData({...formData, ciudad: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    {ciudadesList.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Sector</label>
                  <select className="input-dynamic" value={formData.sector || ''} onChange={e => setFormData({...formData, sector: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    <option value="Rural">Rural</option>
                    <option value="Urbano">Urbano</option>
                    <option value="Ambos">Ambos</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Parámetros Adicionales (JSON)</label>
                <textarea 
                  value={formData.parametros} 
                  onChange={e => setFormData({...formData, parametros: e.target.value})}
                  rows="4"
                  className="input-dynamic" style={{ fontFamily: 'monospace' }}
                  placeholder='{"color_primario": "#ff0000", "logo": "url_imagen"}'
                />
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
