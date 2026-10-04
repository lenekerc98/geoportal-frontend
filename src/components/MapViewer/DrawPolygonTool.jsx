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

// Convertir latlng a UTM 17S
function toUtm(lat, lng) {
  try {
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

// Icono para pin de vértices P01, P02... con elevación para visibilidad
const manualVertexIcon = (num, isSelected = false) => {
  const label = 'P' + String(num).padStart(2, '0');
  const color = isSelected ? '#f59e0b' : '#0284c7';
  const width = isSelected ? 36 : 32;
  const height = isSelected ? 40 : 36;

  return L.divIcon({
    className: 'manual-vertex-marker' + (isSelected ? ' selected-vertex' : ''),
    html: `
      <div style="position: relative; width: ${width}px; height: ${height}px; display: flex; flex-direction: column; align-items: center; pointer-events: auto; cursor: pointer;">
        <div style="
          background: ${color}; 
          color: #ffffff; 
          padding: 2px 5px; 
          border-radius: 999px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: 2px solid #ffffff; 
          box-shadow: ${isSelected ? '0 0 14px #f59e0b, 0 3px 8px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.35)'}; 
          transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'}; 
          transition: transform 0.15s ease, box-shadow 0.15s ease; 
          white-space: nowrap; 
          z-index: 2;
        ">
          <div style="font-size: 10.5px; font-weight: 900; line-height: 1; letter-spacing: -0.2px;">
            ${label}
          </div>
        </div>
        <div style="width: 2px; height: 13px; background: ${color}; box-shadow: 0 0 2px #ffffff; margin-top: -1px; z-index: 1;"></div>
        <div style="width: 6px; height: 6px; background: #ffffff; border: 2px solid ${color}; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.6); margin-top: -1px; z-index: 1;"></div>
      </div>
    `,
    iconSize: [width, height],
    iconAnchor: [width / 2, height]
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
  const [cachedSnapPoints, setCachedSnapPoints] = useState([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState(null);
  const latestMousePos = useRef(null);

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
      setSelectedVertexIndex(null);
    }
  }, [isDrawing, map]);

  // Insertar un nuevo vértice entre dos puntos existentes (re-indexando correlativamente P01, P02...)
  const handleInsertVertexAt = (latlng, insertIndex) => {
    const newPt = Array.isArray(latlng) ? L.latLng(latlng[0], latlng[1]) : L.latLng(latlng.lat, latlng.lng);
    setDrawPoints(prev => {
      const copy = [...prev];
      copy.splice(insertIndex, 0, newPt);
      return copy;
    });
    setSelectedVertexIndex(insertIndex);
  };

  // Modificar coordenadas de un vértice
  const handleEditVertexCoords = async (idx) => {
    const pt = drawPoints[idx];
    if (!pt) return;
    const utm = toUtm(pt.lat, pt.lng);
    const pCode = 'P' + String(idx + 1).padStart(2, '0');

    const { value: formValues } = await Swal.fire({
      title: `Editar Coordenadas ${pCode}`,
      html: `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left; font-size:12px;">
          <div>
            <label style="font-weight:700; color:#475569;">Este (X) [UTM 17S]:</label>
            <input id="swal-edit-x" class="swal2-input" type="number" step="0.01" value="${utm.x}" style="width:100%; box-sizing:border-box; margin:4px 0 0 0; height:38px;">
          </div>
          <div>
            <label style="font-weight:700; color:#475569;">Norte (Y) [UTM 17S]:</label>
            <input id="swal-edit-y" class="swal2-input" type="number" step="0.01" value="${utm.y}" style="width:100%; box-sizing:border-box; margin:4px 0 0 0; height:38px;">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
      preConfirm: () => {
        const x = parseFloat(document.getElementById('swal-edit-x').value);
        const y = parseFloat(document.getElementById('swal-edit-y').value);
        if (isNaN(x) || isNaN(y)) {
          Swal.showValidationMessage('Ingresa valores numéricos válidos');
          return false;
        }
        return { x, y };
      }
    });

    if (formValues) {
      const newLatLng = fromUtm(formValues.x, formValues.y);
      if (newLatLng) {
        setDrawPoints(prev => {
          const copy = [...prev];
          copy[idx] = newLatLng;
          return copy;
        });
      }
    }
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
        setSelectedVertexIndex(null);
      }
    });
  };

  useMapEvents({
    click(e) {
      if (!isDrawing) return;

      const clickPt = snappedLatLng || e.latlng;

      // Si ya hay 2 o más vértices, verificar si el clic fue sobre cualquier parte de la línea
      if (drawPoints.length >= 2) {
        try {
          const ptClicked = map.latLngToLayerPoint(clickPt);
          let minPixelDist = Infinity;
          let bestInsertIdx = -1;
          let bestProjLatLng = null;

          const count = drawPoints.length >= 3 ? drawPoints.length : drawPoints.length - 1;

          for (let i = 0; i < count; i++) {
            const j = (i + 1) % drawPoints.length;
            const pA = drawPoints[i];
            const pB = drawPoints[j];
            if (!pA || !pB) continue;

            const ptA = map.latLngToLayerPoint([pA.lat, pA.lng]);
            const ptB = map.latLngToLayerPoint([pB.lat, pB.lng]);

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
        if (prev.length > 0) {
          const lastPoint = prev[prev.length - 1];
          if (Math.abs(lastPoint.lat - clickPt.lat) < 1e-6 && Math.abs(lastPoint.lng - clickPt.lng) < 1e-6) {
            return prev;
          }
        }
        return [...prev, clickPt];
      });
      setSelectedVertexIndex(drawPoints.length);
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
      if (isDrawing) {
        let bestSnap = null;
        let minDistance = 20;
        const mousePoint = map.latLngToLayerPoint(e.latlng);

        if (drawPoints.length > 0) {
          drawPoints.forEach((ptLatLng, index) => {
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
          cachedSnapPoints.forEach(coord => {
            const vPoint = map.latLngToLayerPoint(coord);
            const dist = mousePoint.distanceTo(vPoint);
            if (dist < minDistance) {
              minDistance = dist;
              bestSnap = coord;
            }
          });
        }

        if (bestSnap) {
          setSnappedLatLng(bestSnap);
          setMousePos(bestSnap);
          if (setIsSnapped) setIsSnapped(true);
        } else {
          setSnappedLatLng(null);
          setMousePos(e.latlng);
          if (setIsSnapped) setIsSnapped(false);
        }
      } else {
        setMousePos(null);
        setSnappedLatLng(null);
        if (setIsSnapped) setIsSnapped(false);
      }
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
        if (drawPoints.length >= 3) {
          if (setIsSnapped) setIsSnapped(false);
          onFinish(drawPoints);
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
        setDrawPoints(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
      } else if (e.key === 'Delete' && selectedVertexIndex !== null) {
        e.preventDefault();
        handleDeleteVertex(selectedVertexIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, drawPoints, selectedVertexIndex, onFinish, setIsSnapped, setDrawPoints]);

  if (!isDrawing) return null;

  // Medidas de los tramos
  const count = drawPoints.length >= 3 ? drawPoints.length : drawPoints.length - 1;
  const segments = [];
  if (drawPoints.length >= 2) {
    for (let i = 0; i < count; i++) {
      const nextIdx = (i + 1) % drawPoints.length;
      const p1 = drawPoints[i];
      const p2 = drawPoints[nextIdx];
      if (!p1 || !p2) continue;

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

  const selectedPt = selectedVertexIndex !== null ? drawPoints[selectedVertexIndex] : null;
  const selectedUtm = selectedPt ? toUtm(selectedPt.lat, selectedPt.lng) : null;

  return (
    <>
      {/* Polilínea conectando los puntos existentes */}
      {drawPoints.length >= 2 && (
        <Polyline
          positions={drawPoints}
          pathOptions={{ color: '#0284c7', weight: 3, dashArray: '5, 5' }}
          interactive={false}
        />
      )}

      {/* Polígono cerrado si hay 3 o más puntos */}
      {drawPoints.length >= 3 && (
        <Polygon
          positions={drawPoints}
          pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.18, weight: 2.5 }}
          interactive={false}
        />
      )}

      {/* Badges de medidas en los segmentos */}
      {segments}

      {/* Marcadores de vértices con etiquetas P01, P02... */}
      {drawPoints.map((pt, i) => (
        <Marker
          key={`v-${i}`}
          position={[pt.lat, pt.lng]}
          icon={manualVertexIcon(i + 1, selectedVertexIndex === i)}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              setSelectedVertexIndex(selectedVertexIndex === i ? null : i);
            }
          }}
        />
      ))}

      {/* Tarjeta flotante interactiva al tocar un vértice */}
      {selectedVertexIndex !== null && selectedPt && selectedUtm && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          border: '1.5px solid #0284c7',
          borderRadius: '14px',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.25)',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          userSelect: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '12px',
              padding: '3px 8px',
              borderRadius: '6px'
            }}>
              📍 P{String(selectedVertexIndex + 1).padStart(2, '0')}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: '#0f172a' }}>
              <span className="mono" style={{ fontWeight: '700' }}>Este (X): {selectedUtm.x.toFixed(2)}</span>
              <span className="mono" style={{ fontWeight: '700' }}>Norte (Y): {selectedUtm.y.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleEditVertexCoords(selectedVertexIndex)}
              style={{
                height: '32px',
                padding: '0 10px',
                background: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Modificar coordenadas numéricas"
            >
              <Edit2 size={13} /> Modificar
            </button>

            <button
              type="button"
              onClick={() => handleDeleteVertex(selectedVertexIndex)}
              style={{
                height: '32px',
                padding: '0 10px',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Eliminar este punto"
            >
              <Trash2 size={13} /> Eliminar Punto
            </button>

            <button
              type="button"
              onClick={() => setSelectedVertexIndex(null)}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer'
              }}
              title="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
