import React, { useMemo, useState } from 'react';
import { MapContainer, Polygon, Marker, GeoJSON, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2 } from 'lucide-react';
import { API_URL } from '../../services/api';
import { escapeHtml } from '../../utils/sanitize';

// Helper: Crear icono de texto Leaflet para vértices
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
    html: `
      <div style="position: relative; width: ${pointSize}px; height: ${pointSize}px; background: #ffb6c1; border: 1px solid black; border-radius: 50%;">
        <span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px); font-size: ${textSize}px; font-weight: bold; color: black; white-space: nowrap; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">${safeText}</span>
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

  const safeMedida = escapeHtml(medida);
  const safeColindante = escapeHtml(colindante);

  return L.divIcon({
    className: 'lindero-rotated',
    html: `
      <div style="position: absolute; transform: translate(-50%, -50%) translate(${offMx}px, ${offMy}px) rotate(${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; color: #37474f; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
        ${safeMedida}
      </div>
      ${colindante ? `
      <div style="position: absolute; transform: translate(-50%, -50%) translate(${offCx}px, ${offCy}px) rotate(${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; color: #1a237e; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;">
        ${safeColindante}
      </div>` : ''}
    `,
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

export default function PlanimetricoSheet({
  data,
  activeEmpresa,
  scale = 'Auto',
  customScale = '',
  pointSize = 6,
  textSize = 10,
  textAngleOffset = 0,
  fondoMinimapa = 'osm',
  selectedCadFile = '',
  cadGeoJson = null,
  codigoCarta = '',
  nombreCarta = '',
  nombreCuadricula = 'ZONA 17S',
  onPrevisualizarPlano,
  onPrevisualizarMinimapa,
  MapScaleUpdater,
  UtmGrid
}) {
  const [mapGridLabels, setMapGridLabels] = useState({ top: [], left: [] });
  const [minimapGridLabels, setMinimapGridLabels] = useState({ top: [], left: [] });
  const [calculatedScale, setCalculatedScale] = useState('1:1000');
  const [graphicScale, setGraphicScale] = useState({ totalWidthPx: 300, ticks: [0, 20, 40, 60, 80, 100] });

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
    if (polygonCoords.length === 0) return { center: [0, 0], width: 1, height: 1, mainAngle: 0 };
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
          let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
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

  const linderosConInfo = useMemo(() => {
    return linderos.map((l, index) => {
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
  }, [linderos, vertices, center, centerInfo]);

  const linderosNorte = linderosConInfo.filter(l => l.orientacion === 'NORTE');
  const linderosSur = linderosConInfo.filter(l => l.orientacion === 'SUR');
  const linderosEste = linderosConInfo.filter(l => l.orientacion === 'ESTE');
  const linderosOeste = linderosConInfo.filter(l => l.orientacion === 'OESTE');

  const renderLinderoText = (l) => {
    const tramoStr = (l.tramo || '').replace(' - ', ' al ');
    return `Del ${tramoStr} con una distancia de ${l.longitud ? l.longitud.toFixed(1) : '0.0'} m, Rumbo ${l.rumbo || '-'}; ${l.colindante || ''}`;
  };

  const currentDate = new Date().toLocaleDateString('es-ES');
  const dpaProvincia = activeEmpresa?.provincia || predio?.provincia || 'LOS RÍOS';
  const dpaCanton = activeEmpresa?.canton || predio?.canton || 'URDANETA';
  const dpaParroquia = activeEmpresa?.ciudad || predio?.ciudad || 'CATARAMA';
  const dpaSector = activeEmpresa?.sector || predio?.sector || 'URBANO';
  const displayScale = scale === 'custom' ? customScale : scale;

  return (
    <>
      {/* PÁGINA 1: PLANO CARTOGRÁFICO */}
      <div className="print-page">
        <div className="report-border">

          {/* HEADER OFICIAL CON LOGO GAD Y NOMBRE DE EMPRESA */}
          <div className="report-header" style={{ position: 'relative', textAlign: 'center', padding: '10px 0', borderBottom: '2px solid black', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                {activeEmpresa?.nombre || 'GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL'}
              </div>
              <h1 style={{ margin: '0', fontSize: '20px', fontWeight: '900', color: '#0f172a', letterSpacing: '1px', textTransform: 'uppercase' }}>
                LEVANTAMIENTO PLANIMÉTRICO
              </h1>
            </div>

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
                  {onPrevisualizarPlano && (
                    <button
                      type="button"
                      className="no-print"
                      onClick={onPrevisualizarPlano}
                      style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 999, background: '#0284c7', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                      title="Abrir ventana emergente interactiva de este plano"
                    >
                      <Maximize2 size={13} /> Previsualizar
                    </button>
                  )}

                  {polygonCoords.length > 0 && (
                    <MapContainer preferCanvas={true} center={center} zoom={18} maxZoom={24} zoomSnap={0.1} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false}>
                      {MapScaleUpdater && (
                        <MapScaleUpdater scaleValue={displayScale} polygonCoords={polygonCoords} setCalculatedScale={setCalculatedScale} setGraphicScale={setGraphicScale} />
                      )}
                      {UtmGrid && <UtmGrid setMapGridLabels={setMapGridLabels} />}

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
                              const medida = `${l.longitud ? l.longitud.toFixed(1) : '0.0'}m`;
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
                    {onPrevisualizarMinimapa && (
                      <button
                        type="button"
                        className="no-print"
                        onClick={onPrevisualizarMinimapa}
                        style={{ position: 'absolute', top: '4px', right: '4px', zIndex: 999, background: '#0284c7', color: 'white', border: 'none', padding: '3px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
                        title="Abrir ventana emergente interactiva de la carta CAD"
                      >
                        <Maximize2 size={10} /> Previsualizar
                      </button>
                    )}

                    <MapContainer preferCanvas={true} center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false}>
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
                        />
                      )}

                      {UtmGrid && <UtmGrid setMapGridLabels={setMinimapGridLabels} isMinimap={true} />}
                      <Polygon positions={polygonCoords} pathOptions={{ color: 'black', weight: 2.5, fillColor: '#ea580c', fillOpacity: 0.85 }} />
                    </MapContainer>
                  </div>

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
              </div>

              <div className="sidebar-box">
                <div className="box-title">UBICACIÓN:</div>
                <div className="box-content" style={{ textAlign: 'center', fontSize: '8px', lineHeight: '1.2' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    CARTA TOPOGRÁFICA: {nombreCarta || predio?.nombre_carta || 'VENTANAS / CATARAMA / JUAN MONTALVO'}
                  </div>
                  <div>ESCALA: 1:50000</div>
                  <div style={{ fontWeight: 'bold', marginTop: '1px' }}>
                    CÓDIGO: {codigoCarta || predio?.codigo_carta || 'CT-NIV-D1 / CT-NIV-D3 / CT-NIV-F1 / CT-NIV-F3'}
                  </div>
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
          <div className="page2-body">
            {/* LADO IZQUIERDO: TABLA VERTICES */}
            <div className="page2-col-left">
              <div className="page2-title">INFORME DE LINDERACIÓN</div>
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
                        <td>{v.coord_x ? v.coord_x.toFixed(1) : '-'}</td>
                        <td>{v.coord_y ? v.coord_y.toFixed(1) : '-'}</td>
                        <td>{desdeHasta}</td>
                        <td>{l.longitud ? l.longitud.toFixed(1) : '-'}</td>
                        <td>{l.rumbo || '-'}</td>
                        <td style={{ fontSize: '8px' }}>{l.colindante || '-'}</td>
                      </tr>
                    );
                  })}
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
              <div className="page2-title">DESCRIPCIÓN DE LINDEROS</div>
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
                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: 'transparent', userSelect: 'none' }}>.</div>
                    <div style={{ fontSize: '8px', color: 'transparent', userSelect: 'none' }}>.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
