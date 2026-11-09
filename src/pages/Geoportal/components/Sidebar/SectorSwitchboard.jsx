import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  Target,
  Eye,
  EyeOff,
  Edit
} from 'lucide-react';
import SectorColorPickerButton from '../Map/SectorColorPickerButton';

export default function SectorSwitchboard({
  predioViewTab,
  setPredioViewTab,
  availableSectors = [],
  disabledSectors = new Set(),
  setDisabledSectors,
  colorBySector,
  setColorBySector,
  expandedSectors = {},
  setExpandedSectors,
  filteredAvailableSectors = [],
  sectorSearchTerm,
  setSectorSearchTerm,
  prediosBySector = {},
  searchResults,
  selectedYear,
  visibleCounts = {},
  setVisibleCounts,
  handleSectorColorChange,
  zoomToSector,
  toggleSectorVisibility,
  hiddenFeatureIds = [],
  setHiddenFeatureIds,
  listDisplayMode,
  setListDisplayMode,
  zoomToFeature,
  setFeatureContextMenu,
  setEditingPredio,
  selectedSectorFilter,
  setSelectedSectorFilter,
  loadingPredios,
  prediosData
}) {
  const renderPredioRow = (f) => {
    if (!f || !f.properties) return null;
    const isHidden = hiddenFeatureIds.includes(f.properties.id);
    let displayText = '';
    if (listDisplayMode === 'codigo') {
      displayText = f.properties.cod_catastral || `Predio ${f.properties.id}`;
    } else if (listDisplayMode === 'nombre') {
      displayText = f.properties.nombre_posesionario || 'Sin Nombre';
    } else if (listDisplayMode === 'sector') {
      displayText = f.properties.sector ? `${f.properties.sector} • ${f.properties.cod_catastral || ''}` : (f.properties.cod_catastral || `Predio ${f.properties.id}`);
    } else {
      displayText = f.properties.cod_catastral || `Predio ${f.properties.id}`;
    }

    return (
      <div
        key={f.properties.id}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px', borderBottom: '1px solid var(--card-border)', fontSize: '0.76rem', color: isHidden ? 'var(--text-muted)' : 'var(--text-main)', opacity: isHidden ? 0.6 : 1, cursor: 'pointer' }}
        onClick={() => zoomToFeature && zoomToFeature(f)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (setFeatureContextMenu) {
            setFeatureContextMenu({
              feature: f,
              mouseX: e.clientX,
              mouseY: e.clientY
            });
          }
        }}
      >
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={displayText}>
            {displayText}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{ cursor: 'pointer', color: '#3b82f6' }}
            onClick={(e) => {
              e.stopPropagation();
              if (setEditingPredio) {
                setEditingPredio({
                  id: f.properties.id,
                  predio_id: f.properties.id,
                  posesionario_id: f.properties.posesionario_id || null,
                  cod_catastral: f.properties.cod_catastral,
                  cedula: f.properties.cedula || '',
                  nombre_posesionario: f.properties.nombre_posesionario || '',
                  empresa_id: f.properties.empresa_id,
                  proyecto_id: f.properties.proyecto_id,
                  geom_geojson: f.geometry ? JSON.stringify(f.geometry, null, 2) : '',
                  sector: f.properties.sector || '',
                  parroquia: f.properties.parroquia || '',
                  isOffline: f.properties.isOffline,
                  offline_id: f.properties.offline_id || f.properties.id
                });
              }
            }}
            title="Editar predio"
          >
            <Edit size={14} />
          </span>

          <span
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (isHidden) setHiddenFeatureIds(hiddenFeatureIds.filter(id => id !== f.properties.id));
              else setHiddenFeatureIds([...hiddenFeatureIds, f.properties.id]);
            }}
            title={isHidden ? "Mostrar lote" : "Ocultar lote"}
          >
            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </span>
        </div>
      </div>
    );
  };

  const hasAnyExpandedSectors = Object.values(expandedSectors).some(Boolean);

  return (
    <div style={{ padding: '6px 10px 10px 14px', backgroundColor: 'var(--bg-main)', borderLeft: '2px solid var(--card-border)', marginLeft: '12px' }}>
      {/* Pestañas de Navegación: Sectores vs Predios individuales */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', background: 'var(--bg-panel)', padding: '2px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
        <button
          type="button"
          onClick={() => setPredioViewTab('sectores')}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: '0.74rem',
            fontWeight: predioViewTab === 'sectores' ? 600 : 400,
            color: predioViewTab === 'sectores' ? 'var(--accent-color, #2563eb)' : 'var(--text-muted)',
            background: predioViewTab === 'sectores' ? 'var(--bg-main)' : 'transparent',
            border: predioViewTab === 'sectores' ? '1px solid var(--card-border)' : '1px solid transparent',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          Por Sectores ({availableSectors.length})
        </button>
        <button
          type="button"
          onClick={() => setPredioViewTab('predios')}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: '0.74rem',
            fontWeight: predioViewTab === 'predios' ? 600 : 400,
            color: predioViewTab === 'predios' ? 'var(--accent-color, #2563eb)' : 'var(--text-muted)',
            background: predioViewTab === 'predios' ? 'var(--bg-main)' : 'transparent',
            border: predioViewTab === 'predios' ? '1px solid var(--card-border)' : '1px solid transparent',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Lista Predios
        </button>
      </div>

      {predioViewTab === 'sectores' ? (
        /* VISTA POR SECTORES: SWITCHBOARD ELEGANTE */
        <div>
          {/* Fila 1: Resumen y Switch de Color */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--text-main)' }}>{availableSectors.length - disabledSectors.size}</strong> de {availableSectors.length} activos
            </span>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontSize: '0.71rem',
                color: colorBySector ? 'var(--accent-color, #2563eb)' : 'var(--text-muted)',
                fontWeight: colorBySector ? 600 : 400,
                userSelect: 'none',
                flexShrink: 0
              }}
              title="Colorear predios en el mapa según el color de su sector"
            >
              <input
                type="checkbox"
                checked={colorBySector}
                onChange={e => setColorBySector(e.target.checked)}
                style={{ margin: 0, cursor: 'pointer', width: '12px', height: '12px' }}
              />
              <span>Color mapa</span>
            </label>
          </div>

          {/* Fila 2: Acciones Rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '6px' }}>
            <button
              type="button"
              onClick={() => setDisabledSectors(new Set())}
              title="Mostrar todos los sectores en el mapa"
              style={{
                padding: '3px 4px',
                fontSize: '0.69rem',
                fontWeight: 500,
                borderRadius: '4px',
                border: '1px solid var(--card-border)',
                background: 'var(--bg-panel)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Ver todos
            </button>
            <button
              type="button"
              onClick={() => setDisabledSectors(new Set(availableSectors.map(s => s.name)))}
              title="Ocultar todos los sectores del mapa"
              style={{
                padding: '3px 4px',
                fontSize: '0.69rem',
                borderRadius: '4px',
                border: '1px solid var(--card-border)',
                background: 'var(--bg-panel)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Ocultar
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasAnyExpandedSectors) {
                  setExpandedSectors({});
                } else {
                  const allExp = {};
                  filteredAvailableSectors.forEach(s => { allExp[s.name] = true; });
                  setExpandedSectors(allExp);
                }
              }}
              title={hasAnyExpandedSectors ? "Colapsar todos los sectores" : "Desplegar todos los sectores"}
              style={{
                padding: '3px 4px',
                fontSize: '0.69rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: '1px solid var(--card-border)',
                background: 'var(--bg-panel)',
                color: 'var(--accent-color, #2563eb)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              {hasAnyExpandedSectors ? 'Colapsar' : 'Desplegar'}
            </button>
          </div>

          {/* Buscador de Sector */}
          <div style={{ marginBottom: '6px' }}>
            <input
              type="text"
              value={sectorSearchTerm}
              onChange={e => setSectorSearchTerm(e.target.value)}
              placeholder="Filtrar sectores por nombre..."
              className="sidebar-input"
              style={{ width: '100%', padding: '4px 8px', fontSize: '0.74rem', height: 'auto', boxSizing: 'border-box' }}
            />
          </div>

          {/* Lista de Sectores con Ojo, Zoom y Acordeón Desplegable */}
          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '6px', background: 'var(--bg-panel)' }}>
            {filteredAvailableSectors.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                No se encontraron sectores
              </div>
            ) : (
              filteredAvailableSectors.map(s => {
                const isVisible = !disabledSectors.has(s.name);
                const isExp = !!expandedSectors[s.name];
                const sectorPredios = (prediosBySector[s.name] || []).filter(f => {
                  if (searchResults && !searchResults.includes(f.properties?.id)) return false;
                  if (selectedYear !== 'Todos' && (!f.properties?.fecha_creacion || !String(f.properties.fecha_creacion).startsWith(selectedYear))) return false;
                  return true;
                });
                const secLimit = visibleCounts[`sec_${s.name}`] || 15;
                const visibleFeats = sectorPredios.slice(0, secLimit);

                return (
                  <div
                    key={s.name}
                    style={{
                      borderBottom: '1px solid var(--card-border)',
                      background: isVisible ? 'transparent' : 'rgba(0,0,0,0.03)',
                      opacity: isVisible ? 1 : 0.55,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setExpandedSectors(prev => ({ ...prev, [s.name]: !prev[s.name] }))}
                    >
                      {/* Info del Sector: Flecha + Color Picker Interactivo + Nombre + Total Predios */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', flex: 1, minWidth: 0, marginRight: '4px' }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--text-muted)',
                            flexShrink: 0
                          }}
                        >
                          {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <SectorColorPickerButton
                          sectorName={s.name}
                          currentColor={s.color}
                          isVisible={isVisible}
                          onColorChange={handleSectorColorChange}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isVisible ? 'var(--text-main)' : 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={`${s.displayName} (${s.count} predios)`}
                        >
                          {s.displayName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.67rem',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-main)',
                            padding: '1px 5px',
                            borderRadius: '8px',
                            border: '1px solid var(--card-border)',
                            flexShrink: 0
                          }}
                        >
                          {s.count}
                        </span>
                      </div>

                      {/* Acciones: Enfocar (Zoom) y Toggle Ojo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span
                          style={{ cursor: 'pointer', color: 'var(--accent-color, #2563eb)', display: 'flex', alignItems: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (zoomToSector) zoomToSector(s.name);
                          }}
                          title={`Enfocar sector ${s.displayName}`}
                        >
                          <Target size={14} />
                        </span>
                        <span
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (toggleSectorVisibility) toggleSectorVisibility(s.name);
                          }}
                          title={isVisible ? `Ocultar sector ${s.displayName} en el mapa` : `Mostrar sector ${s.displayName} en el mapa`}
                        >
                          {isVisible ? <Eye size={15} color="var(--accent-color, #2563eb)" /> : <EyeOff size={15} color="var(--text-muted)" />}
                        </span>
                      </div>
                    </div>

                    {/* Predios del Sector (Acordeón desplegable) */}
                    {isExp && (
                      <div style={{ padding: '2px 8px 6px 24px', backgroundColor: 'var(--bg-main)', borderTop: '1px solid var(--card-border)' }}>
                        {visibleFeats.length === 0 ? (
                          <div style={{ padding: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Sin predios coincidentes con filtros
                          </div>
                        ) : (
                          visibleFeats.map(renderPredioRow)
                        )}
                        {sectorPredios.length > secLimit && (
                          <div style={{ padding: '4px 0', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVisibleCounts(prev => ({
                                  ...prev,
                                  [`sec_${s.name}`]: (prev[`sec_${s.name}`] || 15) + 20
                                }));
                              }}
                              style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                              Cargar más (+20) • {secLimit} de {sectorPredios.length}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* VISTA DE LISTA COMPLETA DE PREDIOS */
        <div>
          <div style={{ marginBottom: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '45px' }}>Sector:</label>
            <select
              value={selectedSectorFilter}
              onChange={e => {
                const val = e.target.value;
                setSelectedSectorFilter(val);
                if (val !== 'Todos' && zoomToSector) {
                  zoomToSector(val);
                }
              }}
              className="sidebar-input"
              style={{ padding: '2px 4px', fontSize: '0.75rem', height: 'auto', flex: 1 }}
            >
              <option value="Todos">Todos ({prediosData?.features?.length || 0})</option>
              {availableSectors.map(s => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.count})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '45px' }}>Mostrar:</label>
            <select
              value={listDisplayMode}
              onChange={e => setListDisplayMode(e.target.value)}
              className="sidebar-input"
              style={{ padding: '2px 4px', fontSize: '0.75rem', height: 'auto', flex: 1 }}
            >
              <option value="codigo">Código Catastral</option>
              <option value="nombre">Nombre Propietario</option>
              <option value="sector">Sector</option>
            </select>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '4px', padding: '4px' }}>
            {loadingPredios && (
              <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Cargando predios...
              </div>
            )}
            {!loadingPredios && (!prediosData?.features || prediosData.features.length === 0) && (
              <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No hay predios en esta empresa.
              </div>
            )}
            {!loadingPredios && (() => {
              const allFiltered = (prediosData?.features || [])
                .filter(f => f && f.properties)
                .filter(f => searchResults === null || searchResults.includes(f.properties.id))
                .filter(f => selectedYear === 'Todos' || (f.properties.fecha_creacion && String(f.properties.fecha_creacion).startsWith(selectedYear)))
                .filter(f => {
                  if (selectedSectorFilter === 'Todos') return true;
                  const sec = f.properties.sector ? f.properties.sector.trim().toUpperCase() : 'SIN SECTOR';
                  return sec === selectedSectorFilter;
                });

              const limit = visibleCounts['predios'] || 20;
              const visibleList = allFiltered.slice(0, limit);

              return (
                <>
                  {visibleList.map(renderPredioRow)}
                  {allFiltered.length > limit && (
                    <div style={{ padding: '6px 0', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisibleCounts(prev => ({ ...prev, predios: (prev['predios'] || 20) + 20 }));
                        }}
                        style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)', cursor: 'pointer' }}
                      >
                        Cargar más (+20) • {limit} de {allFiltered.length}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

