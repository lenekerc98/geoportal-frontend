import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Marker, Polyline, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { Printer, ArrowLeft, Loader2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, AlertCircle } from 'lucide-react';
import { API_URL } from '../../services/api';
import { AppContext } from '../../context/AppContext';
import { showSuccess, showError } from '../../utils/swal';
import './ReportePlanimetrico.css';

// Helper: Crear icono de texto Leaflet
const createTextIcon = (text, className) => {
  return L.divIcon({
    className: className,
    html: `<div style="white-space: nowrap; font-size: 10px; font-weight: bold;">${text}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const createRotatedTextIcon = (text, p1, p2) => {
  let angle = Math.atan2(-(p2[0] - p1[0]), (p2[1] - p1[1])) * (180 / Math.PI);
  if (angle > 90 || angle < -90) angle += 180;
  
  return L.divIcon({
    className: 'lindero-rotated',
    html: `<div style="position: absolute; transform: translate(-50%, -50%) rotate(${angle}deg); white-space: nowrap; font-size: 10px; font-weight: bold; margin-top: -10px;">${text}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Helper: Determinar orientación geométrica respecto al centro
const getOrientacionGeometrica = (center, midPoint) => {
  if (!center || !midPoint) return 'ESTE';
  let dy = midPoint[0] - center[0];
  let dx = midPoint[1] - center[1];
  let angle = Math.atan2(dx, dy) * (180 / Math.PI);
  let azimuth = (angle + 360) % 360;
  
  if (azimuth >= 315 || azimuth < 45) return 'NORTE';
  if (azimuth >= 45 && azimuth < 135) return 'ESTE';
  if (azimuth >= 135 && azimuth < 225) return 'SUR';
  return 'OESTE';
};

const MapScaleUpdater = ({ scaleValue }) => {
  const map = useMap();
  useEffect(() => {
    let s = 1000;
    if (scaleValue && scaleValue.includes(':')) {
      const val = parseInt(scaleValue.split(':')[1].replace(/\D/g, ''));
      if (!isNaN(val) && val > 0) s = val;
    }
    // Formula matemática de escala a zoom en Web Mercator
    // Zoom 19 equivale aprox a 1:1000
    const z = 19 - Math.log2(s / 1000);
    map.setZoom(z);
  }, [scaleValue, map]);
  return null;
};

export default function ReportePlanimetrico() {
  const { id, codigo } = useParams();
  const navigate = useNavigate();
  const { activeEmpresa } = useContext(AppContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [allPredios, setAllPredios] = useState([]);
  
  const [scale, setScale] = useState('1:1000');
  const [customScale, setCustomScale] = useState('');
  
  const predefinedScales = ['1:100', '1:500', '1:1000', '1:1500', '1:2000', '1:2500', '1:3000', '1:4000', '1:5000', '1:10000', '1:50000'];

  useEffect(() => {
    const fetchAllPredios = async () => {
      try {
        const token = localStorage.getItem('catastro_token');
        const res = await fetch(`${API_URL}/api/gis/codigos-catastrales`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          json.sort((a,b) => (a.codigo || '').localeCompare(b.codigo || ''));
          setAllPredios(json);
        }
      } catch (e) {}
    };
    fetchAllPredios();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [id, codigo]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setData(null); // Clear previous data
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
      showError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      navigate(`/reporte/planimetrico/codigo/${e.target.value.trim()}`);
    }
  };

  if (loading && !allPredios.length) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <Loader2 size={40} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
      <h2>Cargando Atlas...</h2>
    </div>;
  }

  // Remove the early return for !data so we can render the controls first

  const { predio, vertices, linderos } = data;
  
  // Extraer Polígono (WKT to LatLng array)
  // Ej: POLYGON((lng lat, lng lat...))
  const parsePolygonWKT = (wkt) => {
    if (!wkt) return [];
    try {
      const coordsString = wkt.replace('POLYGON((', '').replace('))', '');
      const points = coordsString.split(',').map(p => {
        const [lng, lat] = p.trim().split(' ');
        return [parseFloat(lat), parseFloat(lng)];
      });
      return points;
    } catch (e) { return []; }
  };
  const polygonCoords = parsePolygonWKT(predio.geom_wkt);
  
  // Calcular centro
  const lats = polygonCoords.map(p => p[0]);
  const lngs = polygonCoords.map(p => p[1]);
  const center = polygonCoords.length > 0 ? [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2] : [0,0];

  // Calcular centroides y linderos
  const linderosConInfo = linderos.map(l => {
    let midPoint = [0, 0];
    try {
      const coordsStr = l.geom_wkt.replace('LINESTRING(', '').replace(')', '');
      const points = coordsStr.split(',').map(p => {
        const [lng, lat] = p.trim().split(' ');
        return [parseFloat(lat), parseFloat(lng)];
      });
      if(points.length >= 2) {
        midPoint = [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
      }
    } catch(e){}
    return { ...l, orientacion: getOrientacionGeometrica(center, midPoint) };
  });

  // Agrupar Linderos por Orientación
  const linderosNorte = linderosConInfo.filter(l => l.orientacion === 'NORTE');
  const linderosSur = linderosConInfo.filter(l => l.orientacion === 'SUR');
  const linderosEste = linderosConInfo.filter(l => l.orientacion === 'ESTE');
  const linderosOeste = linderosConInfo.filter(l => l.orientacion === 'OESTE');

  const renderLinderoText = (l) => {
    return `Del ${l.tramo || ''} con una distancia de ${l.longitud.toFixed(2)} m, Rumbo ${l.rumbo}; ${l.colindante || ''}`;
  };

  const currentDate = new Date().toLocaleDateString('es-ES');
  const dpaProvincia = activeEmpresa?.provincia || 'N/A';
  const dpaCanton = activeEmpresa?.canton || 'N/A';
  const dpaParroquia = activeEmpresa?.ciudad || 'N/A';
  const dpaSector = activeEmpresa?.sector || 'N/A';
  
  const displayScale = scale === 'custom' ? customScale : scale;

  const currentIndex = allPredios.findIndex(p => p.codigo === (codigo || predio.codigo) || p.id === parseInt(id || predio.id));
  
  const goFirst = () => {
    if (allPredios.length > 0) navigate(`/reporte/planimetrico/codigo/${allPredios[0].codigo}`);
  };
  const goPrev = () => {
    if (currentIndex > 0) navigate(`/reporte/planimetrico/codigo/${allPredios[currentIndex - 1].codigo}`);
  };
  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < allPredios.length - 1) navigate(`/reporte/planimetrico/codigo/${allPredios[currentIndex + 1].codigo}`);
  };
  const goLast = () => {
    if (allPredios.length > 0) navigate(`/reporte/planimetrico/codigo/${allPredios[allPredios.length - 1].codigo}`);
  };

  return (
    <div style={{ paddingBottom: '50px' }}>
      <div className="report-controls no-print">
        <div className="report-controls-group">
          <button onClick={() => window.close()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            <ArrowLeft size={16} /> Volver
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '20px', background: 'white', padding: '5px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', marginRight: '5px' }}>Atlas:</span>
            <button onClick={goFirst} disabled={currentIndex <= 0} title="Primero" style={{ padding: '4px', cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '4px' }}><ChevronsLeft size={16} /></button>
            <button onClick={goPrev} disabled={currentIndex <= 0} title="Anterior" style={{ padding: '4px', cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '4px' }}><ChevronLeft size={16} /></button>
            
            <div style={{ display: 'flex', alignItems: 'center', margin: '0 10px', gap: '5px' }}>
              <input 
                key={codigo || (data?.predio ? data.predio.codigo : 'manual')}
                type="text" 
                defaultValue={codigo || (data?.predio ? data.predio.codigo : '')}
                onKeyDown={handleManualSearch}
                placeholder="Buscar código..."
                style={{ width: '120px', padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}
                title="Presiona Enter para buscar"
              />
              <span style={{ fontSize: '12px', minWidth: '40px', color: '#64748b' }}>
                / {allPredios.length}
              </span>
            </div>

            <button onClick={goNext} disabled={currentIndex === -1 || currentIndex >= allPredios.length - 1} title="Siguiente" style={{ padding: '4px', cursor: (currentIndex === -1 || currentIndex >= allPredios.length - 1) ? 'not-allowed' : 'pointer', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '4px' }}><ChevronRight size={16} /></button>
            <button onClick={goLast} disabled={currentIndex === -1 || currentIndex >= allPredios.length - 1} title="Último" style={{ padding: '4px', cursor: (currentIndex === -1 || currentIndex >= allPredios.length - 1) ? 'not-allowed' : 'pointer', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '4px' }}><ChevronsRight size={16} /></button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Escala:</label>
            <select 
              value={scale} 
              onChange={(e) => setScale(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
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
        </div>
        
        <button onClick={() => window.print()} disabled={!data} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 20px', background: !data ? '#94a3b8' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: !data ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
          <Printer size={18} /> Imprimir PDF
        </button>
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
          <p>El código catastral <b>{codigo}</b> está registrado en la base de datos pero aún no tiene un polígono asociado.</p>
          <p>Usa los controles del Atlas arriba para navegar al siguiente predio.</p>
        </div>
      )}

      {!loading && data && (
        <>
        <div className="print-page">
        <div className="report-border">
          <div className="report-header">
            <h1>LEVANTAMIENTO PLANIMÉTRICO</h1>
          </div>
          
          <div className="report-body">
            <div className="report-map-container">
              {polygonCoords.length > 0 && (
                <MapContainer center={center} zoom={18} maxZoom={24} zoomSnap={0.1} style={{ width: '100%', height: '100%' }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false}>
                  <MapScaleUpdater scaleValue={displayScale} />
                  
                  <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Mapa Claro">
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" opacity={0.5} maxNativeZoom={19} maxZoom={24} />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satélite (Esri)">
                      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" opacity={0.8} maxNativeZoom={19} maxZoom={24} />
                    </LayersControl.BaseLayer>
                  </LayersControl>
                  
                  <Polygon positions={polygonCoords} pathOptions={{ color: 'black', weight: 2, fillColor: 'transparent' }} />
                  
                  {/* Vértices Puntos */}
                  {vertices.map(v => {
                    const lat = parsePolygonWKT(v.geom_wkt)[0]?.[0];
                    const lng = parsePolygonWKT(v.geom_wkt)[0]?.[1];
                    if(!lat || !lng) return null;
                    return (
                      <React.Fragment key={v.id}>
                        <Marker position={[lat, lng]} icon={createTextIcon(v.codigo, 'vertex-label')} />
                      </React.Fragment>
                    );
                  })}

                  {/* Info Central del Predio */}
                  <Marker position={center} icon={L.divIcon({
                    className: 'center-predio-info',
                    html: `<div style="position: absolute; transform: translate(-50%, -50%); text-align: center; font-size: 10px; line-height: 1.2; font-weight: bold; white-space: nowrap;">
                      Posesionario:<br/>
                      ${predio.nombre_posesionario || 'SIN NOMBRE'}<br/>
                      C.C.: ${predio.cedula || 'S/D'}<br/>
                      Código: ${predio.codigo || 'S/D'}<br/>
                      Área: ${predio.area_ha || 0} Ha
                    </div>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                  })} />

                  {/* Linderos / Distancias Rotadas */}
                  {linderos.map((l, i) => {
                    try {
                      const coordsStr = l.geom_wkt.replace('LINESTRING(', '').replace(')', '');
                      const points = coordsStr.split(',').map(p => {
                        const [lng, lat] = p.trim().split(' ');
                        return [parseFloat(lat), parseFloat(lng)];
                      });
                      if(points.length >= 2) {
                        const midLat = (points[0][0] + points[1][0]) / 2;
                        const midLng = (points[0][1] + points[1][1]) / 2;
                        const label = `${l.longitud.toFixed(2)}m - ${l.colindante || ''}`;
                        return <Marker key={i} position={[midLat, midLng]} icon={createRotatedTextIcon(label, points[0], points[1])} />;
                      }
                    } catch(e){}
                    return null;
                  })}
                  
                  {/* Rosa de los Vientos estática (Norte) */}
                  <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, textAlign: 'center' }}>
                    <div style={{ width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '30px solid black', margin: '0 auto' }}></div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '5px' }}>N</div>
                  </div>
                </MapContainer>
              )}
            </div>
            
            <div className="report-sidebar">
              <div className="sidebar-box">
                <div className="minimap-box">
                  {/* Carta Topográfica Scale 1:50000 */}
                  <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false}>
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    <Polygon positions={polygonCoords} pathOptions={{ color: 'yellow', weight: 1, fillColor: 'transparent' }} />
                  </MapContainer>
                </div>
                <div className="box-content-center" style={{ fontSize: '9px', borderTop: '1px solid black' }}>
                  UBICACIÓN:<br/>
                  CARTA TOPOGRÁFICA<br/>
                  ESCALA 1:50000
                </div>
              </div>
              
              <div className="sidebar-box">
                <div className="box-title">POSESIONARIO:</div>
                <div className="box-content">
                  {predio.nombre_posesionario || 'SIN NOMBRE'}<br/>
                  C.C.: {predio.cedula || 'S/D'}
                </div>
              </div>
              
              <div className="sidebar-box dpa-grid">
                <div className="dpa-col">
                  <div className="box-title-no-border">PROVINCIA:</div>
                  <div className="box-content-center">{dpaProvincia}</div>
                </div>
                <div className="dpa-col">
                  <div className="box-title-no-border">CANTÓN:</div>
                  <div className="box-content-center">{dpaCanton}</div>
                </div>
                <div className="dpa-col">
                  <div className="box-title-no-border">PARROQUIA:</div>
                  <div className="box-content-center">{dpaParroquia}</div>
                </div>
              </div>
              
              <div className="sidebar-box">
                <div className="box-title">SECTOR:</div>
                <div className="box-content-center">{dpaSector}</div>
              </div>
              
              <div className="sidebar-box">
                <div className="box-title">NOMBRE DEL PREDIO:</div>
                <div className="box-content-center">SIN NOMBRE</div>
              </div>
              
              <div className="sidebar-box" style={{ flex: 1, justifyContent: 'flex-end', borderBottom: 'none' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ flex: 1, borderRight: '1px solid black', borderTop: '1px solid black', padding: '5px' }}>
                    <div className="box-title-no-border" style={{ padding: 0 }}>RESP. TÉCNICO:</div>
                    <div style={{ marginTop: '30px', borderTop: '1px solid black', textAlign: 'center', fontSize: '9px', paddingTop: '2px' }}>FIRMA RESPONSABLE</div>
                  </div>
                  <div style={{ flex: 1, borderTop: '1px solid black', padding: '5px' }}>
                    <div className="box-title-no-border" style={{ padding: 0 }}>REVISADO Y APROBADO:</div>
                    <div style={{ marginTop: '30px', borderTop: '1px solid black', textAlign: 'center', fontSize: '9px', paddingTop: '2px' }}>AUTORIDAD AGRARIA</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="report-footer">
            <div className="footer-box" style={{ flex: 1.5 }}>
              <div className="box-title">ESCALA GRÁFICA:</div>
              <div className="box-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                {/* Simulación Escala Gráfica */}
                <div style={{ width: '80%', height: '5px', display: 'flex', border: '1px solid black' }}>
                  <div style={{ flex: 1, background: 'black' }}></div>
                  <div style={{ flex: 1, background: 'white' }}></div>
                  <div style={{ flex: 1, background: 'black' }}></div>
                  <div style={{ flex: 1, background: 'white' }}></div>
                </div>
              </div>
            </div>
            <div className="footer-box">
              <div className="box-title">FECHA:</div>
              <div className="box-content">{currentDate}</div>
            </div>
            <div className="footer-box">
              <div className="box-title">ÁREA:</div>
              <div className="box-content">{predio.area_ha ? predio.area_ha.toFixed(4) : '0.0000'} Ha</div>
            </div>
            <div className="footer-box">
              <div className="box-title">ESCALA:</div>
              <div className="box-content">{displayScale}</div>
            </div>
            <div className="footer-box" style={{ flex: 1.5 }}>
              <div className="box-title">COORDENADAS PLANAS:</div>
              <div className="box-content" style={{ fontSize: '8px', lineHeight: '1', fontWeight: 'normal', paddingTop: '2px' }}>
                SISTEMA DE COORDENADAS<br/>
                WGS 1984 UTM ZONE 17S<br/>
                PROYECCIÓN: TRANSVERSE MERCATOR<br/>
                DATUM: WGS 1984
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* PÁGINA 2: TABLAS DE LINDEROS */}
      <div className="print-page">
        <div className="report-inner-border">
          <div className="page2-header">
            <div className="page2-title" style={{ borderRight: '2px solid black' }}>INFORME DE LINDERACIÓN</div>
            <div className="page2-title">DESCRIPCIÓN DE LINDEROS</div>
          </div>
          
          <div className="page2-body">
            {/* LADO IZQUIERDO: TABLA VERTICES */}
            <div className="page2-col-left" style={{ padding: '0 10px' }}>
              <div className="dpa-grid" style={{ border: '1px solid black', marginBottom: '10px' }}>
                <div className="dpa-col" style={{ padding: '4px' }}><div style={{fontWeight:'bold', fontSize:'9px'}}>PROVINCIA:</div><div style={{textAlign:'center', fontSize:'11px'}}>{dpaProvincia}</div></div>
                <div className="dpa-col" style={{ padding: '4px' }}><div style={{fontWeight:'bold', fontSize:'9px'}}>CANTÓN:</div><div style={{textAlign:'center', fontSize:'11px'}}>{dpaCanton}</div></div>
                <div className="dpa-col" style={{ padding: '4px' }}><div style={{fontWeight:'bold', fontSize:'9px'}}>PARROQUIA:</div><div style={{textAlign:'center', fontSize:'11px'}}>{dpaParroquia}</div></div>
                <div className="dpa-col" style={{ padding: '4px' }}><div style={{fontWeight:'bold', fontSize:'9px'}}>SECTOR:</div><div style={{textAlign:'center', fontSize:'11px'}}>{dpaSector}</div></div>
              </div>
              
              <div style={{ display: 'flex', border: '1px solid black', marginBottom: '10px' }}>
                <div style={{ flex: 1, padding: '4px', borderRight: '1px solid black' }}>
                  <div style={{fontWeight:'bold', fontSize:'9px'}}>NOMBRES DEL POSESIONARIO</div>
                  <div style={{textAlign:'center', fontSize:'10px', marginTop:'5px'}}>{predio.nombre_posesionario || 'SIN NOMBRE'}<br/>C.C.: {predio.cedula || 'S/D'}</div>
                </div>
                <div style={{ flex: 1, padding: '4px' }}>
                  <div style={{fontWeight:'bold', fontSize:'9px'}}>NOMBRE DEL PREDIO</div>
                  <div style={{textAlign:'center', fontSize:'10px', marginTop:'5px'}}>SIN NOMBRE</div>
                </div>
              </div>
              
              <table className="report-table">
                <thead>
                  <tr>
                    <th rowSpan="2">PUNTOS</th>
                    <th colSpan="2">COORDENADAS PLANAS<br/>UTM W.G.S.-84</th>
                    <th rowSpan="2">VERTICE<br/>DESDE-HASTA</th>
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
                    const l = linderos[i] || {};
                    return (
                      <tr key={v.id}>
                        <td>{v.codigo}</td>
                        <td>{v.coord_x ? v.coord_x.toFixed(3) : '-'}</td>
                        <td>{v.coord_y ? v.coord_y.toFixed(3) : '-'}</td>
                        <td>{l.tramo || '-'}</td>
                        <td>{l.longitud ? l.longitud.toFixed(2) : '-'}</td>
                        <td>{l.rumbo || '-'}</td>
                        <td style={{ fontSize: '8px' }}>{l.colindante || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* LADO DERECHO: DESCRIPCION ORIENTACION */}
            <div className="page2-col-right" style={{ padding: '0 10px', display: 'flex', flexDirection: 'column' }}>
              <div className="desc-box">
                <div className="desc-box-title">COLINDANTE NORTE</div>
                <div className="desc-box-content">
                  {linderosNorte.length > 0 ? linderosNorte.map((l, i) => <div key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                </div>
              </div>
              <div className="desc-box">
                <div className="desc-box-title">COLINDANTE SUR</div>
                <div className="desc-box-content">
                  {linderosSur.length > 0 ? linderosSur.map((l, i) => <div key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                </div>
              </div>
              <div className="desc-box">
                <div className="desc-box-title">COLINDANTE ESTE</div>
                <div className="desc-box-content">
                  {linderosEste.length > 0 ? linderosEste.map((l, i) => <div key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                </div>
              </div>
              <div className="desc-box">
                <div className="desc-box-title">COLINDANTE OESTE</div>
                <div className="desc-box-content">
                  {linderosOeste.length > 0 ? linderosOeste.map((l, i) => <div key={i}>{renderLinderoText(l)}</div>) : 'Sin datos.'}
                </div>
              </div>
              
              <div style={{ flex: 1 }}></div>
              
              <div className="firmas-grid">
                <div className="firma-box">
                  <div className="firma-box-title">RESPONSABILIDAD TÉCNICA</div>
                  <div>
                    <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 5px auto' }}></div>
                    Ingeniero Topógrafo<br/>Registro:
                  </div>
                </div>
                <div className="firma-box" style={{ borderLeft: 'none' }}>
                  <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                  <div>
                    <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 5px auto' }}></div>
                    Autoridad Agraria Nacional
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
