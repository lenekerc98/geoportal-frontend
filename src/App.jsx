import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import Geoportal from './pages/Geoportal/Geoportal';
import AnalyticsDashboard from './pages/Dashboard/AnalyticsDashboard';
import SystemLogs from './pages/System/SystemLogs';
import ReporteriaDashboard from './pages/Reportes/ReporteriaDashboard';
import SystemParams from './pages/System/SystemParams';
import EmpresasManager from './pages/System/EmpresasManager';
import ProjectsManager from './pages/System/ProjectsManager';
import Users from './pages/Users/Users';
import SidebarLayout from './components/Layout/SidebarLayout';
import { AppProvider } from './context/AppContext';
import ReportePlanimetrico from './pages/Reportes/ReportePlanimetrico';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [fatalError, setFatalError] = useState(localStorage.getItem('catastro_fatal_error'));

  useEffect(() => {
    const handleGlobalError = (event) => {
      const errorMsg = event.error ? event.error.stack : event.message;
      localStorage.setItem('catastro_fatal_error', errorMsg);
      setFatalError(errorMsg);
    };
    const handleUnhandledRejection = (event) => {
      const errorMsg = event.reason ? event.reason.stack || event.reason : 'Unhandled Promise Rejection';
      localStorage.setItem('catastro_fatal_error', errorMsg);
      setFatalError(errorMsg);
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
        <Routes>
          <Route path="/" element={<Login />} />
          
          {/* Rutas protegidas/envueltas en el Sidebar */}
          <Route element={<SidebarLayout />}>
            <Route path="/geoportal" element={<Geoportal />} />
            <Route path="/dashboard" element={<AnalyticsDashboard />} />
            <Route path="/reporteria" element={<ErrorBoundary><ReporteriaDashboard /></ErrorBoundary>} />
            <Route path="/usuarios" element={<Users />} />
            <Route path="/sistema/parametros" element={<SystemParams />} />
            <Route path="/sistema/logs" element={<SystemLogs />} />
            <Route path="/empresas" element={<EmpresasManager />} />
            <Route path="/proyectos" element={<ProjectsManager />} />
          </Route>
          
          <Route path="/reporte/planimetrico/:id" element={<ReportePlanimetrico />} />
          <Route path="/reporte/planimetrico/codigo/:codigo" element={<ReportePlanimetrico />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
