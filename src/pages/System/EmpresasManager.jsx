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
    <div style={{ padding: '25px 35px', color: 'var(--text-main)', minHeight: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
      <header className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', padding: '20px', gap: '15px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 size={24} color="var(--primary)" /> Gestión de Empresas
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Administra las entidades, municipios y empresas registradas en el sistema
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-dynamic" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Nueva Empresa
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
              <th style={{ minWidth: '220px' }}>Empresa / GAD</th>
              <th style={{ minWidth: '130px' }}>RUC</th>
              <th style={{ minWidth: '180px' }}>Contacto</th>
              <th style={{ minWidth: '150px' }}>Ubicación</th>
              <th style={{ minWidth: '180px' }}>Proyectos Asignados</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map(emp => (
              <tr key={emp.id}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }}>#{emp.id}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {emp.logo_url ? (
                      <img 
                        src={emp.logo_url} 
                        alt="" 
                        style={{ width: '36px', height: '36px', objectFit: 'contain', background: 'white', borderRadius: '6px', padding: '2px', border: '1px solid var(--card-border)' }} 
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                        <Building2 size={20} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{emp.nombre}</div>
                      {emp.bandera_url && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bandera registrada</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', letterSpacing: '0.04em', background: 'rgba(0,0,0,0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                    {emp.ruc || '—'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      {emp.correo ? (
                        <a href={`mailto:${emp.correo}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{emp.correo}</a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                    {emp.telefono && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tel: {emp.telefono}</div>
                    )}
                  </div>
                </td>
                <td>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.88rem' }}>{emp.canton || '—'}</div>
                    {(emp.provincia || emp.sector) && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {[emp.provincia, emp.sector].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  {emp.proyectos_ids && emp.proyectos_ids.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {emp.proyectos_ids.map(id => {
                        const proj = proyectos.find(p => p.id === id);
                        return (
                          <span key={id} style={{ 
                            fontSize: '0.75rem', 
                            padding: '3px 9px', 
                            borderRadius: '12px', 
                            background: 'rgba(56, 189, 248, 0.12)', 
                            color: 'var(--accent-color)', 
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            fontWeight: '600'
                          }}>
                            {proj ? proj.nombre : `Proyecto ${id}`}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button 
                    onClick={() => openModal(emp)} 
                    title="Editar Empresa"
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid var(--card-border)', 
                      color: 'var(--text-main)', 
                      padding: '6px 12px', 
                      cursor: 'pointer', 
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                </td>
              </tr>
            ))}
            {empresas.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No hay empresas registradas
                </td>
              </tr>
            )}
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
