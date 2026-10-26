import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import SidebarLayout from './components/Layout/SidebarLayout';
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import { API_URL } from './services/api';

// Code-splitting diferido de páginas para carga ultrarrápida y menor consumo de memoria
const Geoportal = lazy(() => import('./pages/Geoportal/Geoportal'));
const AnalyticsDashboard = lazy(() => import('./pages/Dashboard/AnalyticsDashboard'));
const SystemLogs = lazy(() => import('./pages/System/SystemLogs'));
const ReporteriaDashboard = lazy(() => import('./pages/Reportes/ReporteriaDashboard'));
const SystemParams = lazy(() => import('./pages/System/SystemParams'));
const GestionDPA = lazy(() => import('./pages/System/GestionDPA'));
const EmpresasManager = lazy(() => import('./pages/System/EmpresasManager'));
const ProjectsManager = lazy(() => import('./pages/System/ProjectsManager'));
const Users = lazy(() => import('./pages/Users/Users'));
const CartasTopograficas = lazy(() => import('./pages/Cartas/CartasTopograficas'));
const ReportePlanimetrico = lazy(() => import('./pages/Reportes/ReportePlanimetrico'));
const ReporteLinderacion = lazy(() => import('./pages/Reportes/ReporteLinderacion'));

const reportErrorToBackend = async (errorMsg) => {
  try {
    const userStr = localStorage.getItem('catastro_user');
    let userDesc = 'Usuario no autenticado / Sesión anónima';
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        userDesc = `${u.username || u.nombre || u.email || 'Usuario'} (ID: ${u.id || 'N/A'})`;
      } catch(e) {}
    }
    
    await fetch(`${API_URL}/api/system/report-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: String(errorMsg),
        user: userDesc,
        url: window.location.href
      })
    });
  } catch (err) {
    console.error("No se pudo reportar el error al backend:", err);
  }
};

const ProtectedRoute = ({ children }) => {
  // Permitir token vía query param (ej. para automatización o generación headless)
  try {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('catastro_token', urlToken);
    }
  } catch (e) {}

  const token = localStorage.getItem('catastro_token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  const [fatalError, setFatalError] = useState(localStorage.getItem('catastro_fatal_error'));

  useEffect(() => {
    const handleGlobalError = (event) => {
      let errorMsg = 'Unknown Error';
      if (event.error) {
        errorMsg = event.error.stack || event.error.message || String(event.error);
      } else if (event.message) {
        errorMsg = String(event.message);
      }
      localStorage.setItem('catastro_fatal_error', errorMsg);
      setFatalError(errorMsg);
      reportErrorToBackend(errorMsg);
    };
    const handleUnhandledRejection = (event) => {
      let errorMsg = 'Unhandled Promise Rejection';
      if (event.reason) {
        errorMsg = event.reason.stack || event.reason.message || String(event.reason);
      }
      // Ignorar errores normales de red u offline para no bloquear la app en campo
      const isNetworkError = errorMsg.includes('Failed to fetch') || 
                             errorMsg.includes('NetworkError') || 
                             errorMsg.includes('Load failed') || 
                             errorMsg.includes('aborted') || 
                             !navigator.onLine;
      if (isNetworkError) {
        console.warn("Ignorando error de red no crítico:", errorMsg);
        return;
      }
      localStorage.setItem('catastro_fatal_error', errorMsg);
      setFatalError(errorMsg);
      reportErrorToBackend(errorMsg);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('catastro_theme_v2') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const clearError = () => {
    localStorage.removeItem('catastro_fatal_error');
    setFatalError(null);
  };

  if (fatalError) {
    return (
      <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', minHeight: '100vh' }}>
        <h1>Falla Crítica Detectada</h1>
        <p>El sistema atrapó el error que está causando el reinicio:</p>
        <pre style={{ background: 'white', padding: '15px', overflowX: 'auto', border: '1px solid #f87171' }}>
          {fatalError}
        </pre>
        <button onClick={clearError} style={{ padding: '10px 20px', background: '#991b1b', color: 'white', border: 'none', cursor: 'pointer', marginTop: '20px' }}>
          Limpiar Error y Reintentar
        </button>
      </div>
    );
  }

  return (
    <AppProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            background: 'var(--bg-main, #0f172a)',
            color: 'var(--text-main, #ffffff)',
            gap: '16px'
          }}>
            <div className="spin" style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: '3px solid rgba(56, 189, 248, 0.2)',
              borderTopColor: 'var(--accent-color, #38bdf8)'
            }} />
            <span style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>
              Cargando Sistema Catastral...
            </span>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Login />} />
            
            {/* Rutas protegidas/envueltas en el Sidebar */}
            <Route element={<SidebarLayout />}>
              <Route path="/geoportal" element={<Geoportal />} />
              <Route path="/dashboard" element={<AnalyticsDashboard />} />
              <Route path="/predios" element={<ErrorBoundary><ReporteriaDashboard /></ErrorBoundary>} />
              <Route path="/reporteria" element={<ErrorBoundary><ReporteriaDashboard /></ErrorBoundary>} />
              <Route path="/cartas-topograficas" element={<CartasTopograficas />} />
              <Route path="/usuarios" element={<Users />} />
              <Route path="/localizacion/dpa" element={<GestionDPA />} />
              <Route path="/sistema/parametros" element={<SystemParams />} />
              <Route path="/sistema/logs" element={<SystemLogs />} />
              <Route path="/empresas" element={<EmpresasManager />} />
              <Route path="/proyectos" element={<ProjectsManager />} />
            </Route>
            
            <Route path="/reporte/planimetrico/:id" element={<ProtectedRoute><ReportePlanimetrico /></ProtectedRoute>} />
            <Route path="/reporte/planimetrico/codigo/:codigo" element={<ProtectedRoute><ReportePlanimetrico /></ProtectedRoute>} />
            
            <Route path="/reporte/linderacion/codigo/:codigo" element={<ProtectedRoute><ReporteLinderacion /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}
