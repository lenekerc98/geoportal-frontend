import React, { useState, useEffect } from 'react';
import { Users, Map, Layers, Target, Activity } from 'lucide-react';
import { API_URL } from '../../services/api';
import './Dashboard.css';

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    usuarios: 0,
    predios: 0,
    ortofotos: 0
  });

  useEffect(() => {
    // Aquí idealmente haríamos fetch a un endpoint de métricas
    // Por ahora simularemos la carga o haremos fetch de los catálogos
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('catastro_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Predios
        const resPredios = await fetch(`${API_URL}/api/gis/predios`, { headers });
        const prediosData = await resPredios.json();
        const prediosCount = prediosData.features ? prediosData.features.length : 0;
        
        // Ortofotos
        const resOrtofotos = await fetch(`${API_URL}/api/gis/catalog`, { headers });
        const ortofotosData = await resOrtofotos.json();
        const ortofotosCount = ortofotosData.features ? ortofotosData.features.length : 0;

        setStats({
          usuarios: 3, // Hardcodeado por ahora o fetching si hay endpoint
          predios: prediosCount,
          ortofotos: ortofotosCount
        });
      } catch(e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="analytics-container">
      <h1 className="dashboard-title">Dashboard de Analíticas</h1>
      <p className="dashboard-subtitle">Resumen general del estado del sistema Catastro 2026</p>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <Target size={24} color="#3b82f6" />
          </div>
          <div className="stat-info">
            <h3>Total Predios</h3>
            <p className="stat-value">{stats.predios}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper green">
            <Layers size={24} color="#10b981" />
          </div>
          <div className="stat-info">
            <h3>Ortofotos Procesadas</h3>
            <p className="stat-value">{stats.ortofotos}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper purple">
            <Users size={24} color="#8b5cf6" />
          </div>
          <div className="stat-info">
            <h3>Usuarios Activos</h3>
            <p className="stat-value">{stats.usuarios}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon-wrapper orange">
            <Activity size={24} color="#f59e0b" />
          </div>
          <div className="stat-info">
            <h3>Estado del Motor</h3>
            <p className="stat-value" style={{ fontSize: '1.2rem', color: '#10b981' }}>Óptimo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
