import React, { useState, useEffect, useContext } from 'react';
import { Settings, Map, Layers, Plus, Building2, Save } from 'lucide-react';
import { API_URL } from '../../services/api';
import { AppContext } from '../../context/AppContext';
import { showSuccess, showError } from '../../utils/swal';
import './SystemParams.css';

export default function SystemParams() {
  const [activeTab, setActiveTab] = useState('dpa');
  
  const { activeEmpresa, setGlobalEmpresa } = useContext(AppContext);
  const [empresaConfig, setEmpresaConfig] = useState({ modo_historico: 'automatico' });
  const [isSaving, setIsSaving] = useState(false);
  const [provincias, setProvincias] = useState([]);
  const [cantones, setCantones] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  
  const [selectedProv, setSelectedProv] = useState('');
  const [selectedCanton, setSelectedCanton] = useState('');

  useEffect(() => {
    fetchProvincias();
  }, []);
  
  useEffect(() => {
    if (activeEmpresa) {
      setEmpresaConfig({
        modo_historico: activeEmpresa.parametros?.modo_historico || 'automatico'
      });
    }
  }, [activeEmpresa]);

  const handleSaveEmpresaConfig = async () => {
    if (!activeEmpresa) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const payload = { ...activeEmpresa, parametros: { ...activeEmpresa.parametros, ...empresaConfig } };
      
      const res = await fetch(`${API_URL}/api/empresas/${activeEmpresa.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ parametros: payload.parametros })
      });
      
      if (res.ok) {
        const updatedEmpresa = await res.json();
        setGlobalEmpresa(updatedEmpresa);
        showSuccess('Configuración guardada exitosamente');
      } else {
        const err = await res.json();
        showError(err.detail || 'Error al guardar');
      }
    } catch(e) {
      showError('Error de conexión');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchProvincias = async () => {
    try {
      const res = await fetch(`${API_URL}/api/system/dpa/provincias`);
      const data = await res.json();
      setProvincias(data);
    } catch(e) { console.error(e); }
  };

  const fetchCantones = async (provId) => {
    try {
      const res = await fetch(`${API_URL}/api/system/dpa/cantones?provincia_id=${provId}`);
      const data = await res.json();
      setCantones(data);
      setCiudades([]);
      setSelectedCanton('');
    } catch(e) { console.error(e); }
  };

  const fetchCiudades = async (cantonId) => {
    try {
      const res = await fetch(`${API_URL}/api/system/dpa/ciudades?canton_id=${cantonId}`);
      const data = await res.json();
      setCiudades(data);
    } catch(e) { console.error(e); }
  };

  return (
    <div className="params-container">
      <h1 className="params-title">Parámetros Generales</h1>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)' }}>
        <button 
          onClick={() => setActiveTab('dpa')}
          style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'dpa' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'dpa' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Gestión DPA
        </button>
        <button 
          onClick={() => setActiveTab('empresa')}
          style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'empresa' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'empresa' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Configuración de Empresa
        </button>
      </div>

      {activeTab === 'dpa' && (
      <div className="params-grid">
        {/* Provincias */}
        <div className="param-card">
          <div className="card-header">
            <h3><Map size={20} /> Provincias</h3>
            <button className="icon-btn"><Plus size={16} /></button>
          </div>
          <ul className="dpa-list">
            {provincias.map(p => (
              <li 
                key={p.id} 
                className={selectedProv === p.id ? 'active' : ''}
                onClick={() => { setSelectedProv(p.id); fetchCantones(p.id); }}
              >
                {p.nombre}
              </li>
            ))}
          </ul>
        </div>

        {/* Cantones */}
        <div className="param-card">
          <div className="card-header">
            <h3><Layers size={20} /> Cantones</h3>
            <button className="icon-btn" disabled={!selectedProv}><Plus size={16} /></button>
          </div>
          {selectedProv ? (
            <ul className="dpa-list">
              {cantones.map(c => (
                <li 
                  key={c.id}
                  className={selectedCanton === c.id ? 'active' : ''}
                  onClick={() => { setSelectedCanton(c.id); fetchCiudades(c.id); }}
                >
                  {c.nombre}
                </li>
              ))}
              {cantones.length === 0 && <p className="empty-msg">No hay cantones registrados.</p>}
            </ul>
          ) : (
            <p className="empty-msg">Seleccione una provincia.</p>
          )}
        </div>

        {/* Ciudades */}
        <div className="param-card">
          <div className="card-header">
            <h3><Settings size={20} /> Ciudades / Parroquias</h3>
            <button className="icon-btn" disabled={!selectedCanton}><Plus size={16} /></button>
          </div>
          {selectedCanton ? (
            <ul className="dpa-list">
              {ciudades.map(ciu => (
                <li key={ciu.id}>{ciu.nombre}</li>
              ))}
              {ciudades.length === 0 && <p className="empty-msg">No hay ciudades registradas.</p>}
            </ul>
          ) : (
            <p className="empty-msg">Seleccione un cantón.</p>
          )}
        </div>
      </div>
      )}

      {activeTab === 'empresa' && (
        <div style={{ background: 'var(--bg-panel)', padding: '25px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}><Building2 size={20} color="var(--primary)" /> {activeEmpresa ? activeEmpresa.nombre : 'Sin Empresa Activa'}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.9rem' }}>Configura los parámetros globales que afectarán a todos los usuarios de esta empresa.</p>
          
          {activeEmpresa ? (
            <div style={{ maxWidth: '500px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Modo de Carga Histórica (Shapes)</label>
                <select 
                  value={empresaConfig.modo_historico}
                  onChange={(e) => setEmpresaConfig({...empresaConfig, modo_historico: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }}
                >
                  <option value="automatico">Automático (Usa la fecha actual del sistema siempre)</option>
                  <option value="manual">Manual (Permite al usuario elegir la fecha al importar)</option>
                </select>
                <small style={{ display: 'block', marginTop: '5px', color: 'var(--text-muted)' }}>
                  Si seleccionas "Manual", aparecerá un campo de fecha opcional al subir un Shapefile.
                </small>
              </div>
              
              <button 
                onClick={handleSaveEmpresaConfig}
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          ) : (
            <p style={{ color: '#ef4444' }}>Debes seleccionar una Empresa en el menú lateral (Contexto Global) para poder configurarla.</p>
          )}
        </div>
      )}
    </div>
  );
}
