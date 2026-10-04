const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/components/ReportePlanimetricoSheet.jsx');

const code = `import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, Polygon, Marker, TileLayer, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import proj4 from 'proj4';

// Definir proyección UTM 17S
proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

import { normalizeVerticesAndLinderos, calculateRumbo, getSegmentOrientation } from '../utils/geoUtils';
import './ReportePlanimetrico.css';

const escapeHtml = (text) => {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Icono Leaflet para vértices con numeración P01, P02...
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

// Icono Leaflet para medida y colindante rotado a lo largo del lindero
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

  const offsetColindante = 36;
  const offCx = Math.cos(outAngle) * offsetColindante;
  const offCy = Math.sin(outAngle) * offsetColindante;

  const safeMedida = escapeHtml(medida);
  const safeColindante = escapeHtml(colindante);

  return L.divIcon({
    className: 'lindero-rotated',
    html: \`
      <div style="position: absolute; transform: translate(-50%, -50%) translate(\${offMx}px, \${offMy}px) rotate(\${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; color: #37474f; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
        \${safeMedida}
      </div>
      \${colindante ? \`
      <div style="position: absolute; transform: translate(-50%, -50%) translate(\${offCx}px, \${offCy}px) rotate(\${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; color: #1a237e; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
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

// Componente para actualizar Escala Numérica y Gráfica en Leaflet
function MapScaleUpdater({ polygonCoords, setCalculatedScale, setGraphicScale }) {
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

    map.fitBounds(polygonCoords, { padding: [70, 70], animate: false });
    const z = map.getZoom();
    let s = Math.round(1000 * Math.pow(2, 19 - z));
    if (s > 1000) s = Math.round(s / 100) * 100;
    else if (s > 100) s = Math.round(s / 50) * 50;
    setCalculatedScale(\`1:\${s}\`);

    updateGraphicScale();
    map.on('moveend zoomend', updateGraphicScale);
    return () => map.off('moveend zoomend', updateGraphicScale);
  }, [map, polygonCoords, setCalculatedScale, setGraphicScale]);

  return null;
}

// Cuadrícula Cartográfica UTM
function UtmGrid({ setMapGridLabels, isMinimap = false }) {
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
      const labels = { top: [], left: [] };

      const minX = Math.floor(swUtm[0] / step) * step;
      const maxX = Math.ceil(neUtm[0] / step) * step;
      const minY = Math.floor(swUtm[1] / step) * step;
      const maxY = Math.ceil(neUtm[1] / step) * step;

      // Líneas verticales (Este)
      for (let x = minX; x <= maxX; x += step) {
        if (x === 0) continue;
        const bottom = proj4('EPSG:32717', 'EPSG:4326', [x, minY]);
        const top = proj4('EPSG:32717', 'EPSG:4326', [x, maxY]);
        lines.push([[bottom[1], bottom[0]], [top[1], top[0]]]);

        const ptTop = map.latLngToContainerPoint([top[1], top[0]]);
        labels.top.push({ text: x.toString(), val: ptTop.x });
      }

      // Líneas horizontales (Norte)
      for (let y = minY; y <= maxY; y += step) {
        if (y === 0) continue;
        const left = proj4('EPSG:32717', 'EPSG:4326', [minX, y]);
        const right = proj4('EPSG:32717', 'EPSG:4326', [maxX, y]);
        lines.push([[left[1], left[0]], [right[1], right[0]]]);

        const ptLeft = map.latLngToContainerPoint([left[1], left[0]]);
        labels.left.push({ text: y.toString(), val: ptLeft.y });
      }

      setGridLines(lines);
      if (setMapGridLabels) {
        setMapGridLabels(labels);
      }
    };

    updateGrid();
    map.on('moveend zoomend', updateGrid);
    return () => map.off('moveend zoomend', updateGrid);
  }, [map, isMinimap, setMapGridLabels]);

  return (
    <>
      {gridLines.map((line, idx) => (
        <Polyline
          key={idx}
          positions={line}
          pathOptions={{
            color: '#cbd5e1',
            weight: 0.8,
            dashArray: '3, 3',
            opacity: 0.8
          }}
        />
      ))}
    </>
  );
}

/**
 * Reporte Planimétrico Sheet Oficial (Lámina 1 y Lámina 2)
 * Mismo tamaño A4 (297mm × 209mm), formato y diseño institucional que el Geoportal.
 */
export default function ReportePlanimetricoSheet({
  data,
  activeEmpresa,
  pageView = 'all' // 'page1', 'page2', or 'all'
}) {
  const [mapGridLabels, setMapGridLabels] = useState({ top: [], left: [] });
  const [calculatedScale, setCalculatedScale] = useState('1:1000');
  const [graphicScale, setGraphicScale] = useState({ totalWidthPx: 300, ticks: [0, 20, 40, 60, 80, 100] });

  const predio = data?.predio || {};
  const { vertices, linderos } = useMemo(() => {
    return normalizeVerticesAndLinderos(data?.vertices, data?.linderos);
  }, [data?.vertices, data?.linderos]);

  // Extraer polygonCoords en formato [lat, lng]
  const polygonCoords = useMemo(() => {
    if (Array.isArray(predio.positions) && predio.positions.length >= 3) {
      return predio.positions;
    }
    if (Array.isArray(vertices) && vertices.length >= 3) {
      return vertices.map(v => {
        if (v.lat !== undefined && v.lng !== undefined) return [v.lat, v.lng];
        const wgs = proj4('EPSG:32717', 'EPSG:4326', [v.coord_x ?? v.x, v.coord_y ?? v.y]);
        return [wgs[1], wgs[0]];
      });
    }
    return [];
  }, [predio.positions, vertices]);

  const centerInfo = useMemo(() => {
    if (polygonCoords.length === 0) return { center: [-1.55, -79.45], width: 1, height: 1 };
    const lats = polygonCoords.map(p => p[0]);
    const lngs = polygonCoords.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
      height: maxLat - minLat || 1,
      width: maxLng - minLng || 1
    };
  }, [polygonCoords]);

  const center = centerInfo.center;

  // Linderos calculados con distancias y rumbos exactos
  const linderosConInfo = useMemo(() => {
    const n = vertices.length;
    return vertices.map((v, index) => {
      const nextIdx = (index + 1) % n;
      const vNext = vertices[nextIdx];

      const p1 = polygonCoords[index] || [0, 0];
      const p2 = polygonCoords[nextIdx] || [0, 0];
      const midPoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

      const dx = (vNext.coord_x ?? vNext.x) - (v.coord_x ?? v.x);
      const dy = (vNext.coord_y ?? vNext.y) - (v.coord_y ?? v.y);
      const dist = Math.hypot(dx, dy).toFixed(1);
      const rumbo = calculateRumbo(dx, dy);

      const currentCode = v.codigo || \`P\${String(index + 1).padStart(2, '0')}\`;
      const nextCode = vNext.codigo || \`P\${String(nextIdx + 1).padStart(2, '0')}\`;
      const tramoCalculado = \`\${currentCode} - \${nextCode}\`;

      const linderoExistente = linderos[index] || {};

      return {
        ...linderoExistente,
        p1,
        p2,
        longitud: Number(dist),
        rumbo,
        tramo: tramoCalculado,
        colindante: linderoExistente.colindante || v.colindante || '',
        orientacion: getOrientacionGeometrica(center, midPoint, centerInfo.width, centerInfo.height)
      };
    });
  }, [vertices, linderos, polygonCoords, center, centerInfo]);

  const linderosNorte = linderosConInfo.filter(l => l.orientacion === 'NORTE');
  const linderosSur = linderosConInfo.filter(l => l.orientacion === 'SUR');
  const linderosEste = linderosConInfo.filter(l => l.orientacion === 'ESTE');
  const linderosOeste = linderosConInfo.filter(l => l.orientacion === 'OESTE');

  const renderLinderoText = (l) => {
    const tramoStr = (l.tramo || '').replace(' - ', ' al ');
    return \`Del \${tramoStr} con una distancia de \${l.longitud ? l.longitud.toFixed(1) : '0.0'} m, Rumbo \${l.rumbo || '-'}; \${l.colindante ? l.colindante : 'Colindante por definir'}\`;
  };

  const currentDate = new Date().toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const dpaProvincia = activeEmpresa?.provincia || predio?.provincia || 'LOS RÍOS';
  const dpaCanton = activeEmpresa?.canton || predio?.canton || 'URDANETA';
  const dpaParroquia = activeEmpresa?.ciudad || predio?.ciudad || 'CATARAMA';
  const dpaSector = activeEmpresa?.sector || predio?.sector || 'URBANO';

  const showP1 = pageView === 'all' || pageView === 'page1';
  const showP2 = pageView === 'all' || pageView === 'page2';

  return (
    <div className="report-sheets-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
      {/* ============================================================== */}
      {/* PÁGINA 1: PLANO CARTOGRÁFICO OFICIAL                          */}
      {/* ============================================================== */}
      {showP1 && (
        <div className="print-page" style={{ width: '297mm', height: '209mm', background: '#ffffff', boxSizing: 'border-box' }}>
          <div className="report-border">
            {/* HEADER OFICIAL CON LOGO GAD Y NOMBRE DE EMPRESA */}
            <div className="report-header">
              <img
                src="/logo_gad.png"
                alt="Logo GAD Urdaneta"
                style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)', height: '60px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />

              <div className="report-header-text">
                <div>
                  {activeEmpresa?.nombre || 'GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL DE URDANETA'}
                </div>
                <h1>LEVANTAMIENTO PLANIMÉTRICO</h1>
              </div>
            </div>

            {/* CUERPO PRINCIPAL PÁGINA 1 */}
            <div className="report-body">
              {/* COLUMNA IZQUIERDA: MAPA CARTOGRÁFICO */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid black' }}>
                <div className="report-map-container" style={{ flex: 1, position: 'relative', padding: '24px 20px 16px 24px', backgroundColor: 'white', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', width: '100%', height: '100%', border: '2px solid black', backgroundColor: 'white' }}>
                    {polygonCoords.length > 0 && (
                      <MapContainer
                        preferCanvas={true}
                        center={center}
                        zoom={18}
                        style={{ width: '100%', height: '100%' }}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}
                      >
                        <MapScaleUpdater
                          polygonCoords={polygonCoords}
                          setCalculatedScale={setCalculatedScale}
                          setGraphicScale={setGraphicScale}
                        />

                        <UtmGrid setMapGridLabels={setMapGridLabels} />

                        {/* Polígono del predio */}
                        <Polygon
                          positions={polygonCoords}
                          pathOptions={{
                            color: '#000000',
                            weight: 2.2,
                            fillColor: 'transparent',
                            fillOpacity: 0
                          }}
                        />

                        {/* Vértices P01, P02... con sus etiquetas */}
                        {polygonCoords.map((coord, i) => {
                          const v = vertices[i] || {};
                          const pCode = v.codigo || \`P\${String(i + 1).padStart(2, '0')}\`;
                          return (
                            <Marker
                              key={\`vert-\${i}\`}
                              position={coord}
                              icon={createTextIcon(pCode, 'vertex-label', 6, 9.5, coord[0], coord[1], center[0], center[1])}
                            />
                          );
                        })}

                        {/* Linderos con medidas y colindantes rotados */}
                        {linderosConInfo.map((l, i) => (
                          <Marker
                            key={\`lin-\${i}\`}
                            position={[(l.p1[0] + l.p2[0]) / 2, (l.p1[1] + l.p2[1]) / 2]}
                            icon={createRotatedTextIcon(
                              l.colindante,
                              \`\${l.longitud ? l.longitud.toFixed(1) : '0.0'}m\`,
                              l.p1,
                              l.p2,
                              center[0],
                              center[1]
                            )}
                          />
                        ))}

                        {/* Flecha del Norte */}
                        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000, textAlign: 'center' }}>
                          <div style={{ width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: '28px solid black', margin: '0 auto' }}></div>
                          <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '3px', color: '#000000' }}>N</div>
                        </div>
                      </MapContainer>
                    )}
                  </div>

                  {/* Coordenadas UTM exteriores (top y left) */}
                  {mapGridLabels.top.map((lbl, i) => (
                    <div key={\`t-\${i}\`} style={{ position: 'absolute', top: '8px', left: \`\${lbl.val + 24}px\`, transform: 'translateX(-50%)', fontSize: '9px', fontWeight: 'bold', color: '#000000' }}>
                      {lbl.text}
                    </div>
                  ))}
                  {mapGridLabels.left.map((lbl, i) => (
                    <div key={\`l-\${i}\`} style={{ position: 'absolute', left: '-12px', top: \`\${lbl.val + 24}px\`, transform: 'translateY(-50%) rotate(-90deg)', fontSize: '9px', fontWeight: 'bold', color: '#000000', width: '50px', textAlign: 'center' }}>
                      {lbl.text}
                    </div>
                  ))}
                </div>

                {/* Escala Gráfica debajo del mapa */}
                <div style={{ padding: '0 24px 12px 24px', display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', marginRight: '12px' }}>ESCALA GRÁFICA:</div>
                  <div style={{ position: 'relative', width: \`\${Math.min(graphicScale.totalWidthPx || 280, 320)}px\`, height: '8px', display: 'flex', border: '1px solid black' }}>
                    {graphicScale.ticks?.map((tick, i) => (
                      <div key={i} style={{ position: 'absolute', left: \`\${(i / (graphicScale.ticks.length - 1)) * 100}%\`, top: '9px', transform: 'translateX(-50%)', fontSize: '7.5px', fontWeight: 'bold' }}>
                        {tick}
                      </div>
                    ))}
                    {graphicScale.ticks?.slice(0, -1).map((_, i) => (
                      <div key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? 'black' : 'white', borderRight: i < graphicScale.ticks.length - 2 ? '1px solid black' : 'none' }}></div>
                    ))}
                    <div style={{ position: 'absolute', right: '-35px', top: '9px', fontSize: '7.5px', fontWeight: 'bold' }}>
                      Metros
                    </div>
                  </div>
                </div>

                {/* Footer Boxes */}
                <div style={{ display: 'flex', borderTop: '2px solid black', height: '46px' }}>
                  <div className="footer-box" style={{ flex: 1 }}>
                    <div className="box-title">FECHA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold' }}>{currentDate}</div>
                  </div>
                  <div className="footer-box" style={{ flex: 1 }}>
                    <div className="box-title">ÁREA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold' }}>{Number(predio?.area_ha || (predio.area ? predio.area / 10000 : 0)).toFixed(4)} Ha</div>
                  </div>
                  <div className="footer-box" style={{ flex: 1 }}>
                    <div className="box-title">ESCALA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold' }}>{calculatedScale}</div>
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

              {/* COLUMNA DERECHA: SIDEBAR CAJETÍN TÉCNICO OFICIAL */}
              <div className="report-sidebar" style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
                {/* Minimapa de Ubicación */}
                <div className="sidebar-box">
                  <div className="minimap-box" style={{ height: '210px', position: 'relative', overflow: 'hidden', padding: '14px 8px 6px 20px', backgroundColor: 'white' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid black', backgroundColor: 'white' }}>
                      <MapContainer preferCanvas={true} center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Polygon positions={polygonCoords} pathOptions={{ color: '#b91c1c', weight: 2.5, fillColor: '#ef4444', fillOpacity: 0.95 }} />
                        <CircleMarker center={center} radius={18} pathOptions={{ color: '#dc2626', weight: 2, dashArray: '4, 4', fillColor: '#ef4444', fillOpacity: 0.15 }} />
                      </MapContainer>
                    </div>
                  </div>
                </div>

                <div className="sidebar-box">
                  <div className="box-title">UBICACIÓN:</div>
                  <div className="box-content" style={{ textAlign: 'center', fontSize: '8px', lineHeight: '1.2' }}>
                    <div style={{ fontWeight: 'bold' }}>CARTA TOPOGRÁFICA: VENTANAS / CATARAMA</div>
                    <div>ESCALA: 1:50000</div>
                    <div style={{ fontWeight: 'bold', marginTop: '1px' }}>CÓDIGO: CT-NIV-D1 / CT-NIV-D3</div>
                  </div>
                </div>

                <div className="sidebar-box">
                  <div className="box-title">POSESIONARIO:</div>
                  <div className="box-content">
                    <b>{predio?.nombre_posesionario || predio?.propietario || 'SIN NOMBRE'}</b><br />
                    C.C.: {predio?.cedula || 'S/D'}
                  </div>
                </div>

                <div className="sidebar-box">
                  <div className="box-title">CÓDIGO CATASTRAL:</div>
                  <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {predio?.codigo || predio?.cod_catastral || 'S/D'}
                  </div>
                </div>

                <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid black' }}>
                  <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex', flexDirection: 'column', minHeight: '32px' }}>
                    <div className="box-title" style={{ borderBottom: 'none' }}>PROVINCIA:</div>
                    <div className="box-content" style={{ textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {dpaProvincia}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '32px' }}>
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
                          {activeEmpresa?.nombre_director || 'Ing. Responsable de Catastro'}
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>REVISADO Y APROBADO:</div>
                      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                        <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                        <div style={{ fontSize: '7px', fontWeight: 'bold', minHeight: '10px' }}>
                          GAD URDANETA
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PÁGINA 2: INFORME DE LINDERACIÓN (TABLAS OFICIALES)            */}
      {/* ============================================================== */}
      {showP2 && (
        <div className="print-page" style={{ width: '297mm', height: '209mm', background: '#ffffff', boxSizing: 'border-box' }}>
          <div className="report-inner-border">
            <div className="page2-body">
              {/* LADO IZQUIERDO: TABLA VERTICES Y LINDEROS */}
              <div className="page2-col-left">
                <div className="page2-title">INFORME DE LINDERACIÓN</div>
                <div className="dpa-grid" style={{ border: '1px solid black', marginBottom: '8px' }}>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8px' }}>PROVINCIA:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>{dpaProvincia}</div></div>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8px' }}>CANTÓN:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>{dpaCanton}</div></div>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8px' }}>PARROQUIA:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>{dpaParroquia}</div></div>
                  <div className="dpa-col" style={{ padding: '3px' }}><div style={{ fontWeight: 'bold', fontSize: '8px' }}>SECTOR:</div><div style={{ textAlign: 'center', fontSize: '10px' }}>{dpaSector}</div></div>
                </div>

                <div style={{ display: 'flex', border: '1px solid black', marginBottom: '8px' }}>
                  <div style={{ flex: 1, padding: '4px', borderRight: '1px solid black' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '8px' }}>NOMBRES DEL POSESIONARIO</div>
                    <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '3px' }}>
                      {predio.nombre_posesionario || predio.propietario || 'SIN NOMBRE'}<br />C.C.: {predio.cedula || 'S/D'}
                    </div>
                  </div>
                  <div style={{ flex: .5, padding: '4px', borderRight: '1px solid black' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '8px' }}>NOMBRE DEL PREDIO</div>
                    <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '3px' }}>{predio?.nombre_predio || 'SIN NOMBRE'}</div>
                  </div>
                  <div style={{ flex: .5, padding: '4px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '8px' }}>CÓDIGO CATASTRAL</div>
                    <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '3px' }}>{predio?.codigo || predio?.cod_catastral || 'S/D'}</div>
                  </div>
                </div>

                {/* TABLA DE 7 COLUMNAS OFICIAL DEL GEOPORTAL */}
                <table className="report-table">
                  <thead>
                    <tr>
                      <th rowSpan="2" style={{ width: '40px' }}>PUNTOS</th>
                      <th colSpan="2">COORDENADAS PLANAS<br />UTM W.G.S.-84 (17S)</th>
                      <th rowSpan="2" style={{ width: '85px' }}>VERTICE<br />DESDE-HASTA</th>
                      <th rowSpan="2" style={{ width: '65px' }}>DISTANCIA (m)</th>
                      <th rowSpan="2" style={{ width: '80px' }}>RUMBO</th>
                      <th rowSpan="2">COLINDANTES</th>
                    </tr>
                    <tr>
                      <th style={{ width: '75px' }}>X</th>
                      <th style={{ width: '75px' }}>Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vertices.map((v, i) => {
                      const l = linderosConInfo[i] || {};
                      const currentCode = v.codigo || \`P\${String(i + 1).padStart(2, '0')}\`;
                      const vx = Number(v.coord_x ?? v.x);
                      const vy = Number(v.coord_y ?? v.y);

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 'bold', color: i === 0 ? '#047857' : '#000000' }}>{currentCode}</td>
                          <td>{!isNaN(vx) ? vx.toFixed(2) : '-'}</td>
                          <td>{!isNaN(vy) ? vy.toFixed(2) : '-'}</td>
                          <td style={{ fontWeight: 'bold' }}>{l.tramo || '-'}</td>
                          <td>{l.longitud ? l.longitud.toFixed(1) : '-'}</td>
                          <td>{l.rumbo || '-'}</td>
                          <td style={{ fontSize: '8.5px', textAlign: 'left', paddingLeft: '4px' }}>{l.colindante || 'Terreno Particular'}</td>
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

              {/* LADO DERECHO: DESCRIPCIÓN DE LINDEROS Y FIRMAS */}
              <div className="page2-col-right" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="page2-title">DESCRIPCIÓN DE LINDEROS</div>
                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE NORTE</div>
                  <div className="desc-box-content">
                    {linderosNorte.length > 0 ? linderosNorte.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : (predio.norte ? predio.norte : 'Sin datos.')}
                  </div>
                </div>
                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE SUR</div>
                  <div className="desc-box-content">
                    {linderosSur.length > 0 ? linderosSur.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : (predio.sur ? predio.sur : 'Sin datos.')}
                  </div>
                </div>
                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE ESTE</div>
                  <div className="desc-box-content">
                    {linderosEste.length > 0 ? linderosEste.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : (predio.este ? predio.este : 'Sin datos.')}
                  </div>
                </div>
                <div className="desc-box">
                  <div className="desc-box-title">COLINDANTE OESTE</div>
                  <div className="desc-box-content">
                    {linderosOeste.length > 0 ? linderosOeste.map((l, i) => <div style={{ marginBottom: '2px' }} key={i}>{renderLinderoText(l)}</div>) : (predio.oeste ? predio.oeste : 'Sin datos.')}
                  </div>
                </div>

                <div style={{ flex: 1 }}></div>

                {/* Resumen Métrico */}
                <div style={{ border: '1px solid black', padding: '6px', marginBottom: '8px', fontSize: '9px', textAlign: 'center', background: '#f8fafc' }}>
                  <div><b>ÁREA TOTAL:</b> {Number(predio?.area_ha || (predio.area ? predio.area / 10000 : 0)).toFixed(4)} Ha ({Number(predio.area || 0).toFixed(1)} m²)</div>
                  <div style={{ marginTop: '2px' }}><b>PERÍMETRO TOTAL:</b> {Number(predio.perimetro || 0).toFixed(2)} m</div>
                </div>

                <div className="firmas-grid">
                  <div className="firma-box">
                    <div className="firma-box-title">RESPONSABILIDAD TÉCNICA</div>
                    <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                      <div style={{ fontSize: '8px', fontWeight: 'bold' }}>{activeEmpresa?.nombre_director || 'Ing. Responsable de Catastro'}</div>
                      <div style={{ fontSize: '7.5px' }}>Director(a) de Catastro</div>
                    </div>
                  </div>
                  <div className="firma-box" style={{ borderLeft: 'none' }}>
                    <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                    <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                      <div style={{ fontSize: '8px', fontWeight: 'bold' }}>GAD URDANETA</div>
                      <div style={{ fontSize: '7.5px' }}>Dirección de Avalúos y Catastros</div>
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

fs.writeFileSync(targetPath, code, 'utf8');
console.log('ReportePlanimetricoSheet.jsx created successfully in movil!');
