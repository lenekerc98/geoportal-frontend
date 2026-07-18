import React, { useState, useEffect } from 'react';
import { Settings, Map, Layers, Plus } from 'lucide-react';
import { API_URL } from '../../services/api';
import './SystemParams.css';

export default function SystemParams() {
  const [provincias, setProvincias] = useState([]);
  const [cantones, setCantones] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  
  const [selectedProv, setSelectedProv] = useState('');
  const [selectedCanton, setSelectedCanton] = useState('');

  useEffect(() => {
    fetchProvincias();
  }, []);

  const fetchProvincias = async () => {
    try {
      const res = await fetch(`${API_URL}/api/system/dpa/provincias`);
      const data = await res.json();
      setProvincias(data);
    } catch(e) { console.error(e); }
  };

  const fetchCantones = async (provId) => {
    try {
      const res = await fetch(`${API_URL}/api/system/dpa/cantones?provincia_id=${provId}`);
      const data = await res.json();
      setCantones(data);
      setCiudades([]);
      setSelectedCanton('');
    } catch(e) { console.error(e); }
  };

  const fetchCiudades = async (cantonId) => {
    try {
      const res = await fetch(`${API_URL}/api/system/dpa/ciudades?canton_id=${cantonId}`);
      const data = await res.json();
      setCiudades(data);
    } catch(e) { console.error(e); }
  };

  return (
    <div className="params-container">
      <h1 className="params-title">Gestión DPA</h1>
      <p className="params-subtitle">Gestión de División Político Administrativa (Provincias, Cantones, Parroquias)</p>

      <div className="params-grid">
        {/* Provincias */}
        <div className="param-card">
          <div className="card-header">
            <h3><Map size={20} /> Provincias</h3>
            <button className="icon-btn"><Plus size={16} /></button>
          </div>
          <ul className="dpa-list">
            {provincias.map(p => (
              <li 
                key={p.id} 
                className={selectedProv === p.id ? 'active' : ''}
                onClick={() => { setSelectedProv(p.id); fetchCantones(p.id); }}
              >
                {p.nombre}
              </li>
            ))}
          </ul>
        </div>

        {/* Cantones */}
        <div className="param-card">
          <div className="card-header">
            <h3><Layers size={20} /> Cantones</h3>
            <button className="icon-btn" disabled={!selectedProv}><Plus size={16} /></button>
          </div>
          {selectedProv ? (
            <ul className="dpa-list">
              {cantones.map(c => (
                <li 
                  key={c.id}
                  className={selectedCanton === c.id ? 'active' : ''}
                  onClick={() => { setSelectedCanton(c.id); fetchCiudades(c.id); }}
                >
                  {c.nombre}
                </li>
              ))}
              {cantones.length === 0 && <p className="empty-msg">No hay cantones registrados.</p>}
            </ul>
          ) : (
            <p className="empty-msg">Seleccione una provincia.</p>
          )}
        </div>

        {/* Ciudades */}
        <div className="param-card">
          <div className="card-header">
            <h3><Settings size={20} /> Ciudades / Parroquias</h3>
            <button className="icon-btn" disabled={!selectedCanton}><Plus size={16} /></button>
          </div>
          {selectedCanton ? (
            <ul className="dpa-list">
              {ciudades.map(ciu => (
                <li key={ciu.id}>{ciu.nombre}</li>
              ))}
              {ciudades.length === 0 && <p className="empty-msg">No hay ciudades registradas.</p>}
            </ul>
          ) : (
            <p className="empty-msg">Seleccione un cantón.</p>
          )}
        </div>
      </div>
    </div>
  );
}
