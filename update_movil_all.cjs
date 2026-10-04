const fs = require('fs');
const path = require('path');

const movilDir = path.resolve('c:/LNCZ/proyecto-catastro-2026/movil');

// ============================================================================
// 1. CREATE movil/src/components/ReportePlanimetricoSheet.jsx
// ============================================================================
const sheetContent = `import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, Polygon, Marker, Polyline, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import proj4 from 'proj4';
import { API_URL } from '../services/api';
import { calculateRumbo, normalizeVerticesAndLinderos, utmToWgs84, wgs84ToUtm } from '../utils/geoUtils';

// Definir proyección UTM 17S
if (!proj4.defs("EPSG:32717")) {
  proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");
}

const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Helper: Icono de texto Leaflet para vértices (P01, P02...)
const createTextIcon = (text, className, pointSize = 6, textSize = 10, lat = 0, lng = 0, centerLat = 0, centerLng = 0) => {
  const dy = lat - centerLat;
  const dx = lng - centerLng;
  const angle = Math.atan2(-dy, dx);
  const dist = (pointSize / 2) + 8 + (textSize / 2);
  const offsetX = Math.cos(angle) * dist;
  const offsetY = Math.sin(angle) * dist;
  const safeText = escapeHtml(text);

  return L.divIcon({
    className: className,
    html: \`
      <div style="position: relative; width: \${pointSize}px; height: \${pointSize}px; background: #ffb6c1; border: 1px solid black; border-radius: 50%;">
        <span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) translate(\${offsetX}px, \${offsetY}px); font-size: \${textSize}px; font-weight: bold; color: black; white-space: nowrap; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">\${safeText}</span>
      </div>
    \`,
    iconSize: [pointSize, pointSize],
    iconAnchor: [pointSize / 2, pointSize / 2]
  });
};

// Helper: Icono rotado para medidas y colindantes a lo largo del lindero
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

  const offsetColindante = 35;
  const offCx = Math.cos(outAngle) * offsetColindante;
  const offCy = Math.sin(outAngle) * offsetColindante;

  const safeMedida = escapeHtml(medida);
  const safeColindante = escapeHtml(colindante);

  return L.divIcon({
    className: 'lindero-rotated',
    html: \`
      <div style="position: absolute; transform: translate(-50%, -50%) translate(\${offMx}px, \${offMy}px) rotate(\${angle}deg); white-space: nowrap; font-size: 9.5px; font-weight: bold; color: #37474f; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
        \${safeMedida}
      </div>
      \${colindante ? \`
      <div style="position: absolute; transform: translate(-50%, -50%) translate(\${offCx}px, \${offCy}px) rotate(\${angle}deg); white-space: nowrap; font-size: 9.5px; font-weight: bold; color: #1a237e; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
        \${safeColindante}
      </div>\` : ''}
    \`,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const getOrientacionGeometrica = (center, midPoint, width, height) => {
  if (!center || !midPoint) return 'ESTE';
  let dy = (midPoint[0] - center[0]) / (height || 1);
  let dx = (midPoint[1] - center[1]) / (width || 1);
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (angle >= 45 && angle < 135) return 'NORTE';
  if (angle >= -45 && angle < 45) return 'ESTE';
  if (angle >= -135 && angle < -45) return 'SUR';
  return 'OESTE';
};

// Componente para cuadricula UTM WGS84 17S
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

      for (let x = minX; x <= maxX; x += step) {
        if (x === 0) continue;
        const bottom = proj4('EPSG:32717', 'EPSG:4326', [x, minY]);
        const top = proj4('EPSG:32717', 'EPSG:4326', [x, maxY]);
        lines.push([[bottom[1], bottom[0]], [top[1], top[0]]]);
        const ptTop = map.latLngToContainerPoint([top[1], top[0]]);
        labels.top.push({ text: x.toString(), val: ptTop.x });
      }

      for (let y = minY; y <= maxY; y += step) {
        if (y === 0) continue;
        const left = proj4('EPSG:32717', 'EPSG:4326', [minX, y]);
        const right = proj4('EPSG:32717', 'EPSG:4326', [maxX, y]);
        lines.push([[left[1], left[0]], [right[1], right[0]]]);
        const ptLeft = map.latLngToContainerPoint([left[1], left[0]]);
        labels.left.push({ text: y.toString(), val: ptLeft.y });
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

// Componente para actualizar escala y barras métricas
const MapScaleUpdater = ({ scaleValue = 'Auto', polygonCoords, setCalculatedScale, setGraphicScale }) => {
  const map = useMap();

  useEffect(() => {
    const updateGraphicScale = () => {
      const centerLatLng = map.getCenter();
      const pointC = map.latLngToContainerPoint(centerLatLng);
      const pointX = L.point(pointC.x + 300, pointC.y);
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
      map.fitBounds(polygonCoords, { padding: [60, 60], animate: false });
      const z = map.getZoom();
      let s = Math.round(1000 * Math.pow(2, 19 - z));
      if (s > 1000) s = Math.round(s / 100) * 100;
      else if (s > 100) s = Math.round(s / 50) * 50;
      if (setCalculatedScale) setCalculatedScale(\`~ 1:\${s}\`);
    } else {
      let s = 1000;
      if (scaleValue && scaleValue.includes(':')) {
        const val = parseInt(scaleValue.split(':')[1].replace(/\\D/g, ''));
        if (!isNaN(val) && val > 0) s = val;
      }
      const z = 19 - Math.log2(s / 1000);
      map.setView(center, z, { animate: false });
      if (setCalculatedScale) setCalculatedScale(scaleValue);
    }

    updateGraphicScale();
    map.on('moveend zoomend', updateGraphicScale);
    return () => map.off('moveend zoomend', updateGraphicScale);
  }, [scaleValue, map, polygonCoords, setCalculatedScale, setGraphicScale]);

  return null;
};

/**
 * ReportePlanimetricoSheet
 * Formato Oficial A4 Horizontal (297mm x 209mm) del Geoportal GAD Urdaneta
 */
export default function ReportePlanimetricoSheet({
  predio = {},
  rawVertices = [],
  activeEmpresa = null,
  sheetToShow = 'both' // 'both', 'page1', 'page2'
}) {
  const [mapGridLabels, setMapGridLabels] = useState({ top: [], left: [] });
  const [minimapGridLabels, setMinimapGridLabels] = useState({ top: [], left: [] });
  const [calculatedScale, setCalculatedScale] = useState('1:1000');
  const [graphicScale, setGraphicScale] = useState({ totalWidthPx: 300, ticks: [0, 20, 40, 60, 80, 100] });

  // 1. Normalizar vértices y linderos con la regla P01 al Nor-Oeste en sentido horario
  const { vertices, linderos } = useMemo(() => {
    let sourceVerts = rawVertices;
    if (!sourceVerts || sourceVerts.length === 0) {
      if (Array.isArray(predio.vertices) && predio.vertices.length > 0) {
        sourceVerts = predio.vertices;
      }
    }

    // Convertir a objetos con coord_x, coord_y, lat, lng
    const cleanVerts = (sourceVerts || []).map((v, i) => {
      let x = v.coord_x ?? v.x ?? (Array.isArray(v) ? v[0] : 0);
      let y = v.coord_y ?? v.y ?? (Array.isArray(v) ? v[1] : 0);
      let lat = v.lat;
      let lng = v.lng;

      if ((!lat || !lng) && x && y) {
        const wgs = utmToWgs84(x, y);
        lat = wgs.lat;
        lng = wgs.lng;
      }
      if ((!x || !y) && lat && lng) {
        const utm = wgs84ToUtm(lng, lat);
        x = utm.x;
        y = utm.y;
      }

      return {
        id: v.id || i + 1,
        codigo: v.codigo || \`P\${String(i + 1).padStart(2, '0')}\`,
        coord_x: Number(x) || 0,
        coord_y: Number(y) || 0,
        x: Number(x) || 0,
        y: Number(y) || 0,
        lat: Number(lat) || 0,
        lng: Number(lng) || 0,
        colindante: v.colindante || ''
      };
    });

    // Generar linderos calculados entre vértices consecutivos
    const generatedLinderos = cleanVerts.map((v, idx) => {
      const next = cleanVerts[(idx + 1) % cleanVerts.length];
      const dx = next.coord_x - v.coord_x;
      const dy = next.coord_y - v.coord_y;
      const dist = Math.hypot(dx, dy);
      const rumbo = calculateRumbo(dx, dy);
      return {
        id: idx + 1,
        desde_id: v.id,
        hasta_id: next.id,
        longitud: dist,
        rumbo: rumbo,
        colindante: v.colindante || '',
        geom_wkt: \`LINESTRING(\${v.lng} \${v.lat}, \${next.lng} \${next.lat})\`
      };
    });

    return normalizeVerticesAndLinderos(cleanVerts, generatedLinderos);
  }, [predio, rawVertices]);

  // 2. Coordenadas de polígono para MapContainer (en [lat, lng])
  const polygonCoords = useMemo(() => {
    return vertices.map(v => [v.lat, v.lng]).filter(p => p[0] && p[1]);
  }, [vertices]);

  // 3. Centro y dimensiones del predio
  const centerInfo = useMemo(() => {
    if (polygonCoords.length === 0) return { center: [-1.575, -79.46], width: 0.001, height: 0.001 };
    const lats = polygonCoords.map(p => p[0]);
    const lngs = polygonCoords.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
      height: maxLat - minLat || 0.001,
      width: maxLng - minLng || 0.001
    };
  }, [polygonCoords]);

  const center = centerInfo.center;

  // 4. Linderos enriquecidos con orientación geográfica
  const linderosConInfo = useMemo(() => {
    return linderos.map((l, index) => {
      const v1 = vertices[index];
      const nextIdx = (index + 1) % vertices.length;
      const v2 = vertices[nextIdx];
      const midPoint = v1 && v2 ? [(v1.lat + v2.lat) / 2, (v1.lng + v2.lng) / 2] : center;
      const orientacion = getOrientacionGeometrica(center, midPoint, centerInfo.width, centerInfo.height);
      const currentCode = v1?.codigo || \`P\${String(index + 1).padStart(2, '0')}\`;
      const nextCode = v2?.codigo || \`P\${String(nextIdx + 1).padStart(2, '0')}\`;

      return {
        ...l,
        tramo: \`\${currentCode} - \${nextCode}\`,
        orientacion,
        points: v1 && v2 ? [[v1.lat, v1.lng], [v2.lat, v2.lng]] : []
      };
    });
  }, [linderos, vertices, center, centerInfo]);

  const linderosNorte = linderosConInfo.filter(l => l.orientacion === 'NORTE');
  const linderosSur = linderosConInfo.filter(l => l.orientacion === 'SUR');
  const linderosEste = linderosConInfo.filter(l => l.orientacion === 'ESTE');
  const linderosOeste = linderosConInfo.filter(l => l.orientacion === 'OESTE');

  const renderLinderoText = (l) => {
    const tramoStr = (l.tramo || '').replace(' - ', ' al ');
    return \`Del \${tramoStr} con una distancia de \${l.longitud ? l.longitud.toFixed(1) : '0.0'} m, Rumbo \${l.rumbo || '-'}; \${l.colindante || 'S/C'}\`;
  };

  const currentDate = new Date().toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const areaM2 = Number(predio.area) || 0;
  const areaHa = (areaM2 / 10000).toFixed(4);

  const dpaProvincia = activeEmpresa?.provincia || predio?.provincia || 'LOS RÍOS';
  const dpaCanton = activeEmpresa?.canton || predio?.canton || 'URDANETA';
  const dpaParroquia = activeEmpresa?.ciudad || predio?.parroquia || 'CATARAMA';
  const dpaSector = activeEmpresa?.sector || predio?.sector || 'URBANO';
  const institucionNombre = activeEmpresa?.nombre || 'GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL DE URDANETA';
  const directorNombre = activeEmpresa?.nombre_director || 'ING. MARCO CHÓEZ';

  const showP1 = sheetToShow === 'both' || sheetToShow === 'page1';
  const showP2 = sheetToShow === 'both' || sheetToShow === 'page2';

  return (
    <div className="report-print-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      {/* ========================================================================= */}
      {/* LÁMINA 1: PLANO CARTOGRÁFICO (297mm x 209mm FORMATO OFICIAL A4)           */}
      {/* ========================================================================= */}
      {showP1 && (
        <div className="print-page" style={{ position: 'relative' }}>
          <div className="report-border">
            {/* ENCABEZADO INSTITUCIONAL */}
            <div className="report-header">
              <img
                src="/logo_gad.png"
                alt="Logo Institucional"
                style={{ position: 'absolute', top: '50%', left: '15px', transform: 'translateY(-50%)', height: '56px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />

              <div className="report-header-text">
                <div>\${institucionNombre}</div>
                <h1>LEVANTAMIENTO PLANIMÉTRICO</h1>
              </div>

              <img
                src="/logo_gad.png"
                alt="Escudo / Logo GAD"
                style={{ position: 'absolute', top: '50%', right: '15px', transform: 'translateY(-50%)', height: '56px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            {/* CUERPO PRINCIPAL */}
            <div className="report-body">
              {/* COLUMNA IZQUIERDA: PLANO CARTOGRÁFICO CON LEAFLET Y CUADRICULA UTM 17S */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid black' }}>
                <div className="report-map-container" style={{ flex: 1, position: 'relative', padding: '26px 20px 16px 26px', backgroundColor: 'white', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', width: '100%', height: '100%', border: '2px solid black', backgroundColor: 'white', zIndex: 0 }}>
                    {polygonCoords.length > 0 && (
                      <MapContainer
                        preferCanvas={true}
                        center={center}
                        zoom={18}
                        maxZoom={22}
                        zoomSnap={0.1}
                        style={{ width: '100%', height: '100%', zIndex: 1 }}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}
                      >
                        <MapScaleUpdater
                          scaleValue="Auto"
                          polygonCoords={polygonCoords}
                          setCalculatedScale={setCalculatedScale}
                          setGraphicScale={setGraphicScale}
                        />

                        <UtmGrid setMapGridLabels={setMapGridLabels} />

                        {/* Polígono del predio */}
                        <Polygon positions={polygonCoords} pathOptions={{ color: 'black', weight: 2.2, fillColor: 'transparent' }} />

                        {/* Marcadores de vértices P01, P02... */}
                        {vertices.map(v => (
                          <Marker
                            key={\`vert-\${v.id || v.codigo}\`}
                            position={[v.lat, v.lng]}
                            icon={createTextIcon(v.codigo, 'vertex-label', 6, 9.5, v.lat, v.lng, center[0], center[1])}
                          />
                        ))}

                        {/* Etiqueta central del posesionario */}
                        <Marker
                          position={center}
                          icon={L.divIcon({
                            className: 'center-predio-info',
                            html: \`
                              <div style="position: absolute; transform: translate(-50%, -50%); text-align: center; font-size: 8px; line-height: 1.3; font-weight: bold; color: black; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff, 0px 0px 4px #fff; white-space: nowrap;">
                                <div>POSESIONARIO: \${escapeHtml(predio?.propietario || predio?.nombre_posesionario || 'SIN NOMBRE')}</div>
                                <div>C.C.: \${escapeHtml(predio?.cedula || 'S/D')} | CLAVE: \${escapeHtml(predio?.codigo || predio?.cod_catastral || 'S/D')}</div>
                                <div>ÁREA: \${areaHa} Ha (\${areaM2.toLocaleString('es-EC', { maximumFractionDigits: 1 })} m²)</div>
                              </div>
                            \`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                          })}
                        />

                        {/* Distancias y colindantes a lo largo del lindero */}
                        {linderosConInfo.map((l, i) => {
                          if (!l.points || l.points.length < 2) return null;
                          const p1 = l.points[0];
                          const p2 = l.points[1];
                          const midLat = (p1[0] + p2[0]) / 2;
                          const midLng = (p1[1] + p2[1]) / 2;
                          const medida = \`\${l.longitud ? l.longitud.toFixed(1) : '0.0'}m\`;
                          return (
                            <Marker
                              key={\`lind-\${i}\`}
                              position={[midLat, midLng]}
                              icon={createRotatedTextIcon(l.colindante, medida, p1, p2, center[0], center[1])}
                            />
                          );
                        })}

                        {/* Rosa de los vientos (Norte) */}
                        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000, textAlign: 'center' }}>
                          <div style={{ width: '0', height: '0', borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: '28px solid white', filter: 'drop-shadow(0px 0px 1px black)', margin: '0 auto' }}></div>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '4px', color: 'white', textShadow: '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000' }}>N</div>
                        </div>
                      </MapContainer>
                    )}
                  </div>

                  {/* Etiquetas de cuadricula UTM */}
                  {mapGridLabels.top.map((lbl, i) => (
                    <div key={\`t-\${i}\`} style={{ position: 'absolute', top: '8px', left: \`\${lbl.val + 26}px\`, transform: 'translateX(-50%)', fontSize: '9px', fontWeight: 'bold' }}>
                      {lbl.text}
                    </div>
                  ))}
                  {mapGridLabels.left.map((lbl, i) => (
                    <div key={\`l-\${i}\`} style={{ position: 'absolute', left: '-12px', top: \`\${lbl.val + 26}px\`, transform: 'translateY(-50%) rotate(-90deg)', fontSize: '9px', fontWeight: 'bold', width: '55px', textAlign: 'center' }}>
                      {lbl.text}
                    </div>
                  ))}
                </div>

                {/* ESCALA GRÁFICA */}
                <div style={{ padding: '0 20px 12px 20px', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: 'bold', marginRight: '12px' }}>ESCALA GRÁFICA:</div>
                  <div style={{ position: 'relative', width: \`\${Math.min(graphicScale.totalWidthPx || 280, 320)}px\`, height: '8px', display: 'flex', border: '1px solid black' }}>
                    {graphicScale.ticks?.map((tick, i) => (
                      <div key={i} style={{ position: 'absolute', left: \`\${(i / (graphicScale.ticks.length - 1)) * 100}%\`, top: '9px', transform: 'translateX(-50%)', fontSize: '7.5px', fontWeight: 'bold' }}>
                        {tick}
                      </div>
                    ))}
                    {graphicScale.ticks?.slice(0, -1).map((_, i) => (
                      <div key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? 'black' : 'white', borderRight: i < graphicScale.ticks.length - 2 ? '1px solid black' : 'none' }}></div>
                    ))}
                    <div style={{ position: 'absolute', right: '-32px', top: '9px', fontSize: '7.5px', fontWeight: 'bold' }}>
                      Metros
                    </div>
                  </div>
                </div>

                {/* FOOTER METRICAS */}
                <div style={{ display: 'flex', borderTop: '1px solid black', height: '44px' }}>
                  <div className="footer-box" style={{ flex: 1 }}>
                    <div className="box-title">FECHA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>{currentDate}</div>
                  </div>
                  <div className="footer-box" style={{ flex: 1 }}>
                    <div className="box-title">ÁREA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>{areaHa} Ha</div>
                  </div>
                  <div className="footer-box" style={{ flex: 1 }}>
                    <div className="box-title">ESCALA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>{calculatedScale}</div>
                  </div>
                  <div className="footer-box" style={{ flex: 1.5, borderRight: 'none' }}>
                    <div className="box-title">COORDENADAS PLANAS:</div>
                    <div className="box-content" style={{ fontSize: '7px', lineHeight: '1.2', fontWeight: 'bold', paddingTop: '2px', textAlign: 'center' }}>
                      SISTEMA: WGS 1984 UTM ZONE 17S<br />
                      PROYECCIÓN: TRANSVERSE MERCATOR<br />
                      DATUM: WGS 1984
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: SIDEBAR CON MINIMAPA Y DATOS INSTITUCIONALES */}
              <div className="report-sidebar">
                {/* Minimapa de ubicación */}
                <div className="sidebar-box">
                  <div className="minimap-box" style={{ height: '220px', position: 'relative', overflow: 'hidden', padding: '14px 6px 6px 24px', backgroundColor: 'white' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid black', backgroundColor: 'white' }}>
                      {polygonCoords.length > 0 && (
                        <MapContainer
                          preferCanvas={true}
                          center={center}
                          zoom={13}
                          style={{ width: '100%', height: '100%' }}
                          zoomControl={false}
                          scrollWheelZoom={false}
                          doubleClickZoom={false}
                          dragging={false}
                          touchZoom={false}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <UtmGrid setMapGridLabels={setMinimapGridLabels} isMinimap={true} />
                          <Polygon positions={polygonCoords} pathOptions={{ color: '#b91c1c', weight: 2.5, fillColor: '#ef4444', fillOpacity: 0.95 }} />
                          <CircleMarker center={center} radius={20} pathOptions={{ color: '#dc2626', weight: 2, dashArray: '4, 4', fillColor: '#ef4444', fillOpacity: 0.1 }} />
                          <Marker
                            position={center}
                            icon={L.divIcon({
                              className: 'minimap-predio-tag',
                              html: \`<div style="font-size: 7.5px; font-weight: 800; color: #991b1b; background: rgba(255,255,255,0.95); padding: 1px 4px; border: 1.2px solid #dc2626; border-radius: 3px; white-space: nowrap; transform: translate(-50%, -150%);">\${escapeHtml(predio?.codigo || predio?.cod_catastral || 'PREDIO')}</div>\`,
                              iconSize: [0, 0]
                            })}
                          />
                        </MapContainer>
                      )}
                    </div>

                    {minimapGridLabels.top.map((lbl, i) => (
                      <div key={\`mt-\${i}\`} style={{ position: 'absolute', top: '2px', left: \`\${lbl.val + 24}px\`, transform: 'translateX(-50%)', fontSize: '6px', fontWeight: 'bold', color: '#0f172a' }}>
                        {lbl.text}
                      </div>
                    ))}
                    {minimapGridLabels.left.map((lbl, i) => (
                      <div key={\`ml-\${i}\`} style={{ position: 'absolute', left: '-12px', top: \`\${lbl.val + 14}px\`, transform: 'translateY(-50%) rotate(-90deg)', fontSize: '6px', fontWeight: 'bold', color: '#0f172a', width: '50px', textAlign: 'center' }}>
                        {lbl.text}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ubicación y Carta */}
                <div className="sidebar-box">
                  <div className="box-title">UBICACIÓN:</div>
                  <div className="box-content" style={{ textAlign: 'center', fontSize: '7.5px', lineHeight: '1.2' }}>
                    <div style={{ fontWeight: 'bold' }}>CARTA TOPOGRÁFICA: URDANETA / CATARAMA</div>
                    <div>ESCALA: 1:50000</div>
                    <div style={{ fontWeight: 'bold', marginTop: '1px' }}>CÓDIGO: CT-NIV-D1 / CT-NIV-D3</div>
                  </div>
                </div>

                {/* Posesionario */}
                <div className="sidebar-box">
                  <div className="box-title">POSESIONARIO:</div>
                  <div className="box-content" style={{ fontSize: '8.5px', lineHeight: '1.3' }}>
                    <b>\${predio?.propietario || predio?.nombre_posesionario || 'SIN NOMBRE'}</b><br />
                    C.C.: \${predio?.cedula || 'S/D'}
                  </div>
                </div>

                {/* Código Catastral */}
                <div className="sidebar-box">
                  <div className="box-title">CÓDIGO CATASTRAL</div>
                  <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                    \${predio?.codigo || predio?.cod_catastral || 'S/D'}
                  </div>
                </div>

                {/* DPA: Provincia / Cantón */}
                <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid black' }}>
                  <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex', flexDirection: 'column', minHeight: '32px' }}>
                    <div className="box-title" style={{ borderBottom: 'none' }}>PROVINCIA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px' }}>
                      \${dpaProvincia}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '32px' }}>
                    <div className="box-title" style={{ borderBottom: 'none' }}>CANTÓN:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px' }}>
                      \${dpaCanton}
                    </div>
                  </div>
                </div>

                {/* Parroquia */}
                <div className="sidebar-box">
                  <div className="box-title">PARROQUIA:</div>
                  <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '8.5px' }}>
                    \${dpaParroquia}
                  </div>
                </div>

                {/* Sector */}
                <div className="sidebar-box">
                  <div className="box-title">SECTOR:</div>
                  <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '8.5px' }}>
                    \${dpaSector}
                  </div>
                </div>

                {/* Nombre del Predio */}
                <div className="sidebar-box">
                  <div className="box-title">NOMBRE DEL PREDIO:</div>
                  <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '8.5px' }}>
                    \${predio?.nombre_predio || predio?.nombre || 'SIN NOMBRE'}
                  </div>
                </div>

                {/* Firmas Técnicas */}
                <div className="sidebar-box" style={{ flex: 1, borderBottom: 'none' }}>
                  <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                    <div style={{ flex: 1, borderRight: '1px solid black', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '7.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>RESP. TÉCNICO:</div>
                      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                        <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                        <div style={{ fontSize: '7px', fontWeight: 'bold' }}>\${directorNombre}</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '7.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>REVISADO Y APROBADO:</div>
                      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                        <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                        <div style={{ fontSize: '7px', fontWeight: 'bold', color: 'transparent', userSelect: 'none' }}>.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LÁMINA 2: INFORME DE LINDERACIÓN (297mm x 209mm FORMATO OFICIAL A4)        */}
      {/* ========================================================================= */}
      {showP2 && (
        <div className="print-page" style={{ position: 'relative' }}>
          <div className="report-inner-border">
            <div className="page2-body">
              {/* LADO IZQUIERDO: TABLA VERTICES OFICIAL DE 7 COLUMNAS */}
              <div className="page2-col-left">
                <div className="page2-title">INFORME DE LINDERACIÓN</div>

                <div className="dpa-grid" style={{ border: '1px solid black', marginBottom: '8px' }}>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>PROVINCIA:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>\${dpaProvincia}</div></div>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>CANTÓN:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>\${dpaCanton}</div></div>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>PARROQUIA:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>\${dpaParroquia}</div></div>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>SECTOR:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>\${dpaSector}</div></div>
                </div>

                <div style={{ display: 'flex', border: '1px solid black', marginBottom: '8px' }}>
                  <div style={{ flex: 1.2, padding: '3px', borderRight: '1px solid black' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>NOMBRES DEL POSESIONARIO</div>
                    <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '3px' }}>
                      \${predio.propietario || predio.nombre_posesionario || 'SIN NOMBRE'}<br />C.C.: \${predio.cedula || 'S/D'}
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '3px', borderRight: '1px solid black' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>NOMBRE DEL PREDIO</div>
                    <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '3px' }}>
                      \${predio?.nombre_predio || predio?.nombre || 'SIN NOMBRE'}
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '3px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '8.5px' }}>CÓDIGO CATASTRAL</div>
                    <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '3px', fontWeight: 'bold' }}>
                      \${predio?.codigo || predio?.cod_catastral || 'S/D'}
                    </div>
                  </div>
                </div>

                {/* TABLA DE 7 COLUMNAS SEGÚN NORMATIVA CATASTRAL */}
                <table className="report-table">
                  <thead>
                    <tr>
                      <th rowSpan="2" style={{ width: '45px' }}>PUNTOS</th>
                      <th colSpan="2">COORDENADAS PLANAS<br />UTM W.G.S.-84 (17S)</th>
                      <th rowSpan="2" style={{ width: '65px' }}>VERTICE<br />DESDE-HASTA</th>
                      <th rowSpan="2" style={{ width: '50px' }}>DISTANCIA<br />(m)</th>
                      <th rowSpan="2" style={{ width: '75px' }}>RUMBO</th>
                      <th rowSpan="2">COLINDANTES</th>
                    </tr>
                    <tr>
                      <th style={{ width: '65px' }}>X (ESTE)</th>
                      <th style={{ width: '65px' }}>Y (NORTE)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vertices.map((v, i) => {
                      const l = linderosConInfo[i] || linderos[i] || {};
                      const currentCode = v.codigo || \`P\${String(i + 1).padStart(2, '0')}\`;
                      const nextCode = (i < vertices.length - 1)
                        ? (vertices[i + 1]?.codigo || \`P\${String(i + 2).padStart(2, '0')}\`)
                        : (vertices[0]?.codigo || 'P01');
                      const desdeHasta = (l.tramo && l.tramo !== '-') ? l.tramo : \`\${currentCode} - \${nextCode}\`;

                      return (
                        <tr key={v.id || i}>
                          <td style={{ fontWeight: 'bold' }}>\${currentCode}</td>
                          <td style={{ fontFamily: 'monospace' }}>\${v.coord_x ? Number(v.coord_x).toFixed(2) : '-'}</td>
                          <td style={{ fontFamily: 'monospace' }}>\${v.coord_y ? Number(v.coord_y).toFixed(2) : '-'}</td>
                          <td style={{ fontWeight: '600' }}>\${desdeHasta}</td>
                          <td style={{ fontFamily: 'monospace' }}>\${l.longitud ? Number(l.longitud).toFixed(2) : '-'}</td>
                          <td style={{ fontSize: '8px' }}>\${l.rumbo || '-'}</td>
                          <td style={{ fontSize: '8px', textAlign: 'left', paddingLeft: '4px' }}>\${l.colindante || '-'}</td>
                        </tr>
                      );
                    })}
                    {vertices.length < 18 && Array.from({ length: 18 - vertices.length }).map((_, i) => (
                      <tr key={\`empty-\${i}\`}>
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

              {/* LADO DERECHO: DESCRIPCION ORIENTACION Y FIRMAS */}
              <div className="page2-col-right" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="page2-title">DESCRIPCIÓN DE LINDEROS</div>

                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE NORTE</div>
                  <div className="desc-box-content">
                    {linderosNorte.length > 0
                      ? linderosNorte.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>\${renderLinderoText(l)}</div>)
                      : (predio.norte ? \`Al Norte: \${predio.norte}\` : 'Sin datos.')}
                  </div>
                </div>

                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE SUR</div>
                  <div className="desc-box-content">
                    {linderosSur.length > 0
                      ? linderosSur.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>\${renderLinderoText(l)}</div>)
                      : (predio.sur ? \`Al Sur: \${predio.sur}\` : 'Sin datos.')}
                  </div>
                </div>

                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE ESTE</div>
                  <div className="desc-box-content">
                    {linderosEste.length > 0
                      ? linderosEste.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>\${renderLinderoText(l)}</div>)
                      : (predio.este ? \`Al Este: \${predio.este}\` : 'Sin datos.')}
                  </div>
                </div>

                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE OESTE</div>
                  <div className="desc-box-content">
                    {linderosOeste.length > 0
                      ? linderosOeste.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>\${renderLinderoText(l)}</div>)
                      : (predio.oeste ? \`Al Oeste: \${predio.oeste}\` : 'Sin datos.')}
                  </div>
                </div>

                <div style={{ flex: 1 }}></div>

                {/* BLOQUE DE FIRMAS */}
                <div className="firmas-grid">
                  <div className="firma-box">
                    <div className="firma-box-title">RESPONSABILIDAD TÉCNICA</div>
                    <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                      <div style={{ fontSize: '8px', fontWeight: 'bold' }}>\${directorNombre}</div>
                      <div style={{ fontSize: '7.5px' }}>Director(a) de Catastro</div>
                    </div>
                  </div>
                  <div className="firma-box" style={{ borderLeft: 'none' }}>
                    <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                    <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                      <div style={{ fontSize: '8px', fontWeight: 'bold', color: 'transparent', userSelect: 'none' }}>.</div>
                      <div style={{ fontSize: '7.5px', color: 'transparent', userSelect: 'none' }}>.</div>
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
`;

fs.writeFileSync(path.join(movilDir, 'src/components/ReportePlanimetricoSheet.jsx'), sheetContent, 'utf8');
console.log('✓ Created movil/src/components/ReportePlanimetricoSheet.jsx');

// ============================================================================
// 2. UPDATE movil/src/components/ReportePlanimetricoModal.jsx
// ============================================================================
const modalContent = `import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, ZoomIn, ZoomOut, Layers, Eye } from 'lucide-react';
import ReportePlanimetricoSheet from './ReportePlanimetricoSheet';
import './ReportePlanimetrico.css';

/**
 * ReportePlanimetricoModal
 * Modal visor del Formato Oficial Planimétrico A4 Horizontal (297mm x 209mm)
 * Idéntico al formato y diseño del Geoportal GAD Urdaneta.
 */
export default function ReportePlanimetricoModal({ predio, onClose }) {
  const [activeSheet, setActiveSheet] = useState('page1'); // 'page1', 'page2', 'both'
  const [fitToScreen, setFitToScreen] = useState(true);
  const [scaleFactor, setScaleFactor] = useState(1);

  // Calcular factor de escala para que la lámina A4 (297mm ~ 1122px) quepa en la pantalla del teléfono
  useEffect(() => {
    const updateScale = () => {
      if (fitToScreen) {
        const screenW = window.innerWidth;
        const a4WidthPx = 1122;
        const availableW = screenW - 16;
        const factor = Math.min(1, Math.max(0.28, availableW / a4WidthPx));
        setScaleFactor(factor);
      } else {
        setScaleFactor(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [fitToScreen]);

  if (!predio) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="report-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* BARRA SUPERIOR DE CONTROL INSTITUCIONAL */}
      <div 
        className="no-print"
        style={{
          height: '52px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          gap: '8px',
          flexShrink: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <X size={16} /> Cerrar
          </button>

          <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📄 {predio.codigo || 'Reporte Oficial A4'}
          </span>
        </div>

        {/* SELECTOR DE LÁMINAS */}
        <div style={{ display: 'flex', gap: '4px', background: '#0f172a', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveSheet('page1')}
            style={{
              background: activeSheet === 'page1' ? '#0284c7' : 'transparent',
              color: activeSheet === 'page1' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Lámina 1
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('page2')}
            style={{
              background: activeSheet === 'page2' ? '#0284c7' : 'transparent',
              color: activeSheet === 'page2' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Lámina 2
          </button>

          <button
            type="button"
            onClick={() => setActiveSheet('both')}
            style={{
              background: activeSheet === 'both' ? '#0284c7' : 'transparent',
              color: activeSheet === 'both' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Ambas
          </button>
        </div>

        {/* ACCIONES: AJUSTAR A PANTALLA & IMPRIMIR */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setFitToScreen(!fitToScreen)}
            title={fitToScreen ? 'Ver a tamaño real 100%' : 'Ajustar a pantalla del teléfono'}
            style={{
              background: fitToScreen ? '#334155' : '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 9px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {fitToScreen ? <ZoomIn size={14} /> : <ZoomOut size={14} />}
            <span>{fitToScreen ? '100% A4' : 'Ajustar'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* ÁREA DE VISUALIZACIÓN DE LÁMINAS */}
      <div 
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#334155',
          padding: '16px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}
      >
        <div 
          style={{
            transform: fitToScreen ? \`scale(\${scaleFactor})\` : 'none',
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease',
            marginBottom: fitToScreen ? \`\${-(1122 * 0.7 * (1 - scaleFactor))}px\` : '20px'
          }}
        >
          <ReportePlanimetricoSheet
            predio={predio}
            rawVertices={predio.vertices || []}
            sheetToShow={activeSheet}
          />
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path.join(movilDir, 'src/components/ReportePlanimetricoModal.jsx'), modalContent, 'utf8');
console.log('✓ Updated movil/src/components/ReportePlanimetricoModal.jsx');

// ============================================================================
// 3. UPDATE movil/src/pages/FormTab/PredioFormMobile.jsx
// ============================================================================
let formCode = fs.readFileSync(path.join(movilDir, 'src/pages/FormTab/PredioFormMobile.jsx'), 'utf8');

// A) Remove blocking isReadOnly: allow brigadistas and surveyors full interactivity
formCode = formCode.replace(
  /const readOnlyRequested = !!formPreloadData\.isReadOnly \|\| \(formPreloadData\.isServer && permissions\?\.isBrigadista\);/g,
  'const readOnlyRequested = false; // Permitir siempre interacción y edición de datos a brigadistas y topógrafos'
);

// B) Update handleViewOnMap to pass justViewOnMap: true so it doesn't open the bottom sheet
formCode = formCode.replace(
  /const handleViewOnMap = \(p\) => \{\s*setSelectedPredio\(p\);\s*setActiveTab\('map'\);\s*\};/g,
  `const handleViewOnMap = (p) => {
    // Ver en mapa directamente sobre el polígono sin abrir la tarjeta de información
    setSelectedPredio({ ...p, justViewOnMap: true });
    setActiveTab('map');
  };`
);

// C) Remove disabled={isReadOnly} from + Punto GPS and + Coordenada (Pto)
formCode = formCode.replace(
  /<button \s*type="button" \s*className="btn-primary-mobile" \s*style=\{\{ minHeight: '44px', height: '44px', fontSize: '12px', padding: '0 10px', flex: '0 0 auto' \}\} \s*onClick=\{handleAddGPSVertex\} \s*disabled=\{isReadOnly\}/g,
  `<button \n              type="button" \n              className="btn-primary-mobile" \n              style={{ minHeight: '44px', height: '44px', fontSize: '12px', padding: '0 10px', flex: '0 0 auto' }} \n              onClick={handleAddGPSVertex}`
);

formCode = formCode.replace(
  /<button \s*type="button" \s*className="btn-secondary-mobile" \s*style=\{\{ minHeight: '44px', height: '44px', fontSize: '12px', fontWeight: '700', border: '1.5px dashed #0284c7', color: '#0284c7', flex: '0 0 auto' \}\} \s*onClick=\{handleAddManualVertex\} \s*disabled=\{isReadOnly\}/g,
  `<button \n              type="button" \n              className="btn-secondary-mobile" \n              style={{ minHeight: '44px', height: '44px', fontSize: '12px', fontWeight: '700', border: '1.5px dashed #0284c7', color: '#0284c7', flex: '0 0 auto' }} \n              onClick={handleAddManualVertex}`
);

// D) Make row cells and edit/delete icons always interactive
formCode = formCode.replace(
  /onClick=\{\(\) => !isReadOnly && handleEditVertex\(i\)\}/g,
  'onClick={() => handleEditVertex(i)}'
);

formCode = formCode.replace(
  /<button \s*type="button" \s*onClick=\{\(\) => handleEditVertex\(i\)\} \s*title="Editar Coordenadas del Punto" \s*style=\{\{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', marginRight: '6px' \}\} \s*disabled=\{isReadOnly\}/g,
  `<button \n                          type="button" \n                          onClick={() => handleEditVertex(i)} \n                          title="Editar Coordenadas del Punto" \n                          style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', marginRight: '6px' }}`
);

formCode = formCode.replace(
  /<button \s*type="button" \s*onClick=\{\(\) => handleRemoveVertex\(i\)\} \s*title="Eliminar Punto" \s*style=\{\{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' \}\} \s*disabled=\{isReadOnly\}/g,
  `<button \n                          type="button" \n                          onClick={() => handleRemoveVertex(i)} \n                          title="Eliminar Punto" \n                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}`
);

// E) Make input fields interactive
formCode = formCode.replace(/disabled=\{isReadOnly\}/g, '');

// F) Make sure bottom action buttons are always displayed and interactive
formCode = formCode.replace(
  /\{\!isReadOnly \? \(\s*<>([\s\S]*?)<\/>\s*\) : \([\s\S]*?🛡️ Este predio está en <b>Modo Solo Lectura<\/b> para brigadistas\.[\s\S]*?\)\}/g,
  `<>\$1</>`
);

fs.writeFileSync(path.join(movilDir, 'src/pages/FormTab/PredioFormMobile.jsx'), formCode, 'utf8');
console.log('✓ Updated movil/src/pages/FormTab/PredioFormMobile.jsx');

// ============================================================================
// 4. UPDATE movil/src/pages/MapTab/MapTab.jsx
// ============================================================================
let mapCode = fs.readFileSync(path.join(movilDir, 'src/pages/MapTab/MapTab.jsx'), 'utf8');

// Ensure showToast is imported from useMobile
mapCode = mapCode.replace(
  /const \{\s*gps,\s*activeBaseMap,/g,
  `const {\n    gps,\n    showToast,\n    activeBaseMap,`
);

// Enhance MapController to support bounds
mapCode = mapCode.replace(
  /function MapController\(\{ center, zoom \}\) \{\s*const map = useMap\(\);\s*useEffect\(\(\) => \{\s*if \(center && center\[0\] && center\[1\]\) \{\s*map\.setView\(center, zoom \|\| map\.getZoom\(\), \{ animate: true \}\);\s*\}\s*\}, \[center, zoom, map\]\);\s*return null;\s*\}/g,
  `function MapController({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 19, animate: true });
    } else if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, bounds, map]);
  return null;
}`
);

// Add mapBounds state and auto-centering hook
if (!mapCode.includes('const [mapBounds, setMapBounds]')) {
  mapCode = mapCode.replace(
    /const \[mapZoom, setMapZoom\] = useState\(16\);/g,
    `const [mapZoom, setMapZoom] = useState(16);\n  const [mapBounds, setMapBounds] = useState(null);`
  );

  mapCode = mapCode.replace(
    /<MapController center=\{mapCenter\} zoom=\{mapZoom\} \/>/g,
    `<MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />`
  );
}

// Add auto-centering and zoom when selectedPredio changes, and handle justViewOnMap flag
if (!mapCode.includes('// Centrar automáticamente en el predio seleccionado')) {
  const centerHook = `  // Centrar automáticamente en el predio seleccionado (e.g. desde "Ver en Mapa")
  useEffect(() => {
    if (selectedPredio) {
      let latlngs = [];
      if (Array.isArray(selectedPredio.positions) && selectedPredio.positions.length > 0) {
        latlngs = selectedPredio.positions;
      } else if (Array.isArray(selectedPredio.vertices) && selectedPredio.vertices.length > 0) {
        latlngs = selectedPredio.vertices.map(v => {
          if (v.lat !== undefined && v.lng !== undefined) return [v.lat, v.lng];
          const wgs = utmToWgs84(v.x, v.y);
          return [wgs.lat, wgs.lng];
        }).filter(p => p[0] && p[1]);
      }
      if (latlngs.length >= 3) {
        setMapBounds(latlngs);
        const lats = latlngs.map(p => p[0]);
        const lngs = latlngs.map(p => p[1]);
        setMapCenter([(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2]);
        setMapZoom(18);
      } else if (latlngs.length > 0) {
        setMapCenter(latlngs[0]);
        setMapZoom(18);
      }

      if (selectedPredio.justViewOnMap && showToast) {
        showToast({
          type: 'info',
          title: \`📍 Predio \${selectedPredio.codigo || ''}\`,
          message: 'Mostrando polígono en el mapa satelital.',
          duration: 3500
        });
      }
    }
  }, [selectedPredio, showToast]);
`;
  mapCode = mapCode.replace(
    /useEffect\(\(\) => \{\s*if \(gps\.hasFix && \!hasCenteredGPS\.current\)/,
    centerHook + '\n  useEffect(() => {\n    if (gps.hasFix && !hasCenteredGPS.current)'
  );
}

// Ensure bottom sheet is NOT shown if justViewOnMap is true
mapCode = mapCode.replace(
  /\{selectedPredio && \(\s*<PredioBottomSheet \s*predio=\{selectedPredio\}/g,
  `{selectedPredio && !selectedPredio.justViewOnMap && (
        <PredioBottomSheet 
          predio={selectedPredio}`
);

fs.writeFileSync(path.join(movilDir, 'src/pages/MapTab/MapTab.jsx'), mapCode, 'utf8');
console.log('✓ Updated movil/src/pages/MapTab/MapTab.jsx');

// ============================================================================
// 5. UPDATE movil/src/pages/SyncTab/SyncCenterMobile.jsx
// ============================================================================
let syncCode = fs.readFileSync(path.join(movilDir, 'src/pages/SyncTab/SyncCenterMobile.jsx'), 'utf8');

// Fix missing checkPredioConflict import
if (!syncCode.includes('checkPredioConflict')) {
  syncCode = syncCode.replace(
    /import \{ uploadSinglePredio \} from '\.\.\/\.\.\/services\/api';/g,
    `import { uploadSinglePredio, checkPredioConflict } from '../../services/api';`
  );
}

// Pass auth to uploadSinglePredio
syncCode = syncCode.replace(
  /const \{ \s*offlineCount,/g,
  `const { \n    auth,\n    offlineCount,`
);
syncCode = syncCode.replace(
  /const res = await uploadSinglePredio\(finalPredio, \{\}, overwriteId\);/g,
  `const res = await uploadSinglePredio(finalPredio, auth, overwriteId);`
);

fs.writeFileSync(path.join(movilDir, 'src/pages/SyncTab/SyncCenterMobile.jsx'), syncCode, 'utf8');
console.log('✓ Updated movil/src/pages/SyncTab/SyncCenterMobile.jsx');

// ============================================================================
// 6. ENSURE API_URL IS EXPORTED IN movil/src/services/api.js
// ============================================================================
let apiCode = fs.readFileSync(path.join(movilDir, 'src/services/api.js'), 'utf8');
apiCode = apiCode.replace(
  /export const API_URL = [^\n]+;/g,
  ''
);
apiCode = apiCode.replace(/\\nconst DEFAULT_BACKEND_URL/g, '\nconst DEFAULT_BACKEND_URL');
apiCode = apiCode.replace(
  /const DEFAULT_BACKEND_URL =/g,
  'export const API_URL = "https://geoportal-backend-43s0.onrender.com";\nconst DEFAULT_BACKEND_URL ='
);
fs.writeFileSync(path.join(movilDir, 'src/services/api.js'), apiCode, 'utf8');
console.log('✓ Exported API_URL in movil/src/services/api.js');

// ============================================================================
// 7. BUMP VERSION IN movil/android/app/build.gradle
// ============================================================================
const gradlePath = path.join(movilDir, 'android/app/build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode \\d+/g, 'versionCode 19');
  gradle = gradle.replace(/versionName "[^"]+"/g, 'versionName "2.9"');
  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log('✓ Updated android/app/build.gradle to versionCode 19, versionName 2.9');
}

console.log('ALL UPDATES APPLIED SUCCESSFULLY!');
