import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, Polygon, Marker, GeoJSON, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2 } from 'lucide-react';
import { API_URL } from '../../services/api';
import { escapeHtml } from '../../utils/sanitize';
import { normalizeVerticesAndLinderos, parseWktPolygonCoords, parseWktPointCoords, parseWktLineCoords, fetchCadGeoJsonForCenter } from '../../utils/geometryUtils';
import defaultLogoGad from '../../assets/logo_gad.png';

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${API_URL}${cleanUrl}`;
};

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
  });
};

const MinimapViewUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, 13, { animate: false });
      map.invalidateSize();
    }
  }, [map, center[0], center[1]]);
  return null;
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

const getCardinalOrientations = (vertices = []) => {
  const n = vertices.length;
  if (n < 3) return [];
  if (n === 3) return ['NORTE', 'ESTE', 'OESTE'];

  const coords = vertices.map(v => {
    let x = v.coord_x;
    let y = v.coord_y;
    if ((x === undefined || y === undefined || x === null || y === null) && v.geom_wkt) {
      const pt = parseWktPointCoords(v.geom_wkt);
      if (pt) {
        x = pt.lng;
        y = pt.lat;
      }
    }
    return { x: Number(x) || 0, y: Number(y) || 0 };
  });

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = coords[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  // NE: maximiza normY + normX en [1, n - 3]
  let neIdx = 1;
  let bestNe = -Infinity;
  const maxNeLimit = Math.max(1, n - 3);
  for (let i = 1; i <= maxNeLimit; i++) {
    const normX = (coords[i].x - minX) / spanX;
    const normY = (coords[i].y - minY) / spanY;
    const score = normY + normX;
    if (score > bestNe) {
      bestNe = score;
      neIdx = i;
    }
  }

  // SE: maximiza -normY + normX en [neIdx + 1, n - 2]
  let seIdx = Math.min(n - 2, neIdx + 1);
  let bestSe = -Infinity;
  const maxSeLimit = Math.max(seIdx, n - 2);
  for (let i = neIdx + 1; i <= maxSeLimit; i++) {
    const normX = (coords[i].x - minX) / spanX;
    const normY = (coords[i].y - minY) / spanY;
    const score = -normY + normX;
    if (score > bestSe) {
      bestSe = score;
      seIdx = i;
    }
  }

  // SW: maximiza -normY - normX en [seIdx + 1, n - 1]
  let swIdx = Math.min(n - 1, seIdx + 1);
  let bestSw = -Infinity;
  for (let i = seIdx + 1; i < n; i++) {
    const normX = (coords[i].x - minX) / spanX;
    const normY = (coords[i].y - minY) / spanY;
    const score = -normY - normX;
    if (score > bestSw) {
      bestSw = score;
      swIdx = i;
    }
  }

  const res = [];
  for (let i = 0; i < n; i++) {
    if (i < neIdx) res.push('NORTE');
    else if (i < seIdx) res.push('ESTE');
    else if (i < swIdx) res.push('SUR');
    else res.push('OESTE');
  }
  return res;
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
  duplexMode = true,
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

  const [empresaInfo, setEmpresaInfo] = useState(activeEmpresa);

  useEffect(() => {
    if (activeEmpresa) {
      setEmpresaInfo(prev => ({ ...(prev || {}), ...activeEmpresa }));
    }
  }, [activeEmpresa]);

  useEffect(() => {
    // Si activeEmpresa no tiene logo_url, consultar la API para asegurar los datos más recientes
    if (!empresaInfo?.logo_url && !activeEmpresa?.logo_url) {
      const token = localStorage.getItem('catastro_token');
      if (!token) return;
      fetch(`${API_URL}/api/empresas`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(list => {
          if (Array.isArray(list) && list.length > 0) {
            const targetId = activeEmpresa?.id || predio?.empresa_id || 2;
            const match = list.find(e => e.id === targetId) || list[0];
            if (match) {
              setEmpresaInfo(prev => ({ ...(prev || {}), ...match }));
            }
          }
        })
        .catch(() => { });
    }
  }, [activeEmpresa?.id, activeEmpresa?.logo_url, predio?.empresa_id]);
  const { vertices, linderos } = useMemo(() => {
    return normalizeVerticesAndLinderos(data?.vertices, data?.linderos);
  }, [data?.vertices, data?.linderos]);

  const polygonCoords = useMemo(() => {
    return parseWktPolygonCoords(predio.geom_wkt);
  }, [predio.geom_wkt]);

  const centerInfo = useMemo(() => {
    if (!polygonCoords || polygonCoords.length === 0) return { center: [-1.5, -79.5], width: 1, height: 1, mainAngle: 0 };
    const lats = polygonCoords.map(p => p[0]).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    const lngs = polygonCoords.map(p => p[1]).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (lats.length === 0 || lngs.length === 0) return { center: [-1.5, -79.5], width: 1, height: 1, mainAngle: 0 };

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    if (isNaN(centerLat) || isNaN(centerLng)) {
      return { center: [-1.5, -79.5], width: 1, height: 1, mainAngle: 0 };
    }

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
      center: [centerLat, centerLng],
      height: Math.max(0.0001, maxLat - minLat),
      width: Math.max(0.0001, maxLng - minLng),
      mainAngle
    };
  }, [polygonCoords]);

  const center = (centerInfo.center && !isNaN(centerInfo.center[0]) && !isNaN(centerInfo.center[1]))
    ? centerInfo.center
    : [-1.5, -79.5];

  const [localCadGeoJson, setLocalCadGeoJson] = useState(cadGeoJson);

  useEffect(() => {
    if (cadGeoJson && cadGeoJson.features && cadGeoJson.features.length > 0) {
      setLocalCadGeoJson(cadGeoJson);
    }
  }, [cadGeoJson]);

  useEffect(() => {
    if (fondoMinimapa === 'cad' && center && !isNaN(center[0]) && !isNaN(center[1])) {
      const hasValidFeatures = localCadGeoJson && Array.isArray(localCadGeoJson.features) && localCadGeoJson.features.length > 0;
      if (!hasValidFeatures) {
        const token = localStorage.getItem('catastro_token');
        fetchCadGeoJsonForCenter(API_URL, token, selectedCadFile, center).then(data => {
          if (data && data.features && data.features.length > 0) {
            setLocalCadGeoJson(data);
          }
        });
      }
    }
  }, [fondoMinimapa, selectedCadFile, center, localCadGeoJson]);

  const activeCadGeoJson = (localCadGeoJson && localCadGeoJson.features && localCadGeoJson.features.length > 0)
    ? localCadGeoJson
    : cadGeoJson;

  const linderosConInfo = useMemo(() => {
    const orientations = getCardinalOrientations(vertices);
    return linderos.map((l, index) => {
      const currentCode = vertices[index]?.codigo || `P${String(index + 1).padStart(2, '0')}`;
      const nextCode = (index < vertices.length - 1)
        ? (vertices[index + 1]?.codigo || `P${String(index + 2).padStart(2, '0')}`)
        : (vertices[0]?.codigo || 'P01');
      const tramoCalculado = (l.tramo && l.tramo !== '-') ? l.tramo : `${currentCode} - ${nextCode}`;

      return {
        ...l,
        tramo: tramoCalculado,
        orientacion: orientations[index] || 'NORTE'
      };
    });
  }, [linderos, vertices]);

  const CARDINAL_ORDER = ['NORTE', 'SUR', 'ESTE', 'OESTE'];

  // Agrupar estrictamente en el orden solicitado por el usuario: NORTE -> SUR -> ESTE -> OESTE
  const orderedLinderosForReport = useMemo(() => {
    const list = [];
    const usedIds = new Set();
    CARDINAL_ORDER.forEach(orient => {
      const items = linderosConInfo.filter(l => l.orientacion === orient);
      items.forEach(l => {
        list.push(l);
        usedIds.add(l.id || l.tramo || list.length);
      });
    });
    // Garantizar que no se quede ningún lindero fuera
    linderosConInfo.forEach((l, idx) => {
      const key = l.id || l.tramo || idx;
      if (!usedIds.has(key)) {
        list.push({ ...l, orientacion: l.orientacion || 'NORTE' });
      }
    });
    return list;
  }, [linderosConInfo]);

  // Memoizar marcadores rotados y colindantes para no recalcular trigonometría en cada render
  const linderosMarkers = useMemo(() => {
    if (!linderos || linderos.length === 0) return [];
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
        if (!l.geom_wkt) return null;
        const points = parseWktLineCoords(l.geom_wkt);
        if (points.length >= 2) {
          const midLat = (points[0][0] + points[1][0]) / 2;
          const midLng = (points[0][1] + points[1][1]) / 2;
          if (isNaN(midLat) || isNaN(midLng)) return null;
          const medida = `${l.longitud ? Number(l.longitud).toFixed(1) : '0.0'}m`;
          const colindanteToRender = centerIndices.has(i) ? l.colindante : '';
          return (
            <Marker
              key={`lindero-${i}`}
              position={[midLat, midLng]}
              icon={createRotatedTextIcon(colindanteToRender, medida, points[0], points[1], center[0], center[1])}
            />
          );
        }
      } catch (e) { }
      return null;
    });
  }, [linderos, center]);

  // Capacidad de filas por hoja
  const ROWS_PER_PAGE = 28;
  const LINDEROS_CAPACITY_NORMAL = 38;
  const LINDEROS_CAPACITY_LAST = 28;

  const totalSheets = useMemo(() => {
    const totalVerts = vertices.length;
    const totalLins = orderedLinderosForReport.length;
    if (totalVerts <= 24 && totalLins <= 24) return 1;

    const sheetsVerts = Math.max(1, Math.ceil(totalVerts / ROWS_PER_PAGE));
    let sheetsLins = 1;
    if (totalLins > LINDEROS_CAPACITY_LAST) {
      sheetsLins = Math.ceil((totalLins - LINDEROS_CAPACITY_LAST) / LINDEROS_CAPACITY_NORMAL) + 1;
    }
    return Math.max(sheetsVerts, sheetsLins);
  }, [vertices.length, orderedLinderosForReport.length]);

  // Llenar cada hoja a su máxima capacidad (38 linderos) en vez de repartir poquito por hoja.
  // El usuario solicitó: "súbele más sin importar si en una hoja no tiene descripción de lindero"
  const sheetLinderosChunks = useMemo(() => {
    const chunks = [];
    const totalItems = orderedLinderosForReport.length;
    let curr = 0;

    for (let s = 0; s < totalSheets; s++) {
      const isLast = (s === totalSheets - 1);
      const remainingItems = totalItems - curr;

      if (remainingItems <= 0) {
        chunks.push({
          startIdx: curr,
          items: []
        });
        continue;
      }

      // En la última hoja caben hasta LINDEROS_CAPACITY_LAST (o todo lo restante si cabe)
      // En las hojas anteriores se llena con la capacidad máxima de 38 linderos
      let count = isLast ? remainingItems : Math.min(remainingItems, LINDEROS_CAPACITY_NORMAL);

      const items = orderedLinderosForReport.slice(curr, curr + count);
      chunks.push({
        startIdx: curr,
        items
      });
      curr += count;
    }
    return chunks;
  }, [orderedLinderosForReport, totalSheets]);

  const renderLinderoText = (l) => {
    const tramoStr = (l.tramo || '').replace(' - ', ' al ');
    const colindanteText = l.colindante && l.colindante.trim() && l.colindante.trim() !== '-'
      ? `; ${l.colindante.trim()}`
      : '';
    return `Del ${tramoStr} con una distancia de ${l.longitud ? Number(l.longitud).toFixed(1) : '0.0'} m, Rumbo ${l.rumbo || '-'}${colindanteText}`;
  };

  const currentDate = new Date().toLocaleDateString('es-ES');
  const currentEmpresa = empresaInfo || activeEmpresa;
  const dpaProvincia = currentEmpresa?.provincia || predio?.provincia || 'LOS RÍOS';
  const dpaCanton = currentEmpresa?.canton || predio?.canton || 'URDANETA';
  const dpaParroquia = currentEmpresa?.ciudad || predio?.ciudad || 'CATARAMA';
  const dpaSector = predio?.sector || currentEmpresa?.sector || 'URBANO';
  const displayScale = scale === 'custom' ? customScale : scale;
  const directorNombre = currentEmpresa?.nombre_director || ' ';

  return (
    <>
      {/* PÁGINA 1: PLANO CARTOGRÁFICO */}
      <div className="print-page">
        <div className="report-border">

          {/* HEADER OFICIAL CON LOGO GAD Y NOMBRE DE EMPRESA */}
          <div className="report-header" style={{ position: 'relative', textAlign: 'center', padding: '10px 0', borderBottom: '2px solid black', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={currentEmpresa?.logo_url ? getImageUrl(currentEmpresa.logo_url) : defaultLogoGad}
              alt="Logo Empresa"
              style={{ position: 'absolute', top: '50%', left: '15px', transform: 'translateY(-50%)', height: '65px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => {
                if (e.target.src !== defaultLogoGad) {
                  e.target.src = defaultLogoGad;
                } else {
                  e.target.style.display = 'none';
                }
              }}
            />

            <div className="report-header-text" style={{ display: 'inline-block', textAlign: 'center', padding: '0 90px' }}>
              <div style={{ fontSize: '25px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                {currentEmpresa?.nombre}
              </div>
              <h1 style={{ margin: '0', fontSize: '10px', fontWeight: '900', color: '#0f172a', letterSpacing: '1px', textTransform: 'uppercase' }}>
                LEVANTAMIENTO PLANIMÉTRICO
              </h1>
            </div>

            {currentEmpresa?.bandera_url && (
              <img
                src={getImageUrl(currentEmpresa.bandera_url)}
                alt="Bandera Empresa"
                style={{ position: 'absolute', top: '50%', right: '15px', transform: 'translateY(-50%)', height: '65px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => {
                  console.warn('Error al cargar bandera de empresa:', e.target.src);
                  e.target.style.display = 'none';
                }}
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

                  {polygonCoords.length > 0 && !isNaN(center[0]) && !isNaN(center[1]) && (
                    <MapContainer preferCanvas={true} center={center} zoom={18} maxZoom={24} zoomSnap={0.1} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} dragging={false} touchZoom={false}>
                      {MapScaleUpdater && (
                        <MapScaleUpdater scaleValue={displayScale} polygonCoords={polygonCoords} setCalculatedScale={setCalculatedScale} setGraphicScale={setGraphicScale} />
                      )}
                      {UtmGrid && <UtmGrid setMapGridLabels={setMapGridLabels} />}

                      <Polygon positions={polygonCoords} pathOptions={{ color: 'black', weight: 2, fillColor: 'transparent' }} />

                      {vertices.map(v => {
                        let lat = 0, lng = 0;
                        if (v.geom_wkt) {
                          const pt = parseWktPointCoords(v.geom_wkt);
                          if (pt) {
                            lat = pt.lat;
                            lng = pt.lng;
                          }
                        }
                        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
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

                      {linderosMarkers}

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
                  <div className="box-content" style={{ fontSize: '7.5px', lineHeight: '1.2', paddingTop: '2px', textAlign: 'center' }}>
                    <strong>SISTEMA DE COORDENADAS:</strong> WGS 1984 UTM ZONE 17S<br />
                    <strong>PROYECCIÓN:</strong> TRANSVERSE MERCATOR<br />
                    <strong>DATUM:</strong> WGS 1984
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

                    {!isNaN(center[0]) && !isNaN(center[1]) && (
                      <MapContainer
                        key={`minimap_${center[0].toFixed(5)}_${center[1].toFixed(5)}_${fondoMinimapa}`}
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
                      <MinimapViewUpdater center={center} />

                      {fondoMinimapa === 'osm' && (
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                      )}

                      {fondoMinimapa === 'satelital' && (
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                      )}

                      {fondoMinimapa === 'cad' && activeCadGeoJson && (
                        <GeoJSON
                          key={'minimap_cad_' + (activeCadGeoJson?.features?.length || 0)}
                          data={activeCadGeoJson}
                          filter={(feature) => {
                            const geomType = feature?.geometry?.type;
                            const capa = (feature?.properties?.capa_cad || feature?.properties?.capa || '').toUpperCase();
                            // Filtrar puntos densos de cota/altura que saturan el minimapa 235px
                            if (geomType === 'Point' || geomType === 'MultiPoint') {
                              if (capa.includes('ALTURA') || capa.includes('ELEVACION') || capa.includes('VALORCURVA')) return false;
                              const textVal = feature?.properties?.texto || feature?.properties?.text;
                              return Boolean(textVal && String(textVal).trim());
                            }
                            return true;
                          }}
                          style={(feature) => {
                            const capa = (feature?.properties?.capa_cad || feature?.properties?.capa || feature?.properties?.layer || '').toUpperCase();
                            if (capa.includes('CUADRICULA')) return { color: '#94a3b8', weight: 0.8, opacity: 0.7 };
                            if (capa.includes('RIO') || capa.includes('AGUA') || capa.includes('CAUCE')) return { color: '#0284c7', weight: 1.8, opacity: 0.95 };
                            if (capa.includes('CAMINO') || capa.includes('VIA')) return { color: '#b45309', weight: 1.6, opacity: 0.95 };
                            if (capa.includes('CURVA') || capa.includes('NIVEL') || capa.includes('ACCIDENTE')) return { color: '#ca8a04', weight: 1.3, opacity: 0.9 };
                            return { color: '#334155', weight: 1.1, opacity: 0.85 };
                          }}
                          pointToLayer={(feature, latlng) => {
                            const textVal = feature?.properties?.texto || feature?.properties?.text;
                            if (textVal && String(textVal).trim()) {
                              return L.marker(latlng, {
                                icon: L.divIcon({
                                  className: 'cad-text-label',
                                  html: `<div style="font-size: 7px; font-weight: bold; color: #475569; white-space: nowrap; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff; transform: translate(-50%, -50%);">${textVal}</div>`,
                                  iconSize: [0, 0]
                                })
                              });
                            }
                            return null;
                          }}
                        />
                      )}

                      {UtmGrid && <UtmGrid setMapGridLabels={setMinimapGridLabels} isMinimap={true} />}

                      {/* Polígono del predio destacado */}
                      <Polygon positions={polygonCoords} pathOptions={{ color: '#b91c1c', weight: 2.5, fillColor: '#ef4444', fillOpacity: 0.95 }} />

                      {/* Círculo envolvente para ubicar el predio en la carta general */}
                      <CircleMarker
                        center={center}
                        radius={22}
                        pathOptions={{
                          color: '#dc2626',
                          weight: 2.2,
                          dashArray: '5, 4',
                          fillColor: '#ef4444',
                          fillOpacity: 0.1
                        }}
                      />

                    </MapContainer>
                    )}
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
                  <div>
                    <strong>CARTA TOPOGRÁFICA:</strong> {nombreCarta || predio?.nombre_carta || ''}
                  </div>
                  <div style={{ marginTop: '1px' }}>
                    <strong>CÓDIGO:</strong> {codigoCarta || predio?.codigo_carta || ''}
                  </div>
                  <div style={{ marginTop: '1px' }}>
                    <strong>ESCALA:</strong> 1:50000
                  </div>
                </div>
              </div>

              <div className="sidebar-box">
                <div className="box-title">POSESIONARIO:</div>
                <div className="box-content">
                  {predio?.nombre_posesionario || 'SIN NOMBRE'}<br />
                  <strong>C.C.:</strong> {predio?.cedula || 'S/D'}
                </div>
              </div>
              <div className="sidebar-box">
                <div className="box-title">CODIGO CATASTRAL:</div>
                <div className="box-content" style={{ textAlign: 'center' }}>
                  {predio?.codigo || predio?.cod_catastral || 'S/D'}
                </div>
              </div>

              <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid black' }}>
                <div style={{ flex: 1, borderRight: '1px solid black', display: 'flex', flexDirection: 'column', minHeight: '35px' }}>
                  <div className="box-title" style={{ borderBottom: 'none' }}>PROVINCIA:</div>
                  <div className="box-content" style={{ textAlign: 'center', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {dpaProvincia}
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '35px' }}>
                  <div className="box-title" style={{ borderBottom: 'none' }}>CANTÓN:</div>
                  <div className="box-content" style={{ textAlign: 'center', textTransform: 'uppercase', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {dpaCanton}
                  </div>
                </div>
              </div>

              <div className="sidebar-box">
                <div className="box-title">PARROQUIA:</div>
                <div className="box-content" style={{ textAlign: 'center', textTransform: 'uppercase' }}>
                  CATARAMA - URDANETA - PIJULLO {/*dpaParroquia11*/}
                </div>
              </div>

              <div className="sidebar-box">
                <div className="box-title">SECTOR:</div>
                <div className="box-content" style={{ textAlign: 'center', textTransform: 'uppercase' }}>
                  {dpaSector}
                </div>
              </div>

              <div className="sidebar-box">
                <div className="box-title">NOMBRE DEL PREDIO:</div>
                <div className="box-content" style={{ textAlign: 'center', textTransform: 'uppercase' }}>
                  {predio?.nombre_predio || 'SIN NOMBRE'}
                </div>
              </div>

              <div className="sidebar-box" style={{ flex: 1, borderBottom: 'none' }}>
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                  <div style={{ flex: 1, borderRight: '1px solid black', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>RESP. TÉCNICO:</div>
                    <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                      <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                      <div style={{ fontSize: '7px', minHeight: '10px' }}>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>REVISADO Y APROBADO POR:</div>
                    <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                      <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                      <div style={{ fontSize: '7px', minHeight: '10px' }}>
                        {directorNombre}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PÁGINAS DEL INFORME DE LINDERACIÓN (PAGINACIÓN DINÁMICA DE VÉRTICES Y LINDEROS) */}
      {Array.from({ length: totalSheets }).map((_, sheetIdx) => {
        const startIdx = sheetIdx * ROWS_PER_PAGE;
        const endIdx = Math.min(vertices.length, startIdx + ROWS_PER_PAGE);
        const sheetVertices = vertices.slice(startIdx, endIdx);
        const isFirstSheet = sheetIdx === 0;
        const isLastSheet = sheetIdx === totalSheets - 1;

        const chunkData = sheetLinderosChunks[sheetIdx] || { startIdx: 0, items: [] };
        const chunk = chunkData.items;
        const chunkStart = chunkData.startIdx;

        let sheetGroups = [];
        if (totalSheets === 1) {
          sheetGroups = CARDINAL_ORDER.map(dir => ({
            orientacion: dir,
            isContinuation: false,
            items: orderedLinderosForReport.filter(l => l.orientacion === dir)
          }));
        } else {
          chunk.forEach((l, idxInChunk) => {
            const globalIdx = chunkStart + idxInChunk;
            const lastG = sheetGroups[sheetGroups.length - 1];
            if (lastG && lastG.orientacion === l.orientacion) {
              lastG.items.push(l);
            } else {
              const wasStartedBefore = globalIdx > 0 && orderedLinderosForReport.slice(0, globalIdx).some(prev => prev.orientacion === l.orientacion);
              sheetGroups.push({
                orientacion: l.orientacion,
                isContinuation: wasStartedBefore,
                items: [l]
              });
            }
          });
        }

        const sheetTitleSuffix = totalSheets > 1 ? ` (HOJA ${sheetIdx + 1} DE ${totalSheets})` : '';

        return (
          <div className="print-page" key={`report-sheet-${sheetIdx}`}>
            <div className="report-inner-border">
              <div className="page2-body">
                {/* LADO IZQUIERDO: TABLA VERTICES */}
                <div className="page2-col-left">
                  <div className="page2-title">INFORME DE LINDERACIÓN{sheetTitleSuffix}</div>
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
                      {sheetVertices.map((v, localIdx) => {
                        const globalIdx = startIdx + localIdx;
                        const l = linderosConInfo[globalIdx] || linderos[globalIdx] || {};
                        const currentCode = v.codigo || `P${String(globalIdx + 1).padStart(2, '0')}`;
                        const nextCode = (globalIdx < vertices.length - 1)
                          ? (vertices[globalIdx + 1]?.codigo || `P${String(globalIdx + 2).padStart(2, '0')}`)
                          : (vertices[0]?.codigo || 'P01');
                        const desdeHasta = (l.tramo && l.tramo !== '-') ? l.tramo : `${currentCode} - ${nextCode}`;

                        return (
                          <tr key={v.id || globalIdx}>
                            <td>{currentCode}</td>
                            <td>{v.coord_x ? Number(v.coord_x).toFixed(1) : '-'}</td>
                            <td>{v.coord_y ? Number(v.coord_y).toFixed(1) : '-'}</td>
                            <td>{desdeHasta}</td>
                            <td>{l.longitud ? Number(l.longitud).toFixed(1) : '-'}</td>
                            <td>{l.rumbo || '-'}</td>
                            <td style={{ fontSize: '8px' }}>{l.colindante && l.colindante.trim() ? l.colindante : '-'}</td>
                          </tr>
                        );
                      })}
                      {sheetVertices.length < ROWS_PER_PAGE && Array.from({ length: ROWS_PER_PAGE - sheetVertices.length }).map((_, i) => (
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
                  <div className="page2-title">
                    DESCRIPCIÓN DE LINDEROS{sheetTitleSuffix}
                  </div>

                  {sheetGroups.length > 0 ? (
                    sheetGroups.map((g, gIdx) => {
                      const titleText = `COLINDANTE ${g.orientacion}${g.isContinuation ? ' (CONTINUACIÓN)' : ''}`;

                      return (
                        <div className="desc-box" key={`grp-${g.orientacion}-${sheetIdx}-${gIdx}`} style={{ marginBottom: '6px' }}>
                          <div className="desc-box-title">{titleText}</div>
                          <div className="desc-box-content" style={{ fontSize: '8.5px', lineHeight: '1.3', padding: '4px 6px' }}>
                            {g.items.length > 0 ? (
                              g.items.map((l, i) => (
                                <div style={{ marginBottom: '1.5px' }} key={i}>
                                  {renderLinderoText(l)}
                                </div>
                              ))
                            ) : (
                              <div style={{ color: '#64748b', fontStyle: 'italic' }}>Sin datos.</div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '10px', fontStyle: 'italic', border: '1px dashed #cbd5e1', borderRadius: '4px', margin: '20px 0' }}>
                      (Descripción de linderos completada en láminas anteriores)
                    </div>
                  )}

                  <div style={{ flex: 1 }}></div>

                  {isLastSheet ? (
                    <div className="firmas-grid">
                      <div className="firma-box">
                        <div className="firma-box-title">RESPONSABILIDAD TÉCNICA</div>
                        <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                          <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '7px', minHeight: '10px' }}>
                          </div>
                        </div>
                      </div>
                      <div className="firma-box" style={{ borderLeft: 'none' }}>
                        <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '8px' }}>{directorNombre}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'right', fontSize: '9px', fontStyle: 'italic', color: '#475569', padding: '6px 4px' }}>
                      {chunkStart + chunk.length < orderedLinderosForReport.length ? `Continúa en la Hoja ${sheetIdx + 2}...` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* PÁGINA EN BLANCO AUTOMÁTICA PARA MODO DÚPLEX INTELIGENTE (CARA A CARA) */}
      {duplexMode && (1 + totalSheets) % 2 !== 0 && (
        <div className="print-page duplex-blank-page" key="duplex-blank-page">
          <div className="report-inner-border duplex-blank-inner">
            <div className="duplex-blank-placeholder no-print">
              <div className="duplex-blank-icon">📄</div>
              <div className="duplex-blank-title">Modo Dúplex Inteligente</div>
              <p className="duplex-blank-desc">
                Esta página se mantiene intencionalmente en blanco para que, al imprimir a doble cara (cara a cara), 
                el siguiente predio comience en una hoja física nueva y limpia en lugar de imprimirse en el reverso de este expediente.
              </p>
              <div className="duplex-blank-badge">
                Reverso libre para expediente: #{predio?.codigo || predio?.cod_catastral || ''} ({1 + totalSheets} páginas de contenido)
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
