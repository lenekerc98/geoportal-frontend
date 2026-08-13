import React, { useState, useRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import Draggable from 'react-draggable';

export default function AttributeTable({ data, layerName, onClose, hiddenFeatureIds = [], setHiddenFeatureIds, onRowContextMenu, selectedId, onRowClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const nodeRef = useRef(null);

  if (!data) {
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100px', backgroundColor: '#ef4444', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <h2>Cargando datos o no hay datos para {layerName}...</h2>
        <button onClick={onClose} style={{ marginLeft: '20px', padding: '10px', cursor: 'pointer' }}>Cerrar</button>
      </div>
    );
  }

  if (!data.features || data.features.length === 0) {
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100px', backgroundColor: '#f97316', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <h2>La capa {layerName} no tiene geometrías (0 elementos).</h2>
        <button onClick={onClose} style={{ marginLeft: '20px', padding: '10px', cursor: 'pointer' }}>Cerrar</button>
      </div>
    );
  }

  // Extraer todas las columnas únicas de las properties de los features
  const columns = Array.from(
    new Set(
      data.features.reduce((acc, feature) => {
        if (feature.properties) {
          Object.keys(feature.properties).forEach(key => {
            if (!['id', 'posesionario_id', 'predio_id'].includes(key)) {
              acc.add(key);
            }
          });
        }
        return acc;
      }, new Set())
    )
  );

  return (
    <Draggable nodeRef={nodeRef} handle=".drag-handle" defaultPosition={{x: Math.max(0, (window.innerWidth - 800) / 2), y: -50}}>
      <div ref={nodeRef} style={{
        position: 'fixed',
        bottom: '80px',
        left: 0,
        width: '90vw',
        maxWidth: '1000px',
        minWidth: '500px',
        height: isExpanded ? '60vh' : '300px',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        transition: 'height 0.3s ease'
      }}>
      {/* Header */}
      <div 
        className="drag-handle"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: '1px solid var(--card-border)',
          backgroundColor: 'var(--table-header-bg)',
          cursor: 'grab',
          userSelect: 'none',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          Tabla de Atributos: <span style={{ color: 'var(--accent-color)' }}>{layerName}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--table-row-hover)', padding: '2px 8px', borderRadius: '10px' }}>
            {data.features.length} elementos
          </span>
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)', fontSize: '0.85rem' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-main)', zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <tr>
              {setHiddenFeatureIds && <th style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid var(--card-border)', whiteSpace: 'nowrap', width: '40px', color: 'var(--text-muted)' }}>👁️</th>}
              <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid var(--card-border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>#</th>
              {columns.map(col => (
                <th key={col} style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid var(--card-border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.features.map((feature, i) => {
              const isHidden = hiddenFeatureIds.includes(feature.properties.id);
              const isSelected = selectedId === feature.properties.id;
              
              return (
                <tr 
                  key={i} 
                  onClick={() => onRowClick && onRowClick(feature)}
                  style={{ 
                    borderBottom: '1px solid var(--card-border)', 
                    backgroundColor: isSelected ? 'var(--primary-glow)' : (i % 2 === 0 ? 'transparent' : 'var(--table-row-hover)'), 
                    opacity: isHidden ? 0.5 : 1,
                    cursor: onRowClick ? 'pointer' : 'default',
                    color: isSelected ? 'var(--accent-color)' : 'inherit',
                    fontWeight: isSelected ? 'bold' : 'normal'
                  }}
                  onContextMenu={(e) => {
                    if (onRowContextMenu) {
                      e.preventDefault();
                      onRowContextMenu(e, feature);
                    }
                  }}
                >
                  {setHiddenFeatureIds && (
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <span 
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (isHidden) {
                            setHiddenFeatureIds(hiddenFeatureIds.filter(id => id !== feature.properties.id));
                          } else {
                            setHiddenFeatureIds([...hiddenFeatureIds, feature.properties.id]);
                          }
                        }}
                      >
                        {isHidden ? '❌' : '👁️'}
                      </span>
                    </td>
                  )}
                  <td style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                {columns.map(col => {
                  let val = feature.properties ? feature.properties[col] : '';
                  if (typeof val === 'number') val = Number.isInteger(val) ? val : val.toFixed(4);
                  return (
                    <td key={col} style={{ padding: '6px 12px', borderRight: '1px solid var(--card-border)', whiteSpace: 'nowrap' }}>
                      {val !== null && val !== undefined ? val.toString() : ''}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </Draggable>
  );
}
