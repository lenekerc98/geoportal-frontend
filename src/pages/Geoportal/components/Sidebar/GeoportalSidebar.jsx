import React from 'react';
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  UploadCloud,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  DownloadCloud,
  FolderSearch,
  Clock,
  Layers,
  Hexagon,
  Boxes,
  Plus,
  Shield,
  ShieldAlert,
  Map,
  Image,
  Target,
  Settings,
  MapPin
} from 'lucide-react';
import CustomLayerItem from './CustomLayerItem';
import SectorSwitchboard from './SectorSwitchboard';

export default function GeoportalSidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  collapsedCategories = {},
  toggleCategory,
  // Búsqueda
  searchQuery,
  setSearchQuery,
  handleSearch,
  setSearchResults,
  // Gestión de datos
  handleProcesarClick,
  shapefileInputRef,
  handleImportShapefile,
  setShowShapefileUploader,
  importedShapes,
  atlasFileName,
  setShowAtlasModal,
  showImportedShapes,
  setShowImportedShapes,
  handleCancelTempShapes,
  handleExportAll,
  handleCatalogarMasivo,
  // Histórico 4D
  fechaHistorica,
  setFechaHistorica,
  selectedYear,
  setSelectedYear,
  prediosData,
  setPrediosData,
  fetchMapData,
  activeEmpresa,
  activeProyecto,
  API_URL,
  authToken,
  // Árbol de capas - Vectoriales
  setSidebarContextMenu,
  showPredios,
  togglePredios,
  expandedPredios,
  setExpandedPredios,
  showLineas,
  toggleLineas,
  showVertices,
  toggleVertices,
  showReferenciasSql,
  toggleReferenciasSql,
  referenciasSqlData,
  loadingReferenciasSql,
  // SectorSwitchboard props
  predioViewTab,
  setPredioViewTab,
  availableSectors,
  disabledSectors,
  setDisabledSectors,
  colorBySector,
  setColorBySector,
  expandedSectors,
  setExpandedSectors,
  filteredAvailableSectors,
  sectorSearchTerm,
  setSectorSearchTerm,
  prediosBySector,
  searchResults,
  visibleCounts,
  setVisibleCounts,
  handleSectorColorChange,
  zoomToSector,
  toggleSectorVisibility,
  hiddenFeatureIds,
  setHiddenFeatureIds,
  listDisplayMode,
  setListDisplayMode,
  zoomToFeature,
  setFeatureContextMenu,
  setEditingPredio,
  selectedSectorFilter,
  setSelectedSectorFilter,
  loadingPredios,
  // Capas adicionales & límites
  capasGenericas = [],
  capasCantonales = [],
  capasParroquiales = [],
  setShapefileInitialType,
  activeCapasAdicionales,
  expandedCapasAdicionales,
  layerStyles,
  activeStylePopover,
  setActiveStylePopover,
  activeFeatureStylePopover,
  setActiveFeatureStylePopover,
  toggleExpandCapaAdicional,
  toggleCapaAdicional,
  handleUpdateLayerStyle,
  geoJsonCacheAdicionales,
  selectedPredioId,
  setSelectedPredioId,
  getFeatureCustomStyle,
  handleUpdateFeatureStyle,
  handleResetFeatureStyle,
  handleExportSingleFeatureToAtlas,
  // Capas Temporales
  temporalLayers = [],
  activeTemporalLayers = {},
  setActiveTemporalLayers,
  deleteTemporalLayer,
  setTemporalLayers,
  // Mapas base
  baseMap,
  setBaseMap,
  theme,
  showCartoLabels,
  setShowCartoLabels,
  // Raster & WMS
  showMasterOrthophoto,
  setShowMasterOrthophoto,
  ortofotoOpacity,
  setOrtofotoOpacity,
  catalogData,
  individualOrthophotos = {},
  toggleIndividualOrthophoto,
  deleteOrthophoto,
  zoomToOrtofoto,
  // Metadatos
  showFootprints,
  setShowFootprints
}) {
  const customLayerProps = {
    activeCapasAdicionales,
    expandedCapasAdicionales,
    layerStyles,
    activeStylePopover,
    setActiveStylePopover,
    activeFeatureStylePopover,
    setActiveFeatureStylePopover,
    setSidebarContextMenu,
    toggleExpandCapaAdicional,
    toggleCapaAdicional,
    handleUpdateLayerStyle,
    geoJsonCacheAdicionales,
    visibleCounts,
    setVisibleCounts,
    hiddenFeatureIds,
    setHiddenFeatureIds,
    selectedPredioId,
    setSelectedPredioId,
    zoomToFeature,
    getFeatureCustomStyle,
    handleUpdateFeatureStyle,
    handleResetFeatureStyle,
    handleExportSingleFeatureToAtlas,
    setFeatureContextMenu
  };

  return (
    <aside className={`map-sidebar ${isSidebarOpen ? 'open' : ''}`}>
      {/* HEADER */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <X
          size={24}
          color="var(--text-main)"
          style={{ cursor: 'pointer' }}
          onClick={() => setIsSidebarOpen(false)}
          title="Ocultar panel"
        />
        <h3 style={{ margin: 0, color: 'var(--accent-color)' }}>Controles del Mapa</h3>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* PANEL: BÚSQUEDA Y HERRAMIENTAS */}
        <div className="sidebar-section">
          <div className="section-title" onClick={() => toggleCategory('buscar')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Search size={16} color="var(--primary)" />
              <span style={{ color: 'var(--text-main)' }}>Buscar Predio</span>
            </div>
            {collapsedCategories.buscar ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
          </div>

          {!collapsedCategories.buscar && (
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="sidebar-input"
                  type="text"
                  placeholder="Cédula, Código, Nombre o Sector..."
                  value={searchQuery}
                  onChange={e => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (!val.trim() && setSearchResults) setSearchResults(null);
                  }}
                  style={{ width: '100%', paddingRight: '22px', boxSizing: 'border-box' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      if (setSearchResults) setSearchResults(null);
                    }}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '12px'
                    }}
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button type="submit" style={{ padding: '5px 12px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Buscar</button>
            </form>
          )}
        </div>

        {/* PANEL: GESTIÓN DE DATOS Y HERRAMIENTAS */}
        <div className="sidebar-section">
          <div className="section-title" onClick={() => toggleCategory('gestion')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Database size={16} color="var(--primary)" />
              <span style={{ color: 'var(--text-main)' }}>Gestión de Datos</span>
            </div>
            {collapsedCategories.gestion ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
          </div>

          {!collapsedCategories.gestion && (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', marginTop: '10px' }}>
                <button className="btn-primary" onClick={handleProcesarClick} style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} title="Procesar Nueva Ortofoto">
                  <UploadCloud size={16} /> Ortofoto
                </button>
                <input
                  type="file"
                  accept=".zip,.xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  ref={shapefileInputRef}
                  onChange={handleImportShapefile}
                />
                <button className="btn-primary" onClick={() => shapefileInputRef.current?.click()} style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} title="Subir Shapefile o Excel Masivo para Asistente Atlas">
                  <UploadCloud size={16} /> Shapefile / Excel Atlas
                </button>
                <button className="btn-primary" onClick={() => setShowShapefileUploader(true)} style={{ padding: '8px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} title="Subir Shapefile a Tablas Crudas / BD">
                  <Database size={16} />
                </button>
              </div>

              {/* Tarjeta del Shapefile Temporal Atlas Cargado */}
              {importedShapes && (
                <div style={{
                  marginBottom: '12px',
                  padding: '10px 12px',
                  background: 'rgba(2, 132, 199, 0.08)',
                  border: '1.5px solid #0284c7',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} color="#0284c7" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#0369a1' }}>
                        Shapefile Atlas ({importedShapes.features?.length || 0})
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '10px', fontWeight: '700' }}>
                      Temporal
                    </span>
                  </div>

                  {atlasFileName && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={atlasFileName}>
                      📁 {atlasFileName}
                    </div>
                  )}

                  <button
                    onClick={() => setShowAtlasModal(true)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#fff',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)'
                    }}
                  >
                    <Sparkles size={15} /> 📖 Ver Asistente Atlas
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setShowImportedShapes(prev => !prev)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        background: showImportedShapes ? '#f1f5f9' : '#e2e8f0',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                      title={showImportedShapes ? "Ocultar polígonos del mapa temporalmente" : "Mostrar polígonos temporales en el mapa"}
                    >
                      {showImportedShapes ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showImportedShapes ? 'Ocultar' : 'Mostrar'}
                    </button>

                    <button
                      onClick={handleCancelTempShapes}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                      title="Cancelar y descartar este shapefile del mapa"
                    >
                      <Trash2 size={14} />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                <button className="btn-primary" onClick={handleExportAll} style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <DownloadCloud size={16} /> Descargar DB
                </button>
                <button className="btn-primary" onClick={handleCatalogarMasivo} style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} title="Catalogar Carpeta Entera de Ortofotos">
                  <FolderSearch size={16} /> Catalogar
                </button>
              </div>
            </>
          )}

          {/* CATASTRO HISTÓRICO (4D) */}
          <div className="section-title" onClick={() => toggleCategory('historico')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Clock size={16} color="var(--primary)" />
              <span style={{ color: 'var(--text-main)' }}>Catastro Histórico (4D)</span>
            </div>
            {collapsedCategories.historico ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
          </div>

          {!collapsedCategories.historico && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px' }}>Ver estado a la fecha:</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input
                  className="sidebar-input"
                  type="date"
                  value={fechaHistorica}
                  onChange={e => setFechaHistorica(e.target.value)}
                  style={{ flex: 1 }}
                  title="Filtrar en el backend por fecha exacta"
                />
                <select
                  className="sidebar-input"
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  style={{ flex: 1, padding: '2px', fontSize: '0.75rem' }}
                  title="Filtrar resultados visualmente por año"
                >
                  <option value="Todos">Todos los años</option>
                  {Array.from(
                    new Set(
                      (prediosData?.features || [])
                        .map(f => f.properties?.fecha_creacion ? String(f.properties.fecha_creacion).substring(0, 4) : null)
                        .filter(y => y && !isNaN(y))
                    )
                  )
                    .sort((a, b) => b - a)
                    .map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                <button
                  onClick={() => {
                    if (setPrediosData) setPrediosData(null);
                    if (fetchMapData) fetchMapData();
                  }}
                  style={{ padding: '5px 10px', background: '#eab308', color: '#1e293b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Aplicar
                </button>
              </div>
              {fechaHistorica && (
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '5px', textAlign: 'center', cursor: 'pointer' }} onClick={() => {
                  setFechaHistorica('');
                  setTimeout(() => {
                    let currentUrl = `${API_URL}/api/gis/predios`;
                    const urlParams = new URLSearchParams();
                    if (activeEmpresa) urlParams.append('empresa_id', activeEmpresa.id);
                    if (activeProyecto) urlParams.append('proyecto_id', activeProyecto.id);
                    if (urlParams.toString()) currentUrl += `?${urlParams.toString()}`;
                    fetch(currentUrl, { headers: { 'Authorization': `Bearer ${authToken}` } })
                      .then(r => r.json())
                      .then(d => { if (setPrediosData) setPrediosData(d); })
                      .catch(console.error);
                  }, 50);
                }}>
                  Volver a la actualidad
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANEL: ÁRBOL DE CAPAS ESTRUCTURADO (1. Capas) */}
        <div className="sidebar-section">
          <div
            className="layer-category"
            onClick={() => toggleCategory('vectores')}
            onContextMenu={(e) => {
              e.preventDefault();
              setSidebarContextMenu({
                x: e.clientX,
                y: e.clientY,
                menuKind: 'group_vectores'
              });
            }}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            title="1. Capas (Clic para colapsar/expandir)"
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Layers size={16} color="var(--primary)" />
              <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>1. Capas</span>
            </div>
            {collapsedCategories.vectores ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
          </div>

          {!collapsedCategories.vectores && (
            <div style={{ paddingLeft: '4px', marginTop: '6px' }}>

              {/* 1.1. Capas generales */}
              <div style={{ marginBottom: '8px' }}>
                <div
                  onClick={() => toggleCategory('capas_generales')}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                  title="1.1. Capas generales (Predios, Linderos, Vértices)"
                >
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    <Hexagon size={14} color="#3b82f6" />
                    <span>1.1. Capas generales</span>
                  </div>
                  {collapsedCategories.capas_generales ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>

                {!collapsedCategories.capas_generales && (
                  <div style={{ paddingLeft: '8px', marginTop: '4px' }}>
                    {/* Predios (Polígonos) */}
                    <div
                      className={`layer-item ${showPredios ? 'active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center' }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSidebarContextMenu({ x: e.clientX, y: e.clientY, layerType: 'predios' });
                      }}
                    >
                      <span
                        onClick={(e) => { e.stopPropagation(); setExpandedPredios(!expandedPredios); }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '6px', color: 'var(--text-muted)' }}
                        title={expandedPredios ? "Colapsar lista de predios" : "Expandir lista de predios"}
                      >
                        {expandedPredios ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <span onClick={() => setExpandedPredios(!expandedPredios)} style={{ flex: 1, cursor: 'pointer' }}>Predios (Polígonos)</span>
                      <span onClick={togglePredios} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px' }} title={showPredios ? "Ocultar en mapa" : "Mostrar en mapa"}>
                        {showPredios ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
                      </span>
                    </div>

                    {expandedPredios && (
                      <SectorSwitchboard
                        predioViewTab={predioViewTab}
                        setPredioViewTab={setPredioViewTab}
                        availableSectors={availableSectors}
                        disabledSectors={disabledSectors}
                        setDisabledSectors={setDisabledSectors}
                        colorBySector={colorBySector}
                        setColorBySector={setColorBySector}
                        expandedSectors={expandedSectors}
                        setExpandedSectors={setExpandedSectors}
                        filteredAvailableSectors={filteredAvailableSectors}
                        sectorSearchTerm={sectorSearchTerm}
                        setSectorSearchTerm={setSectorSearchTerm}
                        prediosBySector={prediosBySector}
                        searchResults={searchResults}
                        selectedYear={selectedYear}
                        visibleCounts={visibleCounts}
                        setVisibleCounts={setVisibleCounts}
                        handleSectorColorChange={handleSectorColorChange}
                        zoomToSector={zoomToSector}
                        toggleSectorVisibility={toggleSectorVisibility}
                        hiddenFeatureIds={hiddenFeatureIds}
                        setHiddenFeatureIds={setHiddenFeatureIds}
                        listDisplayMode={listDisplayMode}
                        setListDisplayMode={setListDisplayMode}
                        zoomToFeature={zoomToFeature}
                        setFeatureContextMenu={setFeatureContextMenu}
                        setEditingPredio={setEditingPredio}
                        selectedSectorFilter={selectedSectorFilter}
                        setSelectedSectorFilter={setSelectedSectorFilter}
                        loadingPredios={loadingPredios}
                        prediosData={prediosData}
                      />
                    )}

                    {/* Linderos (Líneas) */}
                    <div
                      className={`layer-item ${showLineas ? 'active' : ''}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSidebarContextMenu({ x: e.clientX, y: e.clientY, layerType: 'lineas' });
                      }}
                    >
                      <span onClick={toggleLineas} style={{ flex: 1 }}>Linderos (Líneas)</span>
                      <span onClick={toggleLineas} style={{ cursor: 'pointer' }}>{showLineas ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}</span>
                    </div>

                    {/* Vértices (Puntos) */}
                    <div
                      className={`layer-item ${showVertices ? 'active' : ''}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSidebarContextMenu({ x: e.clientX, y: e.clientY, layerType: 'vertices' });
                      }}
                    >
                      <span onClick={toggleVertices} style={{ flex: 1 }}>Vértices (Puntos)</span>
                      <span onClick={toggleVertices} style={{ cursor: 'pointer' }}>{showVertices ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}</span>
                    </div>

                    {/* Puntos de Referencia Predial (SQL Server) */}
                    <div
                      className={`layer-item ${showReferenciasSql ? 'active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center' }}
                      title="Puntos de Referencia Predial importados desde la base SQL Server municipal"
                    >
                      <span
                        onClick={toggleReferenciasSql}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, cursor: 'pointer' }}
                      >
                        <MapPin size={16} color={showReferenciasSql ? "#f59e0b" : "var(--text-muted)"} />
                        <span style={{ fontSize: '13px' }}>Puntos de Ref. (SQL)</span>
                        {referenciasSqlData?.total && (
                          <span style={{
                            fontSize: '10.5px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#d97706',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontWeight: 'bold',
                            marginLeft: 'auto',
                            marginRight: '6px'
                          }}>
                            {referenciasSqlData.total}
                          </span>
                        )}
                        {loadingReferenciasSql && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', fontStyle: 'italic', marginLeft: 'auto', marginRight: '6px' }}>
                            cargando...
                          </span>
                        )}
                      </span>
                      <span onClick={toggleReferenciasSql} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px' }}>
                        {showReferenciasSql ? <Eye size={18} color="#f59e0b" /> : <EyeOff size={18} color="#475569" />}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 1.2. Capas Adicionales */}
              <div style={{ marginBottom: '8px' }}>
                <div
                  onClick={() => toggleCategory('capas_adicionales')}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSidebarContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      menuKind: 'group_adicionales'
                    });
                  }}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
                  title="1.2. Capas Adicionales"
                >
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    <Boxes size={14} color="#a855f7" />
                    <span>1.2. Capas Adicionales ({capasGenericas.length})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShapefileInitialType('capa_adicional');
                        setShowShapefileUploader(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid #a855f7',
                        borderRadius: '4px',
                        color: '#a855f7',
                        padding: '1px 5px',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      title="Subir Capa Adicional (Shapefile / GeoJSON)"
                    >
                      <Plus size={11} /> Subir
                    </button>
                    {collapsedCategories.capas_adicionales ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {!collapsedCategories.capas_adicionales && (
                  <div style={{ paddingLeft: '8px', marginTop: '4px' }}>
                    {capasGenericas.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed var(--card-border)', borderRadius: '6px', margin: '4px 0' }}>
                        <p style={{ margin: '0 0 5px 0' }}>No hay capas adicionales cargadas.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShapefileInitialType('capa_adicional');
                            setShowShapefileUploader(true);
                          }}
                          style={{
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid #a855f7',
                            color: '#a855f7',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.73rem',
                            cursor: 'pointer'
                          }}
                        >
                          + Cargar Capa Adicional
                        </button>
                      </div>
                    ) : (
                      capasGenericas.map(capa => (
                        <CustomLayerItem key={capa.tabla_db} capa={capa} {...customLayerProps} />
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 1.3. Capas Limites */}
              <div style={{ marginBottom: '8px' }}>
                <div
                  onClick={() => toggleCategory('capas_limites')}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  title="1.3. Capas Limitrofes."
                >
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    <Shield size={14} color="#ef4444" />
                    <span>1.3. Capas Limitrofes.</span>
                  </div>
                  {collapsedCategories.capas_limites ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>

                {!collapsedCategories.capas_limites && (
                  <div style={{ paddingLeft: '8px', marginTop: '4px' }}>

                    {/* 1.3.1.: Limite cantonal */}
                    <div style={{ marginBottom: '6px', padding: '6px', background: 'rgba(239, 68, 68, 0.04)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#ef4444' }}>
                          <Shield size={13} />
                          <span>1.3.1.: Limite cantonal</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShapefileInitialType('limite_cantonal');
                            setShowShapefileUploader(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                          title="Subir o actualizar Límite Cantonal"
                        >
                          <UploadCloud size={11} /> Subir
                        </button>
                      </div>

                      {capasCantonales.length === 0 ? (
                        <div style={{ padding: '6px', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <div style={{ marginBottom: '4px' }}>Sin límite cantonal activo</div>
                          <button
                            type="button"
                            onClick={() => {
                              setShapefileInitialType('limite_cantonal');
                              setShowShapefileUploader(true);
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px dashed #ef4444',
                              color: '#ef4444',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              cursor: 'pointer'
                            }}
                          >
                            + Subir Límite Cantonal
                          </button>
                        </div>
                      ) : (
                        capasCantonales.map(capa => (
                          <CustomLayerItem key={capa.tabla_db} capa={capa} {...customLayerProps} />
                        ))
                      )}
                    </div>

                    {/* 1.3.2.: Limite Parroquial */}
                    <div style={{ marginBottom: '6px', padding: '6px', background: 'rgba(6, 182, 212, 0.04)', borderRadius: '6px', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '600', color: '#06b6d4' }}>
                          <ShieldAlert size={13} />
                          <span>1.3.2.: Limite Parroquial</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShapefileInitialType('limite_parroquial');
                            setShowShapefileUploader(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #06b6d4',
                            color: '#06b6d4',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                          title="Subir o actualizar Límites Parroquiales"
                        >
                          <UploadCloud size={11} /> Subir
                        </button>
                      </div>

                      {capasParroquiales.length === 0 ? (
                        <div style={{ padding: '6px', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <div style={{ marginBottom: '4px' }}>Sin límites parroquiales activos</div>
                          <button
                            type="button"
                            onClick={() => {
                              setShapefileInitialType('limite_parroquial');
                              setShowShapefileUploader(true);
                            }}
                            style={{
                              background: 'rgba(6, 182, 212, 0.1)',
                              border: '1px dashed #06b6d4',
                              color: '#06b6d4',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              cursor: 'pointer'
                            }}
                          >
                            + Subir Límite Parroquial
                          </button>
                        </div>
                      ) : (
                        capasParroquiales.map(capa => (
                          <CustomLayerItem key={capa.tabla_db} capa={capa} {...customLayerProps} />
                        ))
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* Capas Temporales (Local IndexedDB) */}
              {temporalLayers.length > 0 && (
                <>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }}></div>
                  <div
                    className="layer-group-header"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSidebarContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        menuKind: 'group_temporales'
                      });
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      marginBottom: '5px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'context-menu',
                      borderRadius: '4px'
                    }}
                    title="Capas Temporales (Clic derecho para opciones de grupo)"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="#f59e0b" />
                      <span>Capas Temporales ({temporalLayers.length})</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>clic derecho</span>
                  </div>
                  {temporalLayers.map(capa => (
                    <div
                      key={capa.id}
                      className={`layer-item ${activeTemporalLayers[capa.id] ? 'active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center' }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSidebarContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          menuKind: 'layer_temporal',
                          layerId: capa.id,
                          capaObj: capa
                        });
                      }}
                      title="Clic derecho para opciones de capa"
                    >
                      <span onClick={() => setActiveTemporalLayers(prev => ({ ...prev, [capa.id]: !prev[capa.id] }))} style={{ flex: 1, fontSize: '0.85rem', display: 'flex', alignItems: 'center', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={capa.name}>
                        <div style={{ width: '12px', height: '12px', background: capa.color || '#3b82f6', borderRadius: '2px', marginRight: '8px', flexShrink: 0 }}></div>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{capa.name}</span>
                      </span>
                      <span onClick={() => setActiveTemporalLayers(prev => ({ ...prev, [capa.id]: !prev[capa.id] }))} style={{ cursor: 'pointer', marginRight: '10px' }} title={activeTemporalLayers[capa.id] ? "Ocultar" : "Mostrar"}>
                        {activeTemporalLayers[capa.id] ? <Eye size={16} /> : <EyeOff size={16} color="#475569" />}
                      </span>
                      <span onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await deleteTemporalLayer(capa.id);
                          if (setTemporalLayers) setTemporalLayers(prev => prev.filter(c => c.id !== capa.id));
                        } catch (err) { console.error(err); }
                      }} style={{ cursor: 'pointer', color: '#ef4444' }} title="Eliminar capa temporal local">
                        <Trash2 size={16} />
                      </span>
                    </div>
                  ))}
                </>
              )}

            </div>
          )}

          {/* MAPAS BASE */}
          <div className="sidebar-section">
            <div className="layer-category" onClick={() => toggleCategory('basemap')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Map size={16} color="var(--primary)" />
                <span style={{ color: 'var(--text-main)' }}>Mapas Base</span>
              </div>
              {collapsedCategories.basemap ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
            </div>
          </div>

          {!collapsedCategories.basemap && (
            <>
              <div className={`layer-item ${baseMap === 'osm' ? 'active' : ''}`} onClick={() => setBaseMap('osm')}>
                <span>OpenStreetMap</span>
                {baseMap === 'osm' ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
              </div>
              <div className={`layer-item ${baseMap === 'esri' ? 'active' : ''}`} onClick={() => setBaseMap('esri')}>
                <span>Satélite (Esri)</span>
                {baseMap === 'esri' ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
              </div>
              <div className={`layer-item ${baseMap === 'osm-hybrid' ? 'active' : ''}`} onClick={() => setBaseMap('osm-hybrid')}>
                <span>Satélite + Calles</span>
                {baseMap === 'osm-hybrid' ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
              </div>
              <div className={`layer-item ${baseMap === 'carto' ? 'active' : ''}`} onClick={() => setBaseMap('carto')}>
                <span>Carto ({theme === 'dark' ? 'Oscuro' : 'Claro'})</span>
                {baseMap === 'carto' ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
              </div>
              <div className={`layer-item ${baseMap === 'none' ? 'active' : ''}`} onClick={() => setBaseMap('none')}>
                <span>Fondo Blanco (Ninguno)</span>
                {baseMap === 'none' ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }}></div>
              <div style={{ padding: '0 10px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>Capas Superpuestas</div>
              <div className={`layer-item ${showCartoLabels ? 'active' : ''}`} onClick={() => setShowCartoLabels(!showCartoLabels)}>
                <span>Etiquetas de Calles (Carto)</span>
                {showCartoLabels ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
              </div>
            </>
          )}

          {/* CAPAS RASTER ADICIONALES */}
          <div className="sidebar-section">
            <div className="layer-category" onClick={() => toggleCategory('raster')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Image size={16} color="var(--primary)" />
                <span style={{ color: 'var(--text-main)' }}>Capas Raster Adicionales</span>
              </div>
              {collapsedCategories.raster ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
            </div>
          </div>

          {!collapsedCategories.raster && (
            <>
              <div className={`layer-item ${showMasterOrthophoto ? 'active' : ''}`} onClick={() => setShowMasterOrthophoto(!showMasterOrthophoto)}>
                <span>Mosaico Maestro (Todas)</span>
                {showMasterOrthophoto ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
              </div>

              <div className="layer-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '10px 15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px' }}>Opacidad: {Math.round(ortofotoOpacity * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ortofotoOpacity}
                  onChange={(e) => setOrtofotoOpacity(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            </>
          )}

          {/* ORTOFOTOS (WMS) */}
          <div className="sidebar-section">
            <div className="layer-category" onClick={() => toggleCategory('ortofotos')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Layers size={16} color="var(--primary)" />
                <span style={{ color: 'var(--text-main)' }}>Ortofotos (WMS)</span>
              </div>
              {collapsedCategories.ortofotos ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
            </div>
          </div>

          {!collapsedCategories.ortofotos && catalogData?.features?.map((f, i) => {
            const filename = f.properties.nombre_archivo;
            const isVisible = individualOrthophotos[filename];
            return (
              <div key={i} className={`layer-item ${isVisible ? 'active' : ''}`} style={{ paddingLeft: '20px', fontSize: '0.85rem' }}>
                <span onClick={() => toggleIndividualOrthophoto(filename)} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>{filename}</span>
                <Trash2 size={16} color="#ef4444" style={{ marginRight: '8px' }} onClick={() => deleteOrthophoto(filename)} />
                {isVisible && <Target size={16} color="#fbbf24" style={{ marginRight: '8px' }} onClick={() => zoomToOrtofoto(filename)} />}
                <span onClick={() => toggleIndividualOrthophoto(filename)}>{isVisible ? <Eye size={16} /> : <EyeOff size={16} color="#475569" />}</span>
              </div>
            );
          })}

          {/* METADATOS Y UTILIDADES */}
          <div className="sidebar-section">
            <div className="layer-category" onClick={() => toggleCategory('metadatos')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Settings size={16} color="var(--primary)" />
                <span style={{ color: 'var(--text-main)' }}>Metadatos y Utilidades</span>
              </div>
              {collapsedCategories.metadatos ? <ChevronRight size={16} color="var(--primary)" /> : <ChevronDown size={16} color="var(--primary)" />}
            </div>
          </div>

          {!collapsedCategories.metadatos && (
            <div className={`layer-item ${showFootprints ? 'active' : ''}`} onClick={() => setShowFootprints(!showFootprints)}>
              <span>Cuadros de Ortofotos</span>
              {showFootprints ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}

