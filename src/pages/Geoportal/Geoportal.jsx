import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ScaleControl, useMapEvents, Polyline, CircleMarker, Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Maximize, Search, Save, Layers, Target, Eye, EyeOff, Trash2, X, Download, User, TableProperties, MousePointer2, UploadCloud, Loader2, FolderSearch, AlertCircle, CheckCircle2, Ruler, Edit, Menu, Navigation, ChevronDown, ChevronRight, DownloadCloud, Upload, ZoomIn, ZoomOut, Scan } from 'lucide-react';
import proj4 from 'proj4';
import shpwrite from '@mapbox/shp-write';
import shp from 'shpjs';
import { API_URL } from '../../services/api';
import { confirmDelete, showSuccess, showError } from '../../utils/swal';
import './Geoportal.css';
import PredioForm from '../../components/MapViewer/PredioForm';
import AttributeTable from '../../components/AttributeTable';
import MeasureTool from '../../components/MapViewer/MeasureTool';
import DrawPolygonTool from '../../components/MapViewer/DrawPolygonTool';
import QgisStatusBar from '../../components/MapViewer/QgisStatusBar';
import S3BrowserModal from '../../components/S3BrowserModal';
import ShapefileUploader from '../../components/MapViewer/ShapefileUploader';

// --- NEW COMPONENT FOR BOX ZOOM ---
const BoxZoomHandler = ({ isActive, setIsActive }) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (!isActive) {
      if (map && map.boxZoom && !map.boxZoom.enabled()) {
        map.boxZoom.enable();
      }
      return;
    }
    
    let box = null;
    let startLatLng = null;

    const onMouseDown = (e) => {
      if (e.originalEvent.button !== 0) return; // solo click izquierdo
      map.dragging.disable();
      startLatLng = e.latlng;
      box = L.rectangle([startLatLng, startLatLng], { color: '#0078ff', weight: 2, fillOpacity: 0.2, interactive: false }).addTo(map);
    };

    const onMouseMove = (e) => {
      if (!startLatLng || !box) return;
      box.setBounds([startLatLng, e.latlng]);
    };

    const onMouseUp = (e) => {
      if (!startLatLng || !box) return;
      const bounds = box.getBounds();
      map.removeLayer(box);
      startLatLng = null;
      box = null;
      map.dragging.enable();
      
      if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
         setIsActive(false);
         return;
      }
      map.fitBounds(bounds);
      setIsActive(false);
    };

    map.getContainer().style.cursor = 'crosshair';
    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.getContainer().style.cursor = '';
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      if (box) map.removeLayer(box);
      map.dragging.enable();
    };
  }, [isActive, map, setIsActive]);

  return null;
};

function MapContextMenu({ onAction }) {
  const [contextMenu, setContextMenu] = React.useState(null);

  useMapEvents({
    contextmenu(e) {
      setContextMenu({
        mouseX: e.originalEvent.clientX,
        mouseY: e.originalEvent.clientY,
        latlng: e.latlng
      });
    },
    click() {
      if (contextMenu) setContextMenu(null);
    },
    dragstart() {
      if (contextMenu) setContextMenu(null);
    }
  });

  if (!contextMenu) return null;

  return (
    <div style={{
      position: 'fixed',
      top: contextMenu.mouseY,
      left: contextMenu.mouseX,
      zIndex: 9999,
      background: 'var(--bg-panel)',
      border: '1px solid var(--card-border)',
      borderRadius: '8px',
      padding: '5px 0',
      minWidth: '200px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div 
        onClick={(e) => { e.stopPropagation(); onAction('add_predio', contextMenu.latlng); setContextMenu(null); }}
        style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Plus size={16} color="#34d399" /> Agregar Predio
      </div>
      <div 
        onClick={(e) => { e.stopPropagation(); onAction('measure', contextMenu.latlng); setContextMenu(null); }}
        style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Ruler size={16} color="#60a5fa" /> Medir Distancia
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '5px 0' }}></div>
      <div 
        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${contextMenu.latlng.lat.toFixed(6)}, ${contextMenu.latlng.lng.toFixed(6)}`); setContextMenu(null); showSuccess('Coordenadas copiadas'); }}
        style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Target size={16} color="#fbbf24" /> Copiar Coordenadas
      </div>
    </div>
  );
}

function MapInteractionHandler({ onInteraction }) {
  useMapEvents({
    click: onInteraction,
    dragstart: onInteraction,
    contextmenu: onInteraction,
  });
  return null;
}

function FeatureContextMenuComponent({ context, onClose, onAction }) {
  if (!context) return null;

  return (
    <>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, pointerEvents: 'auto' }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div style={{
        position: 'fixed',
        top: context.mouseY,
        left: context.mouseX,
        zIndex: 9999,
        background: 'var(--bg-panel)',
        border: '1px solid var(--card-border)',
        borderRadius: '8px',
        padding: '5px 0',
        minWidth: '200px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto'
      }}>
        <div style={{ padding: '5px 15px', fontSize: '0.8rem', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '5px' }}>
          Predio: {context.feature.properties.cod_catastral || 'N/A'}
        </div>
        <div 
          onClick={(e) => { e.stopPropagation(); onAction('zoom', context.feature); onClose(); }}
          style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Target size={16} color="#fbbf24" /> Acercar al Predio
        </div>
        <div 
          onClick={(e) => { e.stopPropagation(); onAction('table', context.feature); onClose(); }}
          style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <TableProperties size={16} color="#eab308" /> Tabla de Atributos
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '5px 0' }}></div>
        <div 
          onClick={(e) => { e.stopPropagation(); onAction('edit', context.feature); onClose(); }}
          style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Edit size={16} color="#3b82f6" /> Editar Predio
        </div>
        <div 
          onClick={(e) => { e.stopPropagation(); onAction('hide', context.feature); onClose(); }}
          style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <EyeOff size={16} color="#94a3b8" /> Ocultar Predio
        </div>
        <div 
          onClick={(e) => { e.stopPropagation(); onAction('export', context.feature); onClose(); }}
          style={{ padding: '10px 15px', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <DownloadCloud size={16} color="#10b981" /> Exportar a Shapefile
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '5px 0' }}></div>
        <div 
          onClick={(e) => { e.stopPropagation(); onAction('delete', context.feature); onClose(); }}
          style={{ padding: '10px 15px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,0,0,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 size={16} color="#ef4444" /> Eliminar Predio
        </div>
      </div>
    </>
  );
}

// Define UTM Zone 17S
proj4.defs("EPSG:32717","+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

export default function Geoportal() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('catastro_token'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarContextMenu, setSidebarContextMenu] = useState(null);
  const [map, setMap] = useState(null);
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');
  const [showShapefileUploader, setShowShapefileUploader] = useState(false);
  
  // Current user info might be stored in localStorage or available via context/props
  // Attempting to decode JWT token to get user info if not passed down:
  const getDecodedUser = () => {
    try {
      const token = localStorage.getItem('catastro_token');
      if (!token) return null;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };
  
  const [currentUser] = useState(getDecodedUser());

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    
    // Observar cambios en el tema
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          setTheme(document.documentElement.getAttribute('data-theme') || 'light');
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!authToken) {
      window.location.href = "/";
    }
  }, [authToken]);

  const [activeTasks, setActiveTasks] = useState([]);
  const [catalogData, setCatalogData] = useState(null);
  const [activeTableData, setActiveTableData] = useState(null);
  
  const [collapsedCategories, setCollapsedCategories] = useState({
    vectores: false,
    raster: false,
    ortofotos: false,
    metadatos: false
  });
  const toggleCategory = (cat) => setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  // Estados para dibujo manual de predio
  const [isDrawingPredio, setIsDrawingPredio] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [tempPredioFormData, setTempPredioFormData] = useState(null);

  const deleteOrthophoto = async (filename) => {
    const isConfirmed = await confirmDelete(`¿Eliminar permanentemente ${filename} del servidor?`);
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_URL}/api/gis/ortofotos/${filename}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setToastMsg({ type: 'success', title: 'Eliminado', message: `${filename} borrado` });
        const catRes = await fetch(`${API_URL}/api/gis/catalog`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        setCatalogData(await catRes.json());
      } else {
        setToastMsg({ type: 'error', title: 'Error', message: 'No se pudo borrar' });
      }
    } catch(e) { console.error(e); }
  };
  
  // Datos Vectoriales Catastrales
  const [prediosData, setPrediosData] = useState(null);
  const [verticesData, setVerticesData] = useState(null);
  const [lineasData, setLineasData] = useState(null);
  const [importedShapes, setImportedShapes] = useState(null);
  const shapefileInputRef = useRef(null);

  // Filtros y Visibilidad
  const [selectedYear, setSelectedYear] = useState('Todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [hiddenFeatureIds, setHiddenFeatureIds] = useState([]);
  const [listDisplayMode, setListDisplayMode] = useState('codigo'); // 'codigo' o 'nombre'

  // Visibilidades
  const [showFootprints, setShowFootprints] = useState(false);
  const [showMasterOrthophoto, setShowMasterOrthophoto] = useState(false);
  const [ortofotoOpacity, setOrtofotoOpacity] = useState(1);
  const [showPredios, setShowPredios] = useState(false);
  const [showVertices, setShowVertices] = useState(false);
  const [showLineas, setShowLineas] = useState(false);
  
  // CRUD Predios
  const [isAddingPredio, setIsAddingPredio] = useState(false);
  const [editingPredio, setEditingPredio] = useState(null);
  const [featureContextMenu, setFeatureContextMenu] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  
  // Búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const sanitizeForShp = (features) => {
    return features.map(f => {
      const newProps = {};
      if (f.properties) {
        Object.keys(f.properties).forEach(k => {
          let val = f.properties[k];
          if (val === null || val === undefined) {
            val = '';
          } else if (typeof val === 'object') {
            val = JSON.stringify(val);
          }
          newProps[k] = val;
        });
      }
      return { ...f, properties: newProps };
    });
  };

  const handleExportAll = () => {
    let allFeatures = [];
    if (prediosData && prediosData.features) allFeatures = [...allFeatures, ...prediosData.features];
    if (lineasData && lineasData.features) allFeatures = [...allFeatures, ...lineasData.features];
    if (verticesData && verticesData.features) allFeatures = [...allFeatures, ...verticesData.features];

    if (allFeatures.length === 0) {
      setToastMsg({ type: 'error', title: 'Exportar', message: 'No hay datos para exportar' });
      return;
    }
    const combinedGeoJSON = {
      type: 'FeatureCollection',
      features: sanitizeForShp(allFeatures)
    };
    const options = {
      outputType: 'blob',
      types: { 
        point: 'vertices',
        polygon: 'predios',
        line: 'linderos'
      }
    };
    Promise.resolve(shpwrite.zip(combinedGeoJSON, options)).then(content => {
      if (content && typeof content.generateAsync === 'function') return content.generateAsync({ type: 'blob' });
      if (content && typeof content.generate === 'function') return content.generate({ type: 'blob' });
      return content;
    }).then(blob => {
      const finalBlob = blob instanceof Blob ? blob : new Blob([blob], { type: 'application/zip' });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catastro_export.zip';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleImportShapefile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const geojson = await shp(buffer);
        setImportedShapes(geojson);
        setToastMsg({ type: 'success', title: 'Importado', message: 'Shapefile cargado al mapa visualmente.' });
        
        if (map && geojson.features && geojson.features.length > 0) {
          const group = L.geoJSON(geojson);
          map.fitBounds(group.getBounds());
        }
      } catch (err) {
        console.error(err);
        setToastMsg({ type: 'error', title: 'Error', message: 'Error leyendo Shapefile ZIP.' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  // Ubicación en tiempo real
  useEffect(() => {
    if (!map) return;
    map.on('locationfound', (e) => {
      setUserLocation(e.latlng);
      
      // Solo centramos la cámara la primera vez
      if (!window.isFirstLocationFound) {
        map.flyTo(e.latlng, 18);
        window.isFirstLocationFound = true;
      }

      // Solo mostramos el toast una vez
      if (!window.hasShownLocationToast) {
        setToastMsg({ type: 'success', title: 'Ubicación Activa', message: 'Mostrando tu posición en tiempo real' });
        window.hasShownLocationToast = true;
      }
    });
    map.on('locationerror', (e) => {
      if (!window.isSecureContext) {
        setToastMsg({ type: 'error', title: 'Permiso Denegado', message: 'Por seguridad, los navegadores bloquean la ubicación en conexiones HTTP (no seguras) a menos que sea localhost.' });
      } else {
        setToastMsg({ type: 'error', title: 'Error de Ubicación', message: e.message || "No se pudo obtener la ubicación o fue denegada." });
      }
    });
    return () => {
      map.off('locationfound');
      map.off('locationerror');
    };
  }, [map]);

  const fetchMapData = async () => {
    let url = `${API_URL}/api/gis/predios`;
    if (fechaInicio || fechaFin) {
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fecha_inicio', fechaInicio + ' 00:00:00');
      if (fechaFin) params.append('fecha_fin', fechaFin + ' 23:59:59');
      url += `?${params.toString()}`;
    }
    try {
      const prediosRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (prediosRes.ok) {
        const prediosGeoJSON = await prediosRes.json();
        setPrediosData(prediosGeoJSON);
      }
    } catch (err) { console.error(err); }
  };

  const handleSavePredio = async (predioData) => {
    const isUpdate = !!editingPredio;
    const url = isUpdate ? `${API_URL}/api/gis/predios/${editingPredio.id}` : `${API_URL}/api/gis/predios`;
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(predioData)
      });
      if (res.ok) {
        setToastMsg({ type: 'success', title: 'Éxito', message: 'Predio guardado correctamente' });
        setIsAddingPredio(false);
        setEditingPredio(null);
        // Recargar predios
        setPrediosData(null);
        if (showPredios) togglePredios();
      } else {
        const err = await res.json();
        setToastMsg({ type: 'error', title: 'Error', message: err.detail });
      }
    } catch (e) {
      setToastMsg({ type: 'error', title: 'Error', message: e.message });
    }
  };

  const handleDeletePredio = async (id, codigo) => {
    const isConfirmed = await confirmDelete(`¿Estás seguro de eliminar el predio ${codigo || id}?`);
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_URL}/api/gis/predios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setToastMsg({ type: 'success', title: 'Éxito', message: 'Predio eliminado' });
        setPrediosData(null);
        if (showPredios) togglePredios();
      } else {
        const err = await res.json();
        setToastMsg({ type: 'error', title: 'Error', message: err.detail });
      }
    } catch (e) {
      setToastMsg({ type: 'error', title: 'Error', message: e.message });
    }
  };
  
  // Visibilidad de Ortofotos Individuales { "archivo.tif": true/false }
  const [individualOrthophotos, setIndividualOrthophotos] = useState({});

  // Estados de la Regla
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isBoxZooming, setIsBoxZooming] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);

  // Estados del Modal de Procesamiento
  const [toastMsg, setToastMsg] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isS3ModalOpen, setIsS3ModalOpen] = useState(false);



  const storageMode = import.meta.env.VITE_STORAGE_MODE || 's3';

  const handleProcesarClick = async () => {
    if (storageMode === 'local') {
      setToastMsg({ type: 'info', title: 'Aviso', message: 'Abriendo selector de archivos de Windows (revisa tu barra de tareas)...' });
      try {
        const res = await fetch(`${API_URL}/api/gis/seleccionar-archivo`);
        if (!res.ok) {
          setToastMsg({ type: 'warning', title: 'Cancelado', message: 'No se seleccionó ningún archivo' });
          return;
        }
        const data = await res.json();
        if (data.ruta) {
          handleS3FileSelect(data.ruta);
        }
      } catch(e) {
        setToastMsg({ type: 'error', title: 'Error', message: 'Fallo de conexión al buscar archivo' });
      }
    } else {
      setIsS3ModalOpen(true);
    }
  };

  const handleS3FileSelect = async (filename) => {
    setIsS3ModalOpen(false);
    setToastMsg({ type: 'info', title: 'Procesando', message: 'Iniciando generación de pirámides...' });
    try {
      const processRes = await fetch(`${API_URL}/api/gis/ortofotos/procesar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ nombre_archivo: filename })
      });
      const processData = await processRes.json();
      if (processRes.ok) {
        setToastMsg({ type: 'success', title: 'Éxito', message: 'Procesando en segundo plano' });
        setActiveTasks(prev => [...prev, { id: processData.task_id, progress: 0, status: 'procesando', minimized: false, filename }]);
      } else {
        setToastMsg({ type: 'error', title: 'Error', message: processData.detail || 'Fallo al procesar' });
      }
    } catch(e) {
      setToastMsg({ type: 'error', title: 'Error', message: 'Fallo de conexión al enviar archivo' });
    }
  };


  const handleCatalogarMasivo = async () => {
    if (!window.confirm('¿Iniciar la catalogación masiva de toda la carpeta de ortofotos? Esto podría tardar varios minutos.')) return;
    try {
      setToastMsg({ type: 'info', title: 'Catalogación', message: 'Iniciando...' });
      const res = await fetch(`${API_URL}/api/gis/ortofotos/catalogar-masivo`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setToastMsg({ type: 'success', title: 'Éxito', message: 'Catalogación en curso' });
        setActiveTasks(prev => [...prev, { id: data.task_id, progress: 0, status: 'procesando', minimized: false, filename: 'Carpeta Entera' }]);
      } else {
        setToastMsg({ type: 'error', title: 'Error', message: 'No se pudo iniciar' });
      }
    } catch(e) { console.error(e); }
  };
  
  const defaultCenter = [-1.439, -79.468]; 
  const defaultZoom = 14;

  const zoomToFeature = (feature) => {
    if (map && feature) {
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      map.fitBounds(bounds, { padding: [50, 50], animate: true, maxZoom: 19, duration: 1.5 });
    }
  };

  const togglePredios = async () => {
    const newState = !showPredios;
    setShowPredios(newState);
    if (newState && !prediosData && authToken) {
      fetchMapData();
    }
  };

  const toggleVertices = async () => {
    const newState = !showVertices;
    setShowVertices(newState);
    if (newState && !verticesData && authToken) {
      try {
        const res = await fetch(`${API_URL}/api/gis/vertices`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        setVerticesData(await res.json());
      } catch (err) { console.error(err); }
    }
  };

  const toggleLineas = async () => {
    const newState = !showLineas;
    setShowLineas(newState);
    if (newState && !lineasData && authToken) {
      try {
        const res = await fetch(`${API_URL}/api/gis/lineas`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        setLineasData(await res.json());
      } catch (err) { console.error(err); }
    }
  };

  const toggleIndividualOrthophoto = (filename) => {
    setIndividualOrthophotos(prev => ({
      ...prev,
      [filename]: !prev[filename]
    }));
  };

  const zoomToVectorLayer = (data) => {
    if (map && data) {
      const bounds = L.geoJSON(data).getBounds();
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5 });
    }
  };

  const zoomToOrtofoto = (filename) => {
    if (map && catalogData) {
      const feature = catalogData.features.find(f => f.properties.nombre_archivo === filename);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        map.flyToBounds(bounds, { padding: [50, 50], animate: true, duration: 1.5, easeLinearity: 0.25 });
      }
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    let dataToSearch = prediosData;
    if (!dataToSearch && authToken) {
      setToastMsg({ type: 'info', title: 'Buscando...', message: 'Cargando base de predios...' });
      try {
        const res = await fetch(`${API_URL}/api/gis/predios`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        dataToSearch = await res.json();
        setPrediosData(dataToSearch);
        setShowPredios(true);
      } catch (err) {
        setToastMsg({ type: 'error', title: 'Error', message: 'No se pudo cargar la base' });
        return;
      }
    }

    if (!dataToSearch?.features) return;

    const query = searchQuery.trim().toLowerCase();
    
    const matches = dataToSearch.features.filter(f => {
      const cod = f.properties.cod_catastral?.toLowerCase() || '';
      const cedula = f.properties.cedula?.toLowerCase() || '';
      return cod === query || cedula === query || cod.includes(query) || cedula.includes(query);
    });

    if (matches.length === 0) {
      setToastMsg({ type: 'error', title: 'Sin resultados', message: `No se encontraron predios para: ${query}` });
      setSearchResults(null);
      return;
    }

    setSearchResults(matches.map(m => m.properties.id));

    const featureCollection = { type: "FeatureCollection", features: matches };
    const bounds = L.geoJSON(featureCollection).getBounds();
    
    if (map) {
      map.flyToBounds(bounds, { duration: 1.5, easeLinearity: 0.25, padding: [50, 50], maxZoom: 20 });
    }
    
    setToastMsg({ type: 'success', title: 'Encontrado', message: `Se encontraron ${matches.length} predio(s).` });
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const formData = new FormData();
      formData.append("file", file);
      
      setToastMsg({ type: 'info', title: 'Subiendo archivo...', message: `Procesando ${file.name}` });
      
      try {
        const response = await fetch(`${API_URL}/api/gis/upload`, {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setToastMsg({ type: 'success', title: 'Éxito', message: data.mensaje });
          if (data.tipo === 'raster') {
            setActiveTasks(prev => [...prev, { id: data.task_id, progress: 0, status: 'procesando', minimized: false, filename: file.name }]);
          } else if (data.tipo === 'vector') {
            if (data.capa === 'predio') { setPrediosData(null); if(showPredios) togglePredios(); }
            if (data.capa === 'linea_lindero') { setLineasData(null); if(showLineas) toggleLineas(); }
            if (data.capa === 'vertice') { setVerticesData(null); if(showVertices) toggleVertices(); }
          }
        } else {
          setToastMsg({ type: 'error', title: 'Error', message: data.detail });
        }
      } catch (err) {
        setToastMsg({ type: 'error', title: 'Error de Red', message: err.message });
      }
    }
  };

  useEffect(() => {
    let intervalId;
    const processingTasks = activeTasks.filter(t => t.status === 'procesando');
    if (processingTasks.length > 0) {
      intervalId = setInterval(async () => {
        try {
          await Promise.all(processingTasks.map(async (task) => {
            const res = await fetch(`${API_URL}/api/gis/ortofotos/progreso/${task.id}`);
            if (res.ok) {
              const data = await res.json();
              setActiveTasks(prev => prev.map(t => {
                if (t.id === task.id) {
                  const updatedTask = { ...t, progress: data.progreso, status: data.estado };
                  if (data.estado === 'completado') {
                    setToastMsg({ type: 'success', title: '¡Ortofoto Lista!', message: `Generación exitosa para ${t.filename}.` });
                    setTimeout(() => setToastMsg(null), 8000);
                    
                    if (t.filename !== 'Carpeta Entera') {
                      setIndividualOrthophotos(prevOrto => ({ ...prevOrto, [t.filename]: true }));
                    }
                    
                    fetch(`${API_URL}/api/gis/catalog`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json()).then(d => {
                      if (d.type === 'FeatureCollection') setCatalogData(d);
                    });
                  } else if (data.estado === 'error') {
                    setToastMsg({ type: 'error', title: 'Error en GDAL', message: `Fallo al procesar ${t.filename}.` });
                    setTimeout(() => setToastMsg(null), 8000);
                  }
                  return updatedTask;
                }
                return t;
              }));
            }
          }));
        } catch (e) {
          console.error("Error consultando progreso", e);
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTasks]);

  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_URL}/api/gis/catalog`, { headers: { 'Authorization': `Bearer ${authToken}` } })
      .then(res => res.json())
      .then(data => {
        if (data.type === 'FeatureCollection') {
          setCatalogData(data);
        }
      })
      .catch(err => console.error("Error fetching catalog:", err));
  }, [authToken]);

  let totalDistance = 0;
  for (let i = 1; i < measurePoints.length; i++) {
    totalDistance += L.latLng(measurePoints[i-1]).distanceTo(L.latLng(measurePoints[i]));
  }
  let dynamicDistance = 0;
  if (isMeasuring && measurePoints.length > 0 && mousePos) {
    dynamicDistance = L.latLng(measurePoints[measurePoints.length - 1]).distanceTo(L.latLng(mousePos));
  }
  const displayDistance = totalDistance + dynamicDistance;

  const handleFinishDrawing = (points) => {
    if (points.length < 3) {
      setToastMsg({ type: 'error', title: 'Error', message: 'Un polígono debe tener al menos 3 puntos' });
      setIsDrawingPredio(false);
      setDrawPoints([]);
      setMousePos(null);
      setIsAddingPredio(true);
      return;
    }

    let coordsText = '';
    points.forEach(pt => {
      const utm = proj4('EPSG:4326', 'EPSG:32717', [pt.lng, pt.lat]);
      coordsText += `${utm[0].toFixed(2)} ${utm[1].toFixed(2)}\n`;
    });

    setIsDrawingPredio(false);
    setDrawPoints([]);
    setMousePos(null);
    setTempPredioFormData(prev => ({
      ...prev,
      geom_text: coordsText,
      es_utm: true
    }));
    setIsAddingPredio(true);
  };



  const geojsonStyle = {
    color: '#ff0000',
    weight: 4,
    fillColor: '#ff0000',
    fillOpacity: 0.15,
  };

  return (
    <div className="app-wrapper" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {isDragging && (
        <div className="drag-overlay" style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(59, 130, 246, 0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)', border: '4px dashed #3b82f6'
        }}>
          <h1 style={{ color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)', fontSize: '2.5rem' }}>
            Suelta tu archivo aquí (Ortofoto o ZIP)
          </h1>
        </div>
      )}

      {(isAddingPredio || editingPredio) && !isDrawingPredio && (
        <PredioForm 
          initialData={editingPredio || tempPredioFormData} 
          onSubmit={handleSavePredio} 
          onCancel={() => { setIsAddingPredio(false); setEditingPredio(null); setTempPredioFormData(null); }} 
          onStartDrawing={() => {
            setIsAddingPredio(false);
            setIsDrawingPredio(true);
            setDrawPoints([]);
          }}
        />
      )}

      {isDrawingPredio && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--bg-panel)', backdropFilter: 'blur(10px)', padding: '10px 20px', borderRadius: '30px', border: '1px solid var(--accent-color)', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
          <MousePointer2 size={18} color="var(--accent-color)" />
          <span style={{ color: 'white', fontWeight: 'bold' }}>Modo Dibujo: Doble clic para finalizar</span>
          <button 
            className="btn-cancel" 
            style={{ padding: '5px 15px', fontSize: '12px', borderRadius: '15px' }}
            onClick={() => {
              setIsDrawingPredio(false);
              setDrawPoints([]);
              setMousePos(null);
              setIsAddingPredio(true);
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="ui-overlay" style={{ pointerEvents: 'none' }}>
        {sidebarContextMenu && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, pointerEvents: 'auto' }}
            onClick={() => setSidebarContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setSidebarContextMenu(null); }}
          />
        )}
        {sidebarContextMenu && (
          <div style={{
            position: 'fixed',
            top: sidebarContextMenu.y,
            left: sidebarContextMenu.x,
            zIndex: 9999,
            background: 'var(--bg-panel)',
            border: '1px solid var(--card-border)',
            borderRadius: '8px',
            padding: '5px 0',
            minWidth: '200px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto'
          }}>
            <div 
              onClick={(e) => { e.stopPropagation(); setActiveTableData(sidebarContextMenu.layerType); setSidebarContextMenu(null); }}
              style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <TableProperties size={16} color="#3b82f6" /> Ver Tabla de Atributos
            </div>
            <div 
              onClick={(e) => { 
                e.stopPropagation(); 
                const data = sidebarContextMenu.layerType === 'predios' ? prediosData : sidebarContextMenu.layerType === 'lineas' ? lineasData : verticesData;
                zoomToVectorLayer(data); 
                setSidebarContextMenu(null); 
              }}
              style={{ padding: '10px 15px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Target size={16} color="#fbbf24" /> Acercar a la Capa
            </div>
          </div>
        )}

        <FeatureContextMenuComponent 
          context={featureContextMenu} 
          onClose={() => setFeatureContextMenu(null)}
          onAction={(action, feature) => {
            if (action === 'zoom') {
              zoomToFeature(feature);
            } else if (action === 'table') {
              setActiveTableData('predios');
            } else if (action === 'edit') {
              setEditingPredio({
                id: feature.properties.id,
                posesionario_id: feature.properties.posesionario_id,
                cod_catastral: feature.properties.cod_catastral,
                geom_geojson: JSON.stringify(feature.geometry, null, 2)
              });
            } else if (action === 'hide') {
              setHiddenFeatureIds(prev => [...prev, feature.properties.id]);
            } else if (action === 'export') {
              proj4.defs("EPSG:32717","+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

              const predioId = feature.properties.id;
              let posesionarioName = feature.properties.nombre_posesionario;
              if (!posesionarioName || posesionarioName.trim() === '') {
                posesionarioName = `predio_${feature.properties.cod_catastral || predioId}`;
              }
              const cleanName = posesionarioName.replace(/[^a-zA-Z0-9]/g, '_');

              const relatedLines = (linderosData?.features || []).filter(f => f.properties.predio_id === predioId);
              const relatedPoints = (verticesData?.features || []).filter(f => f.properties.predio_id === predioId);

              const transformCoords = (coords) => {
                if (Array.isArray(coords) && typeof coords[0] === 'number') {
                  return proj4('EPSG:4326', 'EPSG:32717', coords);
                }
                return coords.map(c => transformCoords(c));
              };

              const featuresToExport = [feature, ...relatedLines, ...relatedPoints].map(f => {
                const sanitized = { ...f, properties: { ...f.properties } };
                if (sanitized.properties) {
                  Object.keys(sanitized.properties).forEach(k => {
                    let val = sanitized.properties[k];
                    if (val === null || val === undefined) val = '';
                    else if (typeof val === 'object') val = JSON.stringify(val);
                    sanitized.properties[k] = val;
                  });
                }
                if (sanitized.geometry && sanitized.geometry.coordinates) {
                  sanitized.geometry = {
                    ...sanitized.geometry,
                    coordinates: transformCoords(sanitized.geometry.coordinates)
                  };
                }
                return sanitized;
              });

              const singleGeoJSON = {
                type: 'FeatureCollection',
                features: featuresToExport
              };
              
              const prj32717 = 'PROJCS["WGS_1984_UTM_Zone_17S",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",10000000.0],PARAMETER["Central_Meridian",-81.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';

              const options = {
                outputType: 'blob',
                compression: 'STORE',
                prj: prj32717,
                types: { 
                  point: `${cleanName}_punto`,
                  multipoint: `${cleanName}_punto`,
                  line: `${cleanName}_linea`,
                  multiline: `${cleanName}_linea`,
                  linestring: `${cleanName}_linea`,
                  multilinestring: `${cleanName}_linea`,
                  polygon: `${cleanName}_predio`,
                  multipolygon: `${cleanName}_predio`
                }
              };
              
              Promise.resolve(shpwrite.zip(singleGeoJSON, options)).then(content => {
                if (content && typeof content.generateAsync === 'function') return content.generateAsync({ type: 'blob', compression: 'STORE' });
                if (content && typeof content.generate === 'function') return content.generate({ type: 'blob', compression: 'STORE' });
                return content;
              }).then(blob => {
                const finalBlob = blob instanceof Blob ? blob : new Blob([blob], { type: 'application/zip' });
                const url = URL.createObjectURL(finalBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${cleanName}.zip`;
                a.click();
                URL.revokeObjectURL(url);
              }).catch(err => {
                console.error("SHP Export Error:", err);
                alert("Error al exportar: " + err.message);
              });
            } else if (action === 'delete') {
              handleDeletePredio(feature.properties.id, feature.properties.cod_catastral);
            }
          }} 
        />

        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            style={{
              pointerEvents: 'auto',
              position: 'absolute',
              top: '20px',
              right: '20px',
              zIndex: 1000,
              background: 'var(--bg-panel)',
              border: '1px solid var(--card-border)',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            title="Mostrar panel de Capas"
          >
            <Layers size={20} />
            <span style={{ marginLeft: '8px', fontWeight: 'bold', fontSize: '14px' }}>Capas</span>
          </button>
        )}

        {/* PREMIUM FLOATING TOOLBAR DOCK */}
        <div className="floating-dock">
          <button 
            onClick={() => { setIsMeasuring(false); setIsDrawingPredio(false); setIsAddingPredio(false); setIsBoxZooming(false); }}
            className={`dock-button navegar ${(!isMeasuring && !isAddingPredio && !isDrawingPredio && !isBoxZooming) ? 'active' : ''}`}
          >
            <MousePointer2 size={18} /> <span className="dock-button-text">Navegar</span>
          </button>
          
          <div className="dock-divider"></div>

          <button 
            onClick={() => {
              setIsBoxZooming(!isBoxZooming);
              setIsMeasuring(false); setIsDrawingPredio(false); setIsAddingPredio(false);
            }}
            className={`dock-button ${isBoxZooming ? 'active' : ''}`}
            title="Acercamiento por Caja (Zoom Box)"
          >
            <Scan size={18} />
          </button>

          <button 
            onClick={() => map && map.zoomIn()}
            className="dock-button"
            title="Acercar (Zoom In)"
          >
            <ZoomIn size={18} />
          </button>
          <button 
            onClick={() => map && map.zoomOut()}
            className="dock-button"
            title="Alejar (Zoom Out)"
          >
            <ZoomOut size={18} />
          </button>

          <div className="dock-divider"></div>

          <button 
            onClick={() => { setIsAddingPredio(true); setIsMeasuring(false); }}
            className={`dock-button agregar ${(isAddingPredio || isDrawingPredio) ? 'active' : ''}`}
          >
            <Plus size={18} /> <span className="dock-button-text">Agregar Predio</span>
          </button>
          
          <div className="dock-divider"></div>

          <button 
            onClick={() => { setIsMeasuring(!isMeasuring); setIsAddingPredio(false); setIsDrawingPredio(false); setMeasurePoints([]); setMousePos(null); }}
            className={`dock-button medir ${isMeasuring ? 'active' : ''}`}
          >
            <Ruler size={18} /> <span className="dock-button-text">Medir</span>
          </button>

          <div className="dock-divider"></div>

          <button 
            onClick={() => { 
              if (map) {
                // Alternar rastreo
                if (window.isTrackingLocation) {
                  map.stopLocate();
                  window.isTrackingLocation = false;
                  setUserLocation(null);
                  window.hasShownLocationToast = false;
                  setToastMsg({ type: 'info', title: 'Rastreo Detenido', message: 'Se ha detenido el seguimiento de tu ubicación.' });
                } else {
                  window.isFirstLocationFound = false; // Reset flag
                  map.locate({ setView: false, maxZoom: 18, enableHighAccuracy: true, watch: true }); 
                  window.isTrackingLocation = true;
                }
              }
            }}
            className={`dock-button ubicacion ${userLocation ? 'active' : ''}`}
          >
            <Navigation size={18} /> <span className="dock-button-text">Mi Ubicación</span>
          </button>
        </div>

        <S3BrowserModal 
          isOpen={isS3ModalOpen} 
          onClose={() => setIsS3ModalOpen(false)} 
          onSelect={handleS3FileSelect} 
          authToken={authToken} 
        />

        {/* INFO WINDOW PARA LA REGLA */}
        {isMeasuring && (
          <div style={{ 
            position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, pointerEvents: 'auto',
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid #f59e0b', borderRadius: '12px', padding: '12px 20px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '5px' }}>Distancia Total</div>
            <div style={{ color: '#fbbf24', fontSize: '1.5rem', fontWeight: 'bold' }}>{displayDistance.toFixed(2)} m</div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '5px' }}>(Clic derecho en el mapa para limpiar)</div>
          </div>
        )}

        <aside className={`map-sidebar ${isSidebarOpen ? 'open' : ''}`}>
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
        
        {/* PANEL: HERRAMIENTAS RÁPIDAS */}
        <div className="sidebar-section">
          <button className="btn-primary" onClick={handleProcesarClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', marginBottom: '10px' }}>
            Procesar Nueva Ortofoto
            <UploadCloud size={18} />
          </button>
          <button className="btn-primary" onClick={handleCatalogarMasivo} style={{ backgroundColor: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
            Catalogar Carpeta Entera
            <Layers size={18} />
          </button>
        </div>

        {/* PANEL: ÁRBOL DE CAPAS (QGIS-STYLE) */}
        <div className="sidebar-section">
          <div className="section-title">
          
          <div className="section-header" onClick={() => toggleCategory('vectores')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="var(--primary)" />
              <span className="section-title">Capas Vectoriales</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowShapefileUploader(true); }}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 'bold' }}
                title="Subir Shapefile Dinámico"
              >
                <Upload size={12} /> SHP
              </button>
              {collapsedCategories.vectores ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
          
          {!collapsedCategories.vectores && (
            <>
              <div 
                className={`layer-item ${showPredios ? 'active' : ''}`}
                onContextMenu={(e) => {
                  if (showPredios) {
                    e.preventDefault();
                    setSidebarContextMenu({ x: e.clientX, y: e.clientY, layerType: 'predios' });
                  }
                }}
              >
                <span onClick={togglePredios} style={{ flex: 1 }}>Predios (Polígonos)</span>
                <span onClick={togglePredios} style={{ cursor: 'pointer' }}>{showPredios ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}</span>
              </div>
              {showPredios && (
                <div style={{ padding: '5px 10px 10px 30px', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Desde:</label>
                      <input 
                        type="date" 
                        value={fechaInicio} 
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="sidebar-input"
                        style={{ padding: '2px 4px', fontSize: '0.8rem', width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hasta:</label>
                      <input 
                        type="date" 
                        value={fechaFin} 
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="sidebar-input"
                        style={{ padding: '2px 4px', fontSize: '0.8rem', width: '100%' }}
                      />
                    </div>
                    <button 
                      onClick={fetchMapData}
                      style={{ padding: '4px', background: 'var(--accent-color)', color: '#1a1a2e', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem', marginTop: '5px' }}
                    >
                      Filtrar Fechas
                    </button>
                  </div>

                  <div style={{ marginBottom: '5px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mostrar por:</label>
                    <select 
                      value={listDisplayMode} 
                      onChange={e => setListDisplayMode(e.target.value)}
                      className="sidebar-input"
                      style={{ padding: '2px 4px', fontSize: '0.75rem', height: 'auto' }}
                    >
                      <option value="codigo">Código Catastral</option>
                      <option value="nombre">Nombre Propietario</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', marginTop: '10px' }}>
                    <button className="btn-secondary" onClick={handleExportAll} style={{ flex: 1, padding: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <DownloadCloud size={14} /> Descargar
                    </button>
                    <input 
                      type="file" 
                      accept=".zip" 
                      style={{ display: 'none' }} 
                      ref={shapefileInputRef} 
                      onChange={handleImportShapefile} 
                    />
                    <button className="btn-secondary" onClick={() => shapefileInputRef.current.click()} style={{ flex: 1, padding: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <UploadCloud size={14} /> Subir Shape
                    </button>
                  </div>
                  
                  {/* LISTA INDIVIDUAL DE PREDIOS */}
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '4px', padding: '4px' }}>
                    {(prediosData?.features || [])
                      .filter(f => f && f.properties)
                      .filter(f => searchResults === null || searchResults.includes(f.properties.id))
                      .filter(f => selectedYear === 'Todos' || (f.properties.fecha_creacion && String(f.properties.fecha_creacion).startsWith(selectedYear)))
                      .map(f => {
                        const isHidden = hiddenFeatureIds.includes(f.properties.id);
                        const displayText = listDisplayMode === 'codigo' 
                          ? (f.properties.cod_catastral || `Predio ${f.properties.id}`)
                          : (f.properties.nombre_posesionario || 'Sin Nombre');
                        return (
                          <div 
                            key={f.properties.id} 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px', borderBottom: '1px solid var(--card-border)', fontSize: '0.8rem', color: isHidden ? 'var(--text-muted)' : 'var(--text-main)', opacity: isHidden ? 0.6 : 1 }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setFeatureContextMenu({
                                feature: f,
                                mouseX: e.clientX,
                                mouseY: e.clientY
                              });
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{displayText}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <span 
                                style={{ cursor: 'pointer', color: '#3b82f6' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPredio({
                                    id: f.properties.id,
                                    posesionario_id: f.properties.posesionario_id,
                                    cod_catastral: f.properties.cod_catastral,
                                    geom_geojson: JSON.stringify(f.geometry, null, 2)
                                  });
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
                      })
                    }
                  </div>
                </div>
              )}
              
              <div 
                className={`layer-item ${showLineas ? 'active' : ''}`}
                onContextMenu={(e) => {
                  if (showLineas) {
                    e.preventDefault();
                    setSidebarContextMenu({ x: e.clientX, y: e.clientY, layerType: 'lineas' });
                  }
                }}
              >
                <span onClick={toggleLineas} style={{ flex: 1 }}>Linderos (Líneas)</span>
                <span onClick={toggleLineas} style={{ cursor: 'pointer' }}>{showLineas ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}</span>
              </div>
              
              <div 
                className={`layer-item ${showVertices ? 'active' : ''}`}
                onContextMenu={(e) => {
                  if (showVertices) {
                    e.preventDefault();
                    setSidebarContextMenu({ x: e.clientX, y: e.clientY, layerType: 'vertices' });
                  }
                }}
              >
                <span onClick={toggleVertices} style={{ flex: 1 }}>Vértices (Puntos)</span>
                <span onClick={toggleVertices} style={{ cursor: 'pointer' }}>{showVertices ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}</span>
              </div>
            </>
          )}

          <div className="layer-category" onClick={() => toggleCategory('raster')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Raster</span>
            {collapsedCategories.raster ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
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

          <div className="layer-category" onClick={() => toggleCategory('ortofotos')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ortofotos Individuales</span>
            {collapsedCategories.ortofotos ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
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

          <div className="layer-category" onClick={() => toggleCategory('metadatos')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Catálogo Metadatos</span>
            {collapsedCategories.metadatos ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </div>

          {!collapsedCategories.metadatos && (
            <div className={`layer-item ${showFootprints ? 'active' : ''}`} onClick={() => setShowFootprints(!showFootprints)}>
              <span>Cuadros de Ortofotos</span>
              {showFootprints ? <Eye size={18} /> : <EyeOff size={18} color="#475569" />}
            </div>
          )}
        </div>

        {/* PANEL: BÚSQUEDA Y HERRAMIENTAS */}
        <div className="sidebar-section">
          <div className="section-title">
            <Search size={16} />
            Escala
          </div>
          <form onSubmit={(e) => {
              e.preventDefault();
              if (!map) return;
              const val = document.getElementById('sidebar-scale-input').value;
              if (!val || val <= 0) return;
              const lat = map.getCenter().lat;
              const mpp = val / 3779.529;
              const targetZoom = Math.log2((156543.03392 * Math.cos(lat * Math.PI / 180)) / mpp);
              map.setZoom(targetZoom);
            }} style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
              <span style={{ color: '#94a3b8', lineHeight: '30px' }}>1:</span>
              <input id="sidebar-scale-input" className="sidebar-input" type="number" defaultValue="1000" min="1" />
              <button type="submit" style={{ padding: '5px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Ir</button>
          </form>
          <div className="section-title" style={{ marginTop: '15px' }}>
            <Search size={16} />
            Buscar Predio
          </div>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
            <input 
              className="sidebar-input"
              type="text" 
              placeholder="Cédula o Cód. Catastral" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button type="submit" style={{ padding: '5px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Buscar</button>
          </form>

        </div>
        </div>
        </aside>
      </div>

      <MapContainer 
        center={defaultCenter} 
        zoom={defaultZoom} 
        zoomSnap={0.1}
        maxZoom={32}
        ref={setMap}
        className={`map-container ${isMeasuring ? 'measuring-active' : ''}`}
        zoomControl={false}
      >
        <MeasureTool 
          isMeasuring={isMeasuring} 
          measurePoints={measurePoints} 
          setMeasurePoints={setMeasurePoints} 
          setMousePos={setMousePos} 
        />

        {!isMeasuring && !isDrawingPredio && (
          <MapContextMenu 
            onAction={(action, latlng) => {
              if (action === 'add_predio') {
                setIsAddingPredio(true);
              } else if (action === 'measure') {
                setIsMeasuring(true);
                setMeasurePoints([latlng]);
              }
            }} 
          />
        )}

        <FeatureContextMenuComponent 
          context={featureContextMenu} 
          onClose={() => setFeatureContextMenu(null)}
          onAction={(action, feature) => {
            if (action === 'zoom') {
              zoomToFeature(feature);
            } else if (action === 'table') {
              setActiveTableData('predios');
            } else if (action === 'edit') {
              setEditingPredio({
                id: feature.properties.id,
                posesionario_id: feature.properties.posesionario_id,
                cod_catastral: feature.properties.cod_catastral,
                geom_geojson: JSON.stringify(feature.geometry, null, 2)
              });
            } else if (action === 'hide') {
              setHiddenFeatureIds(prev => [...prev, feature.properties.id]);
            } else if (action === 'export') {
              proj4.defs("EPSG:32717","+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

              const predioId = feature.properties.id;
              let posesionarioName = feature.properties.nombre_posesionario;
              if (!posesionarioName || posesionarioName.trim() === '') {
                posesionarioName = `predio_${feature.properties.cod_catastral || predioId}`;
              }
              const cleanName = posesionarioName.replace(/[^a-zA-Z0-9]/g, '_');

              const relatedLines = (linderosData?.features || []).filter(f => f.properties.predio_id === predioId);
              const relatedPoints = (verticesData?.features || []).filter(f => f.properties.predio_id === predioId);

              const transformCoords = (coords) => {
                if (Array.isArray(coords) && typeof coords[0] === 'number') {
                  return proj4('EPSG:4326', 'EPSG:32717', coords);
                }
                return coords.map(c => transformCoords(c));
              };

              const featuresToExport = [feature, ...relatedLines, ...relatedPoints].map(f => {
                const sanitized = { ...f, properties: { ...f.properties } };
                if (sanitized.properties) {
                  Object.keys(sanitized.properties).forEach(k => {
                    let val = sanitized.properties[k];
                    if (val === null || val === undefined) val = '';
                    else if (typeof val === 'object') val = JSON.stringify(val);
                    sanitized.properties[k] = val;
                  });
                }
                if (sanitized.geometry && sanitized.geometry.coordinates) {
                  sanitized.geometry = {
                    ...sanitized.geometry,
                    coordinates: transformCoords(sanitized.geometry.coordinates)
                  };
                }
                return sanitized;
              });

              const singleGeoJSON = {
                type: 'FeatureCollection',
                features: featuresToExport
              };
              
              const prj32717 = 'PROJCS["WGS_1984_UTM_Zone_17S",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",10000000.0],PARAMETER["Central_Meridian",-81.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';

              const options = {
                outputType: 'blob',
                compression: 'STORE',
                prj: prj32717,
                types: { 
                  point: `${cleanName}_punto`,
                  multipoint: `${cleanName}_punto`,
                  line: `${cleanName}_linea`,
                  multiline: `${cleanName}_linea`,
                  linestring: `${cleanName}_linea`,
                  multilinestring: `${cleanName}_linea`,
                  polygon: `${cleanName}_predio`,
                  multipolygon: `${cleanName}_predio`
                }
              };
              
              Promise.resolve(shpwrite.zip(singleGeoJSON, options)).then(content => {
                if (content && typeof content.generateAsync === 'function') return content.generateAsync({ type: 'blob', compression: 'STORE' });
                if (content && typeof content.generate === 'function') return content.generate({ type: 'blob', compression: 'STORE' });
                return content;
              }).then(blob => {
                const finalBlob = blob instanceof Blob ? blob : new Blob([blob], { type: 'application/zip' });
                const url = URL.createObjectURL(finalBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${cleanName}.zip`;
                a.click();
                URL.revokeObjectURL(url);
              }).catch(err => {
                console.error("SHP Export Error:", err);
                alert("Error al exportar: " + err.message);
              });
            } else if (action === 'delete') {
              handleDeletePredio(feature.properties.id, feature.properties.cod_catastral);
            }
          }}
        />
        
        {isDrawingPredio && (
          <DrawPolygonTool 
            isDrawing={isDrawingPredio} 
            drawPoints={drawPoints} 
            setDrawPoints={setDrawPoints} 
            setMousePos={setMousePos} 
            onFinish={handleFinishDrawing} 
            verticesData={verticesData}
          />
        )}

        {/* Línea temporal para medir */}
        {isMeasuring && measurePoints.length > 0 && mousePos && (
          <Polyline positions={[...measurePoints, mousePos]} color="#ef4444" weight={3} dashArray="5, 10" />
        )}
        
        {/* Polígono temporal para dibujo */}
        {isDrawingPredio && drawPoints.length > 0 && mousePos && (
          <Polygon positions={[...drawPoints, mousePos]} color="var(--accent-color)" fillColor="var(--accent-color)" weight={3} fillOpacity={0.2} dashArray="5, 5" />
        )}

        {/* Marcadores de vértices al dibujar */}
        {isDrawingPredio && drawPoints.map((pt, i) => (
          <CircleMarker key={i} center={pt} radius={5} color="var(--accent-color)" fillColor="white" fillOpacity={1} weight={2} />
        ))}
        {isDrawingPredio && mousePos && (
          <CircleMarker center={mousePos} radius={5} color="#fbbf24" fillColor="#fbbf24" fillOpacity={0.8} weight={2} />
        )}

        {/* Marcador de Ubicación en Tiempo Real */}
        {userLocation && (
          <CircleMarker 
            center={userLocation} 
            radius={8} 
            color="#ffffff" 
            fillColor="#a855f7" 
            fillOpacity={0.9} 
            weight={3}
          >
            <Popup>Tu ubicación actual</Popup>
          </CircleMarker>
        )}

        <TileLayer
          url={theme === 'dark' ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
          attribution={theme === 'dark' ? '&copy; CARTO' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
          zIndex={1}
          maxNativeZoom={19}
          maxZoom={32}
        />

        <ScaleControl position="bottomleft" imperial={false} />

        {/* RASTER: Mosaico Maestro */}
        {showMasterOrthophoto && (
          <TileLayer
            url={`${API_URL}/api/gis/tiles/{z}/{x}/{y}.png?v=3`}
            maxZoom={22}
            maxNativeZoom={20}
            zIndex={10}
            opacity={ortofotoOpacity}
          />
        )}
        
        {/* RASTER: Ortofotos Individuales (Dinámicas) */}
        {Object.keys(individualOrthophotos).map(filename => {
          if (individualOrthophotos[filename]) {
            return (
              <TileLayer
                key={filename}
                url={`${API_URL}/api/gis/tiles/{z}/{x}/{y}.png?filename=${encodeURIComponent(filename)}&v=5`}
                maxZoom={22}
                maxNativeZoom={20}
                zIndex={20}
                opacity={ortofotoOpacity}
                keepBuffer={2}
                updateWhenIdle={true}
                updateWhenZooming={false}
              />
            );
          }
          return null;
        })}

        {/* VECTOR: Predios */}
        {showPredios && prediosData && prediosData.features && (
          <GeoJSON 
            key={`predios-${hiddenFeatureIds.join('-')}-${searchResults ? searchResults.join('-') : 'all'}`}
            data={{...prediosData, features: (prediosData.features || []).filter(f => f && f.geometry && f.properties && !hiddenFeatureIds.includes(f.properties.id) && (searchResults === null || searchResults.includes(f.properties.id)))}}
            style={() => ({
              color: '#3b82f6', // Borde azul
              weight: 2,
              fillColor: '#3b82f6', // Relleno azul
              fillOpacity: 0.15
            })}
            onEachFeature={(feature, layer) => {
              if (feature.properties) {
                const { cod_catastral, area_ha, nombre_posesionario } = feature.properties;
                layer.bindPopup(`
                  <div style="font-family: Inter, sans-serif;">
                    <h4 style="margin:0 0 5px 0; color: #1e293b;">Código: ${cod_catastral || 'N/A'}</h4>
                    <p style="margin:0 0 5px 0; font-size: 13px;"><b>Área:</b> ${area_ha ? Number(area_ha).toFixed(2) + ' ha' : 'N/A'}</p>
                    <p style="margin:0; font-size: 13px;"><b>Propietario:</b> ${nombre_posesionario || 'N/A'}</p>
                  </div>
                `);

                layer.on('contextmenu', (e) => {
                  L.DomEvent.stopPropagation(e);
                  setFeatureContextMenu({
                    feature,
                    mouseX: e.originalEvent.clientX,
                    mouseY: e.originalEvent.clientY
                  });
                });
              }
            }}
          />
        )}

        {/* VECTOR: Imported Shapefile */}
        {importedShapes && importedShapes.features && (
          <GeoJSON 
            key="imported-shapes"
            data={importedShapes}
            style={() => ({
              color: '#10b981', // Verde esmeralda
              weight: 2,
              fillColor: '#10b981',
              fillOpacity: 0.3,
              dashArray: '4, 4'
            })}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                  <h4 style="margin:0 0 5px 0; color: #1e293b;">Polígono Importado (Shapefile)</h4>
                  <p style="margin:0; font-size: 13px;">Haz clic en <b>"Nuevo Predio"</b> en la barra de herramientas para registrar este polígono manualmente. Puedes usar este polígono como referencia visual.</p>
                </div>
              `);
            }}
          />
        )}

        {/* VECTOR: Linderos */}
        {showLineas && lineasData && lineasData.features && (
          <GeoJSON 
            data={{...lineasData, features: (lineasData.features || []).filter(f => f && f.geometry)}}
            style={() => ({
              color: '#f97316', // Naranja
              weight: 3,
              dashArray: '5, 5' // Línea punteada
            })}
          />
        )}

        {/* VECTOR: Vértices */}
        {showVertices && verticesData && verticesData.features && (
          <GeoJSON 
            data={{...verticesData, features: (verticesData.features || []).filter(f => f && f.geometry)}}
            pointToLayer={(feature, latlng) => {
              return L.circleMarker(latlng, {
                radius: 4,
                fillColor: "#eab308", // Amarillo
                color: "#ffffff", // Borde blanco
                weight: 1,
                opacity: 1,
                fillOpacity: 1
              });
            }}
            onEachFeature={(feature, layer) => {
              if (feature.properties) {
                layer.bindPopup(`Vértice: ${feature.properties.codigo || 'N/A'}`);
              }
            }}
          />
        )}

        {/* VECTOR: Catálogo de Ortofotos (Footprints) */}
        {showFootprints && catalogData && (
          <GeoJSON 
            data={catalogData} 
            style={geojsonStyle}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(`<b>Archivo:</b> ${feature.properties.nombre_archivo}`);
            }}
          />
        )}


        {/* Líneas de la Regla confirmadas */}
        {measurePoints.length > 1 && (
          <Polyline positions={measurePoints} color="#fbbf24" weight={4} />
        )}
        
        {/* Línea de la Regla dinámica al mover el ratón */}
        {isMeasuring && measurePoints.length > 0 && mousePos && (
          <Polyline 
            positions={[measurePoints[measurePoints.length - 1], mousePos]} 
            color="#fbbf24" 
            weight={4} 
            dashArray="5, 10" 
          />
        )}
        
        {/* Puntos (nodos) de la Regla */}
        {measurePoints.map((pt, idx) => (
          <CircleMarker key={idx} center={pt} radius={5} fillColor="#fbbf24" color="white" weight={2} fillOpacity={1} />
        ))}

        {/* Marcador de Ubicación del Usuario en Tiempo Real */}
        {userLocation && (
          <CircleMarker 
            center={userLocation} 
            radius={8} 
            fillColor="#3b82f6" 
            color="#ffffff" 
            weight={2} 
            fillOpacity={0.8}
            zIndexOffset={1000}
          >
            <Popup>¡Estás aquí!</Popup>
          </CircleMarker>
        )}

        <MapInteractionHandler onInteraction={() => setFeatureContextMenu(null)} />
        <BoxZoomHandler isActive={isBoxZooming} setIsActive={setIsBoxZooming} />

        {/* Escalímetro (Métrico) en la esquina inferior derecha */}
        <ScaleControl position="bottomright" imperial={false} />
      </MapContainer>

      {/* Barra de Estado inferior estilo QGIS */}
      <QgisStatusBar map={map} />

      {/* Modal de Procesamiento de Ortofoto Eliminado */}

      {/* Notificaciones (Toast) */}
      {toastMsg && (
        <div className={`toast ${toastMsg.type}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toastMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="toast-title">{toastMsg.title}</span>
          </div>
          <span className="toast-message">{toastMsg.message}</span>
        </div>
      )}

      {/* Tracker de Progreso GDAL (Multitask) */}
      <div style={{ position: 'absolute', top: '20px', right: isSidebarOpen ? '340px' : '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 1000, pointerEvents: 'none', transition: 'right 0.3s ease' }}>
        {activeTasks.map(task => (
          <div key={task.id} className={`gdal-progress-tracker ${task.minimized ? 'minimized' : ''}`} style={{ position: 'relative', bottom: 'auto', right: 'auto', width: task.minimized ? 'auto' : '320px', pointerEvents: 'auto' }}>
            <div className="tracker-header">
              <span className="tracker-title">
                <Loader2 size={16} className={task.status === 'procesando' ? 'spin' : ''} />
                <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.filename}>
                  {task.status === 'procesando' ? `Procesando: ${task.filename}` : 
                   task.status === 'completado' ? `¡Lista: ${task.filename}!` : `Error: ${task.filename}`}
                </span>
              </span>
              <div style={{display: 'flex', gap: '5px'}}>
                <button 
                  className="tracker-minimize"
                  onClick={() => setActiveTasks(prev => prev.map(t => t.id === task.id ? { ...t, minimized: !t.minimized } : t))}
                >
                  {task.minimized ? '+' : '-'}
                </button>
                <button className="tracker-close" onClick={() => setActiveTasks(prev => prev.filter(t => t.id !== task.id))}>
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {!task.minimized && (
              <div className="tracker-body">
                <div className="progress-bar-bg">
                  <div 
                    className={`progress-bar-fill ${task.status}`} 
                    style={{ width: `${Math.max(0, task.progress)}%` }}
                  ></div>
                </div>
                <div className="tracker-details">
                  <span>{task.status === 'error' ? 'Fallo' : `${task.progress}% Completado`}</span>
                  <span>GDAL Engine</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {activeTableData && (
        <AttributeTable 
          layerName={activeTableData === 'predios' ? 'Predios' : activeTableData === 'lineas' ? 'Linderos' : 'Vértices'} 
          data={activeTableData === 'predios' ? prediosData : activeTableData === 'lineas' ? lineasData : verticesData} 
          onClose={() => setActiveTableData(null)}
          hiddenFeatureIds={hiddenFeatureIds}
          setHiddenFeatureIds={setHiddenFeatureIds}
          onRowContextMenu={(e, feature) => {
            setFeatureContextMenu({
              feature: feature,
              mouseX: e.clientX,
              mouseY: e.clientY
            });
          }}
        />
      )}

      {/* Modal Carga Shapefile Dinámico */}
      {showShapefileUploader && (
        <ShapefileUploader
          onClose={() => setShowShapefileUploader(false)}
          authToken={authToken}
          user={currentUser}
          onSuccess={() => {
            setShowShapefileUploader(false);
            setPrediosData(null);
            if (showPredios) togglePredios();
            // Refrescar vértices y líneas si están activos
            if (showVertices) { setVerticesData(null); toggleVertices(); setTimeout(toggleVertices, 500); }
            if (showLineas) { setLineasData(null); toggleLineas(); setTimeout(toggleLineas, 500); }
          }}
        />
      )}
    </div>
  );
}
