import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Marker, Polyline, useMap, LayersControl, ScaleControl, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import proj4 from 'proj4';

// Definir proyección UTM 17S
proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");
import { Printer, ArrowLeft, Loader2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, AlertCircle, Save, Layers, Maximize2, X, ZoomIn } from 'lucide-react';
import { API_URL } from '../../services/api';
import { getOfflinePredioById } from '../../services/offlineDB';
import { AppContext } from '../../context/AppContext';
import { showSuccess, showError } from '../../utils/swal';
import './ReportePlanimetrico.css';

// Helper: Crear icono de texto Leaflet
const createTextIcon = (text, className, pointSize = 6, textSize = 10, lat = 0, lng = 0, centerLat = 0, centerLng = 0) => {
  const dy = lat - centerLat;
  const dx = lng - centerLng;
  // dy is inverted for DOM coordinates
  const angle = Math.atan2(-dy, dx);

  // Distance to offset the label outwards
  const dist = (pointSize / 2) + 8 + (textSize / 2);

  const offsetX = Math.cos(angle) * dist;
  const offsetY = Math.sin(angle) * dist;

  return L.divIcon({
    className: className,
    html: `
      <div style="position: relative; width: ${pointSize}px; height: ${pointSize}px; background: #ffb6c1; border: 1px solid black; border-radius: 50%;">
        <span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px); font-size: ${textSize}px; font-weight: bold; color: black; white-space: nowrap; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">${text}</span>
      </div>
    `,
    iconSize: [pointSize, pointSize],
    iconAnchor: [pointSize / 2, pointSize / 2]
  });
};

const createRotatedTextIcon = (colindante, medida, p1, p2, centerLat, centerLng) => {
  let angle = Math.atan2(-(p2[0] - p1[0]), (p2[1] - p1[1])) * (180 / Math.PI);
  if (angle > 90 || angle < -90) angle += 180;

  const midLat = (p1[0] + p2[0]) / 2;
  const midLng = (p1[1] + p2[1]) / 2;
  const dy = midLat - centerLat;
  const dx = midLng - centerLng;
  const outAngle = Math.atan2(-dy, dx);

  const offsetMedida = 10;
  const offMx = Math.cos(outAngle) * offsetMedida;
  const offMy = Math.sin(outAngle) * offsetMedida;

  const offsetColindante = 40;
  const offCx = Math.cos(outAngle) * offsetColindante;
  const offCy = Math.sin(outAngle) * offsetColindante;

  return L.divIcon({
    className: 'lindero-rotated',
    html: `
      <div style="position: absolute; transform: translate(-50%, -50%) translate(${offMx}px, ${offMy}px) rotate(${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; color: #37474f; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
        ${medida}
      </div>
      ${colindante ? `
      <div style="position: absolute; transform: translate(-50%, -50%) translate(${offCx}px, ${offCy}px) rotate(${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; color: #1a237e; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
        ${colindante}
      </div>` : ''}
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Helper: Determinar orientación geométrica respecto al centro con normalización de bounding box
const getOrientacionGeometrica = (center, midPoint, width, height) => {
  if (!center || !midPoint) return 'ESTE';

  // Normalizar las distancias por las dimensiones del bounding box
  let dy = (midPoint[0] - center[0]) / (height || 1); // Latitud (Norte/Sur)
  let dx = (midPoint[1] - center[1]) / (width || 1);  // Longitud (Este/Oeste)

  // Calcular ángulo en grados (0° es Este, 90° es Norte, 180° es Oeste, -90° es Sur)
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (angle >= 45 && angle < 135) return 'NORTE';
  if (angle >= -45 && angle < 45) return 'ESTE';
};

const MapScaleUpdater = ({ scaleValue, polygonCoords, setCalculatedScale, setGraphicScale }) => {
  const map = useMap();

  useEffect(() => {
    const updateGraphicScale = () => {
      const centerLatLng = map.getCenter();
      const pointC = map.latLngToContainerPoint(centerLatLng);
      const pointX = L.point(pointC.x + 300, pointC.y); // Usar 300px de referencia
      const latLngX = map.containerPointToLatLng(pointX);
      const dist300px = centerLatLng.distanceTo(latLngX);

      const getRoundNum = (num) => {
        const pow10 = Math.pow(10, (Math.floor(num) + '').length - 1);
        let d = num / pow10;
        d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
        return pow10 * d;
      };

      const maxMeters = getRoundNum(dist300px);
      const totalWidthPx = (maxMeters / dist300px) * 300;

      const segments = 5;
      const segmentMeters = maxMeters / segments;

      const ticks = [];
      for (let i = 0; i <= segments; i++) {
        ticks.push(i * segmentMeters);
      }

      if (setGraphicScale) {
        setGraphicScale({ totalWidthPx, ticks });
      }
    };

    if (!polygonCoords || polygonCoords.length === 0) return;

    const lats = polygonCoords.map(p => p[0]);
    const lngs = polygonCoords.map(p => p[1]);
    const center = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];

    if (scaleValue === 'Auto') {
      map.fitBounds(polygonCoords, { padding: [80, 80], animate: false });
      const z = map.getZoom();
      let s = Math.round(1000 * Math.pow(2, 19 - z));
      if (s > 1000) s = Math.round(s / 100) * 100;
      else if (s > 100) s = Math.round(s / 50) * 50;
      setCalculatedScale(`~ 1:${s}`);
    } else {
      let s = 1000;
      if (scaleValue && scaleValue.includes(':')) {
        const val = parseInt(scaleValue.split(':')[1].replace(/\D/g, ''));
        if (!isNaN(val) && val > 0) s = val;
      }
      const z = 19 - Math.log2(s / 1000);
      map.setView(center, z, { animate: false });
      setCalculatedScale(scaleValue);
    }

    updateGraphicScale();
    map.on('moveend zoomend', updateGraphicScale);
    return () => map.off('moveend zoomend', updateGraphicScale);
  }, [scaleValue, map, polygonCoords, setCalculatedScale, setGraphicScale]);
  return null;
};

const UtmGrid = ({ setMapGridLabels, isMinimap = false }) => {
  const map = useMap();
  const [gridLines, setGridLines] = useState([]);

  useEffect(() => {
    const updateGrid = () => {
      const bounds = map.getBounds();

      const swUtm = proj4('EPSG:4326', 'EPSG:32717', [bounds.getWest(), bounds.getSouth()]);
      const neUtm = proj4('EPSG:4326', 'EPSG:32717', [bounds.getEast(), bounds.getNorth()]);

      const widthUtm = Math.abs(neUtm[0] - swUtm[0]);
      let step = 1000;
      if (isMinimap) {
        step = widthUtm > 6000 ? 2000 : 1000;
      } else {
        if (widthUtm < 200) step = 20;
        else if (widthUtm < 500) step = 50;
        else if (widthUtm < 1500) step = 100;
        else if (widthUtm < 5000) step = 500;
        else if (widthUtm < 15000) step = 1000;
        else step = 5000;
      }

      const lines = [];
      const labels = { top: [], bottom: [], left: [], right: [] };

      const minX = Math.floor(swUtm[0] / step) * step;
      const maxX = Math.ceil(neUtm[0] / step) * step;
      const minY = Math.floor(swUtm[1] / step) * step;
      const maxY = Math.ceil(neUtm[1] / step) * step;

      // Vertical lines (Eastings)
      for (let x = minX; x <= maxX; x += step) {
        if (x === 0) continue;
        const bottom = proj4('EPSG:32717', 'EPSG:4326', [x, minY]);
        const top = proj4('EPSG:32717', 'EPSG:4326', [x, maxY]);
        lines.push([[bottom[1], bottom[0]], [top[1], top[0]]]);

        const ptTop = map.latLngToContainerPoint([top[1], top[0]]);
        labels.top.push({ text: x.toString(), val: ptTop.x });

        const ptBottom = map.latLngToContainerPoint([bottom[1], bottom[0]]);
        labels.bottom.push({ text: x.toString(), val: ptBottom.x });
      }

      // Horizontal lines (Northings)
      for (let y = minY; y <= maxY; y += step) {
        if (y === 0) continue;
        const left = proj4('EPSG:32717', 'EPSG:4326', [minX, y]);
        const right = proj4('EPSG:32717', 'EPSG:4326', [maxX, y]);
        lines.push([[left[1], left[0]], [right[1], right[0]]]);

        const ptLeft = map.latLngToContainerPoint([left[1], left[0]]);
        labels.left.push({ text: y.toString(), val: ptLeft.y });

        const ptRight = map.latLngToContainerPoint([right[1], right[0]]);
        labels.right.push({ text: y.toString(), val: ptRight.y });
      }

      setGridLines(lines);
      if (setMapGridLabels) setMapGridLabels(labels);
    };

    updateGrid();
    map.on('moveend zoomend', updateGrid);
    return () => map.off('moveend zoomend', updateGrid);
  }, [map, setMapGridLabels, isMinimap]);

  return (
    <>
      {gridLines.map((line, i) => (
        <Polyline key={i} positions={line} pathOptions={{ color: '#444444', weight: isMinimap ? 0.4 : 0.6, opacity: 0.6 }} />
      ))}
    </>
  );
};

export default function ReportePlanimetrico() {
  const { id, codigo } = useParams();
  const navigate = useNavigate();
  const { activeEmpresa, activeProyecto } = useContext(AppContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [allPredios, setAllPredios] = useState([]);

  const [scale, setScale] = useState('Auto');
  const [customScale, setCustomScale] = useState('');
  const [calculatedScale, setCalculatedScale] = useState('Auto');
  const [graphicScale, setGraphicScale] = useState({ totalWidthPx: 200, ticks: [0, 50, 100, 150, 200, 250] });
  const [mapGridLabels, setMapGridLabels] = useState({ top: [], bottom: [], left: [], right: [] });
  const [minimapGridLabels, setMinimapGridLabels] = useState({ top: [], bottom: [], left: [], right: [] });

  const [showTextModal, setShowTextModal] = useState(false);
  const [codigoCarta, setCodigoCarta] = useState('');
  const [nombreCarta, setNombreCarta] = useState('');
  const [nombreCuadricula, setNombreCuadricula] = useState('ZONA 17S');
  const [cartasCatalog, setCartasCatalog] = useState([]);
  const [isSavingCarta, setIsSavingCarta] = useState(false);

  // Estados de Capa de Fondo para el Mapa Referencial Pequeño
  const [fondoMinimapa, setFondoMinimapa] = useState('cad'); // 'cad' | 'osm' | 'satelital' | 'blanco'
  const [cadArchivosList, setCadArchivosList] = useState([]);
  const [selectedCadFile, setSelectedCadFile] = useState('');
  const [cadGeoJson, setCadGeoJson] = useState(null);
  const [isLoadingCad, setIsLoadingCad] = useState(false);

  // Estado de Ventana Emergente de Previsualización Interactiva
  const [previewModal, setPreviewModal] = useState({ isOpen: false, type: 'plano' }); // 'plano' | 'minimapa'
  const [modalLayerType, setModalLayerType] = useState('cad'); // 'cad' | 'satelital' | 'osm' | 'blanco'

  // Controles de tamaño de puntos y texto
  const [pointSize, setPointSize] = useState(6);
  const [textSize, setTextSize] = useState(10);

  const predefinedScales = ['Auto', '1:100', '1:500', '1:1000', '1:1500', '1:2000', '1:2500', '1:3000', '1:4000', '1:5000', '1:10000', '1:50000'];

  const fetchCartasCatalog = useCallback(async () => {
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/cartas-topograficas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setCartasCatalog(json);
      }
    } catch (e) { }
  }, []);

  const fetchCadArchivos = useCallback(async () => {
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/cad-archivos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          setCadArchivosList(json);
          if (json.length > 0 && !selectedCadFile) {
            setSelectedCadFile(json[0].nombre_archivo);
          }
        }
      }
    } catch (e) { }
  }, [selectedCadFile]);

  const fetchCadGeoJson = useCallback(async (archivo) => {
    if (!archivo) return;
    try {
      setIsLoadingCad(true);
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/cad-layers/geojson?archivo=${encodeURIComponent(archivo)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setCadGeoJson(json);
      }
    } catch (e) {
      console.error("Error al cargar GeoJSON CAD:", e);
    } finally {
      setIsLoadingCad(false);
    }
  }, []);

  useEffect(() => {
    fetchCartasCatalog();
    fetchCadArchivos();
  }, [fetchCartasCatalog, fetchCadArchivos]);

  useEffect(() => {
    if (fondoMinimapa === 'cad' && selectedCadFile) {
      fetchCadGeoJson(selectedCadFile);
    }
  }, [fondoMinimapa, selectedCadFile, fetchCadGeoJson]);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.body.style.backgroundColor = '#f1f5f9';
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.backgroundColor = '';
    };
  }, []);

  useEffect(() => {
    const fetchAllPredios = async () => {
      try {
        const token = localStorage.getItem('catastro_token');
        const params = new URLSearchParams();
        if (activeEmpresa) params.append('empresa_id', activeEmpresa.id);
        if (activeProyecto) params.append('proyecto_id', activeProyecto.id);
        const queryStr = params.toString() ? `?${params.toString()}` : '';

        const res = await fetch(`${API_URL}/api/gis/codigos-catastrales${queryStr}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          json.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
          setAllPredios(json);
        }
      } catch (e) { }
    };
    fetchAllPredios();
  }, [activeEmpresa, activeProyecto]);

  useEffect(() => {
    fetchReportData();
  }, [id, codigo]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setData(null);
      const token = localStorage.getItem('catastro_token');

      let url = '';
      if (codigo) {
        if (codigo.startsWith('offline_')) {
          const localData = await getOfflinePredioById(codigo);
          if (localData) {
            // Reconstruct a format similar to what the API returns
            setData({
              predio: localData,
              vertices: [], // Or parse them from geom_geojson if needed, but the map uses geom_geojson
              lineas: []
            });
            setLoading(false);
            return;
          }
        }
        url = `${API_URL}/api/gis/predios/detalle/${codigo}`;
      } else {
        url = `${API_URL}/api/gis/predios/detalle-id/${id}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.predio) {
          const cod = json.predio.codigo_carta || '';
          const nom = json.predio.nombre_carta || '';
          const cuad = json.predio.cuadricula_carta || 'ZONA 17S';
          setCodigoCarta(cod);
          setNombreCarta(nom);
          setNombreCuadricula(cuad);

          // Si viene carta detectada automáticamente por intersección espacial, buscar archivo CAD
          if (nom || cod) {
            const nomClean = nom.toUpperCase();
            const codClean = cod.toUpperCase();
            const matchCad = cadArchivosList.find(a =>
              (nomClean && a.nombre && a.nombre.toUpperCase() === nomClean) ||
              (codClean && a.codigo && a.codigo.toUpperCase() === codClean) ||
              (nomClean && a.nombre_archivo.toUpperCase().includes(nomClean)) ||
              (codClean && a.nombre_archivo.toUpperCase().includes(codClean))
            );
            if (matchCad) {
              setSelectedCadFile(matchCad.nombre_archivo);
            }
          }
        }
      } else {
        showError('No se pudo cargar la información del predio (Puede no tener mapa asociado)');
      }
    } catch (e) {
      showError('Error de red al consultar el predio');
    } finally {
      setLoading(false);
    }
  };

  // Auto-seleccionar archivo CAD cuando cargue la lista o cambie la carta detectada
  useEffect(() => {
    if (cadArchivosList.length > 0) {
      const nomClean = (nombreCarta || '').trim().toUpperCase();
      const codClean = (codigoCarta || '').trim().toUpperCase();
      const matchCad = cadArchivosList.find(a =>
        (nomClean && a.nombre && a.nombre.toUpperCase() === nomClean) ||
        (codClean && a.codigo && a.codigo.toUpperCase() === codClean) ||
        (nomClean && a.nombre_archivo.toUpperCase().includes(nomClean)) ||
        (codClean && a.nombre_archivo.toUpperCase().includes(codClean))
      );
      if (matchCad) {
        setSelectedCadFile(matchCad.nombre_archivo);
      } else if (!selectedCadFile && cadArchivosList.length > 0) {
        setSelectedCadFile(cadArchivosList[0].nombre_archivo);
      }
    }
  }, [cadArchivosList, nombreCarta, codigoCarta]);

  const predio = data?.predio || {};
  const vertices = data?.vertices || [];
  const linderos = data?.linderos || [];

  const displayCarta = useMemo(() => {
    // Si nombreCarta existe, mostrar solo ese nombre limpio (ej: CATARAMA o JUAN MONTALVO)
    if (nombreCarta) return nombreCarta.trim().toUpperCase();
    if (codigoCarta) return codigoCarta.trim().toUpperCase();
    if (selectedCadFile) {
      const match = cartasCatalog.find(c => c.nombre === selectedCadFile || c.codigo === selectedCadFile);
      if (match?.nombre) return match.nombre.trim().toUpperCase();
      if (match?.codigo) return match.codigo.trim().toUpperCase();

      const cadMatch = cadArchivosList.find(a => a.nombre_archivo === selectedCadFile);
      if (cadMatch?.nombre) return cadMatch.nombre.trim().toUpperCase();

      let clean = selectedCadFile.replace(/\.[^/.]+$/, '');
      clean = clean.replace(/^[A-Za-z0-9]+-[A-Za-z0-9]+/i, '').replace(/[-_]/g, ' ').trim().toUpperCase();
      return clean || selectedCadFile.replace(/\.[^/.]+$/, '').toUpperCase();
    }
    return '';
  }, [codigoCarta, nombreCarta, selectedCadFile, cartasCatalog, cadArchivosList]);

  const displayCuadricula = useMemo(() => {
    if (nombreCuadricula && nombreCuadricula !== 'ZONA 17S') return nombreCuadricula.trim().toUpperCase();
    if (selectedCadFile) {
      const match = cartasCatalog.find(c => c.nombre === selectedCadFile || c.codigo === selectedCadFile);
      if (match?.cuadricula) return match.cuadricula.trim().toUpperCase();

      const cadMatch = cadArchivosList.find(a => a.nombre_archivo === selectedCadFile);
      if (cadMatch?.cuadricula) return cadMatch.cuadricula.trim().toUpperCase();

      const m = selectedCadFile.match(/([A-Za-z0-9]+-[A-Za-z0-9]+)/i);
      if (m) return m[1].toUpperCase();
    }
    return nombreCuadricula || 'ZONA 17S';
  }, [nombreCuadricula, selectedCadFile, cartasCatalog, cadArchivosList]);

  const handleSaveCartaToDB = async () => {
    const targetIdOrCod = predio?.id || predio?.cod_catastral || codigo || id;
    if (!targetIdOrCod) {
      showError('No se encontró el identificador del predio para guardar');
      return;
    }
    try {
      setIsSavingCarta(true);
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/predios/${targetIdOrCod}/carta-topografica`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          codigo_carta: codigoCarta,
          nombre_carta: nombreCarta,
          cuadricula_carta: nombreCuadricula
        })
      });
      if (res.ok) {
        showSuccess('Carta topográfica guardada en la base de datos');
        fetchCartasCatalog();
        setShowTextModal(false);
      } else {
        const err = await res.json();
        showError(err.detail || 'Error al guardar carta topográfica');
      }
    } catch (e) {
      showError('Error de conexión al guardar carta topográfica');
    } finally {
      setIsSavingCarta(false);
    }
  };

  const polygonCoords = useMemo(() => {
    const coords = [];
    if (predio.geom_wkt) {
      try {
        const coordsStr = predio.geom_wkt.replace('POLYGON((', '').replace('))', '');
        coordsStr.split(',').forEach(p => {
          const [lng, lat] = p.trim().split(' ');
          if (lat && lng) coords.push([parseFloat(lat), parseFloat(lng)]);
        });
      } catch (e) { }
    }
    return coords;
  }, [predio.geom_wkt]);

  const centerInfo = useMemo(() => {
    if (polygonCoords.length === 0) return { center: [0, 0], width: 1, height: 1 };
    const lats = polygonCoords.map(p => p[0]);
    const lngs = polygonCoords.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    let maxDist = 0;
    let mainAngle = 0;
    for (let i = 0; i < polygonCoords.length; i++) {
      for (let j = i + 1; j < polygonCoords.length; j++) {
        const dx = polygonCoords[j][1] - polygonCoords[i][1];
        const dy = polygonCoords[j][0] - polygonCoords[i][0];
        const dist = dx * dx + dy * dy;
        if (dist > maxDist) {
          maxDist = dist;
          // dy is inverted because latitude increases UP, but DOM Y increases DOWN
          let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
          // Normalize angle so text is always readable (left-to-right / top-to-bottom)
          if (angle > 90 || angle < -90) angle += 180;
          mainAngle = angle;
        }
      }
    }

    return {
      center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
      height: maxLat - minLat || 1,
      width: maxLng - minLng || 1,
      mainAngle
    };
  }, [polygonCoords]);
  const center = centerInfo.center;

  // Calcular centroides y linderos
  const linderosConInfo = linderos.map((l, index) => {
    let midPoint = [0, 0];
    try {
      const coordsStr = l.geom_wkt.replace('LINESTRING(', '').replace(')', '');
      const points = coordsStr.split(',').map(p => {
        const [lng, lat] = p.trim().split(' ');
        return [parseFloat(lat), parseFloat(lng)];
      });
      if (points.length >= 2) {
        midPoint = [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
      }
    } catch (e) { }

    const currentCode = vertices[index]?.codigo || `P${String(index + 1).padStart(2, '0')}`;
    const nextCode = (index < vertices.length - 1)
      ? (vertices[index + 1]?.codigo || `P${String(index + 2).padStart(2, '0')}`)
      : (vertices[0]?.codigo || 'P01');
    const tramoCalculado = (l.tramo && l.tramo !== '-') ? l.tramo : `${currentCode} - ${nextCode}`;

    return {
      ...l,
      tramo: tramoCalculado,
      orientacion: getOrientacionGeometrica(center, midPoint, centerInfo.width, centerInfo.height)
    };
  });

  // Agrupar Linderos por Orientación
  const linderosNorte = linderosConInfo.filter(l => l.orientacion === 'NORTE');
  const linderosSur = linderosConInfo.filter(l => l.orientacion === 'SUR');
  const linderosEste = linderosConInfo.filter(l => l.orientacion === 'ESTE');
  const linderosOeste = linderosConInfo.filter(l => l.orientacion === 'OESTE');

  const renderLinderoText = (l) => {
    const tramoStr = (l.tramo || '').replace(' - ', ' al ');
    return `Del ${tramoStr} con una distancia de ${l.longitud ? l.longitud.toFixed(2) : '0.00'} m, Rumbo ${l.rumbo || '-'}; ${l.colindante || ''}`;
  };

  const currentDate = new Date().toLocaleDateString('es-ES');
  const dpaProvincia = activeEmpresa?.provincia || predio?.provincia || 'LOS RÍOS';
  const dpaCanton = activeEmpresa?.canton || predio?.canton || 'URDANETA';
  const dpaParroquia = activeEmpresa?.ciudad || predio?.ciudad || 'CATARAMA';
  const dpaSector = activeEmpresa?.sector || predio?.sector || 'URBANO';

  const displayScale = scale === 'custom' ? customScale : scale;

  const currentIndex = allPredios.findIndex(p => p.codigo === (codigo || predio?.codigo) || p.id === parseInt(id || predio?.id));

  const goFirst = () => {
    if (allPredios.length > 0) navigate(`/reporte/planimetrico/codigo/${allPredios[0].codigo}`);
  };
  const goPrev = () => {
    if (currentIndex > 0) navigate(`/reporte/planimetrico/codigo/${allPredios[currentIndex - 1].codigo}`);
  };
  const goNext = () => {
    if (currentIndex < allPredios.length - 1) navigate(`/reporte/planimetrico/codigo/${allPredios[currentIndex + 1].codigo}`);
  };
  const goLast = () => {
    if (allPredios.length > 0) navigate(`/reporte/planimetrico/codigo/${allPredios[allPredios.length - 1].codigo}`);
  };

  // Zoom del reporte (documento)
  const [reportZoom, setReportZoom] = useState(window.innerWidth <= 768 ? 0.4 : 1);
  const [textAngleOffset, setTextAngleOffset] = useState(0);

  useEffect(() => {
    if (predio?.angulo_texto && predio.angulo_texto !== 0) {
      setTextAngleOffset(predio.angulo_texto);
    } else if (centerInfo?.mainAngle !== undefined) {
      setTextAngleOffset(Math.round(centerInfo.mainAngle));
    }
  }, [predio, centerInfo?.mainAngle]);

  const handleSaveAngle = async () => {
    if (!predio?.id && !predio?.offline_id) return;
    if (predio?.offline_id) {
      // Cannot save angle to API if it's offline
      showSuccess('Ángulo actualizado solo en vista (predio offline)');
      return;
    }
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/predios/${predio.id}/angulo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ angulo_texto: textAngleOffset === 0 ? 360 : textAngleOffset })
      });
      if (res.ok) {
        showSuccess('Ángulo guardado correctamente');
      } else {
        showError('No se pudo guardar el ángulo');
      }
    } catch (e) {
      console.error("Error al guardar ángulo:", e);
      showError('Error de red al guardar');
    }
  };

  return (
    <div className="report-wrapper" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* BARRA DE CONTROLES ATLAS DE NAVEGACIÓN */}
      <div className="report-controls no-print">
        {/* FILA 1: Volver */}
        <div className="rc-row rc-back" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="rc-btn-back" onClick={() => navigate('/geoportal')} title="Regresar al Geoportal / Mapa">
            <ChevronLeft size={16} /> Volver al Geoportal
          </button>
          <button
            className="rc-btn-back"
            onClick={() => navigate('/reporteria')}
            style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b' }}
            title="Ir al listado de reportes"
          >
            Reportería
          </button>
        </div>

        {/* FILA 2: Atlas navegación */}
        <div className="rc-row rc-atlas">
          <span className="rc-label">ATLAS</span>
          <div className="rc-atlas-nav">
            <button className="rc-btn-nav" onClick={goFirst} disabled={currentIndex <= 0}><ChevronsLeft size={16} /></button>
            <button className="rc-btn-nav" onClick={goPrev} disabled={currentIndex <= 0}><ChevronLeft size={16} /></button>
            <select className="rc-select-atlas" value={codigo || predio?.codigo || ''} onChange={(e) => navigate(`/reporte/planimetrico/codigo/${e.target.value}`)}>
              {allPredios.map(p => (
                <option key={p.codigo} value={p.codigo}>{p.codigo} ({p.nombre_posesionario || 'SIN NOMBRE'})</option>
              ))}
            </select>
            <span className="rc-counter">{currentIndex + 1} / {allPredios.length}</span>
            <button className="rc-btn-nav" onClick={goNext} disabled={currentIndex >= allPredios.length - 1}><ChevronRight size={16} /></button>
            <button className="rc-btn-nav" onClick={goLast} disabled={currentIndex >= allPredios.length - 1}><ChevronsRight size={16} /></button>
          </div>
        </div>

        {/* FILA 3: Escala Mapa */}
        <div className="rc-row rc-scale">
          <span className="rc-label">Escala Mapa</span>
          <div className="rc-scale-controls">
            <select className="rc-select" value={scale} onChange={(e) => setScale(e.target.value)}>
              {predefinedScales.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="custom">Manual...</option>
            </select>
            {scale === 'custom' && (
              <input type="text" className="rc-input" placeholder="1:..." value={customScale} onChange={(e) => setCustomScale(e.target.value)} style={{ width: '80px' }} />
            )}
          </div>
        </div>

        {/* FILA 4: Punto y Texto */}
        <div className="rc-row rc-sizes">
          <span className="rc-label">Punto (px)</span>
          <input type="number" className="rc-input" min="1" max="20" value={pointSize} onChange={(e) => setPointSize(Number(e.target.value))} />
          <span className="rc-label" style={{ marginLeft: '10px' }}>Texto</span>
          <input type="number" className="rc-input" min="5" max="30" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} />
        </div>

        {/* FILA 5: Zoom Documento */}
        <div className="rc-row rc-zoom">
          <span className="rc-label">Zoom Documento:</span>
          <div className="rc-scale-controls">
            <button className="rc-btn-nav" onClick={() => setReportZoom(z => Math.max(0.2, z - 0.2))}>-</button>
            <span className="rc-counter" style={{ width: '40px', textAlign: 'center' }}>{Math.round(reportZoom * 100)}%</span>
            <button className="rc-btn-nav" onClick={() => setReportZoom(z => Math.min(3, z + 0.2))}>+</button>
          </div>
          <span className="rc-label" style={{ marginLeft: '10px' }}>Ángulo Texto:</span>
          <div className="rc-scale-controls">
            <button className="rc-btn-nav" onClick={() => setTextAngleOffset(a => (a - 15 + 360) % 360 || 360)}>-</button>
            <input
              type="number"
              className="rc-counter"
              style={{ width: '45px', textAlign: 'center', border: 'none', background: 'transparent', MozAppearance: 'textfield' }}
              value={textAngleOffset}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 0;
                setTextAngleOffset((val % 360 + 360) % 360 || 360);
              }}
            />
            <span style={{ marginLeft: '-5px', fontSize: '11px', color: '#64748b' }}>°</span>
            <button className="rc-btn-nav" onClick={() => setTextAngleOffset(a => (a + 15) % 360 || 360)}>+</button>
          </div>
          <button className="rc-btn-nav" onClick={handleSaveAngle} style={{ marginLeft: '5px', padding: '0 8px', fontSize: '11px' }}>
            Guardar
          </button>
        </div>

        {/* FILA 6: Fondo de Carta Referencial (Minimapa) */}
        <div className="rc-row rc-layers" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="rc-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={14} /> Fondo Carta Referencial:
          </span>
          <select
            className="rc-select"
            value={fondoMinimapa}
            onChange={(e) => setFondoMinimapa(e.target.value)}
            style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px' }}
          >
            <option value="cad">Carta Topográfica CAD (.dxf)</option>
            <option value="osm">OpenStreetMap</option>
            <option value="satelital">Ortofoto / Satelital</option>
            <option value="blanco">Solo Cuadrícula</option>
          </select>

          {fondoMinimapa === 'cad' && cadArchivosList.length > 0 && (
            <select
              className="rc-select"
              value={selectedCadFile}
              onChange={(e) => setSelectedCadFile(e.target.value)}
              style={{ fontSize: '11px', maxWidth: '220px', padding: '3px 6px', borderRadius: '4px' }}
              title="Seleccionar Carta CAD de Fondo"
            >
              {cadArchivosList.map(a => (
                <option key={a.nombre_archivo} value={a.nombre_archivo}>
                  {a.nombre_archivo} ({a.total_elementos || 0} ent.)
                </option>
              ))}
            </select>
          )}

          {fondoMinimapa === 'cad' && isLoadingCad && (
            <Loader2 size={14} className="spin" color="#0284c7" />
          )}
        </div>

        {/* FILA 7: Botones de acción */}
        <div className="rc-row rc-actions">
          <button className="rc-btn-outline" onClick={() => setShowTextModal(true)}>Textos Carta</button>
          <button
            className="rc-btn-outline"
            onClick={() => { setModalLayerType(fondoMinimapa); setPreviewModal({ isOpen: true, type: 'minimapa' }); }}
            title="Abrir ventana emergente interactiva para explorar la carta CAD"
            style={{ color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
          >
            <Maximize2 size={15} /> Previsualizar Carta CAD
          </button>
          <button className="rc-btn-primary" onClick={() => { setReportZoom(1); setTimeout(() => window.print(), 100); }} disabled={!data}>
            <Printer size={18} /> Imprimir PDF
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column' }}>
          <Loader2 size={40} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
          <h2>Generando Reporte...</h2>
        </div>
      )}

      {!loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', color: '#64748b' }}>
          <AlertCircle size={60} style={{ marginBottom: '20px', color: '#cbd5e1' }} />
          <h2>Predio Sin Mapa</h2>
          <p>El código catastral <b>{codigo}</b> está registrado pero aún no tiene un polígono asociado.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {showTextModal && (
            <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '450px', maxWidth: '90vw', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>Configurar Carta Topográfica</h3>
                  <button onClick={() => setShowTextModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8', fontWeight: 'bold' }}>✕</button>
                </div>

                {cartasCatalog.length > 0 && (
                  <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                      Elegir de Cartas Registradas en BD:
                    </label>
                    <select
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: 'white' }}
                      onChange={(e) => {
                        const selected = cartasCatalog.find(c => String(c.id) === e.target.value);
                        if (selected) {
                          setCodigoCarta(selected.codigo || '');
                          setNombreCarta(selected.nombre || '');
                          if (selected.cuadricula) setNombreCuadricula(selected.cuadricula);
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>-- Seleccionar una carta existente --</option>
                      {cartasCatalog.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.codigo ? `${c.codigo} - ` : ''}{c.nombre} ({c.cuadricula || 'ZONA 17S'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Código Carta:</label>
                    <input
                      type="text"
                      value={codigoCarta}
                      onChange={(e) => setCodigoCarta(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                      placeholder="Ej: 3862-I o CT-ÑIV-C1"
                    />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Nombre Carta:</label>
                    <input
                      type="text"
                      value={nombreCarta}
                      onChange={(e) => setNombreCarta(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                      placeholder="Ej: CHONE, ROCAFUERTE"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Cuadrícula / Zona:</label>
                  <input
                    type="text"
                    value={nombreCuadricula}
                    onChange={(e) => setNombreCuadricula(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                    placeholder="Ej: ZONA 17S, MALLA 1"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <button
                    type="button"
                    onClick={() => setShowTextModal(false)}
                    style={{ padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', background: '#f8fafc', fontWeight: '600', fontSize: '13px', color: '#64748b' }}
                  >
                    Solo Vista Previa
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCartaToDB}
                    disabled={isSavingCarta}
                    style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isSavingCarta ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    Guardar en BD
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="report-pages-container" style={{ zoom: reportZoom }}>
            <div className="print-page">
              <div className="report-border">

                {/* HEADER OFICIAL CON LOGO GAD Y NOMBRE DE EMPRESA */}
                <div className="report-header" style={{ position: 'relative', textAlign: 'center', padding: '10px 0', borderBottom: '2px solid black', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* LOGO A LA IZQUIERDA */}
                  {(activeEmpresa?.logo_url || activeEmpresa?.logo) && (
                    <img
                      src={((activeEmpresa.logo_url || activeEmpresa.logo).startsWith('http') ? (activeEmpresa.logo_url || activeEmpresa.logo) : `${API_URL}${activeEmpresa.logo_url || activeEmpresa.logo}`)}
                      alt="Logo Empresa"
                      style={{ position: 'absolute', top: '50%', left: '15px', transform: 'translateY(-50%)', height: '65px', width: 'auto', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}

                  <div className="report-header-text" style={{ display: 'inline-block', textAlign: 'center', padding: '0 90px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {activeEmpresa?.nombre || 'GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL DEL CANTÓN URDANETA'}
                    </div>
                    <h1 style={{ margin: '0', fontSize: '20px', fontWeight: '900', color: '#0f172a', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      LEVANTAMIENTO PLANIMÉTRICO
                    </h1>
                  </div>

                  {/* BANDERA A LA DERECHA */}
                  {activeEmpresa?.bandera_url && (
                    <img
                      src={(activeEmpresa.bandera_url.startsWith('http') ? activeEmpresa.bandera_url : `${API_URL}${activeEmpresa.bandera_url}`)}
                      alt="Bandera Empresa"
                      style={{ position: 'absolute', top: '50%', right: '15px', transform: 'translateY(-50%)', height: '65px', width: 'auto', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>

                <div className="report-body" style={{ display: 'flex', flex: 1 }}>
                  {/* COLUMNA IZQUIERDA: Mapa + Escala Gráfica + Footer Datos */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid black' }}>

                    {/* Mapa */}
                    <div className="report-map-container" style={{ flex: 1, position: 'relative', padding: '30px 25px 20px 30px', backgroundColor: 'white', overflow: 'hidden', borderRight: 'none' }}>
                      <div style={{ position: 'relative', width: '100%', height: '100%', border: '2px solid black', backgroundColor: 'white', zIndex: 0 }}>
                        {/* Botón flotante para previsualización interactiva */}
                        <button
                          type="button"
                          className="no-print"
                          onClick={() => { setModalLayerType('blanco'); setPreviewModal({ isOpen: true, type: 'plano' }); }}
                          style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 999, background: '#0284c7', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                          title="Abrir ventana emergente interactiva de este plano"
                        >
                          <Maximize2 size={13} /> Previsualizar
                        </button>

                        {polygonCoords.length > 0 && (
                          <MapContainer center={center} zoom={18} maxZoom={24} zoomSnap={0.1} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false}>
                            <MapScaleUpdater scaleValue={displayScale} polygonCoords={polygonCoords} setCalculatedScale={setCalculatedScale} setGraphicScale={setGraphicScale} />
                            <UtmGrid setMapGridLabels={setMapGridLabels} />

                            <Polygon positions={polygonCoords} pathOptions={{ color: 'black', weight: 2, fillColor: 'transparent' }} />

                            {vertices.map(v => {
                              let lat = 0, lng = 0;
                              if (v.geom_wkt) {
                                try {
                                  const parts = v.geom_wkt.replace('POINT(', '').replace(')', '').trim().split(' ');
                                  lng = parseFloat(parts[0]);
                                  lat = parseFloat(parts[1]);
                                } catch (e) { }
                              }
                              if (!lat || !lng) return null;
                              return (
                                <React.Fragment key={v.id}>
                                  <Marker position={[lat, lng]} icon={createTextIcon(v.codigo, 'vertex-label', pointSize, textSize, lat, lng, center[0], center[1])} />
                                </React.Fragment>
                              );
                            })}

                            <Marker position={center} icon={L.divIcon({
                              className: 'center-predio-info',
                              html: `<div style="position: absolute; transform: translate(-50%, -50%) rotate(${textAngleOffset}deg); text-align: center; font-size: 8px; line-height: 1.3; font-weight: bold; color: black; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff, 0px 0px 4px #fff; white-space: nowrap;">
                        <div>POSESIONARIO: ${predio?.nombre_posesionario || 'SIN NOMBRE'}</div>
                        <div>C.C.: ${predio?.cedula || 'S/D'} | CÓDIGO: ${predio?.codigo || predio?.cod_catastral || 'S/D'}</div>
                        <div>ÁREA: ${predio?.area_ha ? predio.area_ha.toFixed(4) : '0.0000'} Ha</div>
                      </div>`,
                              iconSize: [0, 0],
                              iconAnchor: [0, 0]
                            })} />

                            {(() => {
                              // Agrupar linderos contiguos por nombre de colindante
                              const contiguousGroups = [];
                              let currGroup = null;
                              linderos.forEach((l, idx) => {
                                const cName = (l.colindante || '').trim();
                                if (cName === '') {
                                  currGroup = null;
                                  return;
                                }
                                if (currGroup && currGroup.name === cName) {
                                  currGroup.indices.push(idx);
                                } else {
                                  currGroup = { name: cName, indices: [idx] };
                                  contiguousGroups.push(currGroup);
                                }
                              });

                              // Seleccionar el índice central geométrico para cada grupo contiguo
                              const centerIndices = new Set();
                              contiguousGroups.forEach(group => {
                                const midIndex = group.indices[Math.floor(group.indices.length / 2)];
                                centerIndices.add(midIndex);
                              });

                              return linderos.map((l, i) => {
                                try {
                                  const coordsStr = l.geom_wkt.replace('LINESTRING(', '').replace(')', '');
                                  const points = coordsStr.split(',').map(p => {
                                    const [lng, lat] = p.trim().split(' ');
                                    return [parseFloat(lat), parseFloat(lng)];
                                  });
                                  if (points.length >= 2) {
                                    const midLat = (points[0][0] + points[1][0]) / 2;
                                    const midLng = (points[0][1] + points[1][1]) / 2;
                                    const medida = `${l.longitud.toFixed(2)}m`;

                                    // Solo pasar el nombre del colindante si este es el segmento central del grupo
                                    const colindanteToRender = centerIndices.has(i) ? l.colindante : '';

                                    return <Marker key={i} position={[midLat, midLng]} icon={createRotatedTextIcon(colindanteToRender, medida, points[0], points[1], center[0], center[1])} />;
                                  }
                                } catch (e) { }
                                return null;
                              });
                            })()}


                            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, textAlign: 'center' }}>
                              <div style={{ width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '30px solid white', filter: 'drop-shadow(0px 0px 1px black)', margin: '0 auto' }}></div>
                              <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '5px', color: 'white', textShadow: '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000' }}>N</div>
                            </div>
                          </MapContainer>
                        )}
                      </div>

                      {mapGridLabels.top.map((lbl, i) => (
                        <div key={`t-${i}`} style={{ position: 'absolute', top: '10px', left: `${lbl.val + 30}px`, transform: 'translateX(-50%)', fontSize: '10px', fontWeight: 'bold' }}>{lbl.text}</div>
                      ))}
                      {mapGridLabels.left.map((lbl, i) => (
                        <div key={`l-${i}`} style={{ position: 'absolute', left: '-15px', top: `${lbl.val + 30}px`, transform: 'translateY(-50%) rotate(-90deg)', fontSize: '10px', fontWeight: 'bold', width: '60px', textAlign: 'center' }}>{lbl.text}</div>
                      ))}
                    </div>

                    {/* Escala Gráfica debajo del mapa */}
                    <div style={{ padding: '0 25px 15px 25px', display: 'flex', alignItems: 'center' }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', marginRight: '15px' }}>ESCALA GRÁFICA:</div>
                      <div style={{ position: 'relative', width: `${Math.min(graphicScale.totalWidthPx || 300, 350)}px`, height: '8px', display: 'flex', border: '1px solid black' }}>
                        {graphicScale.ticks?.map((tick, i) => (
                          <div key={i} style={{ position: 'absolute', left: `${(i / (graphicScale.ticks.length - 1)) * 100}%`, top: '10px', transform: 'translateX(-50%)', fontSize: '8px', fontWeight: 'bold' }}>
                            {tick}
                          </div>
                        ))}
                        {graphicScale.ticks?.slice(0, -1).map((_, i) => (
                          <div key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? 'black' : 'white', borderRight: i < graphicScale.ticks.length - 2 ? '1px solid black' : 'none' }}></div>
                        ))}
                        <div style={{ position: 'absolute', right: '-35px', top: '10px', fontSize: '8px', fontWeight: 'bold' }}>
                          Metros
                        </div>
                      </div>
                    </div>

                    {/* Footer Boxes */}
                    <div style={{ display: 'flex', borderTop: '1px solid black', height: '48px' }}>
                      <div className="footer-box" style={{ flex: 1 }}>
                        <div className="box-title">FECHA:</div>
                        <div className="box-content" style={{ textAlign: 'center' }}>{currentDate}</div>
                      </div>
                      <div className="footer-box" style={{ flex: 1 }}>
                        <div className="box-title">ÁREA:</div>
                        <div className="box-content" style={{ textAlign: 'center' }}>{predio?.area_ha ? predio.area_ha.toFixed(4) : '0.0000'} Ha</div>
                      </div>
                      <div className="footer-box" style={{ flex: 1 }}>
                        <div className="box-title">ESCALA:</div>
                        <div className="box-content" style={{ textAlign: 'center' }}>{scale === 'custom' ? customScale : calculatedScale}</div>
                      </div>
                      <div className="footer-box" style={{ flex: 1.5, borderRight: 'none' }}>
                        <div className="box-title">COORDENADAS PLANAS:</div>
                        <div className="box-content" style={{ fontSize: '7.5px', lineHeight: '1.2', fontWeight: 'bold', paddingTop: '2px', textAlign: 'center' }}>
                          SISTEMA DE COORDENADAS: WGS 1984 UTM ZONE 17S<br />
                          PROYECCIÓN: TRANSVERSE MERCATOR<br />
                          DATUM: WGS 1984
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* COLUMNA DERECHA: Sidebar */}
                  <div className="report-sidebar">
                    <div className="sidebar-box">
                      <div className="minimap-box" style={{ height: '235px', position: 'relative', overflow: 'hidden', padding: '16px 8px 6px 28px', backgroundColor: 'white' }}>
                        <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid black', backgroundColor: 'white' }}>
                          {/* Botón flotante para previsualización interactiva de carta CAD */}
                          <button
                            type="button"
                            className="no-print"
                            onClick={() => { setModalLayerType(fondoMinimapa); setPreviewModal({ isOpen: true, type: 'minimapa' }); }}
                            style={{ position: 'absolute', top: '4px', right: '4px', zIndex: 999, background: '#0284c7', color: 'white', border: 'none', padding: '3px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
                            title="Abrir ventana emergente interactiva de la carta CAD"
                          >
                            <Maximize2 size={10} /> Previsualizar
                          </button>

                          <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false}>
                            {fondoMinimapa === 'osm' && (
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                            )}

                            {fondoMinimapa === 'satelital' && (
                              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                            )}

                            {fondoMinimapa === 'cad' && cadGeoJson && (
                              <GeoJSON
                                key={'minimap_' + selectedCadFile + (cadGeoJson?.features?.length || 0)}
                                data={cadGeoJson}
                                style={(feature) => {
                                  const capa = (feature?.properties?.capa_cad || feature?.properties?.capa || feature?.properties?.layer || '').toUpperCase();
                                  if (capa.includes('CUADRICULA')) return { color: '#94a3b8', weight: 0.6, opacity: 0.6 };
                                  if (capa.includes('RIO') || capa.includes('AGUA') || capa.includes('CAUCE')) return { color: '#0284c7', weight: 1.2, opacity: 0.85 };
                                  if (capa.includes('CAMINO') || capa.includes('VIA')) return { color: '#b45309', weight: 1.0, opacity: 0.85 };
                                  if (capa.includes('CURVA') || capa.includes('NIVEL') || capa.includes('ACCIDENTE')) return { color: '#ca8a04', weight: 0.6, opacity: 0.75 };
                                  return { color: '#475569', weight: 0.7, opacity: 0.7 };
                                }}
                                pointToLayer={(feature, latlng) => {
                                  const textVal = feature?.properties?.texto || feature?.properties?.text;
                                  if (textVal) {
                                    return L.marker(latlng, {
                                      icon: L.divIcon({
                                        className: 'cad-text-label',
                                        html: `<div style="font-size: 6px; font-weight: bold; color: #1e293b; white-space: nowrap; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff; transform: translate(-50%, -50%);">${textVal}</div>`,
                                        iconSize: [0, 0]
                                      })
                                    });
                                  }
                                  return L.circleMarker(latlng, { radius: 1.5, color: '#64748b', weight: 1, opacity: 0.5 });
                                }}
                              />
                            )}

                            <UtmGrid setMapGridLabels={setMinimapGridLabels} isMinimap={true} />
                            <Polygon positions={polygonCoords} pathOptions={{ color: 'black', weight: 2.5, fillColor: '#ea580c', fillOpacity: 0.85 }} />
                          </MapContainer>
                        </div>

                        {/* Coordenadas UTM Referenciales en Bordes del Minimapa */}
                        {minimapGridLabels.top.map((lbl, i) => (
                          <div key={`mt-${i}`} style={{ position: 'absolute', top: '2px', left: `${lbl.val + 28}px`, transform: 'translateX(-50%)', fontSize: '6.5px', fontWeight: 'bold', color: '#0f172a' }}>
                            {lbl.text}
                          </div>
                        ))}
                        {minimapGridLabels.left.map((lbl, i) => (
                          <div key={`ml-${i}`} style={{ position: 'absolute', left: '-14px', top: `${lbl.val + 16}px`, transform: 'translateY(-50%) rotate(-90deg)', fontSize: '6.5px', fontWeight: 'bold', color: '#0f172a', width: '55px', textAlign: 'center' }}>
                            {lbl.text}
                          </div>
                        ))}
                      </div>
                      <div className="box-content-center" style={{ fontSize: '8.5px', borderTop: '1px solid black', padding: '4px 5px', lineHeight: '1.3' }}>
                        <div style={{ fontWeight: 'bold' }}>UBICACIÓN:</div>
                        <div>CARTA TOPOGRÁFICA: {displayCarta || '_________________'}</div>
                        <div style={{ marginTop: '1px' }}>ESCALA 1:50000</div>
                        <div>CÓDIGO: {displayCuadricula || 'ZONA 17S'}</div>
                      </div>
                    </div>

                    <div className="sidebar-box">
                      <div className="box-title">POSESIONARIO:</div>
                      <div className="box-content">
                        {predio?.nombre_posesionario || 'SIN NOMBRE'}<br />
                        C.C.: {predio?.cedula || 'S/D'}
                      </div>
                    </div>
                    <div className="sidebar-box">
                      <div className="box-title">Codigo Catastral</div>
                      <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {predio?.codigo || predio?.cod_catastral || 'S/D'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid black' }}>
                      <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex', flexDirection: 'column', minHeight: '35px' }}>
                        <div className="box-title" style={{ borderBottom: 'none' }}>PROVINCIA:</div>
                        <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {dpaProvincia}
                        </div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '35px' }}>
                        <div className="box-title" style={{ borderBottom: 'none' }}>CANTÓN:</div>
                        <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {dpaCanton}
                        </div>
                      </div>
                    </div>

                    <div className="sidebar-box">
                      <div className="box-title">PARROQUIA:</div>
                      <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {dpaParroquia}
                      </div>
                    </div>

                    <div className="sidebar-box">
                      <div className="box-title">SECTOR:</div>
                      <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {dpaSector}
                      </div>
                    </div>

                    <div className="sidebar-box">
                      <div className="box-title">NOMBRE DEL PREDIO:</div>
                      <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {predio?.nombre_predio || 'SIN NOMBRE'}
                      </div>
                    </div>

                    <div className="sidebar-box" style={{ flex: 1, borderBottom: 'none' }}>
                      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                        <div style={{ flex: 1, borderRight: '1px solid black', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                          <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>RESP. TÉCNICO:</div>
                          <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                            <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                            <div style={{ fontSize: '7px', fontWeight: 'bold', minHeight: '10px' }}>
                              {activeEmpresa?.nombre_director || ' '}
                            </div>
                          </div>
                        </div>
                        <div style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                          <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>REVISADO Y APROBADO POR:</div>
                          <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                            <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                            <div style={{ fontSize: '7px', fontWeight: 'bold', minHeight: '10px', color: 'transparent', userSelect: 'none' }}>
                              .
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PÁGINA 2: TABLAS DE LINDEROS */}
            <div className="print-page">
              <div className="report-inner-border">
                <div className="page2-header">
                  <div className="page2-title">INFORME DE LINDERACIÓN</div>
                  <div className="page2-title">DESCRIPCIÓN DE LINDEROS</div>
                </div>

                <div className="page2-body">
                  {/* LADO IZQUIERDO: TABLA VERTICES */}
                  <div className="page2-col-left">
                    <div className="dpa-grid" style={{ border: '1px solid black', marginBottom: '10px' }}>
                      <div className="dpa-col" style={{ padding: '4px' }}><div style={{ fontWeight: 'bold', fontSize: '9px' }}>PROVINCIA:</div><div style={{ textAlign: 'center', fontSize: '11px' }}>{dpaProvincia}</div></div>
                      <div className="dpa-col" style={{ padding: '4px' }}><div style={{ fontWeight: 'bold', fontSize: '9px' }}>CANTÓN:</div><div style={{ textAlign: 'center', fontSize: '11px' }}>{dpaCanton}</div></div>
                      <div className="dpa-col" style={{ padding: '4px' }}><div style={{ fontWeight: 'bold', fontSize: '9px' }}>PARROQUIA:</div><div style={{ textAlign: 'center', fontSize: '11px' }}>{dpaParroquia}</div></div>
                      <div className="dpa-col" style={{ padding: '4px' }}><div style={{ fontWeight: 'bold', fontSize: '9px' }}>SECTOR:</div><div style={{ textAlign: 'center', fontSize: '11px' }}>{dpaSector}</div></div>
                    </div>

                    <div style={{ display: 'flex', border: '1px solid black', marginBottom: '10px' }}>
                      <div style={{ flex: 1, padding: '4px', borderRight: '1px solid black' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '9px' }}>NOMBRES DEL POSESIONARIO</div>
                        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '5px' }}>{predio.nombre_posesionario || 'SIN NOMBRE'}<br />C.C.: {predio.cedula || 'S/D'}</div>
                      </div>
                      <div style={{ flex: .5, padding: '2px', borderRight: '1px solid black' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '9px' }}>NOMBRE DEL PREDIO</div>
                        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '5px' }}>{predio?.nombre_predio || predio?.nombre || 'SIN NOMBRE'}</div>
                      </div>
                      <div style={{ flex: .5, padding: '2px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '9px' }}>CÓDIGO CATASTRAL</div>
                        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '5px' }}>{predio?.codigo || predio?.cod_catastral || 'S/D'}</div>
                      </div>
                    </div>

                    <table className="report-table">
                      <thead>
                        <tr>
                          <th rowSpan="2">PUNTOS</th>
                          <th colSpan="2">COORDENADAS PLANAS<br />UTM W.G.S.-84</th>
                          <th rowSpan="2">VERTICE<br />DESDE-HASTA</th>
                          <th rowSpan="2">DISTANCIA (m)</th>
                          <th rowSpan="2">RUMBO</th>
                          <th rowSpan="2">COLINDANTES</th>
                        </tr>
                        <tr>
                          <th>X</th>
                          <th>Y</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vertices.map((v, i) => {
                          const l = linderosConInfo[i] || linderos[i] || {};
                          const currentCode = v.codigo || `P${String(i + 1).padStart(2, '0')}`;
                          const nextCode = (i < vertices.length - 1)
                            ? (vertices[i + 1]?.codigo || `P${String(i + 2).padStart(2, '0')}`)
                            : (vertices[0]?.codigo || 'P01');
                          const desdeHasta = (l.tramo && l.tramo !== '-') ? l.tramo : `${currentCode} - ${nextCode}`;

                          return (
                            <tr key={v.id || i}>
                              <td>{currentCode}</td>
                              <td>{v.coord_x ? v.coord_x.toFixed(3) : '-'}</td>
                              <td>{v.coord_y ? v.coord_y.toFixed(3) : '-'}</td>
                              <td>{desdeHasta}</td>
                              <td>{l.longitud ? l.longitud.toFixed(2) : '-'}</td>
                              <td>{l.rumbo || '-'}</td>
                              <td style={{ fontSize: '8px' }}>{l.colindante || '-'}</td>
                            </tr>
                          );
                        })}
                        {/* Filas vacías de relleno si hay pocos vértices */}
                        {vertices.length < 22 && Array.from({ length: 22 - vertices.length }).map((_, i) => (
                          <tr key={`empty-${i}`}>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* LADO DERECHO: DESCRIPCION ORIENTACION */}
                  <div className="page2-col-right" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="desc-box">
                      <div className="desc-box-title">COLINDANTE NORTE</div>
                      <div className="desc-box-content">
                        {linderosNorte.length > 0 ? linderosNorte.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                      </div>
                    </div>
                    <div className="desc-box">
                      <div className="desc-box-title">COLINDANTE SUR</div>
                      <div className="desc-box-content">
                        {linderosSur.length > 0 ? linderosSur.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                      </div>
                    </div>
                    <div className="desc-box">
                      <div className="desc-box-title">COLINDANTE ESTE</div>
                      <div className="desc-box-content">
                        {linderosEste.length > 0 ? linderosEste.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                      </div>
                    </div>
                    <div className="desc-box">
                      <div className="desc-box-title">COLINDANTE OESTE</div>
                      <div className="desc-box-content">
                        {linderosOeste.length > 0 ? linderosOeste.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                      </div>
                    </div>

                    <div style={{ flex: 1 }}></div>

                    <div className="firmas-grid">
                      <div className="firma-box">
                        <div className="firma-box-title">RESPONSABILIDAD TÉCNICA</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '8px', fontWeight: 'bold' }}>{activeEmpresa?.nombre_director || ' '}</div>
                          <div style={{ fontSize: '8px' }}>Director(a) de Catastro</div>
                        </div>
                      </div>
                      <div className="firma-box" style={{ borderLeft: 'none' }}>
                        <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          {/* Textos ocultos para igualar la altura de la caja izquierda y alinear la línea */}
                          <div style={{ fontSize: '8px', fontWeight: 'bold', color: 'transparent', userSelect: 'none' }}>.</div>
                          <div style={{ fontSize: '8px', color: 'transparent', userSelect: 'none' }}>.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* VENTANA EMERGENTE DE PREVISUALIZACIÓN INTERACTIVA */}
          {previewModal.isOpen && (
            <div
              className="no-print"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(6px)',
                zIndex: 99999,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '20px'
              }}
              onClick={() => setPreviewModal({ isOpen: false, type: 'plano' })}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  width: '95vw',
                  maxWidth: '1200px',
                  height: '88vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Modal - Tema Claro */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#0f172a' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                      <ZoomIn size={18} color="#0284c7" />
                      {previewModal.type === 'plano' ? 'Previsualización Interactiva: Levantamiento Planimétrico' : 'Previsualización Interactiva: Carta Topográfica (Ubicación 1:50000)'}
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                      Rueda del mouse o botones para acercar (+), alejar (-) y mover. La lámina del reporte permanecerá fija con su escala oficial.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Selector de capa en modal */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>Capa:</span>
                      <select
                        value={modalLayerType}
                        onChange={(e) => setModalLayerType(e.target.value)}
                        style={{ background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', padding: '2px 6px', fontWeight: '500' }}
                      >
                        <option value="cad">Carta CAD (.dxf)</option>
                        <option value="satelital">Ortofoto / Satelital</option>
                        <option value="osm">OpenStreetMap</option>
                        <option value="blanco">Plano Blanco</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setPreviewModal({ isOpen: false, type: 'plano' })}
                      style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '6px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                    >
                      <X size={14} /> Cerrar
                    </button>
                  </div>
                </div>

                {/* Contenedor del Mapa Interactivo */}
                <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
                  <MapContainer
                    center={center}
                    zoom={previewModal.type === 'plano' ? 18 : 14}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={true}
                    scrollWheelZoom={true}
                    doubleClickZoom={true}
                    dragging={true}
                    touchZoom={true}
                  >
                    {modalLayerType === 'osm' && (
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                    )}
                    {modalLayerType === 'satelital' && (
                      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    )}
                    {modalLayerType === 'cad' && cadGeoJson && (
                      <GeoJSON
                        key={'modal_cad_' + selectedCadFile + (cadGeoJson?.features?.length || 0)}
                        data={cadGeoJson}
                        style={(feature) => {
                          const capa = (feature?.properties?.capa_cad || feature?.properties?.capa || feature?.properties?.layer || '').toUpperCase();
                          if (capa.includes('CUADRICULA')) return { color: '#94a3b8', weight: 0.8, opacity: 0.6 };
                          if (capa.includes('RIO') || capa.includes('AGUA') || capa.includes('CAUCE')) return { color: '#0284c7', weight: 1.4, opacity: 0.9 };
                          if (capa.includes('CAMINO') || capa.includes('VIA')) return { color: '#b45309', weight: 1.2, opacity: 0.9 };
                          if (capa.includes('CURVA') || capa.includes('NIVEL')) return { color: '#ca8a04', weight: 0.7, opacity: 0.8 };
                          return { color: '#475569', weight: 0.8, opacity: 0.7 };
                        }}
                        pointToLayer={(feature, latlng) => {
                          const textVal = feature?.properties?.texto || feature?.properties?.text;
                          if (textVal) {
                            return L.marker(latlng, {
                              icon: L.divIcon({
                                className: 'cad-text-label',
                                html: `<div style="font-size: 8px; font-weight: bold; color: #0f172a; white-space: nowrap; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff; transform: translate(-50%, -50%);">${textVal}</div>`,
                                iconSize: [0, 0]
                              })
                            });
                          }
                          return L.circleMarker(latlng, { radius: 2, color: '#64748b', weight: 1 });
                        }}
                      />
                    )}

                    <UtmGrid isMinimap={previewModal.type === 'minimapa'} />
                    <Polygon positions={polygonCoords} pathOptions={{ color: '#0f172a', weight: 3, fillColor: '#f97316', fillOpacity: 0.35 }} />

                    {/* Vértices del Predio */}
                    {vertices.map(v => {
                      let lat = 0, lng = 0;
                      if (v.geom_wkt) {
                        try {
                          const parts = v.geom_wkt.replace('POINT(', '').replace(')', '').trim().split(' ');
                          lng = parseFloat(parts[0]);
                          lat = parseFloat(parts[1]);
                        } catch (e) { }
                      }
                      if (!lat || !lng) return null;
                      return (
                        <Marker key={v.id} position={[lat, lng]} icon={createTextIcon(v.codigo, 'vertex-label', 7, 11, lat, lng, center[0], center[1])} />
                      );
                    })}
                  </MapContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
