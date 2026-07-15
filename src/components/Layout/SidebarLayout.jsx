import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Map, Users, LogOut, Sun, Moon, Menu, BarChart2, Shield, Settings, Building2, FolderGit2 } from 'lucide-react';

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

      <aside className={`global-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
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
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '5px', marginLeft: collapsed ? '0' : 'auto' }}
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/geoportal" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Map size={20} />
            <span>Geoportal</span>
          </NavLink>

          <NavLink to="/dashboard" onClick={() => isMobile && setCollapsed(true)} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart2 size={20} />
            <span>Dashboard</span>
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
                <Settings size={18} />
                <span>Parámetros Generales</span>
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
        </div>
      </aside>

      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
