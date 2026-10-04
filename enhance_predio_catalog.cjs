const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/LNCZ/proyecto-catastro-2026/movil/src/pages/FormTab/PredioFormMobile.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Asegurar importaciones
if (!content.includes('getCachedPredios')) {
  content = content.replace(
    "import { getOfflinePredios, saveOfflinePredio, deleteOfflinePredio } from '../../services/mobileDB';",
    "import { getOfflinePredios, saveOfflinePredio, deleteOfflinePredio, getCachedPredios } from '../../services/mobileDB';"
  );
}

if (!content.includes('fetchServerPredios')) {
  content = content.replace(
    "import { uploadSinglePredio, searchPosesionarioByCedula, searchPosesionariosByName } from '../../services/api';",
    "import { uploadSinglePredio, searchPosesionarioByCedula, searchPosesionariosByName, fetchServerPredios } from '../../services/api';"
  );
}

if (!content.includes('Search') || !content.includes('RefreshCw') || !content.includes('Database')) {
  content = content.replace(
    "  FileText,\n  Clock\n} from 'lucide-react';",
    "  FileText,\n  Clock,\n  Search,\n  RefreshCw,\n  Database,\n  CheckCircle2\n} from 'lucide-react';"
  );
}

// 2. Agregar estados para el catálogo unificado
const stateSearchTarget = "  const [loadingList, setLoadingList] = useState(false);";
const stateAdditions = `  const [loadingList, setLoadingList] = useState(false);
  const [serverPredios, setServerPredios] = useState([]);
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all', 'pending', 'server'
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isRefreshingServer, setIsRefreshingServer] = useState(false);`;

if (!content.includes('catalogFilter')) {
  content = content.replace(stateSearchTarget, stateAdditions);
}

// 3. Mejorar loadLocalPredios para cargar tanto offline_predios como cached_predios
const loadFunctionTarget = `  // Cargar lista de predios dibujados en el móvil
  const loadLocalPredios = async () => {
    setLoadingList(true);
    try {
      const list = await getOfflinePredios();
      setLocalPredios(list || []);
    } catch (e) {
      console.warn('Error cargando predios locales:', e);
    } finally {
      setLoadingList(false);
    }
  };`;

const improvedLoadFunction = `  // Cargar lista de predios dibujados en el móvil y predios en base de datos
  const loadLocalPredios = async () => {
    setLoadingList(true);
    try {
      const [listLocal, listServer] = await Promise.all([
        getOfflinePredios().catch(() => []),
        getCachedPredios().catch(() => [])
      ]);
      setLocalPredios(listLocal || []);
      setServerPredios(listServer || []);
    } catch (e) {
      console.warn('Error cargando predios:', e);
    } finally {
      setLoadingList(false);
    }
  };

  // Descargar / actualizar predios desde el servidor PostgreSQL (catastro.predio)
  const handleRefreshServerPredios = async () => {
    if (!isOnline) {
      showToast('Sin conexión a internet para consultar la base central', 'warning');
      return;
    }
    setIsRefreshingServer(true);
    try {
      const freshList = await fetchServerPredios();
      setServerPredios(freshList || []);
      showToast(\`\${freshList.length} predios actualizados desde la base central\`, 'success');
    } catch (e) {
      showToast('Error al conectar con la base de datos: ' + e.message, 'error');
    } finally {
      setIsRefreshingServer(false);
    }
  };`;

content = content.replace(loadFunctionTarget, improvedLoadFunction);

// 4. Mejorar handleViewOnMap y apertura de reporte para que admitan predios del servidor
const oldHandleViewOnMap = `  const handleViewOnMap = (p) => {
    const verts = extractVerticesFromPredio(p);
    setSelectedPredio({
      ...p,
      vertices: verts,
      _focusTime: Date.now()
    });
    setActiveTab('map');
  };`;

const newHandleViewOnMap = `  const handleViewOnMap = (p) => {
    const verts = extractVerticesFromPredio(p);
    const cod = p.codigo || p.properties?.cod_catastral || 'S/C';
    const prop = p.propietario || p.properties?.nombre_posesionario || 'Sin Propietario';
    setSelectedPredio({
      ...p,
      id: p.id || p.properties?.id,
      codigo: cod,
      propietario: prop,
      vertices: verts,
      geometry: p.geometry || null,
      _focusTime: Date.now()
    });
    setActiveTab('map');
  };

  const handleOpenReport = (p) => {
    const verts = extractVerticesFromPredio(p);
    const cod = p.codigo || p.properties?.cod_catastral || 'S/C';
    const prop = p.propietario || p.properties?.nombre_posesionario || 'Sin Propietario';
    const ced = p.cedula || p.properties?.cedula || '';
    const areaVal = p.area || (p.properties?.area_ha ? Number(p.properties.area_ha) * 10000 : 0);
    const perimVal = p.perimetro || 0;
    
    setSelectedPredioForReport({
      ...p,
      id: p.id || p.properties?.id,
      codigo: cod,
      propietario: prop,
      cedula: ced,
      area: areaVal,
      perimetro: perimVal,
      vertices: verts
    });
    setShowReporteModal(true);
  };`;

content = content.replace(oldHandleViewOnMap, newHandleViewOnMap);

// 5. Reemplazar renderListContent con el catálogo interactivo categorizado
const oldRenderListRegex = /const renderListContent = \(\) => \([\s\S]*?\n  \);\n\n  return \(/;

const newRenderListContent = `const renderListContent = () => {
    // Normalizar lista de predios del servidor
    const formattedServerPredios = (serverPredios || []).map(sp => {
      const props = sp.properties || {};
      const areaM2 = props.area_ha ? Number(props.area_ha) * 10000 : 0;
      return {
        id: sp.id || props.id,
        isServer: true,
        offline_id: 'srv_' + (sp.id || props.id),
        codigo: props.cod_catastral || 'Sin Código',
        propietario: props.nombre_posesionario || props.propietario || 'Sin Propietario',
        cedula: props.cedula || '',
        area: areaM2,
        perimetro: 0,
        geometry: sp.geometry,
        raw: sp,
        sync_status: 'synced'
      };
    });

    // Combinar o filtrar según selección
    const pendingLocal = localPredios.filter(p => p.sync_status !== 'synced');
    const syncedLocal = localPredios.filter(p => p.sync_status === 'synced');

    // Lista unificada
    let combinedList = [];
    if (catalogFilter === 'pending') {
      combinedList = pendingLocal;
    } else if (catalogFilter === 'server') {
      combinedList = formattedServerPredios;
    } else {
      // 'all': primero locales pendientes, luego locales subidos, luego predios de base central
      combinedList = [...pendingLocal, ...syncedLocal, ...formattedServerPredios];
    }

    // Filtrar por búsqueda
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      combinedList = combinedList.filter(p => 
        (p.codigo && String(p.codigo).toLowerCase().includes(q)) ||
        (p.propietario && String(p.propietario).toLowerCase().includes(q)) ||
        (p.cedula && String(p.cedula).includes(q))
      );
    }

    return (
    <div className="tab-scroll-container">
      {/* Encabezado y Acción Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={20} color="#0284c7" /> Catálogo de Predios
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
            {localPredios.length} en teléfono • {serverPredios.length} en base central
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            type="button" 
            className="btn-secondary-mobile"
            style={{ minHeight: '40px', height: '40px', padding: '0 10px', fontSize: '12px' }}
            onClick={handleRefreshServerPredios}
            disabled={isRefreshingServer}
            title="Descargar predios actualizados de la base central"
          >
            <RefreshCw size={15} className={isRefreshingServer ? 'animate-spin' : ''} color="#0284c7" />
          </button>

          <button 
            type="button" 
            className="btn-primary-mobile"
            style={{ minHeight: '40px', height: '40px', fontSize: '12px', padding: '0 12px', flex: '0 0 auto' }}
            onClick={handleCreateNew}
          >
            <Plus size={16} /> + Nuevo Predio
          </button>
        </div>
      </div>

      {/* Buscador de Predios */}
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <input 
          type="text"
          value={catalogSearch}
          onChange={(e) => setCatalogSearch(e.target.value)}
          placeholder="Buscar por código, propietario o cédula..."
          style={{
            width: '100%',
            height: '40px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            padding: '0 34px 0 34px',
            fontSize: '13px',
            background: '#ffffff',
            boxSizing: 'border-box'
          }}
        />
        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '12px' }} />
        {catalogSearch && (
          <button 
            type="button" 
            onClick={() => setCatalogSearch('')}
            style={{ position: 'absolute', right: '8px', top: '10px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filtros de Categoría (Pestañas Pills) */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setCatalogFilter('all')}
          style={{
            flex: 1,
            minHeight: '34px',
            padding: '0 8px',
            fontSize: '11px',
            fontWeight: catalogFilter === 'all' ? '700' : '500',
            borderRadius: '8px',
            border: catalogFilter === 'all' ? '1px solid #0284c7' : '1px solid #e2e8f0',
            background: catalogFilter === 'all' ? '#e0f2fe' : '#ffffff',
            color: catalogFilter === 'all' ? '#0369a1' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          Todos ({localPredios.length + serverPredios.length})
        </button>

        <button
          type="button"
          onClick={() => setCatalogFilter('pending')}
          style={{
            flex: 1,
            minHeight: '34px',
            padding: '0 8px',
            fontSize: '11px',
            fontWeight: catalogFilter === 'pending' ? '700' : '500',
            borderRadius: '8px',
            border: catalogFilter === 'pending' ? '1px solid #f59e0b' : '1px solid #e2e8f0',
            background: catalogFilter === 'pending' ? '#fef3c7' : '#ffffff',
            color: catalogFilter === 'pending' ? '#b45309' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          Por Subir ({pendingLocal.length})
        </button>

        <button
          type="button"
          onClick={() => setCatalogFilter('server')}
          style={{
            flex: 1,
            minHeight: '34px',
            padding: '0 8px',
            fontSize: '11px',
            fontWeight: catalogFilter === 'server' ? '700' : '500',
            borderRadius: '8px',
            border: catalogFilter === 'server' ? '1px solid #10b981' : '1px solid #e2e8f0',
            background: catalogFilter === 'server' ? '#d1fae5' : '#ffffff',
            color: catalogFilter === 'server' ? '#047857' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          En Servidor ({serverPredios.length})
        </button>
      </div>

      {/* Lista de Predios */}
      {loadingList ? (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
          Cargando predios...
        </div>
      ) : combinedList.length === 0 ? (
        <div style={{
          background: '#ffffff',
          border: '1px dashed #cbd5e1',
          borderRadius: '16px',
          padding: '36px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          marginTop: '10px'
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            🗺️
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            {catalogSearch ? 'No se encontraron predios' : 'No hay predios en esta categoría'}
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>
            {catalogSearch ? 'Intenta buscar con otro término o código catastral.' : 'Puedes dibujar un predio en el mapa o presionar "Actualizar BD".'}
          </p>
          <button 
            type="button" 
            className="btn-primary-mobile"
            style={{ minHeight: '44px', width: '100%', maxWidth: '240px', marginTop: '6px' }}
            onClick={handleCreateNew}
          >
            <Plus size={18} /> + Levantar Nuevo Predio
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {combinedList.map((p) => {
            const isServer = Boolean(p.isServer);
            const isSynced = p.sync_status === 'synced';
            const areaM2 = Number(p.area) || 0;
            const numVerts = Array.isArray(p.vertices) ? p.vertices.length : (p.geometry?.coordinates?.[0]?.length || 0);

            return (
              <div 
                key={p.offline_id || p.id}
                style={{
                  background: '#ffffff',
                  border: isServer ? '1px solid #e0f2fe' : (isSynced ? '1px solid #dcfce7' : '1px solid #fef3c7'),
                  borderRadius: '14px',
                  padding: '14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7' }}>
                        {p.codigo || 'Sin Código'}
                      </span>
                      {isServer ? (
                        <span className="pill-badge" style={{ fontSize: '10px', padding: '2px 6px', background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                          ☁️ Base Central
                        </span>
                      ) : isSynced ? (
                        <span className="pill-badge" style={{ fontSize: '10px', padding: '2px 6px', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#059669' }}>
                          ✅ Subido
                        </span>
                      ) : (
                        <span className="pill-badge" style={{ fontSize: '10px', padding: '2px 6px', background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' }}>
                          ⏳ Por Subir
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>
                      👤 {p.propietario || 'Sin Propietario'} {p.cedula ? \`(\${p.cedula})\` : ''}
                    </div>
                  </div>
                </div>

                {/* Resumen Métrico */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: '#f8fafc', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Área:</span>
                    <div className="mono" style={{ fontWeight: '800', color: '#10b981' }}>{areaM2.toFixed(1)} m²</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Perímetro:</span>
                    <div className="mono" style={{ fontWeight: '800', color: '#f59e0b' }}>{(Number(p.perimetro) || 0).toFixed(1)} m</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Puntos:</span>
                    <div className="mono" style={{ fontWeight: '800', color: '#0284c7' }}>{numVerts > 0 ? \`\${numVerts} pts\` : 'Polígono'}</div>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary-mobile"
                    style={{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1, color: '#0284c7', borderColor: '#bae6fd' }}
                    onClick={() => handleEditFromList(p)}
                  >
                    <Edit2 size={14} /> {isServer ? 'Ver Datos' : 'Editar'}
                  </button>

                  <button 
                    type="button" 
                    className="btn-secondary-mobile"
                    style={{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1, color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}
                    onClick={() => handleOpenReport(p)}
                  >
                    <FileText size={14} /> Reporte
                  </button>

                  <button 
                    type="button" 
                    className="btn-secondary-mobile"
                    style={{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1 }}
                    onClick={() => handleViewOnMap(p)}
                  >
                    <Map size={14} /> Ver en Mapa
                  </button>

                  {!isServer && (
                    <button 
                      type="button" 
                      style={{ width: '38px', height: '38px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => handleDeleteFromList(p)}
                      title="Eliminar Predio Local"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    );
  };

  return (`;

if (oldRenderListRegex.test(content)) {
  content = content.replace(oldRenderListRegex, newRenderListContent);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('✓ Successfully enhanced PredioFormMobile with complete catalog and categories');
} else {
  console.error('oldRenderListRegex did not match in PredioFormMobile.jsx');
}
