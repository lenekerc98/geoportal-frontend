import React from 'react';
import {
  Eye,
  EyeOff,
  Target,
  TableProperties,
  RotateCw,
  UploadCloud,
  Upload,
  Trash2,
  Sparkles,
  FileText
} from 'lucide-react';

export default function SidebarContextMenu({
  sidebarContextMenu,
  onClose,
  handleShowAllVectorLayers,
  handleHideAllVectorLayers,
  prediosData,
  showPredios,
  setShowPredios,
  zoomToVectorLayer,
  setActiveTableData,
  fetchMapData,
  showError,
  showSuccess,
  capasAdicionales = [],
  handleShowAllCapasAdicionales,
  handleHideAllCapasAdicionales,
  setShowShapefileUploader,
  fetchCapasAdicionales,
  temporalLayers = [],
  handleShowAllTemporalLayers,
  handleHideAllTemporalLayers,
  handleDeleteAllTemporalLayers,
  handleZoomToTemporalLayer,
  setAtlasInitialIndex,
  setAtlasFileName,
  setImportedShapes,
  setShowAtlasModal,
  handlePrintTransientLayerOrFeature,
  deleteTemporalLayer,
  setTemporalLayers,
  geoJsonCacheAdicionales = {},
  setGeoJsonCacheAdicionales,
  lineasData,
  verticesData,
  handleExportLayerToAtlas,
  handleDeleteCapaAdicional,
  API_URL,
  authToken
}) {
  if (!sidebarContextMenu) return null;

  const pad = 12;
  const w = 220;
  const h = 320;
  let sLeft = sidebarContextMenu.x;
  let sTop = sidebarContextMenu.y;
  if (sLeft + w > window.innerWidth - pad) sLeft = Math.max(pad, sLeft - w);
  if (sTop + h > window.innerHeight - pad) sTop = Math.max(pad, sTop - h);

  return (
    <>
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, pointerEvents: 'auto' }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        style={{
          position: 'fixed',
          top: sTop,
          left: sLeft,
          zIndex: 9999,
          background: 'var(--bg-panel)',
          border: '1px solid var(--card-border)',
          borderRadius: '8px',
          padding: '5px 0',
          minWidth: '220px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto'
        }}
      >
        {/* 1. MENÚ CONTEXTUAL: GRUPO VECTORIALES */}
        {sidebarContextMenu.menuKind === 'group_vectores' && (
          <>
            <div style={{ padding: '6px 15px', fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
              GRUPO: CAPAS VECTORIALES
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); handleShowAllVectorLayers(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Eye size={16} color="#10b981" /> Mostrar todas las capas
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); handleHideAllVectorLayers(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <EyeOff size={16} color="#94a3b8" /> Ocultar todas las capas
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (prediosData) {
                  if (!showPredios && setShowPredios) setShowPredios(true);
                  if (zoomToVectorLayer) zoomToVectorLayer(prediosData);
                } else if (showError) {
                  showError('No hay geometrías de predios cargadas aún.');
                }
                onClose();
              }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Target size={16} color="#fbbf24" /> Acercar a todos los predios
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); if (setActiveTableData) setActiveTableData('predios'); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <TableProperties size={16} color="#3b82f6" /> Ver Tabla de Predios
            </div>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }}></div>
            <div
              onClick={(e) => { e.stopPropagation(); if (fetchMapData) fetchMapData(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <RotateCw size={16} color="#38bdf8" /> Recargar capas vectoriales
            </div>
          </>
        )}

        {/* 2. MENÚ CONTEXTUAL: GRUPO CAPAS ADICIONALES */}
        {sidebarContextMenu.menuKind === 'group_adicionales' && (
          <>
            <div style={{ padding: '6px 15px', fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
              GRUPO: CAPAS ADICIONALES ({capasAdicionales.length})
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); handleShowAllCapasAdicionales(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Eye size={16} color="#10b981" /> Mostrar todas las capas
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); handleHideAllCapasAdicionales(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <EyeOff size={16} color="#94a3b8" /> Ocultar todas las capas
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); if (setShowShapefileUploader) setShowShapefileUploader(true); onClose(); }}
              style={{ padding: '9px 15px', color: '#0284c7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: '500' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <UploadCloud size={16} color="#0284c7" /> Cargar nueva capa (Shapefile / GeoJSON)
            </div>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }}></div>
            <div
              onClick={(e) => { e.stopPropagation(); if (fetchCapasAdicionales) fetchCapasAdicionales(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <RotateCw size={16} color="#38bdf8" /> Recargar lista de capas
            </div>
          </>
        )}

        {/* 3. MENÚ CONTEXTUAL: GRUPO CAPAS TEMPORALES */}
        {sidebarContextMenu.menuKind === 'group_temporales' && (
          <>
            <div style={{ padding: '6px 15px', fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
              GRUPO: CAPAS TEMPORALES ({temporalLayers.length})
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); handleShowAllTemporalLayers(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Eye size={16} color="#10b981" /> Mostrar todas las capas
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); handleHideAllTemporalLayers(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <EyeOff size={16} color="#94a3b8" /> Ocultar todas las capas
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); if (setShowShapefileUploader) setShowShapefileUploader(true); onClose(); }}
              style={{ padding: '9px 15px', color: '#0284c7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: '500' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Upload size={16} color="#0284c7" /> Cargar nueva capa temporal
            </div>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }}></div>
            <div
              onClick={(e) => { e.stopPropagation(); handleDeleteAllTemporalLayers(); onClose(); }}
              style={{ padding: '9px 15px', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={16} color="var(--danger)" /> Limpiar todas las capas temporales
            </div>
          </>
        )}

        {/* 4. MENÚ CONTEXTUAL: CAPA TEMPORAL INDIVIDUAL */}
        {sidebarContextMenu.menuKind === 'layer_temporal' && (
          <>
            <div style={{ padding: '6px 15px', fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
              {sidebarContextMenu.capaObj?.name || 'Capa Temporal'}
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (handleZoomToTemporalLayer) handleZoomToTemporalLayer(sidebarContextMenu.capaObj);
                onClose();
              }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Target size={16} color="#fbbf24" /> Acercar a esta capa
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                const capa = sidebarContextMenu.capaObj;
                onClose();
                if (capa && capa.geojson && capa.geojson.features && capa.geojson.features.length > 0) {
                  if (setAtlasInitialIndex) setAtlasInitialIndex(0);
                  if (setAtlasFileName) setAtlasFileName(capa.name || 'Capa Temporal');
                  if (setImportedShapes) setImportedShapes(capa.geojson);
                  if (setShowAtlasModal) setShowAtlasModal(true);
                } else if (showError) {
                  showError('No se encontraron elementos en esta capa temporal.');
                }
              }}
              style={{ padding: '9px 15px', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: '500' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Sparkles size={16} color="var(--accent-color)" /> Abrir en Asistente Atlas
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                const capa = sidebarContextMenu.capaObj;
                onClose();
                if (capa && capa.geojson && capa.geojson.features && capa.geojson.features.length > 0) {
                  if (handlePrintTransientLayerOrFeature) handlePrintTransientLayerOrFeature(capa.geojson.features, 0, capa.name || 'Capa Temporal', false);
                } else if (showError) {
                  showError('No se encontraron polígonos en esta capa temporal.');
                }
              }}
              style={{ padding: '9px 15px', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: '600' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <FileText size={16} color="#8b5cf6" /> Imprimir Planimetría (Sin BD)
            </div>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }}></div>
            <div
              onClick={async (e) => {
                e.stopPropagation();
                const capaId = sidebarContextMenu.layerId;
                onClose();
                try {
                  if (deleteTemporalLayer) await deleteTemporalLayer(capaId);
                  if (setTemporalLayers) setTemporalLayers(prev => prev.filter(c => c.id !== capaId));
                  if (showSuccess) showSuccess('Capa temporal eliminada.');
                } catch (err) {
                  console.error(err);
                }
              }}
              style={{ padding: '9px 15px', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={16} color="var(--danger)" /> Eliminar Capa
            </div>
          </>
        )}

        {/* 5. MENÚ CONTEXTUAL: CAPA VECTORIAL O ADICIONAL INDIVIDUAL */}
        {!sidebarContextMenu.menuKind && (
          <>
            <div style={{ padding: '6px 15px', fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
              {sidebarContextMenu.isAdicional
                ? (capasAdicionales.find(c => c.tabla_db === sidebarContextMenu.layerType)?.nombre_capa || sidebarContextMenu.layerType)
                : (sidebarContextMenu.layerType === 'predios' ? 'Predios (Polígonos)' : sidebarContextMenu.layerType === 'lineas' ? 'Linderos (Líneas)' : 'Vértices (Puntos)')}
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (setActiveTableData) setActiveTableData(sidebarContextMenu.layerType);
                onClose();
              }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <TableProperties size={16} color="#3b82f6" /> Ver Tabla de Atributos
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                const data = sidebarContextMenu.isAdicional
                  ? geoJsonCacheAdicionales[sidebarContextMenu.layerType]
                  : sidebarContextMenu.layerType === 'predios' ? prediosData : sidebarContextMenu.layerType === 'lineas' ? lineasData : verticesData;
                if (data && zoomToVectorLayer) {
                  zoomToVectorLayer(data);
                }
                onClose();
              }}
              style={{ padding: '9px 15px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Target size={16} color="#fbbf24" /> Acercar a la Capa
            </div>

            {sidebarContextMenu.isAdicional && (
              <>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const tabla = sidebarContextMenu.layerType;
                    const capaObj = capasAdicionales.find(c => c.tabla_db === tabla);
                    onClose();
                    if (handleExportLayerToAtlas) handleExportLayerToAtlas(tabla, capaObj?.nombre_capa || tabla, 0);
                  }}
                  style={{ padding: '9px 15px', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: '500' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Sparkles size={16} color="var(--accent-color)" /> Exportar capa a Base de Datos
                </div>
                <div
                  onClick={async (e) => {
                    e.stopPropagation();
                    const tabla = sidebarContextMenu.layerType;
                    const capaObj = capasAdicionales.find(c => c.tabla_db === tabla);
                    onClose();
                    let geojsonData = geoJsonCacheAdicionales[tabla];
                    if (!geojsonData && API_URL && authToken) {
                      try {
                        const res = await fetch(`${API_URL}/api/gis/capa-adicional/${tabla}`, {
                          headers: { 'Authorization': `Bearer ${authToken}` }
                        });
                        if (res.ok) {
                          geojsonData = await res.json();
                          if (setGeoJsonCacheAdicionales) setGeoJsonCacheAdicionales(prev => ({ ...prev, [tabla]: geojsonData }));
                        }
                      } catch (err) { }
                    }
                    if (geojsonData?.features?.length > 0 && handlePrintTransientLayerOrFeature) {
                      handlePrintTransientLayerOrFeature(geojsonData.features, 0, capaObj?.nombre_capa || tabla, false);
                    } else if (showError) {
                      showError('No se encontraron polígonos válidos en esta capa.');
                    }
                  }}
                  style={{ padding: '9px 15px', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: '600' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <FileText size={16} color="#8b5cf6" /> Imprimir Planimetría (Sin subir a Catastro)
                </div>

                <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }}></div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (handleDeleteCapaAdicional) handleDeleteCapaAdicional(sidebarContextMenu.layerType);
                    onClose();
                  }}
                  style={{ padding: '9px 15px', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Trash2 size={16} color="var(--danger)" /> Eliminar Capa
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

