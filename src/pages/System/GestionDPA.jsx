import React, { useState, useEffect } from 'react';
import { Map, Layers, Building2, Search, ChevronRight, Globe, Loader2 } from 'lucide-react';
import { API_URL } from '../../services/api';
import './GestionDPA.css';

export default function GestionDPA() {
  const [provincias, setProvincias] = useState([]);
  const [cantones, setCantones] = useState([]);
  const [ciudades, setCiudades] = useState([]);

  const [selectedProv, setSelectedProv] = useState(null);
  const [selectedCanton, setSelectedCanton] = useState(null);

  const [loadingProvincias, setLoadingProvincias] = useState(true);
  const [loadingCantones, setLoadingCantones] = useState(false);
  const [loadingCiudades, setLoadingCiudades] = useState(false);

  const [searchProv, setSearchProv] = useState('');
  const [searchCanton, setSearchCanton] = useState('');
  const [searchCiudad, setSearchCiudad] = useState('');

  useEffect(() => {
    fetchProvincias();
  }, []);

  const fetchProvincias = async () => {
    try {
      setLoadingProvincias(true);
      const res = await fetch(`${API_URL}/api/system/dpa/provincias`);
      const data = await res.json();
      setProvincias(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProvincias(false);
    }
  };

  const fetchCantones = async (prov) => {
    setSelectedProv(prov);
    setSelectedCanton(null);
    setCantones([]);
    setCiudades([]);
    setSearchCanton('');
    setSearchCiudad('');

    try {
      setLoadingCantones(true);
      const res = await fetch(`${API_URL}/api/system/dpa/cantones?provincia_id=${prov.id}`);
      const data = await res.json();
      setCantones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCantones(false);
    }
  };

  const fetchCiudades = async (canton) => {
    setSelectedCanton(canton);
    setCiudades([]);
    setSearchCiudad('');

    try {
      setLoadingCiudades(true);
      const res = await fetch(`${API_URL}/api/system/dpa/ciudades?canton_id=${canton.id}`);
      const data = await res.json();
      setCiudades(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCiudades(false);
    }
  };

  // Filtrados por búsqueda
  const filteredProvincias = provincias.filter(p => {
    const q = searchProv.toLowerCase().trim();
    if (!q) return true;
    return (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.codigo_dpa && p.codigo_dpa.includes(q));
  });

  const filteredCantones = cantones.filter(c => {
    const q = searchCanton.toLowerCase().trim();
    if (!q) return true;
    return (c.nombre && c.nombre.toLowerCase().includes(q)) || (c.codigo_dpa && c.codigo_dpa.includes(q));
  });

  const filteredCiudades = ciudades.filter(ciu => {
    const q = searchCiudad.toLowerCase().trim();
    if (!q) return true;
    return (ciu.nombre && ciu.nombre.toLowerCase().includes(q)) || (ciu.codigo_dpa && ciu.codigo_dpa.includes(q));
  });

  return (
    <div className="dpa-page-container">
      {/* Header Superior con Título y Breadcrumb */}
      <div className="dpa-top-header">
        <div className="dpa-title-block">
          <h1>
            <Globe size={26} color="var(--primary)" /> Gestión DPA
          </h1>
          <p>División Política Administrativa del Ecuador</p>
        </div>

        <div className="dpa-breadcrumbs-bar">
          <span className="crumb-node">
            <Globe size={14} /> Ecuador
          </span>
          <ChevronRight size={14} />
          <span className={`crumb-node ${selectedProv ? 'crumb-active' : ''}`}>
            {selectedProv ? selectedProv.nombre : 'Seleccionar Provincia'}
          </span>
          {selectedProv && (
            <>
              <ChevronRight size={14} />
              <span className={`crumb-node ${selectedCanton ? 'crumb-active' : ''}`}>
                {selectedCanton ? selectedCanton.nombre : 'Seleccionar Cantón'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Grilla con 3 Columnas fijas lado a lado */}
      <div className="dpa-columns-grid">
        {/* Columna 1: Provincias */}
        <div className="dpa-column-card">
          <div className="dpa-card-top">
            <h3>
              <Map size={18} color="var(--primary)" /> Provincias
            </h3>
            <span className="dpa-badge-pill">
              {filteredProvincias.length} {filteredProvincias.length === 1 ? 'provincia' : 'provincias'}
            </span>
          </div>

          <div className="dpa-search-wrapper">
            <Search size={14} className="dpa-search-ico" />
            <input
              type="text"
              className="dpa-search-box"
              placeholder="Buscar provincia o código..."
              value={searchProv}
              onChange={e => setSearchProv(e.target.value)}
            />
          </div>

          {loadingProvincias ? (
            <div className="dpa-empty-indicator">
              <Loader2 size={24} className="spin" />
              <span>Cargando provincias...</span>
            </div>
          ) : (
            <ul className="dpa-items-list">
              {filteredProvincias.map(p => {
                const isSelected = selectedProv?.id === p.id;
                return (
                  <li
                    key={p.id}
                    className={`dpa-list-entry ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => fetchCantones(p)}
                  >
                    <span>{p.nombre}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {p.codigo_dpa && <span className="dpa-code-tag">{p.codigo_dpa}</span>}
                      <ChevronRight size={15} opacity={isSelected ? 1 : 0.4} />
                    </div>
                  </li>
                );
              })}
              {filteredProvincias.length === 0 && (
                <div className="dpa-empty-indicator">
                  <span>No se encontraron provincias</span>
                </div>
              )}
            </ul>
          )}
        </div>

        {/* Columna 2: Cantones */}
        <div className="dpa-column-card">
          <div className="dpa-card-top">
            <h3>
              <Layers size={18} color="var(--primary)" /> Cantones
            </h3>
            <span className="dpa-badge-pill">
              {selectedProv ? `${filteredCantones.length} cantones` : 'Inactivo'}
            </span>
          </div>

          {selectedProv && (
            <div className="dpa-search-wrapper">
              <Search size={14} className="dpa-search-ico" />
              <input
                type="text"
                className="dpa-search-box"
                placeholder={`Buscar en ${selectedProv.nombre}...`}
                value={searchCanton}
                onChange={e => setSearchCanton(e.target.value)}
              />
            </div>
          )}

          {!selectedProv ? (
            <div className="dpa-empty-indicator">
              <Map size={36} />
              <span>Seleccione una provincia en la primera columna para explorar sus cantones.</span>
            </div>
          ) : loadingCantones ? (
            <div className="dpa-empty-indicator">
              <Loader2 size={24} className="spin" />
              <span>Cargando cantones de {selectedProv.nombre}...</span>
            </div>
          ) : (
            <ul className="dpa-items-list">
              {filteredCantones.map(c => {
                const isSelected = selectedCanton?.id === c.id;
                return (
                  <li
                    key={c.id}
                    className={`dpa-list-entry ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => fetchCiudades(c)}
                  >
                    <span>{c.nombre}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {c.codigo_dpa && <span className="dpa-code-tag">{c.codigo_dpa}</span>}
                      <ChevronRight size={15} opacity={isSelected ? 1 : 0.4} />
                    </div>
                  </li>
                );
              })}
              {filteredCantones.length === 0 && (
                <div className="dpa-empty-indicator">
                  <span>No se encontraron cantones registrados en esta provincia.</span>
                </div>
              )}
            </ul>
          )}
        </div>

        {/* Columna 3: Ciudades / Parroquias */}
        <div className="dpa-column-card">
          <div className="dpa-card-top">
            <h3>
              <Building2 size={18} color="var(--primary)" /> Ciudades / Parroquias
            </h3>
            <span className="dpa-badge-pill">
              {selectedCanton ? `${filteredCiudades.length} parroquias` : 'Inactivo'}
            </span>
          </div>

          {selectedCanton && (
            <div className="dpa-search-wrapper">
              <Search size={14} className="dpa-search-ico" />
              <input
                type="text"
                className="dpa-search-box"
                placeholder={`Buscar en ${selectedCanton.nombre}...`}
                value={searchCiudad}
                onChange={e => setSearchCiudad(e.target.value)}
              />
            </div>
          )}

          {!selectedCanton ? (
            <div className="dpa-empty-indicator">
              <Layers size={36} />
              <span>Seleccione un cantón en la segunda columna para ver sus parroquias o ciudades.</span>
            </div>
          ) : loadingCiudades ? (
            <div className="dpa-empty-indicator">
              <Loader2 size={24} className="spin" />
              <span>Cargando ciudades de {selectedCanton.nombre}...</span>
            </div>
          ) : (
            <ul className="dpa-items-list">
              {filteredCiudades.map(ciu => (
                <li
                  key={ciu.id}
                  className="dpa-list-entry"
                  style={{ cursor: 'default' }}
                >
                  <span>{ciu.nombre}</span>
                  {ciu.codigo_dpa && <span className="dpa-code-tag">{ciu.codigo_dpa}</span>}
                </li>
              ))}
              {filteredCiudades.length === 0 && (
                <div className="dpa-empty-indicator">
                  <span>No hay ciudades o parroquias registradas en este cantón.</span>
                </div>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
