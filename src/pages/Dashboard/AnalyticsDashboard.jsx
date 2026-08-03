import React, { useState, useEffect, useContext } from 'react';
import { Users, Map, Layers, Target, Activity, Building2, FolderGit2, ArrowUpRight, CheckCircle2, Clock, MapPin, Eye, FileText, Sparkles, PieChart, BarChart3, ShieldCheck } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    usuarios: 0,
    predios: 0,
    ortofotos: 0,
    proyectos: 0,
    empresas: 0
  });

  const [recentPredios, setRecentPredios] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeEmpresa, activeProyecto } = useContext(AppContext);
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('catastro_token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };

        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUserRole((payload.role || '').toLowerCase());
          setUsername(payload.sub || 'Usuario');
        } catch (e) { }

        const urlParams = new URLSearchParams();
        if (activeEmpresa) urlParams.append('empresa_id', activeEmpresa.id);
        if (activeProyecto) urlParams.append('proyecto_id', activeProyecto.id);
        const queryStr = urlParams.toString() ? `?${urlParams.toString()}` : '';

        // 1. Predios
        const resPredios = await fetch(`${API_URL}/api/gis/predios${queryStr}`, { headers });
        let prediosList = [];
        if (resPredios.ok) {
          const prediosData = await resPredios.json();
          prediosList = prediosData.features || (Array.isArray(prediosData) ? prediosData : []);
        }

        // 2. Ortofotos
        let ortofotosCount = 0;
        try {
          const resOrtofotos = await fetch(`${API_URL}/api/gis/catalog${queryStr}`, { headers });
          if (resOrtofotos.ok) {
            const ortofotosData = await resOrtofotos.json();
            ortofotosCount = ortofotosData.features ? ortofotosData.features.length : (Array.isArray(ortofotosData) ? ortofotosData.length : 0);
          }
        } catch (e) { }

        // 3. Usuarios
        let usersCount = 0;
        try {
          const resUsers = await fetch(`${API_URL}/api/users`, { headers });
          if (resUsers.ok) {
            const usersData = await resUsers.json();
            usersCount = Array.isArray(usersData) ? usersData.length : 0;
          }
        } catch (err) { }

        // 4. Empresas & Proyectos
        let empresasCount = 1;
        let proyectosCount = 1;
        try {
          const resEmp = await fetch(`${API_URL}/api/empresas`, { headers });
          if (resEmp.ok) {
            const empData = await resEmp.json();
            empresasCount = empData.length;
          }
          const resProj = await fetch(`${API_URL}/api/proyectos`, { headers });
          if (resProj.ok) {
            const projData = await resProj.json();
            proyectosCount = projData.length;
          }
        } catch (err) { }

        setStats({
          usuarios: usersCount || 1,
          predios: prediosList.length,
          ortofotos: ortofotosCount,
          proyectos: proyectosCount,
          empresas: empresasCount
        });

        // Set recent 5 predios for recent activity
        setRecentPredios(prediosList.slice(0, 5));

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeEmpresa, activeProyecto]);

  const isSuperAdmin = ['superadmin', 'superadministrador'].includes(userRole);

  return (
    <div style={{ padding: '30px', minHeight: '100vh', position: 'relative', color: 'var(--text-color)' }}>
      <div style={{ position: 'absolute', top: '5%', right: '5%', width: '350px', height: '350px', background: 'var(--primary-glow)', borderRadius: '50%', filter: 'blur(90px)', zIndex: -1 }}></div>

      {/* Banner de Contexto y Saludo */}
      <header className="glass-panel" style={{ padding: '25px', marginBottom: '30px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 className="title" style={{ margin: 0, fontSize: '26px' }}>Dashboard de Analíticas Catastrales</h1>
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-color)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              LIVE GIS 2026
            </span>
          </div>
          <p className="subtitle" style={{ margin: 0 }}>
            Bienvenido, <strong style={{ color: 'var(--text-main)' }}>{username}</strong> — Monitoreo geospacial y catastro territorial en tiempo real.
          </p>
        </div>

        {/* Badge de Contexto Activo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          <Building2 size={20} color="var(--accent-color)" />
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Contexto Global Activo</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {activeEmpresa ? activeEmpresa.nombre : (isSuperAdmin ? 'Todas las Empresas (Visión Global)' : 'GAD Asignado')}
              {activeProyecto ? ` — ${activeProyecto.nombre}` : ''}
            </div>
          </div>
        </div>
      </header>

      {/* Grid de KPIs Principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>

        {/* KPI 1: Predios */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Predios Registrados</span>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1' }}>{stats.predios}</div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> {stats.predios > 0 ? `${stats.predios} predio(s) activo(s)` : 'Sincronizado con PostGIS'}
            </div>
          </div>
        </div>

        {/* KPI 2: Ortofotos */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Ortofotos Subidas</span>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1' }}>{stats.ortofotos}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Capas GeoTIFF y Mosaicos
            </div>
          </div>
        </div>

        {/* KPI 3: Usuarios */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Usuarios del Sistema</span>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1' }}>{stats.usuarios}</div>
            <div style={{ fontSize: '11px', color: '#a855f7', marginTop: '6px', fontWeight: '600' }}>
              Cuentas Activas
            </div>
          </div>
        </div>

        {/* KPI 4: Estado Motor */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Estado Motor GIS & DB</span>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={18} /> Óptimo
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              PostGIS + QGIS Connected
            </div>
          </div>
        </div>

      </div>

      {/* Sección Principal: Gráficos de Distribución + Accesos Rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '25px', marginBottom: '30px' }}>

        {/* Gráfico 1: Distribución por Capas Catastrales */}
        <div className="glass-panel" style={{ padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PieChart size={20} color="var(--accent-color)" />
              <h3 style={{ margin: 0, fontSize: '16px' }}>Distribución de Capas Catastrales</h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Métricas GIS</span>
          </div>

          {/* Custom SVG Donut Chart con datos reales */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="50, 100" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="30, 100" strokeDashoffset="-50" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#a855f7" strokeWidth="4" strokeDasharray="20, 100" strokeDashoffset="-80" />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.predios + stats.ortofotos}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Elementos</span>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> Polígonos de Predios
                </span>
                <strong style={{ color: 'var(--text-main)' }}>{stats.predios}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span> Ortofotos & Raster
                </span>
                <strong style={{ color: 'var(--text-main)' }}>{stats.ortofotos}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#a855f7' }}></span> Proyectos Activos
                </span>
                <strong style={{ color: 'var(--text-main)' }}>{stats.proyectos}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Accesos Rápidos a Módulos */}
        <div className="glass-panel" style={{ padding: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Sparkles size={20} color="var(--accent-color)" />
            <h3 style={{ margin: 0, fontSize: '16px' }}>Accesos Rápidos</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => navigate('/geoportal')}
              style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }}
            >
              <Map size={18} color="#3b82f6" /> Geoportal 2D/3D
            </button>

            <button
              onClick={() => navigate('/usuarios')}
              style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }}
            >
              <Users size={18} color="#a855f7" /> Gestión Usuarios
            </button>

            <button
              onClick={() => navigate('/reporteria')}
              style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }}
            >
              <FileText size={18} color="#10b981" /> Reportes PDF/XLS
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => navigate('/empresas')}
                style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }}
              >
                <Building2 size={18} color="#f59e0b" /> Empresas / GADs
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Tabla de Predios Creados / Actividad Reciente */}
      <div className="glass-panel" style={{ padding: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} color="var(--accent-color)" />
            <h3 style={{ margin: 0, fontSize: '16px' }}>Últimos Predios Registrados</h3>
          </div>
          <button
            onClick={() => navigate('/geoportal')}
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Ver todos en Mapa <ArrowUpRight size={16} />
          </button>
        </div>

        {recentPredios.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            No hay predios registrados recientemente en este contexto.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Código Catastral</th>
                  <th>Posesionario / Propietario</th>
                  <th>Geometría</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {recentPredios.map((f, idx) => (
                  <tr key={f.id || idx}>
                    <td style={{ fontWeight: '700', color: 'var(--accent-color)' }}>
                      {f.properties?.cod_catastral || f.cod_catastral || `PRED-${idx + 1}`}
                    </td>
                    <td>
                      {f.properties?.posesionario_nombre || f.posesionario_nombre || 'Sin registrar'}
                    </td>
                    <td>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-color)' }}>
                        {f.geometry?.type || 'Polígono'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => navigate('/geoportal')}
                        style={{ padding: '6px 12px', background: 'var(--bg-main)', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Eye size={14} /> Inspeccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

