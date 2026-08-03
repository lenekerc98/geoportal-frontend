import React, { useState, useEffect, useContext } from 'react';
import { Settings, Map, Layers, Plus, Building2, Save } from 'lucide-react';
import { API_URL } from '../../services/api';
import { AppContext } from '../../context/AppContext';
import { showSuccess, showError } from '../../utils/swal';
import ProyectosManager from '../../components/System/ProyectosManager';
import './SystemParams.css';

export default function SystemParams() {
  const [activeTab, setActiveTab] = useState('empresa');
  
  const { activeEmpresa, setGlobalEmpresa } = useContext(AppContext);
  const [empresaConfig, setEmpresaConfig] = useState({ 
    modo_historico: 'automatico',
    logo_url: '',
    nombre_alcalde: '',
    nombre_director: '',
    sbu_actual: '',
    valor_m2_urbano: '',
    valor_m2_rural: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (activeEmpresa) {
      setEmpresaConfig({
        modo_historico: activeEmpresa.parametros?.modo_historico || 'automatico',
        logo_url: activeEmpresa.logo_url || '',
        nombre_alcalde: activeEmpresa.nombre_alcalde || '',
        nombre_director: activeEmpresa.nombre_director || '',
        sbu_actual: activeEmpresa.sbu_actual || '',
        valor_m2_urbano: activeEmpresa.valor_m2_urbano || '',
        valor_m2_rural: activeEmpresa.valor_m2_rural || ''
      });
    }
  }, [activeEmpresa]);

  const handleSaveEmpresaConfig = async () => {
    if (!activeEmpresa) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const updateData = {
          parametros: { ...activeEmpresa.parametros, modo_historico: empresaConfig.modo_historico },
          logo_url: empresaConfig.logo_url || null,
          nombre_alcalde: empresaConfig.nombre_alcalde || null,
          nombre_director: empresaConfig.nombre_director || null,
          sbu_actual: empresaConfig.sbu_actual ? parseFloat(empresaConfig.sbu_actual) : null,
          valor_m2_urbano: empresaConfig.valor_m2_urbano ? parseFloat(empresaConfig.valor_m2_urbano) : null,
          valor_m2_rural: empresaConfig.valor_m2_rural ? parseFloat(empresaConfig.valor_m2_rural) : null
      };
      
      const res = await fetch(`${API_URL}/api/empresas/${activeEmpresa.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
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

  return (
    <div className="params-container">
      <h1 className="params-title">Parámetros Generales</h1>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)' }}>

        <button 
          onClick={() => setActiveTab('empresa')}
          style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'empresa' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'empresa' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Configuración de Empresa
        </button>
        <button 
          onClick={() => setActiveTab('proyectos')}
          style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'proyectos' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'proyectos' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Gestión de Proyectos
        </button>
      </div>

      {activeTab === 'proyectos' && <ProyectosManager />}



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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Logotipo de la Empresa / GAD (Reportes)</label>
                
                {/* Vista Previa del Logo Actual */}
                {empresaConfig.logo_url && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '12px', padding: '10px', background: 'var(--bg-lighter)', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                    <img 
                      src={empresaConfig.logo_url} 
                      alt="Vista previa logo" 
                      style={{ height: '50px', width: 'auto', objectFit: 'contain', background: 'white', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Logotipo Seleccionado</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {empresaConfig.logo_url.startsWith('data:') ? '✔ Imagen Cargada desde el Equipo' : empresaConfig.logo_url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmpresaConfig({...empresaConfig, logo_url: ''})}
                      style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Quitar Logo
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ cursor: 'pointer', padding: '8px 14px', background: 'var(--accent-color)', color: 'white', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={16} /> Subir Imagen desde Equipo
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setEmpresaConfig({...empresaConfig, logo_url: event.target.result});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>o ingresa una URL web:</span>
                  </div>

                  <input 
                    type="text" 
                    value={empresaConfig.logo_url}
                    onChange={(e) => setEmpresaConfig({...empresaConfig, logo_url: e.target.value})}
                    placeholder="https://ejemplo.com/logo.png"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Este logotipo se aplicará en el encabezado oficial de todos los Reportes Planimétricos.
                </small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Nombre del Alcalde</label>
                  <input 
                    type="text" 
                    value={empresaConfig.nombre_alcalde}
                    onChange={(e) => setEmpresaConfig({...empresaConfig, nombre_alcalde: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Director(a) de Catastro</label>
                  <input 
                    type="text" 
                    value={empresaConfig.nombre_director}
                    onChange={(e) => setEmpresaConfig({...empresaConfig, nombre_director: e.target.value})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }}
                  />
                </div>
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
