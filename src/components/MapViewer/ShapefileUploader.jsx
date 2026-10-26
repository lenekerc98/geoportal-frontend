import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  UploadCloud, CheckCircle2, AlertCircle, Loader2, X, Eye, 
  ArrowRight, ArrowLeft, CheckSquare, Square, RefreshCw, Slash, AlertTriangle, Layers,
  MapPin, Compass, Check
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { API_URL } from '../../services/api';
import shp from 'shpjs';
import { showSuccess } from '../../utils/swal';
import { AppContext } from '../../context/AppContext';
import './ShapefileUploader.css';

// Helper para ajustar automáticamente el zoom del mapa a los polígonos
function MapBoundsUpdater({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [25, 25], maxZoom: 16 });
    }
  }, [bounds, map]);
  return null;
}

// Helper para convertir geometrías GeoJSON a coordenadas compatibles con Leaflet [lat, lng]
const extractLeafletPositions = (geom) => {
  if (!geom || !geom.coordinates) return [];
  try {
    if (geom.type === 'Polygon') {
      return geom.coordinates.map(ring => ring.map(coord => [coord[1], coord[0]]));
    } else if (geom.type === 'MultiPolygon') {
      return geom.coordinates.map(polygon => 
        polygon.map(ring => ring.map(coord => [coord[1], coord[0]]))
      );
    }
  } catch (err) {
    console.warn("Error extrayendo posiciones Leaflet:", err);
  }
  return [];
};

export default function ShapefileUploader({ onClose, onSuccess, authToken, user, onAddTemporalLayer, initialImportType = 'catastro_base' }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const { activeEmpresa, activeProyecto } = useContext(AppContext);
  const isModoManual = activeEmpresa?.parametros?.modo_historico === 'manual';

  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState(activeEmpresa?.id ? String(activeEmpresa.id) : (user?.id_empresa ? String(user.id_empresa) : ''));
  
  const isSuperAdmin = user?.role?.toLowerCase() === 'superadministrador' || user?.role?.toLowerCase() === 'superadmin';

  // Step state: 'config' (mapping & file) | 'resolution' (conflict resolution) | 'success'
  const [step, setStep] = useState('config');

  // Mapping state
  const [previewColumns, setPreviewColumns] = useState([]);
  const [mapping, setMapping] = useState({ 
    cedula: '', 
    nombre_posesionario: '', 
    cod_catastral: '',
    fecha_adjudicacion: '',
    numero_tramite: '',
    institucion: '',
    sector: ''
  });
  const [renames, setRenames] = useState({});
  const [isParsing, setIsParsing] = useState(false);
  const [parsedGeoJson, setParsedGeoJson] = useState(null);

  // Límites visualizer state
  const [limitePolygons, setLimitePolygons] = useState([]);
  const [limiteAssignments, setLimiteAssignments] = useState({});
  const [selectedPolyIdx, setSelectedPolyIdx] = useState(0);

  // Analysis & Conflict state
  const [analysisData, setAnalysisData] = useState(null);
  const [conflictActions, setConflictActions] = useState({}); // { [temp_id]: 'reemplazar' | 'omitir' }
  const [selectedNewIds, setSelectedNewIds] = useState(new Set()); // Set of temp_ids to insert
  const [importProgress, setImportProgress] = useState({ percent: 0, current: 0, total: 0, message: '' });

  // Custom Layer state
  const [importType, setImportType] = useState(initialImportType || 'catastro_base');
  const [nombreCapa, setNombreCapa] = useState(
    initialImportType === 'limite_cantonal' ? 'Límite Cantonal' :
    initialImportType === 'limite_parroquial' ? 'Límite Parroquial' : ''
  );
  
  // Historical Cadastre 4D
  const [fechaVigencia, setFechaVigencia] = useState('');

  useEffect(() => {
    if (activeEmpresa?.id && !selectedEmpresa) {
      setSelectedEmpresa(String(activeEmpresa.id));
    }
  }, [activeEmpresa?.id, selectedEmpresa]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetch(`${API_URL}/api/empresas`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmpresas(data);
          if (!selectedEmpresa) {
            if (activeEmpresa?.id) {
              setSelectedEmpresa(String(activeEmpresa.id));
            } else if (data.length > 0) {
              setSelectedEmpresa(String(data[0].id));
            }
          }
        }
      })
      .catch(err => console.error("Error fetching empresas", err));
    } else if (user?.id_empresa && !selectedEmpresa) {
      setSelectedEmpresa(String(user.id_empresa));
    }
  }, [isSuperAdmin, authToken, activeEmpresa?.id, selectedEmpresa, user?.id_empresa]);

  // Sincronizar asignaciones de DPA si el usuario cambia el tipo de límite
  useEffect(() => {
    if (limitePolygons && limitePolygons.length > 0) {
      const updated = {};
      limitePolygons.forEach((p, i) => {
        if (importType === 'limite_cantonal') {
          updated[i] = p.matchedDpa || '1206';
        } else if (importType === 'limite_parroquial') {
          updated[i] = p.matchedDpa || (i === 0 ? '120650' : i === 1 ? '120651' : i === 2 ? '120652' : '');
        } else {
          updated[i] = '';
        }
      });
      setLimiteAssignments(updated);
    }
  }, [importType]);

  const parsedMapBounds = useMemo(() => {
    try {
      if (parsedGeoJson) {
        const b = L.geoJSON(parsedGeoJson).getBounds();
        return b && typeof b.isValid === 'function' && b.isValid() ? b : null;
      }
    } catch (e) {
      console.warn("Error calculando bounds:", e);
    }
    return null;
  }, [parsedGeoJson]);

  const [isDragOverBox, setIsDragOverBox] = useState(false);

  const processSelectedFile = (selected) => {
    if (!selected) return;
    const name = selected.name.toLowerCase();
    const isZip = name.endsWith('.zip');

    if (isZip) {
      setFile(selected);
      setUploadStatus(null);
      setPreviewColumns([]);
      setRenames({});
      setIsParsing(true);
      setParsedGeoJson(null);
      setLimitePolygons([]);
      setLimiteAssignments({});
      setStep('config');
      setAnalysisData(null);
      
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target.result;
          const geojson = await shp(buffer);
          const normalizedGeoJson = Array.isArray(geojson) ? geojson[0] : geojson;
          const rawFeatures = (normalizedGeoJson && normalizedGeoJson.features) ? normalizedGeoJson.features : [];

          if (rawFeatures.length > 0) {
            const props = rawFeatures[0].properties || {};
            const cols = Object.keys(props).map(key => ({
              original: key,
              sample: props[key]
            }));
            setPreviewColumns(cols);
            
            // Auto-detect common field names
            const newMap = { 
              cedula: '', 
              nombre_posesionario: '', 
              cod_catastral: '',
              fecha_adjudicacion: '',
              numero_tramite: '',
              institucion: '',
              sector: ''
            };
            cols.forEach(c => {
               const k = c.original.toUpperCase();
               if (k.includes('CEDULA') || k === 'NUMERO_IDE' || k.includes('IDENT') || k.includes('DNI') || k.includes('RUC')) {
                 newMap.cedula = c.original;
               }
               if (k.includes('NOMBRE') || k === 'NOMBRE_PRO' || k.includes('PROP') || k.includes('TITUL') || k.includes('DUENO')) {
                 newMap.nombre_posesionario = c.original;
               }
               if (k.includes('CLAVE') || k.includes('CATAST') || k.includes('NUMERO_PRO') || k === 'COD_PREDIO' || k === 'PREDIO') {
                 newMap.cod_catastral = c.original;
               }
               if (k.includes('FECHA_ADJU') || k.includes('FECHA_ADJ') || k.includes('ADJUDIC')) {
                 newMap.fecha_adjudicacion = c.original;
               }
               if (k.includes('NUMERO_TRA') || k.includes('TRAMITE') || k.includes('EXPEDIENTE') || k.includes('TRAM')) {
                 newMap.numero_tramite = c.original;
               }
               if (k.includes('INSTITUC') || k.includes('ENTIDAD') || k === 'STRTA') {
                 newMap.institucion = c.original;
               }
               if (k.includes('SECTOR') || k === 'SEC' || k.includes('ZONA') || k.includes('BARRIO') || k.includes('RECINTO')) {
                 newMap.sector = c.original;
               }
            });
            setMapping(newMap);
            setParsedGeoJson(normalizedGeoJson);

            // Extraer lista de polígonos para el visualizador de límites
            const detectedPolys = rawFeatures.map((feat, idx) => {
              const fProps = feat.properties || {};
              let detectedName = '';
              let matchedDpa = '';

              const strVals = Object.entries(fProps).map(([k, v]) => `${k}:${v}`).join(' ').toUpperCase();

              if (strVals.includes('CATARAMA') || strVals.includes('120650')) {
                detectedName = 'Catarama';
                matchedDpa = '120650';
              } else if (strVals.includes('RICAURTE') || strVals.includes('120651')) {
                detectedName = 'Ricaurte';
                matchedDpa = '120651';
              } else if (strVals.includes('PIJULLO') || strVals.includes('120652')) {
                detectedName = 'Pijullo';
                matchedDpa = '120652';
              } else if (strVals.includes('URDANETA') || strVals.includes('1206')) {
                detectedName = 'Urdaneta';
                matchedDpa = '1206';
              }

              if (!detectedName) {
                const textEntry = Object.entries(fProps).find(([k, v]) => 
                  typeof v === 'string' && v.trim().length > 1 && !/^\d+$/.test(v.trim())
                );
                detectedName = textEntry ? `${textEntry[1]}` : `Polígono ${idx + 1}`;
              }

              return {
                index: idx,
                feature: feat,
                detectedName,
                matchedDpa,
                properties: fProps,
                positions: extractLeafletPositions(feat.geometry)
              };
            });

            setLimitePolygons(detectedPolys);

            const initialAssign = {};
            detectedPolys.forEach((p, i) => {
              if (importType === 'limite_cantonal') {
                initialAssign[i] = p.matchedDpa || '1206';
              } else if (importType === 'limite_parroquial') {
                initialAssign[i] = p.matchedDpa || (i === 0 ? '120650' : i === 1 ? '120651' : i === 2 ? '120652' : '');
              } else {
                initialAssign[i] = '';
              }
            });
            setLimiteAssignments(initialAssign);
            setSelectedPolyIdx(0);
          }
        } catch (err) {
          console.error("Error parsing SHP", err);
          alert("Error leyendo el Shapefile para previsualización.");
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsArrayBuffer(selected);
      return;
    }

    alert("Por favor selecciona un archivo .zip que contenga el shapefile.");
    setFile(null);
    setPreviewColumns([]);
    setIsParsing(false);
    setParsedGeoJson(null);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleImportError = (data, response, fileType = 'shapefile') => {
    const rawDetail = data?.detail || response?.statusText || 'Error desconocido';
    const isTechnicalError = 
      response?.status >= 500 || 
      /codec can't decode|unicodedecodeerror|traceback|syntaxerror|internal server error|database error|ogr2ogr/i.test(rawDetail);

    if (isTechnicalError) {
      fetch(`${API_URL}/api/system/report-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Falla en importación de ${fileType} (${file?.name || 'archivo'}): ${rawDetail}`,
          user: `${user?.username || user?.nombre || 'Usuario'} (ID: ${user?.id || user?.id_usuario || 'N/A'})`,
          url: window.location.href
        })
      }).catch(err => console.error("Error reportando a soporte:", err));

      setUploadStatus({
        type: 'error',
        message: 'Ocurrió un error inesperado al procesar el archivo. Se ha enviado una alerta por correo al equipo de soporte. Por favor, consulte con soporte técnico.'
      });
    } else {
      setUploadStatus({
        type: 'error',
        message: rawDetail
      });
    }
  };

  // Step 1 -> Step 2: Analizar Shapefile para detectar conflictos y nuevos predios
  const handleStartAnalysis = async () => {
    if (!file) return;

    if (isSuperAdmin && !selectedEmpresa) {
      alert("Por favor selecciona una Empresa.");
      return;
    }

    // Caso Capa Adicional, Límites o CAD DXF: Subida directa sin resolución de predios
    if (importType === 'capa_adicional' || importType === 'limite_cantonal' || importType === 'limite_parroquial' || file.name.toLowerCase().endsWith('.dxf')) {
      handleDirectUpload();
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    const empId = isSuperAdmin ? selectedEmpresa : (user?.empresa_id || 0);
    const url = `${API_URL}/api/gis/analizar-shapefile?empresa_id=${empId}&mapping=${encodeURIComponent(JSON.stringify(mapping))}&renames=${encodeURIComponent(JSON.stringify(renames))}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        setAnalysisData(data);
        
        // Inicializar acciones de conflicto: por defecto sugerir 'reemplazar'
        const initialActions = {};
        (data.conflictos || []).forEach(c => {
          initialActions[c.temp_id] = 'reemplazar';
        });
        setConflictActions(initialActions);

        // Inicializar predios nuevos: todos seleccionados por defecto
        const initialNewIds = new Set((data.nuevos || []).map(n => n.temp_id));
        setSelectedNewIds(initialNewIds);

        setStep('resolution');
      } else {
        handleImportError(data, response, 'Shapefile ZIP');
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: 'Error de conexión al analizar el shapefile con el servidor.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2: Confirmar e importar según las decisiones del usuario
  const handleConfirmImport = async () => {
    if (!analysisData) return;

    setIsUploading(true);
    setUploadStatus(null);

    const empId = isSuperAdmin ? selectedEmpresa : (user?.empresa_id || 0);
    const taskId = `shp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const totalToImport = selectedNewIds.size + Object.values(conflictActions).filter(a => a === 'reemplazar').length;
    setImportProgress({ percent: 0, current: 0, total: totalToImport, message: `Iniciando importación de ${totalToImport} predios...` });

    let pollTimer = null;
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/gis/shapefile/progreso/${taskId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          const pData = await res.json();
          setImportProgress({
            percent: pData.progress || 0,
            current: pData.current || 0,
            total: pData.total || totalToImport,
            message: pData.status || 'Procesando...'
          });
        }
      } catch (err) {}
    }, 400);

    const payload = {
      staging_table: analysisData.staging_table,
      empresa_id: empId,
      mapping: mapping,
      conflict_actions: conflictActions,
      selected_new_ids: Array.from(selectedNewIds),
      fecha_creacion: fechaVigencia ? `${fechaVigencia}T00:00:00` : null,
      proyecto_id: activeProyecto?.id || null,
      task_id: taskId
    };

    try {
      const response = await fetch(`${API_URL}/api/gis/confirmar-importacion`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        const details = data.data || {};
        const numAjustados = details.codigos_ajustados || 0;
        const advertencias = details.advertencias || [];
        
        let successMsg = 'Shapefile procesado e importado correctamente.';
        if (numAjustados > 0) {
          successMsg = `Importación completada: ${details.predios_creados} creados, ${numAjustados} códigos repetidos diferenciados automáticamente.`;
        }

        showSuccess(successMsg);
        setUploadStatus({
          type: 'success',
          message: successMsg,
          details: {
            predios_reemplazados: details.predios_reemplazados || 0,
            predios_omitidos: details.predios_omitidos || 0,
            predios_creados: details.predios_creados || 0,
            codigos_ajustados: numAjustados,
            vertices_creados: details.vertices_creados || 0,
            lineas_creadas: details.lineas_creadas || 0,
            advertencias: advertencias
          }
        });
        setStep('completed');
        if (onSuccess) onSuccess();
      } else {
        handleImportError(data, response, 'Confirmación de Importación');
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: 'Error de conexión al confirmar la importación.' });
    } finally {
      if (pollTimer) clearInterval(pollTimer);
      setIsUploading(false);
    }
  };

  // Carga directa para capa adicional o CAD
  const handleDirectUpload = async () => {
    setIsUploading(true);
    setUploadStatus(null);

    // Caso Archivo CAD DXF
    if (file.name.toLowerCase().endsWith('.dxf')) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(`${API_URL}/api/gis/import-dxf`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` },
          body: formData
        });
        const data = await response.json();
        if (response.ok) {
          showSuccess(`Archivo CAD DXF importado exitosamente (${data?.data?.total_entidades || 0} entidades en ${data?.data?.capas_detectadas?.length || 0} capas).`);
          setUploadStatus({ type: 'success', message: 'Importación CAD DXF completada con éxito.' });
          setStep('completed');
          if (onSuccess) onSuccess();
        } else {
          handleImportError(data, response, 'CAD DXF');
        }
      } catch (error) {
        setUploadStatus({ type: 'error', message: 'Error de conexión al importar DXF.' });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("import_type", importType);
    if (nombreCapa) formData.append("nombre_capa", nombreCapa);
    
    // Inyectar asignaciones manuales del visualizador si aplican
    if ((importType === 'limite_cantonal' || importType === 'limite_parroquial') && Object.keys(limiteAssignments).length > 0) {
      formData.append("limite_assignments", JSON.stringify(limiteAssignments));
    }

    const empId = isSuperAdmin ? selectedEmpresa : (user?.empresa_id || 0);
    let url = `${API_URL}/api/gis/import-shapefile?empresa_id=${empId}&mapping=${encodeURIComponent(JSON.stringify(mapping))}&renames=${encodeURIComponent(JSON.stringify(renames))}`;
    if (fechaVigencia) url += `&fecha_creacion=${fechaVigencia}T00:00:00`;
    if (activeProyecto?.id) url += `&proyecto_id=${activeProyecto.id}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        const isLimits = importType === 'limite_cantonal' || importType === 'limite_parroquial';
        const msg = isLimits 
          ? `Límites territoriales (${importType === 'limite_cantonal' ? 'Cantonal' : 'Parroquial'}) guardados y vinculados a la DPA con éxito.`
          : 'Capa importada correctamente.';
        showSuccess(msg);
        setUploadStatus({ type: 'success', message: msg });
        setStep('completed');
        if (onSuccess) onSuccess();
      } else {
        handleImportError(data, response, 'Importación');
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: 'Error de conexión con el servidor.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVisualizarTemporal = () => {
    if (parsedGeoJson && onAddTemporalLayer) {
      onAddTemporalLayer(parsedGeoJson, file.name || 'Capa Temporal');
      onClose();
    }
  };

  // Helper para asignar acción rápida a todos los conflictos
  const handleSetAllConflicts = (action) => {
    const updated = {};
    (analysisData?.conflictos || []).forEach(c => {
      updated[c.temp_id] = action;
    });
    setConflictActions(updated);
  };

  // Helper para marcar / desmarcar todos los nuevos
  const handleToggleAllNew = (select) => {
    if (select) {
      setSelectedNewIds(new Set((analysisData?.nuevos || []).map(n => n.temp_id)));
    } else {
      setSelectedNewIds(new Set());
    }
  };

  // Helper para omitir copias de códigos repetidos y conservar solo el 1°
  const handleKeepFirstOfDuplicates = () => {
    if (!analysisData?.nuevos) return;
    const kept = new Set();
    analysisData.nuevos.forEach(item => {
      if (!item.es_codigo_repetido || item.repeticion_index === 1) {
        kept.add(item.temp_id);
      }
    });
    setSelectedNewIds(kept);
  };

  const toggleNewPredio = (tempId) => {
    const updated = new Set(selectedNewIds);
    if (updated.has(tempId)) {
      updated.delete(tempId);
    } else {
      updated.add(tempId);
    }
    setSelectedNewIds(updated);
  };

  return (
    <div 
      className="shapefile-uploader-overlay" 
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div 
        className="shapefile-uploader-modal"
        style={{ 
          maxWidth: (step === 'resolution' || ((importType === 'limite_cantonal' || importType === 'limite_parroquial') && limitePolygons.length > 0)) ? '1180px' : '900px', 
          transition: 'max-width 0.3s ease' 
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <button className="close-btn" onClick={onClose}><X size={20} /></button>

        {/* HEADER */}
        <h2>
          {step === 'resolution' ? 'Comparativa y Selección de Predios' : 
           ((importType === 'limite_cantonal' || importType === 'limite_parroquial') && limitePolygons.length > 0)
            ? 'Previsualización y Asignación de Límites'
            : 'Importar Shapefile de Polígonos'}
        </h2>
        <p className="subtitle">
          {step === 'resolution' 
            ? 'Revisa los predios que coinciden en el mismo polígono (conflictos) y selecciona qué predios nuevos deseas crear en la base de datos.'
            : ((importType === 'limite_cantonal' || importType === 'limite_parroquial') && limitePolygons.length > 0)
            ? 'Verifica los polígonos detectados en el mapa y selecciona a qué cantón o parroquia DPA corresponde cada uno antes de guardarlo.'
            : 'Sube un archivo .zip que contenga el shapefile (.shp, .shx, .dbf, .prj) para generar Predios, Posesionarios, Vértices y Linderos.'
          }
        </p>

        {/* PASO 1: CONFIGURACIÓN Y MAPEO */}
        {step === 'config' && (
          <>
            {isSuperAdmin && (
              <div className="form-group" style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Asignar a Empresa:</label>
                <select className="input-dynamic" value={selectedEmpresa} onChange={(e) => setSelectedEmpresa(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                  <option value="">-- Seleccionar Empresa --</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} {emp.sector ? `(${emp.sector})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Tipo de Importación:</label>
              <select 
                className="input-dynamic" 
                value={importType} 
                onChange={(e) => {
                  const val = e.target.value;
                  setImportType(val);
                  if (val === 'limite_cantonal' && (!nombreCapa || nombreCapa === 'Límite Parroquial' || nombreCapa === 'Capa Sin Nombre')) {
                    setNombreCapa('Límite Cantonal');
                  } else if (val === 'limite_parroquial' && (!nombreCapa || nombreCapa === 'Límite Cantonal' || nombreCapa === 'Capa Sin Nombre')) {
                    setNombreCapa('Límite Parroquial');
                  }
                }}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--card-border)' }}
              >
                <option value="catastro_base">Módulo Catastral Base (Predios, Linderos, Vértices)</option>
                <option value="capa_adicional">Capa Adicional (Visualización genérica)</option>
                <option value="limite_cantonal">Límite Cantonal (Límites)</option>
                <option value="limite_parroquial">Límite Parroquial (Límites)</option>
              </select>
            </div>

            {isModoManual && (
              <div className="form-group" style={{marginBottom: '15px'}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Fecha Histórica (Opcional):</label>
                <input 
                  type="date"
                  className="input-dynamic"
                  value={fechaVigencia}
                  onChange={(e) => setFechaVigencia(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--card-border)' }}
                  title="Si dejas este campo en blanco, se usará la fecha actual."
                />
                <small style={{color: 'var(--text-muted)'}}>Si importas datos históricos, selecciona la fecha a la que corresponden los predios.</small>
              </div>
            )}

            {/* DRAG & DROP BOX */}
            <div 
              className="upload-box" 
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOverBox(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOverBox(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOverBox(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processSelectedFile(e.dataTransfer.files[0]);
                }
              }}
              style={{ 
                border: isDragOverBox ? '2px dashed #2563eb' : (file ? '2px solid var(--primary)' : '2px dashed var(--card-border)'), 
                background: isDragOverBox ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                padding: '30px', 
                textAlign: 'center', 
                borderRadius: '8px', 
                marginBottom: '15px', 
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <UploadCloud size={40} color={isDragOverBox ? "#2563eb" : (file ? "var(--primary)" : "gray")} style={{marginBottom: '10px', transition: 'transform 0.2s', transform: isDragOverBox ? 'scale(1.15)' : 'scale(1)'}} />
              <p style={{margin: 0, fontWeight: isDragOverBox ? 'bold' : 'normal', color: isDragOverBox ? '#2563eb' : 'inherit'}}>
                {file ? file.name : (isDragOverBox ? "¡Suelta tu archivo ZIP aquí!" : "1. Arrastra o selecciona el archivo ZIP aquí")}
              </p>
              <input type="file" accept=".zip" onChange={handleFileChange} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer'}} />
            </div>

            {isParsing && <div style={{textAlign: 'center', margin: '20px 0'}}><Loader2 className="spin" size={24} /> Analizando Shapefile...</div>}

            {(importType === 'capa_adicional' || importType === 'limite_cantonal' || importType === 'limite_parroquial') && file && !isParsing && (
              <div className="form-group" style={{marginBottom: '20px', background: 'var(--bg-lighter)', padding: '15px', borderRadius: '8px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Nombre de la Capa:</label>
                <input 
                  type="text" 
                  className="input-dynamic" 
                  placeholder={
                    importType === 'limite_cantonal' ? "Ej: Límite Cantonal Urdaneta" :
                    importType === 'limite_parroquial' ? "Ej: Límites Parroquiales (Catarama / Ricaurte)" :
                    "Ej: Postes de Luz, Vías Principales..."
                  } 
                  value={nombreCapa}
                  onChange={(e) => setNombreCapa(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--card-border)' }}
                />
              </div>
            )}

            {/* VISUALIZADOR INTERACTIVO Y ASIGNACIÓN MANUAL DE LÍMITES */}
            {(importType === 'limite_cantonal' || importType === 'limite_parroquial') && file && !isParsing && parsedGeoJson && limitePolygons.length > 0 && (
              <div className="limites-visualizer-container" style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.25fr 1fr',
                  gap: '16px',
                  alignItems: 'stretch'
                }}>
                  {/* PANEL IZQUIERDO: MAPA LEAFLET */}
                  <div style={{
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid var(--card-border)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '380px'
                  }}>
                    <div style={{
                      background: 'var(--bg-panel)',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--card-border)'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                        <Compass size={16} color="var(--primary)" />
                        Mapa Interactivo de Polígonos
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '2px 8px', 
                        borderRadius: '10px', 
                        background: 'rgba(37, 99, 235, 0.12)', 
                        color: 'var(--primary)', 
                        fontWeight: '600' 
                      }}>
                        {limitePolygons.length} polígono{limitePolygons.length > 1 ? 's' : ''} cargado{limitePolygons.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div style={{ flex: 1, minHeight: '340px', position: 'relative' }}>
                      <MapContainer
                        style={{ width: '100%', height: '100%', minHeight: '340px' }}
                        zoom={11}
                        center={[-1.58, -79.48]}
                        scrollWheelZoom={true}
                      >
                        <TileLayer
                          attribution='&copy; OpenStreetMap'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {parsedMapBounds && <MapBoundsUpdater bounds={parsedMapBounds} />}
                        {limitePolygons.map((poly, idx) => {
                          const isSelected = selectedPolyIdx === idx;
                          const assignedCode = limiteAssignments[idx];

                          let fillColor = '#06b6d4';
                          if (importType === 'limite_cantonal') {
                            fillColor = '#ef4444';
                          } else if (assignedCode === '120650') {
                            fillColor = '#06b6d4'; // Catarama (Cyan)
                          } else if (assignedCode === '120651') {
                            fillColor = '#10b981'; // Ricaurte (Verde)
                          } else if (assignedCode === '120652') {
                            fillColor = '#8b5cf6'; // Pijullo (Violeta)
                          } else {
                            fillColor = '#64748b'; // Sin asignar (Gris)
                          }

                          return (
                            <Polygon
                              key={`lim_poly_${idx}_${assignedCode}_${isSelected}`}
                              positions={poly.positions}
                              pathOptions={{
                                color: isSelected ? '#f59e0b' : fillColor,
                                weight: isSelected ? 4 : 2,
                                fillColor: fillColor,
                                fillOpacity: isSelected ? 0.65 : 0.35
                              }}
                              eventHandlers={{
                                click: () => setSelectedPolyIdx(idx)
                              }}
                            >
                              <Tooltip sticky>
                                <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                                  <strong style={{ color: '#0f172a' }}>Polígono #{idx + 1}: {poly.detectedName}</strong>
                                  <br />
                                  <span style={{ color: '#334155' }}>
                                    Asignado: {
                                      assignedCode === '120650' ? 'Catarama (120650)' :
                                      assignedCode === '120651' ? 'Ricaurte (120651)' :
                                      assignedCode === '120652' ? 'Pijullo (120652)' :
                                      assignedCode === '1206' ? 'Cantón Urdaneta (1206)' :
                                      'Sin asignar'
                                    }
                                  </span>
                                </div>
                              </Tooltip>
                            </Polygon>
                          );
                        })}
                      </MapContainer>
                    </div>
                  </div>

                  {/* PANEL DERECHO: ASIGNACIÓN MANUAL Y PROPIEDADES */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '410px',
                    border: '1px solid var(--card-border)',
                    borderRadius: '10px',
                    background: 'var(--bg-lighter)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--bg-panel)',
                      borderBottom: '1px solid var(--card-border)',
                      fontWeight: 'bold',
                      fontSize: '0.88rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>Asignación DPA por Polígono</span>
                      <small style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>
                        Click en fila para resaltar en mapa
                      </small>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {limitePolygons.map((poly, idx) => {
                        const isSelected = selectedPolyIdx === idx;
                        const assignedCode = limiteAssignments[idx] || '';

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedPolyIdx(idx)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                              background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--card-bg)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '0.88rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <MapPin size={15} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                                Polígono #{idx + 1}
                              </span>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: poly.matchedDpa ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                color: poly.matchedDpa ? '#10b981' : '#64748b',
                                fontWeight: '600'
                              }}>
                                {poly.matchedDpa ? 'Detectado en DBF' : 'Asignación manual'}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              Atributo en archivo: <strong style={{ color: 'var(--text-main)' }}>{poly.detectedName}</strong>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '3px', color: 'var(--text-muted)' }}>
                                {importType === 'limite_cantonal' ? 'Cantón Oficial (DPA):' : 'Parroquia Oficial (DPA):'}
                              </label>
                              {importType === 'limite_cantonal' ? (
                                <select
                                  value={assignedCode}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setLimiteAssignments(prev => ({ ...prev, [idx]: e.target.value }));
                                  }}
                                  className="input-dynamic"
                                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', borderRadius: '4px' }}
                                >
                                  <option value="1206">🏛️ 1206 - Urdaneta (Los Ríos)</option>
                                  <option value="">-- Sin asignar a DPA (Solo Capa Visual) --</option>
                                </select>
                              ) : (
                                <select
                                  value={assignedCode}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setLimiteAssignments(prev => ({ ...prev, [idx]: e.target.value }));
                                  }}
                                  className="input-dynamic"
                                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem', borderRadius: '4px' }}
                                >
                                  <option value="120650">📍 120650 - Catarama (Cabecera Cantonal)</option>
                                  <option value="120651">📍 120651 - Ricaurte (Parroquia Rural)</option>
                                  <option value="120652">📍 120652 - Pijullo (Parroquia Rural)</option>
                                  <option value="">-- Sin asignar a DPA (Solo Capa Visual) --</option>
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TABLA DE MAPEO AMPLIADA */}
            {importType === 'catastro_base' && previewColumns.length > 0 && (
              <div className="mapping-section" style={{marginBottom: '20px', background: 'var(--bg-lighter)', padding: '15px', borderRadius: '8px'}}>
                <h3 style={{marginBottom: '8px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <Eye size={18} color="var(--primary)" /> Previsualización y Mapeo de Columnas
                </h3>
                <p style={{margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                  Vincula las columnas de tu archivo a los campos del sistema para que se guarden correctamente.
                </p>
                
                <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '6px' }}>
                  <table className="logs-table" style={{width: '100%', fontSize: '0.9rem', margin: 0}}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
                      <tr>
                        <th style={{textAlign: 'left', padding: '10px'}}>Columna Original</th>
                        <th style={{textAlign: 'left', padding: '10px'}}>Valor de Ejemplo</th>
                        <th style={{textAlign: 'left', padding: '10px'}}>Vincular A (Sistema)</th>
                        <th style={{textAlign: 'left', padding: '10px'}}>Renombrar como (Opcional)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewColumns.map((col, idx) => {
                        const currentKey = Object.keys(mapping).find(k => mapping[k] === col.original) || '';
                        return (
                          <tr key={idx}>
                            <td style={{fontWeight: 'bold', color: 'var(--primary)'}}>{col.original}</td>
                            <td style={{color: 'var(--text-muted)'}}>{String(col.sample || '').substring(0, 30)}</td>
                            <td>
                              <select 
                                className="input-dynamic" 
                                style={{padding: '5px', width: '100%'}}
                                value={currentKey}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newMap = { ...mapping };
                                  // Limpiar asignación previa de esta columna
                                  Object.keys(newMap).forEach(k => {
                                    if (newMap[k] === col.original) newMap[k] = '';
                                  });
                                  if (val) {
                                    newMap[val] = col.original;
                                  }
                                  setMapping(newMap);
                                }}
                              >
                                <option value="">-- No vincular --</option>
                                <option value="cod_catastral">Código Catastral</option>
                                <option value="nombre_posesionario">Nombre Propietario</option>
                                <option value="cedula">Cédula</option>
                                <option value="fecha_adjudicacion">Fecha de Adjudicación</option>
                                <option value="numero_tramite">Número de Trámite</option>
                                <option value="institucion">Institución</option>
                                <option value="sector">Sector</option>
                              </select>
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="input-dynamic" 
                                style={{padding: '5px', width: '100%'}} 
                                placeholder={col.original}
                                value={renames[col.original] || ''}
                                onChange={(e) => setRenames({...renames, [col.original]: e.target.value})}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* PASO 2: RESOLUCIÓN DE CONFLICTOS Y SELECCIÓN DE PREDIOS */}
        {step === 'resolution' && analysisData && (
          <div className="resolution-section" style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
            {/* RESUMEN DEL ANÁLISIS */}
            <div style={{
              display: 'flex', gap: '15px', flexWrap: 'wrap',
              background: 'var(--bg-lighter)', padding: '15px', borderRadius: '8px', border: '1px solid var(--card-border)'
            }}>
              <div style={{flex: 1, minWidth: '180px'}}>
                <small style={{color: 'var(--text-muted)'}}>Total Polígonos en Archivo:</small>
                <div style={{fontSize: '1.4rem', fontWeight: 'bold'}}>{analysisData.total_features}</div>
              </div>
              <div style={{flex: 1, minWidth: '180px'}}>
                <small style={{color: 'var(--text-muted)'}}>Coincidentes en el Mismo Polígono:</small>
                <div style={{fontSize: '1.4rem', fontWeight: 'bold', color: analysisData.conflictos?.length > 0 ? '#f59e0b' : '#10b981'}}>
                  {analysisData.conflictos?.length || 0}
                </div>
              </div>
              <div style={{flex: 1, minWidth: '180px'}}>
                <small style={{color: 'var(--text-muted)'}}>Predios Nuevos Detectados:</small>
                <div style={{fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)'}}>
                  {analysisData.nuevos?.length || 0}
                </div>
              </div>
            </div>

            {/* AVISO DE CÓDIGOS CATASTRALES REPETIDOS EN EL ARCHIVO */}
            {analysisData?.duplicados_internos && analysisData.duplicados_internos.length > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <AlertTriangle size={22} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#d97706', fontSize: '0.95rem' }}>
                    Aviso: Se detectaron {analysisData.duplicados_internos.length} códigos catastrales repetidos en el archivo
                  </div>
                  <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                    La base de datos requiere códigos únicos por predio. Si decides importarlos todos, el sistema les asignará automáticamente un sufijo único (ej: <code>-1</code>, <code>-2</code>) para conservar todos los polígonos sin que se produzca ningún error. O si prefieres, puedes omitir las copias repetidas con un solo clic:
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleKeepFirstOfDuplicates}
                      style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                    >
                      <Slash size={13} /> Conservar solo el 1° de cada código repetido
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleToggleAllNew(true)}
                      style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <CheckSquare size={13} /> Importar todos (diferenciación automática -1, -2)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN A: CONFLICTOS / MISMO POLÍGONO */}
            {analysisData.conflictos && analysisData.conflictos.length > 0 && (
              <div style={{background: 'var(--bg-lighter)', padding: '15px', borderRadius: '8px', border: '1px solid #f59e0b40'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px'}}>
                  <div>
                    <h3 style={{margin: 0, fontSize: '1.05rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <AlertTriangle size={18} /> Predios Coincidentes en el Mismo Polígono ({analysisData.conflictos.length})
                    </h3>
                    <small style={{color: 'var(--text-muted)'}}>
                      Estos predios ya existen en el sistema en la misma ubicación. Decide si deseas reemplazar sus datos o conservarlos (omitir).
                    </small>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleSetAllConflicts('reemplazar')} 
                      style={{padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px'}}
                    >
                      <RefreshCw size={14} /> Reemplazar Todos
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleSetAllConflicts('omitir')} 
                      style={{padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px'}}
                    >
                      <Slash size={14} /> Omitir Todos
                    </button>
                  </div>
                </div>

                <div style={{maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '6px'}}>
                  <table className="logs-table" style={{width: '100%', fontSize: '0.85rem', margin: 0}}>
                    <thead style={{position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1}}>
                      <tr>
                        <th style={{padding: '8px', textAlign: 'left'}}>#</th>
                        <th style={{padding: '8px', textAlign: 'left'}}>Predio Existente en Sistema</th>
                        <th style={{padding: '8px', textAlign: 'left'}}>Predio Nuevo en Archivo</th>
                        <th style={{padding: '8px', textAlign: 'center'}}>Coincidencia</th>
                        <th style={{padding: '8px', textAlign: 'center'}}>Acción a Tomar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisData.conflictos.map((conf, idx) => {
                        const action = conflictActions[conf.temp_id] || 'reemplazar';
                        return (
                          <tr key={idx} style={{background: action === 'omitir' ? 'rgba(100, 116, 139, 0.08)' : 'inherit'}}>
                            <td style={{padding: '8px', color: 'var(--text-muted)'}}>{idx + 1}</td>
                            <td style={{padding: '8px'}}>
                              <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>{conf.existing.codigo}</div>
                              <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                                {conf.existing.propietario} {conf.existing.cedula ? `(${conf.existing.cedula})` : ''}
                              </div>
                              <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                                Área: {conf.existing.area_ha} ha
                              </div>
                            </td>
                            <td style={{padding: '8px'}}>
                              <div style={{fontWeight: 'bold', color: 'var(--primary)'}}>{conf.incoming.codigo}</div>
                              <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                                {conf.incoming.propietario} {conf.incoming.cedula ? `(${conf.incoming.cedula})` : ''}
                              </div>
                              <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                                Área: {conf.incoming.area_ha} ha 
                                {conf.incoming.fecha_adjudicacion ? ` | F. Adju: ${conf.incoming.fecha_adjudicacion}` : ''}
                                {conf.incoming.numero_tramite ? ` | Trámite: ${conf.incoming.numero_tramite}` : ''}
                                {conf.incoming.sector ? ` | Sector: ${conf.incoming.sector}` : ''}
                              </div>
                            </td>
                            <td style={{padding: '8px', textAlign: 'center'}}>
                              <span style={{
                                padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                                background: conf.overlap_pct >= 90 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: conf.overlap_pct >= 90 ? '#10b981' : '#f59e0b'
                              }}>
                                {conf.match_type === 'mismo_poligono' ? 'Mismo Polígono' : `${conf.overlap_pct}% solape`}
                              </span>
                            </td>
                            <td style={{padding: '8px', textAlign: 'center'}}>
                              <div style={{display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--card-border)', overflow: 'hidden'}}>
                                <button
                                  type="button"
                                  onClick={() => setConflictActions({...conflictActions, [conf.temp_id]: 'reemplazar'})}
                                  style={{
                                    padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer', border: 'none',
                                    background: action === 'reemplazar' ? 'var(--primary)' : 'transparent',
                                    color: action === 'reemplazar' ? '#ffffff' : 'var(--text-muted)',
                                    fontWeight: action === 'reemplazar' ? 'bold' : 'normal'
                                  }}
                                  title="Actualiza el predio existente con los datos nuevos"
                                >
                                  Reemplazar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConflictActions({...conflictActions, [conf.temp_id]: 'omitir'})}
                                  style={{
                                    padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer', border: 'none',
                                    background: action === 'omitir' ? '#64748b' : 'transparent',
                                    color: action === 'omitir' ? '#ffffff' : 'var(--text-muted)',
                                    fontWeight: action === 'omitir' ? 'bold' : 'normal'
                                  }}
                                  title="Conserva el predio original en la base de datos"
                                >
                                  Omitir
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECCIÓN B: PREDIOS NUEVOS */}
            {analysisData.nuevos && analysisData.nuevos.length > 0 && (
              <div style={{background: 'var(--bg-lighter)', padding: '15px', borderRadius: '8px', border: '1px solid var(--card-border)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px'}}>
                  <div>
                    <h3 style={{margin: 0, fontSize: '1.05rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <Layers size={18} /> Predios Nuevos a Crear ({analysisData.nuevos.length})
                    </h3>
                    <small style={{color: 'var(--text-muted)'}}>
                      Selecciona las casillas de los predios que deseas ingresar al sistema ({selectedNewIds.size} de {analysisData.nuevos.length} seleccionados).
                    </small>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleToggleAllNew(true)} 
                      style={{padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px'}}
                    >
                      <CheckSquare size={14} /> Marcar Todos
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleToggleAllNew(false)} 
                      style={{padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px'}}
                    >
                      <Square size={14} /> Desmarcar Todos
                    </button>
                  </div>
                </div>

                <div style={{maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '6px'}}>
                  <table className="logs-table" style={{width: '100%', fontSize: '0.85rem', margin: 0}}>
                    <thead style={{position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1}}>
                      <tr>
                        <th style={{padding: '8px', width: '40px', textAlign: 'center'}}>
                          <input 
                            type="checkbox" 
                            checked={selectedNewIds.size === analysisData.nuevos.length && analysisData.nuevos.length > 0}
                            onChange={(e) => handleToggleAllNew(e.target.checked)}
                          />
                        </th>
                        <th style={{padding: '8px', textAlign: 'left'}}>Código Catastral</th>
                        <th style={{padding: '8px', textAlign: 'left'}}>Propietario / Titular</th>
                        <th style={{padding: '8px', textAlign: 'left'}}>Cédula / RUC</th>
                        <th style={{padding: '8px', textAlign: 'left'}}>Área</th>
                        <th style={{padding: '8px', textAlign: 'left'}}>Datos Adicionales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisData.nuevos.map((item, idx) => {
                        const isChecked = selectedNewIds.has(item.temp_id);
                        return (
                          <tr 
                            key={idx} 
                            style={{background: isChecked ? 'inherit' : 'rgba(100, 116, 139, 0.08)', cursor: 'pointer'}}
                            onClick={() => toggleNewPredio(item.temp_id)}
                          >
                            <td style={{padding: '8px', textAlign: 'center'}} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => toggleNewPredio(item.temp_id)}
                              />
                            </td>
                            <td style={{padding: '8px', fontWeight: 'bold', color: 'var(--primary)'}}>
                              <div style={{display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap'}}>
                                <span>{item.codigo}</span>
                                {item.es_codigo_repetido && (
                                  <span style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: item.repeticion_index === 1 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.18)',
                                    color: item.repeticion_index === 1 ? '#2563eb' : '#d97706',
                                    fontWeight: 'bold',
                                    border: `1px solid ${item.repeticion_index === 1 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                  }} title={item.repeticion_index === 1 ? 'Primer registro con este código' : `Registro #${item.repeticion_index} repetido con el mismo código`}>
                                    {item.repeticion_index === 1 ? '1° Original' : `Repetido #${item.repeticion_index}`}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{padding: '8px'}}>{item.propietario}</td>
                            <td style={{padding: '8px'}}>{item.cedula || '-'}</td>
                            <td style={{padding: '8px'}}>{item.area_ha} ha</td>
                            <td style={{padding: '8px', fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                              {item.fecha_adjudicacion ? `F. Adju: ${item.fecha_adjudicacion} ` : ''}
                              {item.numero_tramite ? `Trámite: ${item.numero_tramite} ` : ''}
                              {item.institucion ? `Inst: ${item.institucion} ` : ''}
                              {item.sector ? `Sector: ${item.sector} ` : ''}
                              {!item.fecha_adjudicacion && !item.numero_tramite && !item.institucion && !item.sector ? '-' : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATUS BANNER */}
        {uploadStatus && (
          <div className={`status-banner ${uploadStatus.type}`} style={{
            padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'flex-start',
            margin: '15px 0', background: uploadStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: uploadStatus.type === 'success' ? '#10b981' : '#ef4444',
            border: `1px solid ${uploadStatus.type === 'success' ? '#10b981' : '#ef4444'}`
          }}>
            {uploadStatus.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <div>
              <strong style={{display: 'block', marginBottom: uploadStatus.details ? '10px' : '0'}}>{uploadStatus.message}</strong>
              {uploadStatus.details && (
                <div>
                  <ul className="details-list" style={{margin: 0, paddingLeft: '20px', fontSize: '0.9rem'}}>
                    <li>Predios reemplazados: <b>{uploadStatus.details.predios_reemplazados}</b></li>
                    <li>Predios nuevos creados: <b>{uploadStatus.details.predios_creados}</b></li>
                    <li>Predios omitidos: <b>{uploadStatus.details.predios_omitidos}</b></li>
                    {uploadStatus.details.codigos_ajustados > 0 && (
                      <li style={{color: '#d97706'}}>
                        Códigos repetidos diferenciados automáticamente: <b>{uploadStatus.details.codigos_ajustados}</b>
                      </li>
                    )}
                    <li>Vértices generados: <b>{uploadStatus.details.vertices_creados}</b></li>
                    <li>Líneas generadas: <b>{uploadStatus.details.lineas_creadas}</b></li>
                  </ul>

                  {uploadStatus.details.advertencias && uploadStatus.details.advertencias.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      maxHeight: '140px',
                      overflowY: 'auto',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '0.8rem'
                    }}>
                      <strong style={{ display: 'block', color: '#b45309', marginBottom: '6px' }}>
                        ⚠️ Detalle de códigos repetidos ajustados ({uploadStatus.details.advertencias.length}):
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                        {uploadStatus.details.advertencias.map((adv, i) => (
                          <li key={i} style={{ marginBottom: '3px' }}>{adv}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BARRA DE PROGRESO EN TIEMPO REAL */}
        {isUploading && (
          <div style={{
            margin: '18px 0 10px 0',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="spin" style={{ color: 'var(--primary)' }} />
                {importProgress.message || 'Procesando importación de predios...'}
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>
                {importProgress.percent}%
              </span>
            </div>

            {/* Contenedor de la barra */}
            <div style={{
              width: '100%',
              height: '10px',
              backgroundColor: 'rgba(203, 213, 225, 0.4)',
              borderRadius: '999px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, importProgress.percent))}%`,
                background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
                borderRadius: '999px',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 10px rgba(37, 99, 235, 0.5)'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>
                {importProgress.total > 0 
                  ? `Progreso: ${importProgress.current} de ${importProgress.total} predios procesados` 
                  : 'Preparando entidades geográficas...'}
              </span>
              <span>En tiempo real</span>
            </div>
          </div>
        )}

        {/* MODAL ACTIONS FOOTER */}
        <div className="modal-actions" style={{display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '20px'}}>
          <div>
            {step === 'config' && onAddTemporalLayer && (
              <button 
                className="btn-secondary" 
                onClick={handleVisualizarTemporal} 
                disabled={!parsedGeoJson || isUploading || isParsing} 
                style={{padding: '10px 20px', background: 'var(--card-bg)', border: '1px solid var(--accent-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'}}
                title="Mostrar esta capa en el mapa sin guardarla en la Base de Datos"
              >
                <Eye size={16} /> Visualizar Temporalmente
              </button>
            )}
            {step === 'resolution' && (
              <button 
                className="btn-secondary" 
                onClick={() => setStep('config')} 
                disabled={isUploading}
                style={{padding: '10px 20px', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}
              >
                <ArrowLeft size={16} /> Modificar Mapeo
              </button>
            )}
          </div>

          <div style={{display: 'flex', gap: '10px'}}>
            <button className="btn-secondary" onClick={onClose} disabled={isUploading} style={{padding: '10px 20px', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer'}}>
              {step === 'completed' ? 'Cerrar' : 'Cancelar'}
            </button>

            {step === 'config' && (
              <button 
                className="btn-dynamic" 
                onClick={handleStartAnalysis} 
                disabled={!file || isUploading || isParsing} 
                style={{
                  padding: '10px 22px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  background: (importType === 'limite_cantonal' || importType === 'limite_parroquial') 
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' 
                    : undefined,
                  boxShadow: (importType === 'limite_cantonal' || importType === 'limite_parroquial') 
                    ? '0 4px 14px rgba(16, 185, 129, 0.35)' 
                    : undefined
                }}
              >
                {isUploading ? (
                  <><Loader2 size={16} className="spin" /> Guardando en Base de Datos...</>
                ) : (importType === 'limite_cantonal' || importType === 'limite_parroquial') ? (
                  <><Check size={18} /> Confirmar y Guardar Límites en BD</>
                ) : (
                  <>Continuar <ArrowRight size={16} /></>
                )}
              </button>
            )}

            {step === 'resolution' && (
              <button 
                className="btn-dynamic" 
                onClick={handleConfirmImport} 
                disabled={isUploading || (selectedNewIds.size === 0 && Object.values(conflictActions).every(a => a === 'omitir'))} 
                style={{padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px'}}
              >
                {isUploading ? <><Loader2 size={16} className="spin" /> Procesando Importación ({importProgress.percent}%)...</> : <>Confirmar e Importar ({Object.values(conflictActions).filter(a => a === 'reemplazar').length} Reemplazos, {selectedNewIds.size} Nuevos)</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
