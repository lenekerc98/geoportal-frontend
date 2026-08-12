import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Marker, Polyline, useMap, LayersControl, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import proj4 from 'proj4';

// Definir proyección UTM 17S
proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");
import { Printer, ArrowLeft, Loader2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, AlertCircle } from 'lucide-react';
import { API_URL } from '../../services/api';
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

  const offsetDist = 12;
  const offsetX = Math.cos(outAngle) * offsetDist;
  const offsetY = Math.sin(outAngle) * offsetDist;

  return L.divIcon({
    className: 'lindero-rotated',
    html: `<div style="position: absolute; transform: translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; display: flex; flex-direction: column; align-items: center; justify-content: center; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
      ${colindante ? `<div style="color: #1a237e;">${colindante}</div>` : ''}
      <div style="color: #37474f;">${medida}</div>
    </div>`,
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
  if (angle >= -135 && angle < -45) return 'SUR';
  return 'OESTE';
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

const UtmGrid = ({ setMapGridLabels }) => {
  const map = useMap();
  const [gridLines, setGridLines] = useState([]);

  useEffect(() => {
    const updateGrid = () => {
      const bounds = map.getBounds();

      const swUtm = proj4('EPSG:4326', 'EPSG:32717', [bounds.getWest(), bounds.getSouth()]);
      const neUtm = proj4('EPSG:4326', 'EPSG:32717', [bounds.getEast(), bounds.getNorth()]);

      const widthUtm = Math.abs(neUtm[0] - swUtm[0]);
      let step = 1000;
      if (widthUtm < 200) step = 20;
      else if (widthUtm < 500) step = 50;
      else if (widthUtm < 1500) step = 100;
      else if (widthUtm < 5000) step = 500;
      else if (widthUtm < 15000) step = 1000;
      else step = 5000;

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
  }, [map, setMapGridLabels]);

  return (
    <>
      {gridLines.map((line, i) => (
        <Polyline key={i} positions={line} pathOptions={{ color: '#444444', weight: 0.6, opacity: 0.6 }} />
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

  const [showTextModal, setShowTextModal] = useState(false);
  const [nombreCarta, setNombreCarta] = useState('');
  const [nombreCuadricula, setNombreCuadricula] = useState('');

  // Controles de tamaño de puntos y texto
  const [pointSize, setPointSize] = useState(6);
  const [textSize, setTextSize] = useState(10);

  const predefinedScales = ['Auto', '1:100', '1:500', '1:1000', '1:1500', '1:2000', '1:2500', '1:3000', '1:4000', '1:5000', '1:10000', '1:50000'];

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
      } else {
        showError('No se pudo cargar la información del predio (Puede no tener mapa asociado)');
      }
    } catch (e) {
      showError('Error de red al consultar el predio');
    } finally {
      setLoading(false);
    }
  };

  const predio = data?.predio || {};
  const vertices = data?.vertices || [];
  const linderos = data?.linderos || [];

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

  return (
    <div className="report-wrapper" style={{ height: '100vh', overflow: 'auto', paddingBottom: '40px' }}>

      {/* BARRA DE CONTROLES ATALAS DE NAVEGACIÓN */}
      <div className="report-controls no-print" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <div className="report-controls-group" style={{ flexWrap: 'wrap', justifyContent: 'center', flex: 1 }}>
          <button onClick={() => navigate('/reporteria')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            <ArrowLeft size={16} /> <span className="hide-on-mobile">Volver a Reportería</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', borderLeft: '2px solid #e2e8f0', paddingLeft: '15px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Atlas:</span>
            <button onClick={goFirst} disabled={currentIndex <= 0} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer' }}><ChevronsLeft size={16} /></button>
            <button onClick={goPrev} disabled={currentIndex <= 0} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={16} /></button>

            <select
              value={codigo || predio?.codigo || ''}
              onChange={(e) => navigate(`/reporte/planimetrico/codigo/${e.target.value}`)}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '13px', maxWidth: '200px', textOverflow: 'ellipsis' }}
            >
              {allPredios.map(p => (
                <option key={p.codigo} value={p.codigo}>{p.codigo} ({p.nombre_posesionario || 'SIN NOMBRE'})</option>
              ))}
            </select>

            <span style={{ fontSize: '12px', color: '#64748b' }}>/ {allPredios.length}</span>

            <button onClick={goNext} disabled={currentIndex >= allPredios.length - 1} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: currentIndex >= allPredios.length - 1 ? 'not-allowed' : 'pointer' }}><ChevronRight size={16} /></button>
            <button onClick={goLast} disabled={currentIndex >= allPredios.length - 1} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: currentIndex >= allPredios.length - 1 ? 'not-allowed' : 'pointer' }}><ChevronsRight size={16} /></button>
          </div>
        </div>

        <div className="report-controls-group" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Escala Mapa:</span>
            <select
              value={scale}
              onChange={(e) => setScale(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
            >
              {predefinedScales.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="custom">Manual...</option>
            </select>
            {scale === 'custom' && (
              <input
                type="text"
                placeholder="1:..."
                value={customScale}
                onChange={(e) => setCustomScale(e.target.value)}
                style={{ padding: '6px', width: '80px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '2px solid #cbd5e1', paddingLeft: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Punto (px):</span>
            <input type="number" min="1" max="20" value={pointSize} onChange={(e) => setPointSize(Number(e.target.value))} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            <span style={{ fontSize: '13px', fontWeight: 'bold', marginLeft: '5px' }}>Texto:</span>
            <input type="number" min="5" max="30" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} style={{ width: '45px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>
          <button onClick={() => setShowTextModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            Textos Carta
          </button>
          <button onClick={() => window.print()} disabled={!data} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 20px', background: !data ? '#94a3b8' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: !data ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
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
            <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Configurar Textos del Mapa</h3>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Nombre Carta Topográfica:</label>
                  <input type="text" value={nombreCarta} onChange={(e) => setNombreCarta(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="Ej: CT-1234" />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Nombre Cuadrícula General:</label>
                  <input type="text" value={nombreCuadricula} onChange={(e) => setNombreCuadricula(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} placeholder="Ej: Malla 1" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button onClick={() => setShowTextModal(false)} style={{ padding: '8px 15px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: '#f8fafc', fontWeight: 'bold' }}>
                    Aceptar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="report-pages-container">
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
                        {polygonCoords.length > 0 && (
                          <MapContainer center={center} zoom={18} maxZoom={24} zoomSnap={0.1} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={true} scrollWheelZoom={true} doubleClickZoom={true} dragging={true} touchZoom={true}>
                            {/* Se desactiva la ortofoto a petición del usuario para evitar parpadeos y mejorar la impresión */}
                            {/* <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /> */}

                            <MapScaleUpdater scaleValue={displayScale} polygonCoords={polygonCoords} setCalculatedScale={setCalculatedScale} setGraphicScale={setGraphicScale} />
                            <UtmGrid setMapGridLabels={setMapGridLabels} />

                            <Polygon positions={polygonCoords} pathOptions={{ color: 'yellow', weight: 2, fillColor: 'transparent' }} />

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
                              html: `<div style="position: absolute; transform: translate(-50%, -50%) rotate(${centerInfo.mainAngle}deg); text-align: center; font-size: 8px; line-height: 1.3; font-weight: bold; color: black; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff, 0px 0px 4px #fff; white-space: nowrap;">
                        <div>POSESIONARIO: ${predio?.nombre_posesionario || 'SIN NOMBRE'}</div>
                        <div>C.C.: ${predio?.cedula || 'S/D'} | CÓDIGO: ${predio?.codigo || predio?.cod_catastral || 'S/D'}</div>
                        <div>ÁREA: ${predio?.area_ha ? predio.area_ha.toFixed(4) : '0.0000'} Ha</div>
                      </div>`,
                              iconSize: [0, 0],
                              iconAnchor: [0, 0]
                            })} />

                            {linderos.map((l, i) => {
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
                                  const colindante = l.colindante || '';
                                  return <Marker key={i} position={[midLat, midLng]} icon={createRotatedTextIcon(colindante, medida, points[0], points[1], center[0], center[1])} />;
                                }
                              } catch (e) { }
                              return null;
                            })}

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
                      <div className="minimap-box">
                        <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                          <UtmGrid />
                          <Polygon positions={polygonCoords} pathOptions={{ color: 'yellow', weight: 1, fillColor: 'transparent' }} />
                        </MapContainer>
                      </div>
                      <div className="box-content-center" style={{ fontSize: '9px', borderTop: '1px solid black', padding: '5px' }}>
                        <div style={{ fontWeight: 'bold' }}>UBICACIÓN:</div>
                        <div>CARTA TOPOGRÁFICA: {nombreCarta || '_________________'}</div>
                        <div>CUADRÍCULA: {nombreCuadricula || '_________________'}</div>
                        <div style={{ marginTop: '2px', fontWeight: 'bold' }}>ESCALA 1:50000</div>
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
                            <div style={{ fontSize: '7px', fontWeight: 'bold' }}>{activeEmpresa?.nombre_director || '______________________'}</div>
                          </div>
                        </div>
                        <div style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                          <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>REVISADO Y APROBADO POR:</div>
                          <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                            <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                            {/* Textos ocultos para igualar la altura de la caja izquierda y alinear la línea */}
                            <div style={{ fontSize: '7px', fontWeight: 'bold', visibility: 'hidden' }}>Espacio</div>
                            <div style={{ fontSize: '7px', visibility: 'hidden' }}>Espacio</div>
                            <div style={{ fontSize: '7px' }}>Jefe de Avaluo y Catastro</div>
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
                        {vertices.length < 24 && Array.from({ length: 24 - vertices.length }).map((_, i) => (
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
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '8px', fontWeight: 'bold' }}>{activeEmpresa?.nombre_director || '______________________'}</div>
                          <div style={{ fontSize: '8px' }}>Director(a) de Catastro</div>
                        </div>
                      </div>
                      <div className="firma-box" style={{ borderLeft: 'none' }}>
                        <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          {/* Textos ocultos para igualar la altura de la caja izquierda y alinear la línea */}
                          <div style={{ fontSize: '8px', fontWeight: 'bold', visibility: 'hidden' }}>Espacio</div>
                          <div style={{ fontSize: '8px', visibility: 'hidden' }}>Espacio</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}
        </div>
      );
}
