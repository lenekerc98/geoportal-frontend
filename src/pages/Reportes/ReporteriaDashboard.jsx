import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  Layers,
  Edit3,
  Ruler,
  MapPin,
  Download,
  ChevronDown,
  Maximize2,
  FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../services/api';
import { confirmDelete, showSuccess, showError } from '../../utils/swal';
import MassivePurgeModal from '../../components/System/MassivePurgeModal';
import EditPredioModal from '../../components/MapViewer/EditPredioModal';
import EditLinderosModal from '../../components/MapViewer/EditLinderosModal';
import './ReporteriaDashboard.css';

const ReporteriaDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('catastro_token');
  const { activeEmpresa, activeProyecto, user } = useContext(AppContext);
  const userRole = user?.role || user?.rol?.nombre || user?.rol || '';
  const isSuperAdmin = ['superadmin', 'superadministrador', 'admin'].includes(String(userRole).toLowerCase());
  const [isStrictSuperAdmin, setIsStrictSuperAdmin] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filters
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Edit modals state
  const [editingPredio, setEditingPredio] = useState(null);
  const [linderosPredio, setLinderosPredio] = useState(null);
  const [activeDropdownCodigo, setActiveDropdownCodigo] = useState(null);

  const actualItemsPerPage = itemsPerPage === 'todos' ? data.length : itemsPerPage;

  useEffect(() => {
    fetchData();
  }, [activeEmpresa, activeProyecto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = localStorage.getItem('catastro_token');
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split('.')[1]));
        const role = (payload.role || '').toLowerCase();
        setIsStrictSuperAdmin(role.includes('superadmin') || role.includes('superadministrador'));
      } catch (e) {}
    }

    const handlePurged = () => fetchData();
    window.addEventListener('catastro_data_purged', handlePurged);
    return () => window.removeEventListener('catastro_data_purged', handlePurged);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleDocumentClick = () => {
      if (activeDropdownCodigo) {
        setActiveDropdownCodigo(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [activeDropdownCodigo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let queryUrl = `${API_URL}/api/gis/codigos-catastrales`;
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);
      if (activeEmpresa) params.append('empresa_id', activeEmpresa.id);
      if (activeProyecto) params.append('proyecto_id', activeProyecto.id);
      
      const queryString = params.toString();
      if (queryString) {
        queryUrl += `?${queryString}`;
      }

      const res = await fetch(queryUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
        setCurrentPage(1);
      }
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // ESTADO DERIVADO: Evita loops infinitos de renderizado
  const term = searchTerm.toLowerCase();
  const filteredData = data.filter(item => 
    String(item.codigo || '').toLowerCase().includes(term) ||
    String(item.nombre_posesionario || '').toLowerCase().includes(term) ||
    String(item.cedula_posesionario || '').toLowerCase().includes(term)
  );

  // Totales / Métricas
  const totalPredios = filteredData.length;
  const totalAreaHa = filteredData.reduce((acc, i) => acc + (parseFloat(i.area_ha) || 0), 0);

  // Acciones
  const handleEditPredio = (item) => {
    setEditingPredio(item);
  };

  const handleEditLinderos = (item) => {
    setLinderosPredio(item);
  };

  const handleVerEnMapa = (item) => {
    if (!item.codigo) return;
    navigate(`/geoportal?codigo=${encodeURIComponent(item.codigo)}`);
  };

  const handleGenerarReporte = (codigo, tipo) => {
    setActiveDropdownCodigo(null);
    if (!codigo) return;
    if (tipo === 'planimetrico') {
      navigate(`/reporte/planimetrico/codigo/${codigo}`);
    } else if (tipo === 'linderacion') {
      navigate(`/reporte/linderacion/codigo/${codigo}`);
    }
  };

  const handleDeletePredio = async (item) => {
    const confirmed = await confirmDelete(
      `¿Eliminar el predio ${item.codigo}?`,
      'Esta acción eliminará permanentemente el polígono, sus linderos, vértices y código catastral de la base de datos.'
    );
    if (!confirmed) return;

    try {
      const deleteUrl = item.predio_id 
        ? `${API_URL}/api/gis/predios/${item.predio_id}` 
        : `${API_URL}/api/gis/codigos-catastrales/${encodeURIComponent(item.codigo)}`;
      
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showSuccess('Predio eliminado exitosamente');
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.detail || 'Error al eliminar el predio');
      }
    } catch (e) {
      showError('Error de conexión al eliminar el predio');
    }
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      showError('No hay predios para exportar');
      return;
    }
    const rows = filteredData.map((item, idx) => ({
      '#': idx + 1,
      'Código Catastral': item.codigo,
      'Posesionario': item.nombre_posesionario || 'SIN NOMBRE',
      'Cédula': item.cedula_posesionario || 'S/D',
      'Superficie (Ha)': item.area_ha ? Number(item.area_ha).toFixed(4) : 'S/D',
      'Empresa': item.empresa_nombre || 'N/A',
      'Fecha Registro': item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString() : 'S/D'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Predios');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Gestion_Predios_${dateStr}.xlsx`);
    showSuccess('Archivo Excel generado exitosamente');
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / (actualItemsPerPage || 1)) || 1;
  const startIndex = (currentPage - 1) * actualItemsPerPage;
  const currentItems = filteredData.slice(startIndex, startIndex + actualItemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const emptyRows = itemsPerPage !== 'todos' && totalPages > 1 && currentPage === totalPages
    ? itemsPerPage - currentItems.length 
    : 0;

  const totalCols = isSuperAdmin ? 7 : 6;

  return (
    <div className="reporteria-dashboard">
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={28} color="var(--primary)" /> Gestión de Predios
          </h1>
          <p>Administración integral de predios, linderos perimétricos, posesionarios y emisión de reportes oficiales.</p>
        </div>

        {isStrictSuperAdmin && (
          <button
            onClick={() => setShowPurgeModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.88rem',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)',
              transition: 'all 0.2s ease'
            }}
            title="Herramienta de eliminación masiva exclusiva para Superadmin"
          >
            <Trash2 size={16} /> Limpieza Masiva de Predios
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
            <Layers size={22} />
          </div>
          <div className="metric-data">
            <h4>Total Predios</h4>
            <div className="metric-val">{totalPredios}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <Maximize2 size={22} />
          </div>
          <div className="metric-data">
            <h4>Superficie Total</h4>
            <div className="metric-val">{totalAreaHa > 0 ? `${totalAreaHa.toFixed(4)} Ha` : '0.0000 Ha'}</div>
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-card-header">
          <div className="report-card-title">
            <div className="report-icon">
              <FileText size={24} />
            </div>
            <div>
              <h2>Catálogo de Predios Catastrados</h2>
              <p>Consulta, edita datos y linderos, visualiza en el mapa o emite reportes planimétricos y actas de linderación.</p>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div className="input-group search-box">
                <Search size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Buscar por código, cédula o nombre..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>

              <button 
                className="btn-export-excel"
                onClick={handleExportExcel}
                title="Descargar catálogo actual en Excel"
              >
                <Download size={16} />
                Exportar Excel
              </button>
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
                  <th>Superficie</th>
                  {isSuperAdmin && <th>Empresa</th>}
                  <th>Fecha Registro</th>
                  <th style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  <>
                    {currentItems.map((item, idx) => (
                    <tr key={item.codigo || idx}>
                      <td data-label="Código Catastral" className="fw-bold">{item.codigo}</td>
                      <td data-label="Posesionario">{item.nombre_posesionario || 'SIN NOMBRE'}</td>
                      <td data-label="Cédula">{item.cedula_posesionario || 'S/D'}</td>
                      <td data-label="Superficie">{item.area_ha ? `${Number(item.area_ha).toFixed(4)} Ha` : '—'}</td>
                      {isSuperAdmin && <td data-label="Empresa">{item.empresa_nombre || 'N/A'}</td>}
                      <td data-label="Fecha Registro">{item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString() : 'S/D'}</td>
                      <td data-label="Acción" style={{ textAlign: 'center' }}>
                        <div className="actions-toolbar">
                          {/* 1. Editar Predio */}
                          <button
                            type="button"
                            className="btn-act btn-act-edit"
                            onClick={() => handleEditPredio(item)}
                            title="Editar datos del predio y posesionario"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* 2. Editar Linderos */}
                          <button
                            type="button"
                            className="btn-act btn-act-linderos"
                            onClick={() => handleEditLinderos(item)}
                            title="Editar linderos, colindantes y rumbos"
                          >
                            <Ruler size={15} />
                          </button>

                          {/* 3. Ver en Mapa */}
                          <button
                            type="button"
                            className="btn-act btn-act-map"
                            onClick={() => handleVerEnMapa(item)}
                            title="Ubicar y enfocar predio en el Geoportal"
                          >
                            <MapPin size={15} />
                          </button>

                          {/* 4. Imprimir Reportes Dropdown */}
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className="btn-act btn-act-report"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownCodigo(activeDropdownCodigo === item.codigo ? null : item.codigo);
                              }}
                              title="Generar reportes oficiales"
                            >
                              <Printer size={15} />
                              <ChevronDown size={12} style={{ marginLeft: 3 }} />
                            </button>

                            {activeDropdownCodigo === item.codigo && (
                              <div className="report-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="report-dropdown-item"
                                  onClick={() => handleGenerarReporte(item.codigo, 'planimetrico')}
                                >
                                  <FileText size={15} color="#2563eb" />
                                  <span>Levantamiento Planimétrico</span>
                                </button>
                                <button
                                  type="button"
                                  className="report-dropdown-item"
                                  onClick={() => handleGenerarReporte(item.codigo, 'linderacion')}
                                >
                                  <FileCheck size={15} color="#8b5cf6" />
                                  <span>Acta de Linderación</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 5. Eliminar Predio */}
                          <button
                            type="button"
                            className="btn-act btn-act-delete"
                            onClick={() => handleDeletePredio(item)}
                            title="Eliminar predio individualmente"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {emptyRows > 0 && Array.from({ length: emptyRows }).map((_, idx) => (
                    <tr key={`empty-${idx}`} style={{ height: '53px' }}>
                      <td colSpan={totalCols} style={{ border: 'none' }}></td>
                    </tr>
                  ))}
                </>
              ) : (
                  <tr>
                    <td colSpan={totalCols} className="empty-state">No se encontraron predios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filteredData.length > 0 && (
          <div className="pagination-controls">
            <div className="pagination-info" style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              <span>
                Mostrando {startIndex + 1} a {Math.min(startIndex + actualItemsPerPage, filteredData.length)} de {filteredData.length} registros
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filas por página:</label>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setItemsPerPage(val === 'todos' ? 'todos' : Number(val));
                    setCurrentPage(1);
                  }}
                  style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--border-color)', 
                    background: 'var(--bg-input)', 
                    color: 'var(--text-main)', 
                    outline: 'none', 
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
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

      {/* Modal: Editar Predio */}
      <EditPredioModal
        predio={editingPredio}
        isOpen={Boolean(editingPredio)}
        onClose={() => setEditingPredio(null)}
        onSaved={() => {
          fetchData();
          setEditingPredio(null);
        }}
      />

      {/* Modal: Editar Linderos */}
      <EditLinderosModal
        predio={linderosPredio}
        isOpen={Boolean(linderosPredio)}
        onClose={() => setLinderosPredio(null)}
        onSaved={() => {
          fetchData();
          setLinderosPredio(null);
        }}
      />

      {/* Modal: Purga Masiva SuperAdmin */}
      <MassivePurgeModal
        isOpen={showPurgeModal}
        onClose={() => setShowPurgeModal(false)}
        onPurged={() => fetchData()}
      />
    </div>
  );
};

export default ReporteriaDashboard;
