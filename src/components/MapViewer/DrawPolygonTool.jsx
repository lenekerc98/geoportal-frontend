import React, { useState, useRef, useEffect } from 'react';
import { useMapEvents, useMap, Marker, Polyline, Polygon } from 'react-leaflet';
import L from 'leaflet';
import Swal from 'sweetalert2';
import proj4 from 'proj4';
import { Trash2, Edit2, X, Check, Undo2 } from 'lucide-react';

// Definir UTM 17S si no está definido
if (!proj4.defs('EPSG:32717')) {
  proj4.defs('EPSG:32717', '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs');
}

// Función utilitaria robusta para normalizar cualquier coordenada geográfica
function normalizeLatLng(p) {
  if (!p) return null;
  if (p instanceof L.LatLng) return p;
  if (typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng)) {
    return L.latLng(p.lat, p.lng);
  }
  if (Array.isArray(p) && p.length >= 2) {
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (!isNaN(lat) && !isNaN(lng)) return L.latLng(lat, lng);
  }
  if (typeof p.latitude === 'number' && typeof p.longitude === 'number' && !isNaN(p.latitude) && !isNaN(p.longitude)) {
    return L.latLng(p.latitude, p.longitude);
  }
  return null;
}

// Convertir latlng a UTM 17S
function toUtm(p, maybeLng) {
  try {
    let lat = p;
    let lng = maybeLng;
    if (typeof p === 'object' && p !== null) {
      const norm = normalizeLatLng(p);
      if (!norm) return { x: 0, y: 0 };
      lat = norm.lat;
      lng = norm.lng;
    }
    const [x, y] = proj4('EPSG:4326', 'EPSG:32717', [lng, lat]);
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  } catch (e) {
    return { x: 0, y: 0 };
  }
}

// Convertir UTM 17S a latlng
function fromUtm(x, y) {
  try {
    const [lng, lat] = proj4('EPSG:32717', 'EPSG:4326', [x, y]);
    return L.latLng(lat, lng);
  } catch (e) {
    return null;
  }
}

// Icono para pin de vértices P01, P02... con diseño profesional idéntico a la referencia
const manualVertexIcon = (num, isFirstOrSelected = false) => {
  const label = 'P' + String(num).padStart(2, '0');
  const bg = isFirstOrSelected ? '#f59e0b' : '#0284c7';
  const glow = isFirstOrSelected 
    ? '0 0 12px rgba(245, 158, 11, 0.8), 0 3px 6px rgba(0,0,0,0.4)' 
    : '0 2px 6px rgba(0,0,0,0.35)';

  return L.divIcon({
    className: 'manual-vertex-pin-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        user-select: none;
        -webkit-user-select: none;
        cursor: grab;
        transform: translate(-50%, -100%);
        pointer-events: auto;
      ">
        <div style="
          background: ${bg};
          color: #ffffff;
          padding: 2.5px 7px;
          border-radius: 6px;
          border: 2px solid #ffffff;
          box-shadow: ${glow};
          font-size: 11px;
          font-weight: 800;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1.1;
        ">
          ${label}
        </div>
        <div style="
          width: 2px;
          height: 8px;
          background: ${bg};
          margin-top: -1px;
        "></div>
        <div style="
          width: 6px;
          height: 6px;
          background: #ffffff;
          border: 2px solid ${bg};
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          margin-top: -1px;
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Icono con la medida en metros del segmento (sin estorbo de botones gigantes)
const createSegmentMeasureIcon = (distMeters, angle = 0, strokeColor = '#0284c7') => {
  const safeText = distMeters < 1000 
    ? `${distMeters.toFixed(1)} m` 
    : `${(distMeters / 1000).toFixed(2)} km`;
  return L.divIcon({
    className: 'segment-measure-badge-wrapper',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 24px;
        transform: rotate(${angle}deg);
        cursor: pointer;
        pointer-events: auto;
      ">
        <div style="
          background: #ffffff;
          color: #0f172a;
          border: 1.5px solid ${strokeColor};
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          pointer-events: auto;
        " title="Medida del tramo. Haz clic para insertar un punto en este tramo">
          ${safeText}
        </div>
      </div>
    `,
    iconSize: [60, 24],
    iconAnchor: [30, 12]
  });
};

export default function DrawPolygonTool({ isDrawing, drawPoints, setDrawPoints, setMousePos, onFinish, setIsSnapped }) {
  const [snappedLatLng, setSnappedLatLng] = useState(null);
  const [localMousePos, setLocalMousePos] = useState(null);
  const [cachedSnapPoints, setCachedSnapPoints] = useState([]);
  const latestMousePos = useRef(null);
  const rafRef = useRef(null);

  // Sanitizar drawPoints para que siempre sean instancias válidas de L.LatLng
  const safeDrawPoints = (Array.isArray(drawPoints) ? drawPoints : []).map(normalizeLatLng).filter(Boolean);

  const polylineRef = useRef(null);
  const polygonRef = useRef(null);
  const drawPointsRef = useRef(safeDrawPoints);
  const isDraggingMarkerRef = useRef(false);
  const dragJustEndedRef = useRef(false);

  useEffect(() => {
    drawPointsRef.current = safeDrawPoints;
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(safeDrawPoints);
    }
    if (polygonRef.current) {
      polygonRef.current.setLatLngs(safeDrawPoints);
    }
  }, [safeDrawPoints]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const map = useMap();

  useEffect(() => {
    if (isDrawing) {
      map.doubleClickZoom.disable();
      const points = [];
      map.eachLayer((layer) => {
        if (layer.getLatLngs) {
          const latlngs = layer.getLatLngs();
          const extract = (coords) => {
            coords.forEach(coord => {
              if (Array.isArray(coord)) {
                extract(coord);
              } else if (coord && coord.lat !== undefined && coord.lng !== undefined) {
                points.push(coord);
              }
            });
          };
          extract(latlngs);
        }
      });
      setCachedSnapPoints(points);
    } else {
      map.doubleClickZoom.enable();
      setCachedSnapPoints([]);
    }
  }, [isDrawing, map]);

  // Insertar un nuevo vértice entre dos puntos existentes (re-indexando correlativamente 1, 2, 3...)
  const handleInsertVertexAt = (latlng, insertIndex) => {
    const newPt = normalizeLatLng(latlng);
    if (!newPt) return;
    setDrawPoints(prev => {
      const copy = Array.isArray(prev) ? prev.map(normalizeLatLng).filter(Boolean) : [];
      copy.splice(insertIndex, 0, newPt);
      return copy;
    });
  };

  // Modificar coordenadas de un vértice (Modal pop-up según diseño exacto solicitado)
  const handleEditVertexCoords = async (idx) => {
    const rawPt = drawPointsRef.current[idx] || (Array.isArray(drawPoints) ? drawPoints[idx] : null);
    const pt = normalizeLatLng(rawPt);
    if (!pt) return;
    const utm = toUtm(pt);
    const pCode = 'P' + String(idx + 1).padStart(2, '0');

    const result = await Swal.fire({
      title: 'Coordenada Manual (UTM 17S)',
      html: `
        <div style="font-size:13px; font-weight:700; color:#0284c7; margin-bottom:12px; text-align:center;">
          Vértice ${idx + 1} (${pCode})
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
          <input 
            id="swal-utm-x" 
            class="swal2-input" 
            placeholder="Coordenada X (Este)" 
            type="number" 
            step="0.01" 
            value="${utm.x.toFixed(2)}"
            style="margin:0; width:100%; box-sizing:border-box; font-family:'JetBrains Mono', monospace;"
          >
          <input 
            id="swal-utm-y" 
            class="swal2-input" 
            placeholder="Coordenada Y (Norte)" 
            type="number" 
            step="0.01" 
            value="${utm.y.toFixed(2)}"
            style="margin:0; width:100%; box-sizing:border-box; font-family:'JetBrains Mono', monospace;"
          >
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      showDenyButton: drawPoints.length > 3,
      confirmButtonText: 'Guardar',
      denyButtonText: 'Eliminar Punto',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonColor: '#0284c7',
      denyButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      preConfirm: () => {
        const x = parseFloat(document.getElementById('swal-utm-x').value);
        const y = parseFloat(document.getElementById('swal-utm-y').value);
        if (isNaN(x) || isNaN(y)) {
          Swal.showValidationMessage('Ambas coordenadas deben ser numéricas');
          return false;
        }
        return { x, y };
      }
    });

    if (result.isConfirmed && result.value) {
      const newLatLng = fromUtm(result.value.x, result.value.y);
      if (newLatLng) {
        setDrawPoints(prev => {
          const copy = Array.isArray(prev) ? prev.map(normalizeLatLng).filter(Boolean) : [];
          copy[idx] = newLatLng;
          return copy;
        });
      }
    } else if (result.isDenied) {
      handleDeleteVertex(idx);
    }
  };

  // Arrastre fluido de vértices sin pérdida de cursor ni re-renders bruscos
  const handleMarkerDragStart = (idx, e) => {
    L.DomEvent.stopPropagation(e);
    isDraggingMarkerRef.current = true;
    dragJustEndedRef.current = false;
    if (map && map.dragging) map.dragging.disable();
  };

  const handleMarkerDrag = (idx, e) => {
    dragJustEndedRef.current = true;
    const newLatLng = e.target.getLatLng();
    if (!drawPointsRef.current) return;
    const updated = [...drawPointsRef.current];
    updated[idx] = newLatLng;
    drawPointsRef.current = updated;

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(updated);
    }
    if (polygonRef.current) {
      polygonRef.current.setLatLngs(updated);
    }
  };

  const handleMarkerDragEnd = (idx, e) => {
    if (map && map.dragging) map.dragging.enable();
    const newLatLng = e.target.getLatLng();
    const updated = [...drawPointsRef.current];
    updated[idx] = newLatLng;
    drawPointsRef.current = updated;
    setDrawPoints(updated);

    setTimeout(() => {
      isDraggingMarkerRef.current = false;
      dragJustEndedRef.current = false;
    }, 120);
  };

  // Eliminar vértice individual del dibujo con confirmación y renumerar
  const handleDeleteVertex = (idx) => {
    if (idx < 0 || idx >= drawPoints.length) return;
    const pCode = 'P' + String(idx + 1).padStart(2, '0');

    Swal.fire({
      title: `¿Eliminar Punto ${pCode}?`,
      text: 'Se eliminará este punto y los vértices siguientes se renumerarán automáticamente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar punto',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a'
    }).then((result) => {
      if (result.isConfirmed) {
        setDrawPoints(prev => prev.filter((_, i) => i !== idx));
      }
    });
  };

  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      if (isDraggingMarkerRef.current || dragJustEndedRef.current) return;

      const rawPt = snappedLatLng || e?.latlng;
      const clickPt = normalizeLatLng(rawPt);
      if (!clickPt) return;

      // Si ya hay 2 o más vértices, verificar si el clic fue sobre cualquier parte de la línea
      if (safeDrawPoints.length >= 2) {
        try {
          const ptClicked = map.latLngToLayerPoint(clickPt);
          let minPixelDist = Infinity;
          let bestInsertIdx = -1;
          let bestProjLatLng = null;

          const count = safeDrawPoints.length >= 3 ? safeDrawPoints.length : safeDrawPoints.length - 1;

          for (let i = 0; i < count; i++) {
            const j = (i + 1) % safeDrawPoints.length;
            const pA = safeDrawPoints[i];
            const pB = safeDrawPoints[j];
            if (!pA || !pB) continue;

            const ptA = map.latLngToLayerPoint(pA);
            const ptB = map.latLngToLayerPoint(pB);

            const dx = ptB.x - ptA.x;
            const dy = ptB.y - ptA.y;
            const l2 = dx * dx + dy * dy;

            if (l2 > 0) {
              const t = ((ptClicked.x - ptA.x) * dx + (ptClicked.y - ptA.y) * dy) / l2;
              if (t >= 0.03 && t <= 0.97) {
                const projX = ptA.x + t * dx;
                const projY = ptA.y + t * dy;
                const dist = Math.hypot(ptClicked.x - projX, ptClicked.y - projY);
                if (dist < minPixelDist) {
                  minPixelDist = dist;
                  bestInsertIdx = i + 1;
                  bestProjLatLng = map.layerPointToLatLng([projX, projY]);
                }
              }
            }
          }

          // Si el clic fue a menos de 36px de cualquier tramo de la línea, insertar vértice exacto en la línea
          if (minPixelDist <= 36 && bestInsertIdx !== -1) {
            handleInsertVertexAt(bestProjLatLng || clickPt, bestInsertIdx);
            return;
          }
        } catch (err) {
          console.error('Error calculando inserción en línea:', err);
        }
      }

      // Agregar punto al final
      setDrawPoints(prev => {
        const safePrev = Array.isArray(prev) ? prev.map(normalizeLatLng).filter(Boolean) : [];
        if (safePrev.length > 0) {
          const lastPoint = safePrev[safePrev.length - 1];
          if (lastPoint && Math.abs(lastPoint.lat - clickPt.lat) < 1e-6 && Math.abs(lastPoint.lng - clickPt.lng) < 1e-6) {
            return safePrev;
          }
        }
        return [...safePrev, clickPt];
      });
    },
    contextmenu(e) {
      if (isDrawing) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);

        Swal.fire({
          title: 'Coordenada Manual (UTM 17S)',
          html: `
            <input id="swal-utm-x" class="swal2-input" placeholder="Coordenada X (Este)" type="text">
            <input id="swal-utm-y" class="swal2-input" placeholder="Coordenada Y (Norte)" type="text">
          `,
          focusConfirm: false,
          showCancelButton: true,
          confirmButtonText: 'Añadir',
          cancelButtonText: 'Cancelar',
          background: '#ffffff',
          color: '#0f172a',
          confirmButtonColor: '#0284c7',
          preConfirm: () => {
            const x = document.getElementById('swal-utm-x').value;
            const y = document.getElementById('swal-utm-y').value;
            if (!x || !y) {
              Swal.showValidationMessage('Ambas coordenadas son obligatorias');
              return null;
            }
            return { x: parseFloat(x), y: parseFloat(y) };
          }
        }).then((result) => {
          if (result.isConfirmed && result.value) {
            try {
              const ll = proj4('EPSG:32717', 'EPSG:4326', [result.value.x, result.value.y]);
              const latlng = L.latLng(ll[1], ll[0]);
              setDrawPoints(prev => [...prev, latlng]);
            } catch (err) {
              Swal.fire('Error', 'Coordenadas UTM inválidas', 'error');
            }
          }
        });
      }
    },
    mousemove(e) {
      latestMousePos.current = e.latlng;
      if (!isDrawing) {
        if (localMousePos) setLocalMousePos(null);
        if (snappedLatLng) setSnappedLatLng(null);
        if (setIsSnapped) setIsSnapped(false);
        return;
      }

      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const rawMouse = latestMousePos.current || e?.latlng;
        const curLatLng = normalizeLatLng(rawMouse);
        if (!curLatLng) return;

        let bestSnap = null;
        let minDistance = 20;
        const mousePoint = map.latLngToLayerPoint(curLatLng);

        if (safeDrawPoints.length > 0) {
          safeDrawPoints.forEach((ptLatLng, index) => {
            if (!ptLatLng) return;
            const vPoint = map.latLngToLayerPoint(ptLatLng);
            const dist = mousePoint.distanceTo(vPoint);
            const threshold = index === 0 ? 25 : 20;
            if (dist < threshold && dist < minDistance) {
              minDistance = dist;
              bestSnap = ptLatLng;
            }
          });
        }

        if (cachedSnapPoints.length > 0) {
          // Bounding box en grados para descartar el 99.9% de puntos sin proyectar
          const p0 = map.layerPointToLatLng([0, 0]);
          const pR = map.layerPointToLatLng([25, 25]);
          const dLat = Math.abs(pR.lat - p0.lat);
          const dLng = Math.abs(pR.lng - p0.lng);
          const minLat = curLatLng.lat - dLat;
          const maxLat = curLatLng.lat + dLat;
          const minLng = curLatLng.lng - dLng;
          const maxLng = curLatLng.lng + dLng;

          for (let i = 0; i < cachedSnapPoints.length; i++) {
            const coord = cachedSnapPoints[i];
            if (coord.lat < minLat || coord.lat > maxLat || coord.lng < minLng || coord.lng > maxLng) {
              continue;
            }
            const vPoint = map.latLngToLayerPoint(coord);
            const dist = mousePoint.distanceTo(vPoint);
            if (dist < minDistance) {
              minDistance = dist;
              bestSnap = coord;
            }
          }
        }

        const activePos = bestSnap || curLatLng;
        setSnappedLatLng(bestSnap);
        setLocalMousePos(activePos);
        if (setIsSnapped) setIsSnapped(Boolean(bestSnap));
      });
    },
    dblclick(e) {
      if (isDrawing) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        if (drawPoints.length >= 3) {
          onFinish(drawPoints);
        }
      }
    }
  });

  // Cambiar cursor del mapa
  useEffect(() => {
    const mapContainer = map.getContainer();
    if (isDrawing) {
      mapContainer.style.cursor = 'crosshair';
    } else {
      mapContainer.style.cursor = '';
    }
    return () => {
      mapContainer.style.cursor = '';
    };
  }, [isDrawing, map]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isDrawing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (setIsSnapped) setIsSnapped(false);
        onFinish([]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (safeDrawPoints.length >= 3) {
          if (setIsSnapped) setIsSnapped(false);
          onFinish(safeDrawPoints);
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Vértices insuficientes',
            text: 'Debes añadir al menos 3 vértices antes de finalizar el predio.',
            timer: 2000,
            showConfirmButton: false,
            background: '#ffffff',
            color: '#0f172a'
          });
        }
      } else if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        setDrawPoints(prev => {
          const safePrev = Array.isArray(prev) ? prev.map(normalizeLatLng).filter(Boolean) : [];
          return safePrev.length > 0 ? safePrev.slice(0, -1) : [];
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, safeDrawPoints, onFinish, setIsSnapped, setDrawPoints]);

  if (!isDrawing) return null;

  // Medidas de los tramos
  const count = safeDrawPoints.length >= 3 ? safeDrawPoints.length : safeDrawPoints.length - 1;
  const segments = [];
  if (safeDrawPoints.length >= 2) {
    for (let i = 0; i < count; i++) {
      const nextIdx = (i + 1) % safeDrawPoints.length;
      const p1 = safeDrawPoints[i];
      const p2 = safeDrawPoints[nextIdx];
      if (!p1 || !p2 || typeof p1.lat !== 'number' || typeof p2.lat !== 'number') continue;

      const dist = map.distance(p1, p2);
      const midLat = (p1.lat + p2.lat) / 2;
      const midLng = (p1.lng + p2.lng) / 2;
      let angle = Math.atan2(-(p2.lat - p1.lat), (p2.lng - p1.lng)) * (180 / Math.PI);
      if (angle > 90 || angle < -90) angle += 180;

      const insertIdx = i + 1;

      segments.push(
        <Marker
          key={`seg-${i}`}
          position={[midLat, midLng]}
          icon={createSegmentMeasureIcon(dist, angle, '#0284c7')}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              handleInsertVertexAt([midLat, midLng], insertIdx);
            }
          }}
        />
      );
    }
  }

  return (
    <>
      {/* Polilínea conectando los puntos existentes */}
      {safeDrawPoints.length >= 2 && (
        <Polyline
          ref={polylineRef}
          positions={safeDrawPoints}
          pathOptions={{ color: '#0284c7', weight: 3, dashArray: '5, 5' }}
          interactive={false}
        />
      )}

      {/* Polígono cerrado si hay 3 o más puntos */}
      {safeDrawPoints.length >= 3 && (
        <Polygon
          ref={polygonRef}
          positions={safeDrawPoints}
          pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.18, weight: 2.5 }}
          interactive={false}
        />
      )}

      {/* Línea elástica interactiva hacia el cursor (ultra rápida en componente local) */}
      {safeDrawPoints.length > 0 && localMousePos && (
        <Polyline
          positions={[safeDrawPoints[safeDrawPoints.length - 1], localMousePos]}
          pathOptions={{ color: '#0284c7', weight: 2, dashArray: '5, 5' }}
          interactive={false}
        />
      )}

      {/* Cursor interactivo que identifica en tiempo real el vértice que será construido */}
      {localMousePos && (
        <Marker
          position={localMousePos}
          interactive={false}
          zIndexOffset={2000}
          icon={L.divIcon({
            className: 'current-drawing-cursor-badge',
            html: `
              <div style="
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                pointer-events: none;
                user-select: none;
                transform: translate(-50%, -100%);
              ">
                <div style="
                  background: ${safeDrawPoints.length === 0 ? '#f59e0b' : '#0284c7'};
                  color: #ffffff;
                  padding: 2px 7px;
                  border-radius: 6px;
                  border: 2px solid #ffffff;
                  box-shadow: 0 0 12px ${safeDrawPoints.length === 0 ? 'rgba(245, 158, 11, 0.9)' : 'rgba(2, 132, 199, 0.85)'}, 0 3px 6px rgba(0,0,0,0.45);
                  font-size: 11px;
                  font-weight: 800;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  white-space: nowrap;
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  letter-spacing: 0.3px;
                ">
                  <span>P${String(safeDrawPoints.length + 1).padStart(2, '0')}</span>
                  <span style="font-size: 9px; opacity: 0.92; font-weight: 600;">(Clic para construir)</span>
                </div>
                <div style="
                  width: 2px;
                  height: 6px;
                  background: ${safeDrawPoints.length === 0 ? '#f59e0b' : '#0284c7'};
                  margin-top: -1px;
                "></div>
                <div style="
                  width: 8px;
                  height: 8px;
                  background: ${snappedLatLng ? '#10b981' : '#ffffff'};
                  border: 2px solid ${snappedLatLng ? '#10b981' : (safeDrawPoints.length === 0 ? '#f59e0b' : '#0284c7')};
                  border-radius: 50%;
                  box-shadow: 0 0 8px ${snappedLatLng ? '#10b981' : 'rgba(0,0,0,0.5)'};
                  margin-top: -1px;
                "></div>
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          })}
        />
      )}

      {/* Línea diagonal punteada de triangulación (como en imagen de referencia topográfica) */}
      {safeDrawPoints.length >= 4 && safeDrawPoints[1] && safeDrawPoints[3] && (
        <Polyline
          positions={[safeDrawPoints[1], safeDrawPoints[3]]}
          pathOptions={{ color: '#0284c7', weight: 2, dashArray: '6, 6', opacity: 0.85 }}
          interactive={false}
        />
      )}

      {/* Badges de medidas en los segmentos */}
      {segments}

      {/* Marcadores de vértices con pines P01, P02... arrastrables */}
      {safeDrawPoints.map((pt, i) => {
        if (!pt || typeof pt.lat !== 'number' || typeof pt.lng !== 'number') return null;
        return (
          <Marker
            key={`v-${i}`}
            position={[pt.lat, pt.lng]}
            draggable={true}
            autoPan={false}
            zIndexOffset={1000 + i}
            icon={manualVertexIcon(i + 1, i === 0)}
            eventHandlers={{
              dragstart: (e) => handleMarkerDragStart(i, e),
              drag: (e) => handleMarkerDrag(i, e),
              dragend: (e) => handleMarkerDragEnd(i, e),
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (dragJustEndedRef.current) return;
                handleEditVertexCoords(i);
              }
            }}
          />
        );
      })}
    </>
  );
}
