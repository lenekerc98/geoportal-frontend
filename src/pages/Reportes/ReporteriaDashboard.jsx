import React, { useState } from 'react';
import { Search, FileText, Printer } from 'lucide-react';
import './ReporteriaDashboard.css';

const ReporteriaDashboard = () => {
  const [codigo, setCodigo] = useState('');

  const handleGenerarReporte = (e) => {
    e.preventDefault();
    if (!codigo) return;
    
    // Abre el reporte en una nueva pestaña lista para imprimir
    const url = `/reporte/planimetrico/codigo/${codigo}`;
    window.open(url, '_blank');
  };

  return (
    <div className="reporteria-dashboard">
      <div className="dashboard-header">
        <h1>Módulo de Reportería</h1>
        <p>Genera reportes catastrales oficiales en formato PDF y listos para imprimir.</p>
      </div>

      <div className="reporteria-content">
        <div className="report-card">
          <div className="report-icon">
            <FileText size={40} />
          </div>
          <div className="report-details">
            <h2>Levantamiento Planimétrico</h2>
            <p>Reporte oficial con mapa de linderos, coordenadas UTM (WGS-84) y datos del posesionario.</p>
            
            <form onSubmit={handleGenerarReporte} className="report-form">
              <div className="input-group">
                <Search size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Ingrese el Código Catastral..."
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="search-input"
                />
              </div>
              <button type="submit" className="btn-generar" disabled={!codigo}>
                <Printer size={18} />
                Generar e Imprimir
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReporteriaDashboard;
