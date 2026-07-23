import React, { useState, useEffect, useContext } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Map, BarChart2, Users, Settings, LogOut, Menu, Moon, Sun, Shield, Building2, FolderGit2, FileText } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../services/api';

const SystemHealthIndicator = ({ collapsed }) => {
  const [health, setHealth] = useState({ api: 'PENDING', database: 'PENDING', storage: 'PENDING' });
  
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/system/health`);
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          setHealth({ api: 'ERROR', database: 'ERROR', storage: 'ERROR' });
        }
      } catch (e) {
        setHealth({ api: 'ERROR', database: 'ERROR', storage: 'ERROR' });
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const isAllOk = health.api === 'OK' && health.database === 'OK' && health.storage === 'OK';
  const hasError = health.api === 'ERROR' || health.database.startsWith('ERROR') || health.storage.startsWith('ERROR');
  
  const statusColor = isAllOk ? 'var(--success)' : (hasError ? 'var(--danger)' : 'var(--warning)');
  const statusText = isAllOk ? 'Sistema en línea' : (hasError ? 'Error de conexión' : 'Verificando...');

  if (collapsed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', borderTop: '1px solid var(--sidebar-border)' }} title={statusText}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}></div>
      </div>
    );
  }

  const [userRole, setUserRole] = useState('');
  
  useEffect(() => {
    const token = localStorage.getItem('catastro_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || '');
      } catch (e) {}
    }
  }, []);

  return (
    <div style={{ padding: '15px', borderTop: '1px solid var(--sidebar-border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}></div>
        <span style={{ fontWeight: 'bold' }}>{statusText}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>API Backend:</span>
          <span style={{ color: health.api === 'OK' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>{health.api}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }} title={userRole === 'superadmin' && health.database !== 'OK' ? health.database : undefined}>
          <span>Base de Datos:</span>
          <span style={{ color: health.database === 'OK' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>{health.database === 'OK' ? 'OK' : 'ERROR'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }} title={userRole === 'superadmin' && health.storage !== 'OK' ? health.storage : undefined}>
          <span>Almacenamiento:</span>
          <span style={{ color: health.storage === 'OK' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>{health.storage === 'OK' ? 'OK' : 'ERROR'}</span>
        </div>
      </div>
    </div>
  );
};

export default function SidebarLayout() {
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [userRole, setUserRole] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('catastro_theme_v2') || 'light');
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('catastro_theme_v2', theme);
  }, [theme]);

  const { activeEmpresa, setGlobalEmpresa } = useContext(AppContext);
  const [empresasList, setEmpresasList] = useState([]);

  useEffect(() => {
    if (userRole?.toLowerCase() === 'superadmin') {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/empresas`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setEmpresasList(data))
        .catch(console.error);
    }
  }, [userRole]);

  // Protección de Rutas (Validar Token JWT)
  useEffect(() => {
    const token = localStorage.getItem('catastro_token');
    if (!token) {
      navigate('/');
      return;
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp;
      setUserRole(payload.role || '');
      if (Date.now() >= exp * 1000) {
         localStorage.removeItem('catastro_token');
         navigate('/');
      }
    } catch (e) {
      localStorage.removeItem('catastro_token');
      navigate('/');
    }
  }, [navigate]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    localStorage.removeItem('catastro_token');
    navigate('/');
  };

  const hasAccess = (allowedRoles) => {
    if (!userRole) return false;
    // Convierte el rol del usuario a minúsculas para evitar problemas de case
    const roleLower = userRole.toLowerCase();
    if (roleLower === 'superadmin') return true;
    return allowedRoles.includes(roleLower);
  };

  return (
    <div>
      {/* Mobile Navbar */}
      {isMobile && (
        <div className="mobile-navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', background: 'var(--accent-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
              C
            </div>
            <span className="title" style={{ fontSize: '15px', lineHeight: '1.2', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '220px' }}>Catastro Rural Cantón Urdaneta 2026</span>
          </div>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', padding: '5px' }}
          >
            <Menu size={24} />
          </button>
        </div>
      )}

      <aside className={`global-sidebar ${collapsed ? 'collapsed' : ''}`}>
        {!isMobile && (
          <div className="sidebar-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              {!collapsed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '30px', height: '30px', background: 'var(--accent-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                    C
                  </div>
                  <span className="title" style={{ fontSize: '15px', lineHeight: '1.2', whiteSpace: 'normal' }}>Catastro Rural Cantón Urdaneta 2026</span>
                </div>
              )}
              <button 
                onClick={() => setCollapsed(!collapsed)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '5px' }}
              >
                <Menu size={20} />
              </button>
            </div>
            
            {!collapsed && userRole?.toLowerCase() === 'superadmin' && empresasList.length > 0 && (
              <div style={{ marginTop: '15px', padding: '10px', background: 'var(--bg-lighter)', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Contexto Global</span>
                <select 
                  style={{ width: '100%', padding: '5px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
                  value={activeEmpresa?.id || ''}
                  onChange={(e) => {
                    const emp = empresasList.find(x => x.id === parseInt(e.target.value));
                    setGlobalEmpresa(emp || null);
                    // Opcional: forzar recarga para limpiar datos anteriores
                    window.location.reload();
                  }}
                >
                  <option value="">Todas (Vista Global)</option>
                  {empresasList.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <nav className="sidebar-nav">
          <NavLink to="/geoportal" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Map size={20} />
            <span>Geoportal</span>
          </NavLink>

          <NavLink to="/dashboard" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart2 size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/reporteria" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={20} />
            <span>Reportería</span>
          </NavLink>
          
          {hasAccess(['admin']) && (
            <NavLink to="/usuarios" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>Usuarios</span>
            </NavLink>
          )}

          {hasAccess(['admin']) && (
            <div className="nav-group" style={{ marginTop: '15px' }}>
              <div className="nav-item" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', cursor: 'default' }}>
                <span>Sistema</span>
              </div>
              <NavLink to="/sistema/parametros" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item sub-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: '35px' }}>
                <Map size={18} />
                <span>Gestión DPA</span>
              </NavLink>
              <NavLink to="/sistema/logs" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item sub-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: '35px' }}>
                <Shield size={18} />
                <span>Logs y Auditoría</span>
              </NavLink>
              {userRole?.toLowerCase() === 'superadmin' && (
                <>
                  <NavLink to="/empresas" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item sub-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: '35px' }}>
                    <Building2 size={18} />
                    <span>Gestión de Empresas</span>
                  </NavLink>
                  <NavLink to="/proyectos" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item sub-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: '35px' }}>
                    <FolderGit2 size={18} />
                    <span>Gestión de Proyectos</span>
                  </NavLink>
                </>
              )}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button 
            onClick={toggleTheme} 
            className="nav-item" 
            style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', justifyContent: 'flex-start' }}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span>Tema {theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
          </button>

          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--sidebar-border)' }}>
            <button 
              onClick={handleLogout} 
              className="nav-item" 
              style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', color: 'var(--danger)', justifyContent: 'flex-start' }}
            >
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
          <SystemHealthIndicator collapsed={collapsed} />
        </div>
      </aside>

      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
