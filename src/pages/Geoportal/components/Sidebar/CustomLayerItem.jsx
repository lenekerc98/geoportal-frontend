import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  Palette,
  Eye,
  EyeOff,
  Target,
  Edit,
  MoreVertical,
  Hexagon,
  Minus,
  MapPin,
  Layers
} from 'lucide-react';
import { getFeatureDisplayName } from '../Toolbars/FeatureContextMenu';

const getGeometryIcon = (tipo) => {
  if (!tipo) return <Layers size={14} style={{ marginRight: '6px', color: 'var(--text-muted)' }} />;
  const t = tipo.toUpperCase();
  if (t.includes('POLYGON')) return <Hexagon size={14} style={{ marginRight: '6px', color: '#10b981' }} />;
  if (t.includes('LINE')) return <Minus size={14} style={{ marginRight: '6px', color: '#3b82f6' }} />;
  if (t.includes('POINT')) return <MapPin size={14} style={{ marginRight: '6px', color: '#ef4444' }} />;
  return <Layers size={14} style={{ marginRight: '6px', color: 'var(--text-muted)' }} />;
};

export default function CustomLayerItem({
  capa,
  activeCapasAdicionales = {},
  expandedCapasAdicionales = {},
  layerStyles = {},
  activeStylePopover,
  setActiveStylePopover,
  activeFeatureStylePopover,
  setActiveFeatureStylePopover,
  setSidebarContextMenu,
  toggleExpandCapaAdicional,
  toggleCapaAdicional,
  handleUpdateLayerStyle,
  geoJsonCacheAdicionales = {},
  visibleCounts = {},
  setVisibleCounts,
  hiddenFeatureIds = [],
  setHiddenFeatureIds,
  selectedPredioId,
  setSelectedPredioId,
  zoomToFeature,
  getFeatureCustomStyle,
  handleUpdateFeatureStyle,
  handleResetFeatureStyle,
  handleExportSingleFeatureToAtlas,
  setFeatureContextMenu
}) {
  const isCapaActive = !!activeCapasAdicionales[capa.tabla_db];
  const isExp = !!expandedCapasAdicionales[capa.tabla_db];
  const st = layerStyles[capa.tabla_db] || {};
  const currentColor = st.color || capa.color || (capa.tipo_capa === 'limite_cantonal' ? '#ef4444' : capa.tipo_capa === 'limite_parroquial' ? '#06b6d4' : '#a855f7');
  const currentOpacity = st.opacity !== undefined ? Number(st.opacity) : (capa.opacidad !== undefined ? Number(capa.opacidad) : 0.35);
  const isStyleOpen = activeStylePopover === capa.tabla_db;

  return (
    <div key={capa.tabla_db} style={{ marginBottom: '4px' }}>
      <div
        className={`layer-item ${isCapaActive ? 'active' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '5px', transition: 'background 0.2s' }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (setSidebarContextMenu) {
            setSidebarContextMenu({ x: e.clientX, y: e.clientY, layerType: capa.tabla_db, isAdicional: true });
          }
        }}
      >
        <span
          onClick={(e) => { e.stopPropagation(); toggleExpandCapaAdicional(capa.tabla_db); }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
          title={isExp ? "Colapsar elementos" : "Expandir elementos"}
        >
          {isExp ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>

        <span
          onClick={() => toggleExpandCapaAdicional(capa.tabla_db)}
          style={{ flex: 1, fontSize: '0.82rem', display: 'flex', alignItems: 'center', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={capa.nombre_capa}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: currentColor,
              marginRight: '6px',
              flexShrink: 0,
              display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.25)'
            }}
          />
          {getGeometryIcon(capa.tipo_geometria)}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{capa.nombre_capa}</span>
        </span>

        {/* Botón para cambiar Color y Opacidad */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveStylePopover(prev => prev === capa.tabla_db ? null : capa.tabla_db);
          }}
          style={{
            background: isStyleOpen ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            border: isStyleOpen ? '1px solid var(--primary)' : '1px solid transparent',
            borderRadius: '4px',
            padding: '2px 4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: isStyleOpen ? 'var(--primary)' : 'var(--text-muted)'
          }}
          title="Personalizar color y opacidad de la capa"
        >
          <Palette size={14} />
        </button>

        {/* Botón Ojo Visibilidad */}
        <span
          onClick={(e) => { e.stopPropagation(); toggleCapaAdicional(capa.tabla_db); }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px' }}
          title={isCapaActive ? "Ocultar capa en el mapa" : "Mostrar capa en el mapa"}
        >
          {isCapaActive ? <Eye size={16} /> : <EyeOff size={16} color="#64748b" />}
        </span>
      </div>

      {/* Panel desplegable de Estilo (Color y Opacidad) */}
      {isStyleOpen && (
        <div style={{
          margin: '4px 0 6px 16px',
          padding: '8px 10px',
          background: 'var(--bg-lighter, rgba(255,255,255,0.06))',
          borderRadius: '6px',
          border: '1px solid var(--card-border)',
          fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Estilo de Capa</span>
            <span
              onClick={() => setActiveStylePopover(null)}
              style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 4px' }}
            >
              ✕
            </span>
          </div>

          {/* Selector de Color */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Color:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  handleUpdateLayerStyle(capa.tabla_db, { color: newColor, borderColor: newColor });
                }}
                style={{
                  width: '28px',
                  height: '24px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: 'none'
                }}
              />
              <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {currentColor}
              </span>
            </div>
          </div>

          {/* Slider de Opacidad */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-main)' }}>Opacidad:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                {Math.round(currentOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={currentOpacity}
              onChange={(e) => {
                const newOp = parseFloat(e.target.value);
                handleUpdateLayerStyle(capa.tabla_db, { opacidad: newOp });
              }}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: currentColor || 'var(--primary)'
              }}
            />
          </div>
        </div>
      )}

      {/* Lista de elementos expandida */}
      {isExp && (
        <div className="feature-list" style={{ marginLeft: '16px', marginTop: '4px', marginBottom: '8px', maxHeight: '180px', overflowY: 'auto', borderLeft: '2px solid var(--card-border)', paddingLeft: '8px' }}>
          {!geoJsonCacheAdicionales[capa.tabla_db] ? (
            <div style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Cargando elementos...
            </div>
          ) : (!geoJsonCacheAdicionales[capa.tabla_db].features || geoJsonCacheAdicionales[capa.tabla_db].features.length === 0) ? (
            <div style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No hay elementos en esta capa.
            </div>
          ) : (() => {
            const allFeatures = geoJsonCacheAdicionales[capa.tabla_db].features || [];
            const limit = visibleCounts[capa.tabla_db] || 20;
            const visibleFeatures = allFeatures.slice(0, limit);

            return (
              <>
                {visibleFeatures.map((f, i) => {
                  const featId = f.properties?.id ?? f.id ?? i;
                  const isHidden = hiddenFeatureIds.includes(featId);
                  const name = getFeatureDisplayName(f, i);
                  const isSelected = selectedPredioId && String(selectedPredioId) === String(featId);

                  const featCustomStyle = getFeatureCustomStyle ? getFeatureCustomStyle(capa.tabla_db, featId, f) : null;
                  const polyColor = featCustomStyle?.color || currentColor;
                  const polyOpacity = featCustomStyle?.opacidad !== undefined
                    ? Number(featCustomStyle.opacidad)
                    : (featCustomStyle?.opacity !== undefined ? Number(featCustomStyle.opacity) : currentOpacity);
                  const hasCustomStyle = !!featCustomStyle;
                  const isFeatStyleOpen = activeFeatureStylePopover?.id === featId && activeFeatureStylePopover?.capa === capa.tabla_db;

                  return (
                    <div key={featId || i} style={{ marginBottom: '2px' }}>
                      <div
                        className="feature-item"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '5px 8px',
                          borderBottom: '1px solid var(--card-border)',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          color: isHidden ? 'var(--text-muted)' : 'var(--text-main)',
                          opacity: isHidden ? 0.6 : 1,
                          background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          borderRadius: '4px',
                          transition: 'background 0.2s ease'
                        }}
                        onClick={() => {
                          setSelectedPredioId(featId);
                          zoomToFeature(f);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setFeatureContextMenu({
                            feature: f,
                            featureIndex: i,
                            featureId: featId,
                            mouseX: e.clientX,
                            mouseY: e.clientY,
                            type: 'generico',
                            layerName: capa.nombre_capa,
                            layerType: capa.tabla_db
                          });
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', maxWidth: '60%' }}>
                          {/* Color Swatch interactivo del polígono */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFeatureStylePopover(prev => (prev?.id === featId && prev?.capa === capa.tabla_db) ? null : { id: featId, capa: capa.tabla_db, name });
                            }}
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '2px',
                              backgroundColor: polyColor,
                              flexShrink: 0,
                              display: 'inline-block',
                              border: hasCustomStyle ? '1.5px solid var(--primary)' : '1px solid rgba(0,0,0,0.25)',
                              boxShadow: hasCustomStyle ? '0 0 4px var(--primary)' : 'none',
                              cursor: 'pointer'
                            }}
                            title={`Color de este polígono: ${polyColor} (Clic para personalizar)`}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? '600' : '500' }} title={name}>
                            {name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Centrar / Zoom */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPredioId(featId);
                              zoomToFeature(f);
                            }}
                            title="Acercar al polígono"
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Target size={13} style={{ color: '#fbbf24', opacity: 0.9 }} />
                          </span>

                          {/* Editar / Atlas */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportSingleFeatureToAtlas(f, i, capa.nombre_capa);
                            }}
                            title="Editar polígono / atributos"
                            style={{ cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center' }}
                          >
                            <Edit size={13} />
                          </span>

                          {/* Botón Estilo del Polígono (Paleta) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFeatureStylePopover(prev => (prev?.id === featId && prev?.capa === capa.tabla_db) ? null : { id: featId, capa: capa.tabla_db, name });
                            }}
                            style={{
                              background: isFeatStyleOpen ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                              border: isFeatStyleOpen ? '1px solid var(--primary)' : '1px solid transparent',
                              borderRadius: '3px',
                              padding: '1px 3px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: isFeatStyleOpen ? 'var(--primary)' : (hasCustomStyle ? polyColor : 'var(--text-muted)')
                            }}
                            title="Personalizar color y opacidad de este polígono"
                          >
                            <Palette size={13} />
                          </button>

                          {/* Ocultar / Mostrar polígono */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isHidden) {
                                setHiddenFeatureIds(prev => prev.filter(id => id !== featId));
                              } else {
                                setHiddenFeatureIds(prev => [...prev, featId]);
                              }
                            }}
                            title={isHidden ? "Mostrar polígono" : "Ocultar polígono"}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            {isHidden ? <EyeOff size={13} style={{ color: '#94a3b8' }} /> : <Eye size={13} style={{ color: 'var(--text-muted)' }} />}
                          </span>

                          {/* Menú de opciones rápidas */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setFeatureContextMenu({
                                feature: f,
                                featureIndex: i,
                                featureId: featId,
                                mouseX: rect.left - 215,
                                mouseY: Math.min(rect.top, window.innerHeight - 380),
                                type: 'generico',
                                layerName: capa.nombre_capa,
                                layerType: capa.tabla_db
                              });
                            }}
                            title="Más opciones de polígono"
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                          >
                            <MoreVertical size={13} />
                          </span>
                        </div>
                      </div>

                      {/* Panel emergente de Estilo de Polígono */}
                      {isFeatStyleOpen && (
                        <div style={{
                          margin: '4px 0 6px 10px',
                          padding: '8px 10px',
                          background: 'var(--bg-lighter, rgba(255,255,255,0.06))',
                          borderRadius: '6px',
                          border: '1px solid var(--card-border)',
                          fontSize: '0.78rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Palette size={13} /> Estilo: {name}
                            </span>
                            <span
                              onClick={(e) => { e.stopPropagation(); setActiveFeatureStylePopover(null); }}
                              style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 4px' }}
                            >
                              ✕
                            </span>
                          </div>

                          {/* Selector de Color */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              Color:
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="color"
                                value={polyColor}
                                onChange={(e) => {
                                  const newColor = e.target.value;
                                  handleUpdateFeatureStyle(capa.tabla_db, featId, { color: newColor, borderColor: newColor });
                                }}
                                style={{
                                  width: '28px',
                                  height: '24px',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  background: 'none'
                                }}
                              />
                              <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {polyColor}
                              </span>
                            </div>
                          </div>

                          {/* Slider de Opacidad */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-main)' }}>Opacidad:</span>
                              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                {Math.round(polyOpacity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0.05"
                              max="1"
                              step="0.05"
                              value={polyOpacity}
                              onChange={(e) => {
                                const newOp = parseFloat(e.target.value);
                                handleUpdateFeatureStyle(capa.tabla_db, featId, { opacidad: newOp });
                              }}
                              style={{
                                width: '100%',
                                cursor: 'pointer',
                                accentColor: polyColor || 'var(--primary)'
                              }}
                            />
                          </div>

                          {/* Botón para restablecer al color de la capa */}
                          {hasCustomStyle && (
                            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--card-border)', display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResetFeatureStyle(capa.tabla_db, featId);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  padding: '2px 4px'
                                }}
                                title="Eliminar personalización y usar el color de la capa"
                              >
                                ↺ Restablecer a capa
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {allFeatures.length > limit && (
                  <div style={{ padding: '6px 0', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVisibleCounts(prev => ({ ...prev, [capa.tabla_db]: (prev[capa.tabla_db] || 20) + 20 }));
                      }}
                      style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)', cursor: 'pointer' }}
                    >
                      Cargar más (+20) • {limit} de {allFeatures.length}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
export { getGeometryIcon };

