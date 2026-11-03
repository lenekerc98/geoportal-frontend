import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Maximize2, Minimize2, Search, Filter, FileText, Table, ChevronLeft, ChevronRight } from 'lucide-react';

// Fila memoizada para renderizado ultra-rápido (<1ms al cambiar selección)
const TableRow = React.memo(function TableRow({
  feature,
  displayIndex,
  columns,
  isSelected,
  isHidden,
  onRowClick,
  onRowContextMenu,
  setHiddenFeatureIds,
  hiddenFeatureIds,
  selectedRowRef
}) {
  const p = feature.properties || {};

  return (
    <tr
      ref={isSelected ? selectedRowRef : null}
      onClick={() => onRowClick && onRowClick(feature)}
      style={{
        borderBottom: '1px solid var(--card-border)',
        borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.16)' : (displayIndex % 2 === 0 ? 'transparent' : 'var(--table-row-hover)'),
        opacity: isHidden ? 0.45 : 1,
        cursor: onRowClick ? 'pointer' : 'default',
        color: isSelected ? 'var(--accent-color)' : 'inherit',
        fontWeight: isSelected ? 600 : 'normal'
      }}
      onContextMenu={(e) => {
        if (onRowContextMenu) {
          e.preventDefault();
          onRowContextMenu(e, feature);
        }
      }}
    >
      {setHiddenFeatureIds && (
        <td style={{ padding: '5px 10px', textAlign: 'center', width: '36px' }}>
          <span
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title={isHidden ? "Mostrar en mapa" : "Ocultar en mapa"}
            onClick={(e) => {
              e.stopPropagation();
              const fid = p.id;
              if (fid !== undefined) {
                if (isHidden) {
                  setHiddenFeatureIds(hiddenFeatureIds.filter(id => id !== fid));
                } else {
                  setHiddenFeatureIds([...hiddenFeatureIds, fid]);
                }
              }
            }}
          >
            {isHidden ? '❌' : '👁️'}
          </span>
        </td>
      )}
      <td style={{ padding: '5px 10px', color: 'var(--text-muted)', fontSize: '0.74rem', width: '42px' }}>
        {displayIndex + 1}
      </td>
      {columns.map(col => {
        let val = p[col];
        if (typeof val === 'number') val = Number.isInteger(val) ? val : val.toFixed(4);
        return (
          <td
            key={col}
            style={{
              padding: '5px 12px',
              borderRight: '1px solid var(--card-border)',
              whiteSpace: 'nowrap',
              maxWidth: '240px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={val !== null && val !== undefined ? String(val) : ''}
          >
            {val !== null && val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : ''}
          </td>
        );
      })}
    </tr>
  );
});

function AttributeTableComponent({
  data,
  layerName,
  onClose,
  hiddenFeatureIds = [],
  setHiddenFeatureIds,
  onRowContextMenu,
  selectedId,
  onRowClick
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Posición de la ventana flotante en la pantalla
  const [position, setPosition] = useState(() => {
    const tableWidth = Math.min(window.innerWidth * 0.92, 1050);
    const initialX = Math.max(10, Math.round((window.innerWidth - tableWidth) / 2));
    const initialY = Math.max(40, window.innerHeight - 330 - 70);
    return { x: initialX, y: initialY };
  });

  const currentPosRef = useRef(position);
  useEffect(() => {
    currentPosRef.current = position;
  }, [position]);

  const cleanupDragRef = useRef(null);
  useEffect(() => {
    return () => {
      if (cleanupDragRef.current) cleanupDragRef.current();
    };
  }, []);

  // Manejador nativo de arrastre (0 lag, 120 FPS, movimiento directo sin re-renders)
  const handleDragStart = useCallback((e) => {
    if (e.target.closest('button, input, select, textarea, .no-drag')) {
      return;
    }
    if (e.button !== 0) return;

    e.preventDefault();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = currentPosRef.current.x;
    const startPosY = currentPosRef.current.y;

    let latestX = startPosX;
    let latestY = startPosY;

    function cleanup() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      cleanupDragRef.current = null;
    }

    function onMouseUp() {
      cleanup();
      currentPosRef.current = { x: latestX, y: latestY };
      setPosition({ x: latestX, y: latestY });
    }

    function onMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;

      const nextX = startPosX + deltaX;
      const nextY = startPosY + deltaY;
      const clampedX = Math.max(-400, Math.min(window.innerWidth - 120, nextX));
      const clampedY = Math.max(10, Math.min(window.innerHeight - 60, nextY));

      latestX = clampedX;
      latestY = clampedY;

      if (nodeRef.current) {
        nodeRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
      }
    }

    cleanupDragRef.current = cleanup;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => {
      const next = !prev;
      if (next) {
        const maxH = window.innerHeight * 0.65;
        setPosition(pos => {
          const newPos = {
            ...pos,
            y: Math.min(pos.y, Math.max(20, window.innerHeight - maxH - 40))
          };
          currentPosRef.current = newPos;
          return newPos;
        });
      }
      return next;
    });
  }, []);

  // Inicia en modo solo seleccionado si se abrió apuntando a uno específico
  const [onlySelected, setOnlySelected] = useState(Boolean(selectedId));
  const [viewMode, setViewMode] = useState('table'); // 'table' o 'card'
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const nodeRef = useRef(null);
  const selectedRowRef = useRef(null);
  const prevSelectedIdRef = useRef(selectedId);

  // Debounce del término de búsqueda (200ms) para 0 lag al escribir
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reiniciar a página 1 cuando cambia búsqueda o filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, onlySelected]);

  // Si cambia el selectedId desde fuera (por ejemplo al abrir un predio desde el mapa),
  // pero NO si el usuario ya eligió voluntariamente ver todos los predios
  useEffect(() => {
    if (selectedId && prevSelectedIdRef.current === null) {
      setOnlySelected(true);
    }
    prevSelectedIdRef.current = selectedId;
  }, [selectedId]);

  // Scroll suave al elemento seleccionado
  useEffect(() => {
    if (selectedId && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId, currentPage]);

  // Descubrimiento ultrarrápido de columnas (muestrea las primeras 30 features en vez de 4524)
  const columns = useMemo(() => {
    const feats = data?.features;
    if (!feats || feats.length === 0) return [];
    const setCols = new Set();
    const sampleSize = Math.min(feats.length, 30);
    for (let i = 0; i < sampleSize; i++) {
      const f = feats[i];
      if (f && f.properties) {
        Object.keys(f.properties).forEach(k => {
          if (!['geom', 'geometry', 'bbox', '_layer'].includes(k)) {
            setCols.add(k);
          }
        });
      }
    }

    const priority = ['cod_catastral', 'nombre_posesionario', 'cedula', 'area_ha', 'parroquia', 'sector', 'estado', 'id'];
    return Array.from(setCols).sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [data?.features]);

  // Filtrado optimizado de alta velocidad
  const filteredFeatures = useMemo(() => {
    const list = data?.features || [];
    if (list.length === 0) return [];

    // Modo 1: Solo seleccionado
    if (onlySelected && selectedId) {
      const sId = String(selectedId);
      const single = list.find(f => {
        const p = f.properties || {};
        const pid = p.id ?? f.id ?? p.cod_catastral;
        return String(pid) === sId || String(p.cod_catastral) === sId;
      });
      return single ? [single] : [];
    }

    // Modo 2: Búsqueda con chequeo rápido de campos clave
    if (debouncedSearch) {
      const q = debouncedSearch;
      return list.filter(f => {
        const p = f.properties;
        if (!p) return false;
        if (p.cod_catastral && String(p.cod_catastral).toLowerCase().includes(q)) return true;
        if (p.nombre_posesionario && String(p.nombre_posesionario).toLowerCase().includes(q)) return true;
        if (p.sector && String(p.sector).toLowerCase().includes(q)) return true;
        if (p.cedula && String(p.cedula).toLowerCase().includes(q)) return true;
        if (p.parroquia && String(p.parroquia).toLowerCase().includes(q)) return true;
        if (p.id && String(p.id).includes(q)) return true;

        for (const k in p) {
          const v = p[k];
          if (v !== null && v !== undefined && String(v).toLowerCase().includes(q)) {
            return true;
          }
        }
        return false;
      });
    }

    return list;
  }, [data?.features, onlySelected, selectedId, debouncedSearch]);

  // Cálculos de paginación
  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(filteredFeatures.length / pageSize));
  }, [filteredFeatures.length, pageSize]);

  const paginatedFeatures = useMemo(() => {
    if (pageSize === 'all' || onlySelected) return filteredFeatures;
    const start = (currentPage - 1) * pageSize;
    return filteredFeatures.slice(start, start + pageSize);
  }, [filteredFeatures, currentPage, pageSize, onlySelected]);

  const startIndex = (pageSize === 'all' || onlySelected) ? 0 : (currentPage - 1) * pageSize;

  const selectedFeature = useMemo(() => {
    if (!selectedId) return filteredFeatures[0] || null;
    const sId = String(selectedId);
    return (data?.features || []).find(f => {
      const p = f.properties || {};
      const pid = p.id ?? f.id ?? p.cod_catastral;
      return String(pid) === sId || String(p.cod_catastral) === sId;
    }) || filteredFeatures[0] || null;
  }, [data?.features, selectedId, filteredFeatures]);

  const handleRowClickMemo = useCallback((feature) => {
    if (onRowClick) onRowClick(feature);
  }, [onRowClick]);

  if (!data) {
    return (
      <div style={{ position: 'fixed', bottom: '80px', left: '20px', backgroundColor: '#ef4444', zIndex: 9999, padding: '15px 25px', borderRadius: '10px', color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span>Cargando atributos de {layerName}...</span>
        <button onClick={onClose} style={{ padding: '6px 12px', background: 'white', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
      </div>
    );
  }

  if (!data.features || data.features.length === 0) {
    return (
      <div style={{ position: 'fixed', bottom: '80px', left: '20px', backgroundColor: '#f97316', zIndex: 9999, padding: '15px 25px', borderRadius: '10px', color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span>La capa {layerName} no contiene elementos para mostrar.</span>
        <button onClick={onClose} style={{ padding: '6px 12px', background: 'white', color: '#f97316', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
      </div>
    );
  }

  return (
    <div
      ref={nodeRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: '92vw',
        maxWidth: '1050px',
        minWidth: '480px',
        height: isExpanded ? '65vh' : '330px',
        backgroundColor: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        transition: 'height 0.25s ease'
      }}
    >
      {/* Header */}
      <div
        className="drag-handle"
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '9px 15px',
          borderBottom: '1px solid var(--card-border)',
          backgroundColor: 'var(--table-header-bg)',
          cursor: 'grab',
          userSelect: 'none',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span>Tabla de Atributos:</span>
              <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{layerName}</span>
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--table-row-hover)', padding: '2px 8px', borderRadius: '10px' }}>
              {filteredFeatures.length} {filteredFeatures.length === 1 ? 'predio' : `de ${data.features.length}`}
            </span>
          </div>

          {/* Opciones y Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {selectedId && (
              <button
                type="button"
                onClick={() => setOnlySelected(!onlySelected)}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--card-border)',
                  background: onlySelected ? 'rgba(59, 130, 246, 0.18)' : 'var(--bg-main)',
                  color: onlySelected ? '#2563eb' : 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title={onlySelected ? "Mostrar todos los predios de la capa" : "Filtrar únicamente el predio seleccionado"}
              >
                <Filter size={12} />
                {onlySelected ? '🎯 Solo Predio Seleccionado' : `🌐 Ver Todos (${data.features.length})`}
              </button>
            )}

            {onlySelected && (
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--card-border)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title={viewMode === 'table' ? "Ver ficha vertical de atributos" : "Ver formato tabla horizontal"}
              >
                {viewMode === 'table' ? <FileText size={12} /> : <Table size={12} />}
                {viewMode === 'table' ? 'Ficha Detallada' : 'Tabla'}
              </button>
            )}

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={13} style={{ position: 'absolute', left: '7px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar predio o sector..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 22px 3px 24px',
                  borderRadius: '6px',
                  border: '1px solid var(--card-border)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  width: '145px'
                }}
              />
              {searchInput && (
                <X size={12} style={{ position: 'absolute', right: '6px', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearchInput('')} />
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginLeft: '4px' }}>
              <button
                type="button"
                onClick={handleToggleExpand}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}
                title={isExpanded ? "Restaurar tamaño" : "Maximizar"}
              >
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px' }}
                title="Cerrar tabla"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Cuerpo: Vista Ficha Detallada */}
        {viewMode === 'card' && selectedFeature ? (
          <div style={{ overflow: 'auto', flex: 1, padding: '14px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              gap: '10px'
            }}>
              {columns.map(col => {
                let val = selectedFeature.properties ? selectedFeature.properties[col] : '';
                if (typeof val === 'number') val = Number.isInteger(val) ? val : val.toFixed(4);
                const displayVal = val !== null && val !== undefined && val !== ''
                  ? (typeof val === 'object' ? JSON.stringify(val) : String(val))
                  : '—';
                return (
                  <div
                    key={col}
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ fontSize: '0.67rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                      {col.replace(/_/g, ' ')}
                    </div>
                    <div style={{
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      color: displayVal === '—' ? 'var(--text-muted)' : 'var(--text-main)',
                      marginTop: '3px',
                      wordBreak: 'break-word'
                    }}>
                      {displayVal}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Cuerpo: Vista Tabla Horizontal */
          <div style={{ overflow: 'auto', flex: 1, padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)', fontSize: '0.81rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-main)', zIndex: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
                <tr>
                  {setHiddenFeatureIds && <th style={{ padding: '7px 10px', textAlign: 'center', borderRight: '1px solid var(--card-border)', whiteSpace: 'nowrap', width: '36px', color: 'var(--text-muted)' }}>👁️</th>}
                  <th style={{ padding: '7px 10px', textAlign: 'left', borderRight: '1px solid var(--card-border)', whiteSpace: 'nowrap', width: '42px', color: 'var(--text-muted)' }}>#</th>
                  {columns.map(col => (
                    <th key={col} style={{ padding: '7px 12px', textAlign: 'left', borderRight: '1px solid var(--card-border)', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedFeatures.map((feature, i) => {
                  const fid = feature.properties?.id;
                  const isHidden = fid !== undefined && hiddenFeatureIds.includes(fid);
                  const isSelected = selectedId && (
                    String(fid) === String(selectedId) ||
                    String(feature.properties?.cod_catastral) === String(selectedId)
                  );

                  return (
                    <TableRow
                      key={fid || (startIndex + i)}
                      feature={feature}
                      displayIndex={startIndex + i}
                      columns={columns}
                      isSelected={Boolean(isSelected)}
                      isHidden={Boolean(isHidden)}
                      onRowClick={handleRowClickMemo}
                      onRowContextMenu={onRowContextMenu}
                      setHiddenFeatureIds={setHiddenFeatureIds}
                      hiddenFeatureIds={hiddenFeatureIds}
                      selectedRowRef={selectedRowRef}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con Paginación */}
        {!onlySelected && filteredFeatures.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 14px',
            borderTop: '1px solid var(--card-border)',
            backgroundColor: 'var(--table-header-bg)',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '8px',
            userSelect: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>
                Mostrando {Math.min(filteredFeatures.length, startIndex + 1)} - {Math.min(filteredFeatures.length, startIndex + paginatedFeatures.length)} de {filteredFeatures.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                <span style={{ fontSize: '0.72rem' }}>Por pág:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    border: '1px solid var(--card-border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value="all">Todos</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || pageSize === 'all'}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg-main)',
                  color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <ChevronLeft size={13} /> Anterior
              </button>

              <span style={{ fontWeight: 600, color: 'var(--text-main)', padding: '0 4px', fontSize: '0.73rem' }}>
                Pág. {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || pageSize === 'all'}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg-main)',
                  color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                Siguiente <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
  );
}

export default React.memo(AttributeTableComponent);
