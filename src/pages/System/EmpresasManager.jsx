import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Loader2, Calendar } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';

export default function EmpresasManager() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', ruc: '', proyectos_ids: [] });
  const [logoFile, setLogoFile] = useState(null);
  const [banderaFile, setBanderaFile] = useState(null);
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
    setLogoFile(null);
    setBanderaFile(null);
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
        proyectos_ids: emp.proyectos_ids || [],
        logo_url: emp.logo_url || emp.logo || '',
        bandera_url: emp.bandera_url || ''
      });
      setEditingId(emp.id);
    } else {
      setFormData({ nombre: '', ruc: '', telefono: '', correo: '', direccion: '', provincia: '', canton: '', ciudad: '', sector: '', parametros: '{}', proyectos_ids: [], logo_url: '', bandera_url: '' });
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
      
      const savedData = await res.json();
      const empresaId = savedData.id;

      if (logoFile || banderaFile) {
        const fileData = new FormData();
        if (logoFile) fileData.append('logo', logoFile);
        if (banderaFile) fileData.append('bandera', banderaFile);
        
        const uploadRes = await fetch(`${API_URL}/api/empresas/${empresaId}/upload-images`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fileData
        });
        if (!uploadRes.ok) {
          showError('La empresa se guardó, pero hubo un error subiendo las imágenes.');
        }
      }
      
      showSuccess('Empresa guardada con éxito');
      setShowModal(false);
      fetchEmpresas();
    } catch (err) {
      showError(err.message);
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
                <td data-label="ID">{emp.id}</td>
                <td data-label="Nombre" style={{ fontWeight: 'bold' }}>{emp.nombre}</td>
                <td data-label="RUC">{emp.ruc || '-'}</td>
                <td data-label="Contacto">
                  <div style={{ fontSize: '0.8rem' }}>{emp.correo || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'gray' }}>{emp.telefono || '-'}</div>
                </td>
                <td data-label="Ubicación">
                  <div>{emp.canton || '-'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'gray' }}>{emp.sector || '-'}</div>
                </td>
                <td data-label="Proyecto">
                  {emp.proyectos_ids && emp.proyectos_ids.length > 0 
                    ? emp.proyectos_ids.map(id => proyectos.find(p => p.id === id)?.nombre || id).join(', ') 
                    : '-'}
                </td>
                <td data-label="Acciones" style={{ textAlign: 'right' }}>
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
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>Proyectos Vinculados</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', background: 'var(--bg-main)', padding: '10px', borderRadius: '5px', border: '1px solid var(--card-border)', maxHeight: '150px', overflowY: 'auto' }}>
                  {proyectos.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.proyectos_ids.includes(p.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            proyectos_ids: isChecked 
                              ? [...prev.proyectos_ids, p.id] 
                              : prev.proyectos_ids.filter(id => id !== p.id)
                          }));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      {p.nombre}
                    </label>
                  ))}
                  {proyectos.length === 0 && <span style={{ fontSize: '12px', color: 'gray' }}>No hay proyectos disponibles</span>}
                </div>
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
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>
                    Logo {formData.logo_url && <span style={{color: '#10b981'}}>(✓ Guardado)</span>}
                  </label>
                  {formData.logo_url && (
                    <div style={{ marginBottom: '5px', padding: '5px', background: 'white', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <img src={formData.logo_url.startsWith('http') ? formData.logo_url : `${API_URL}${formData.logo_url}`} alt="Logo actual" style={{ height: '40px', objectFit: 'contain' }} />
                      <button type="button" onClick={() => { setFormData({...formData, logo_url: ''}); setLogoFile(null); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }} title="Eliminar Logo">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setLogoFile(e.target.files[0])}
                    className="input-dynamic"
                    style={{ padding: '8px', marginTop: '5px', display: 'block' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: 'gray' }}>
                    Bandera {formData.bandera_url && <span style={{color: '#10b981'}}>(✓ Guardada)</span>}
                  </label>
                  {formData.bandera_url && (
                    <div style={{ marginBottom: '5px', padding: '5px', background: 'white', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <img src={formData.bandera_url.startsWith('http') ? formData.bandera_url : `${API_URL}${formData.bandera_url}`} alt="Bandera actual" style={{ height: '40px', objectFit: 'contain' }} />
                      <button type="button" onClick={() => { setFormData({...formData, bandera_url: ''}); setBanderaFile(null); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }} title="Eliminar Bandera">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setBanderaFile(e.target.files[0])}
                    className="input-dynamic"
                    style={{ padding: '8px', marginTop: '5px', display: 'block' }}
                  />
                </div>
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
