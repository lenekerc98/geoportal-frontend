import React, { useState, useEffect, useContext } from 'react';
import { Search, FileText, Printer, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../services/api';
import './ReporteriaDashboard.css';

const ReporteriaDashboard = () => {
  const { token } = useContext(AppContext);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filters
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let queryUrl = `${API_URL}/api/gis/codigos-catastrales`;
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);
      
      const queryString = params.toString();
      if (queryString) {
        queryUrl += `?${queryString}`;
      }

      const res = await fetch(queryUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setFilteredData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const filtered = data.filter(item => 
      (item.codigo || '').toLowerCase().includes(term) ||
      (item.nombre_posesionario || '').toLowerCase().includes(term) ||
      (item.cedula_posesionario || '').toLowerCase().includes(term)
    );
    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page on search
  }, [searchTerm, data]);

  const handleGenerarReporte = (codigo) => {
    if (!codigo) return;
    const url = `/reporte/planimetrico/codigo/${codigo}`;
    window.open(url, '_blank');
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="reporteria-dashboard">
      <div className="dashboard-header">
        <h1>Módulo de Reportería</h1>
        <p>Genera reportes catastrales oficiales en formato PDF y listos para imprimir.</p>
      </div>

      <div className="report-card">
        <div className="report-card-header">
          <div className="report-card-title">
            <div className="report-icon">
              <FileText size={24} />
            </div>
            <div>
              <h2>Levantamiento Planimétrico</h2>
              <p>Selecciona un predio para generar su reporte oficial con mapa de linderos y coordenadas.</p>
            </div>
          </div>
          
          <div className="filters-container">
            <div className="date-filters">
              <div className="date-group">
                <label>Desde:</label>
                <input 
                  type="date" 
                  value={fechaInicio} 
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="date-group">
                <label>Hasta:</label>
                <input 
                  type="date" 
                  value={fechaFin} 
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="date-input"
                />
              </div>
              <button className="btn-filtrar" onClick={fetchData}>
                Filtrar Período
              </button>
            </div>

            <div className="input-group search-box">
              <Search size={18} className="input-icon" />
              <input 
                type="text" 
                placeholder="Buscar por código, cédula o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading-state">Cargando predios...</div>
          ) : (
            <table className="reporteria-table">
              <thead>
                <tr>
                  <th>Código Catastral</th>
                  <th>Posesionario</th>
                  <th>Cédula</th>
                  <th>Fecha Registro</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="fw-bold">{item.codigo}</td>
                      <td>{item.nombre_posesionario || 'SIN NOMBRE'}</td>
                      <td>{item.cedula_posesionario || 'S/D'}</td>
                      <td>{new Date(item.fecha_creacion).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn-generar-sm" 
                          onClick={() => handleGenerarReporte(item.codigo)}
                        >
                          <Printer size={16} />
                          Generar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-state">No se encontraron predios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Controles de Paginación */}
        {!loading && filteredData.length > 0 && (
          <div className="pagination-controls">
            <div className="pagination-info">
              Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredData.length)} de {filteredData.length} registros
            </div>
            <div className="pagination-buttons">
              <button 
                onClick={() => goToPage(1)} 
                disabled={currentPage === 1}
                title="Primero"
              >
                <ChevronsLeft size={16} />
              </button>
              <button 
                onClick={() => goToPage(currentPage - 1)} 
                disabled={currentPage === 1}
                title="Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="page-indicator">
                Página {currentPage} de {totalPages}
              </span>
              <button 
                onClick={() => goToPage(currentPage + 1)} 
                disabled={currentPage === totalPages}
                title="Siguiente"
              >
                <ChevronRight size={16} />
              </button>
              <button 
                onClick={() => goToPage(totalPages)} 
                disabled={currentPage === totalPages}
                title="Último"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReporteriaDashboard;
