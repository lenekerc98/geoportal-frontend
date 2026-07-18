import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import Geoportal from './pages/Geoportal/Geoportal';
import AnalyticsDashboard from './pages/Dashboard/AnalyticsDashboard';
import SystemLogs from './pages/System/SystemLogs';
import SystemParams from './pages/System/SystemParams';
import EmpresasManager from './pages/System/EmpresasManager';
import ProjectsManager from './pages/System/ProjectsManager';
import Users from './pages/Users/Users';
import SidebarLayout from './components/Layout/SidebarLayout';
import { AppProvider } from './context/AppContext';
import ReportePlanimetrico from './pages/Reportes/ReportePlanimetrico';

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('catastro_theme_v2') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          
          {/* Rutas protegidas/envueltas en el Sidebar */}
          <Route element={<SidebarLayout />}>
            <Route path="/geoportal" element={<Geoportal />} />
            <Route path="/dashboard" element={<AnalyticsDashboard />} />
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
