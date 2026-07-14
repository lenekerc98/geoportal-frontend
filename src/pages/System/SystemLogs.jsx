import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, Search, AlertTriangle, Info, Clock, User } from 'lucide-react';
import { API_URL } from '../../services/api';
import './SystemLogs.css';

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, success, error
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/system/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    // Tab filter
    if (activeTab === 'success' && log.tipo !== 'INFO') return false;
    if (activeTab === 'error' && log.tipo === 'INFO') return false; // errors & warnings
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.accion.toLowerCase().includes(term) ||
        log.descripcion.toLowerCase().includes(term) ||
        log.username.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const getLogIcon = (tipo) => {
    switch (tipo) {
      case 'INFO': return <CheckCircle size={18} color="#10b981" />;
      case 'WARNING': return <AlertTriangle size={18} color="#f59e0b" />;
      case 'ERROR': return <ShieldAlert size={18} color="#ef4444" />;
      default: return <Info size={18} color="#3b82f6" />;
    }
  };

  return (
    <div className="logs-container">
      <div className="logs-header">
        <div>
          <h1 className="logs-title">Bitácora del Sistema</h1>
          <p className="logs-subtitle">Registro de auditoría y eventos de Catastro 2026</p>
        </div>
        
        <div className="logs-search">
          <Search size={18} color="#94a3b8" />
          <input 
            type="text" 
            placeholder="Buscar por acción, descripción o usuario..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="logs-tabs">
        <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          Todos los Eventos
        </button>
        <button className={`tab-btn success ${activeTab === 'success' ? 'active' : ''}`} onClick={() => setActiveTab('success')}>
          Exitosos
        </button>
        <button className={`tab-btn error ${activeTab === 'error' ? 'active' : ''}`} onClick={() => setActiveTab('error')}>
          Errores y Advertencias
        </button>
      </div>

      <div className="logs-table-container">
        {loading ? (
          <div className="loading-state">Cargando bitácora...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">No se encontraron registros para los filtros seleccionados.</div>
        ) : (
          <table className="logs-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Acción</th>
                <th>Descripción</th>
                <th>Usuario</th>
                <th>Fecha y Hora</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id_log} className={`log-row ${log.tipo.toLowerCase()}`}>
                  <td className="log-type">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getLogIcon(log.tipo)}
                      <span>{log.tipo}</span>
                    </div>
                  </td>
                  <td className="log-action">
                    <span className="badge">{log.accion}</span>
                  </td>
                  <td className="log-desc">{log.descripcion}</td>
                  <td className="log-user">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={14} /> {log.username}
                    </div>
                  </td>
                  <td className="log-date">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={14} /> {new Date(log.fecha).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
