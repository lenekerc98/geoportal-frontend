import React, { useState, useEffect } from 'react';
import { useMap, useMapEvents, Polyline, Polygon, CircleMarker, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Scissors, Check, X, RotateCcw } from 'lucide-react';
import { splitPolygonByLine } from '../../utils/polygonSplit';
import Swal from 'sweetalert2';

const createVertexIcon = (number, isFirst = false) => {
  return L.divIcon({
    className: 'cut-vertex-icon',
    html: `<div style="background:${isFirst ? '#10b981' : '#ef4444'};color:white;font-size:11px;font-weight:bold;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${number}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

export default function SplitPolygonTool({
  activePredio,
  onSplitComplete,
  onCancel,
  setMousePos
}) {
  const map = useMap();
  const [cutPoints, setCutPoints] = useState([]);
  const [currentMouse, setCurrentMouse] = useState(null);
  const [snappedLatLng, setSnappedLatLng] = useState(null);
  const [cachedSnapPoints, setCachedSnapPoints] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!activePredio || !activePredio.geometry) return;

    const points = [];
    const extractCoords = (coords) => {
      coords.forEach(coord => {
        if (Array.isArray(coord)) {
          if (coord.length >= 2 && typeof coord[0] === 'number') {
            points.push({ lat: coord[1], lng: coord[0] });
          } else {
            extractCoords(coord);
          }
        }
      });
    };

    if (activePredio.geometry.coordinates) {
      extractCoords(activePredio.geometry.coordinates);
    }
    setCachedSnapPoints(points);

    try {
      const geojsonLayer = L.geoJSON(activePredio);
      const bounds = geojsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 19 });
      }
    } catch (e) {
      console.warn('Bounds zoom error:', e);
    }
  }, [activePredio, map]);

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = 'crosshair';
    map.doubleClickZoom.disable();

    return () => {
      container.style.cursor = '';
      map.doubleClickZoom.enable();
    };
  }, [map]);

  const handleExecuteSplit = () => {
    if (cutPoints.length < 2) {
      Swal.fire({
        icon: 'warning',
        title: 'Línea de corte incompleta',
        text: 'Debe trazar al menos 2 puntos que atraviesen el lote de extremo a extremo.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    setIsProcessing(true);
    const lineCoords = cutPoints.map(p => [p.lng, p.lat]);
    const result = splitPolygonByLine(activePredio, lineCoords);
    setIsProcessing(false);

    if (result.success) {
      onSplitComplete({
        ...result,
        matrizPredio: activePredio,
        cutLineCoords: lineCoords
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo fraccionar el lote',
        text: result.error || 'Asegúrese de que la línea corte completamente ambos extremos del perímetro del predio.',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  useMapEvents({
    click(e) {
      if (isProcessing) return;
      const pointToAdd = snappedLatLng || e.latlng;

      setCutPoints(prev => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (Math.abs(last.lat - pointToAdd.lat) < 1e-7 && Math.abs(last.lng - pointToAdd.lng) < 1e-7) {
            return prev;
          }
        }
        return [...prev, pointToAdd];
      });
    },
    mousemove(e) {
      setCurrentMouse(e.latlng);
      if (setMousePos) setMousePos(e.latlng);

      let bestSnap = null;
      let minDistance = 25;
      const mousePixel = map.latLngToLayerPoint(e.latlng);

      cachedSnapPoints.forEach(pt => {
        const ptPixel = map.latLngToLayerPoint(pt);
        const dist = mousePixel.distanceTo(ptPixel);
        if (dist < minDistance) {
          minDistance = dist;
          bestSnap = pt;
        }
      });

      cutPoints.forEach(pt => {
        const ptPixel = map.latLngToLayerPoint(pt);
        const dist = mousePixel.distanceTo(ptPixel);
        if (dist < minDistance) {
          minDistance = dist;
          bestSnap = pt;
        }
      });

      setSnappedLatLng(bestSnap);
    },
    dblclick(e) {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      handleExecuteSplit();
    }
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleExecuteSplit();
      } else if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        setCutPoints(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cutPoints, activePredio]);

  const activePredioLatLngs = React.useMemo(() => {
    if (!activePredio || !activePredio.geometry) return [];
    try {
      const coords = activePredio.geometry.coordinates;
      if (activePredio.geometry.type === 'Polygon') {
        return coords[0].map(c => [c[1], c[0]]);
      } else if (activePredio.geometry.type === 'MultiPolygon') {
        return coords.map(poly => poly[0].map(c => [c[1], c[0]]));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }, [activePredio]);

  const rubberbandCoords = React.useMemo(() => {
    if (cutPoints.length === 0 || !currentMouse) return [];
    const lastPoint = cutPoints[cutPoints.length - 1];
    const targetPoint = snappedLatLng || currentMouse;
    return [
      [lastPoint.lat, lastPoint.lng],
      [targetPoint.lat, targetPoint.lng]
    ];
  }, [cutPoints, currentMouse, snappedLatLng]);

  return (
    <>
      {activePredioLatLngs.length > 0 && (
        <Polygon
          positions={activePredioLatLngs}
          pathOptions={{
            color: '#f59e0b',
            weight: 3,
            dashArray: '6, 6',
            fillColor: '#fef3c7',
            fillOpacity: 0.35
          }}
        />
      )}

      {cutPoints.length > 1 && (
        <Polyline
          positions={cutPoints.map(p => [p.lat, p.lng])}
          pathOptions={{
            color: '#ef4444',
            weight: 4,
            opacity: 0.95
          }}
        />
      )}

      {rubberbandCoords.length === 2 && (
        <Polyline
          positions={rubberbandCoords}
          pathOptions={{
            color: '#f97316',
            weight: 2,
            dashArray: '4, 6',
            opacity: 0.85
          }}
        />
      )}

      {cutPoints.map((pt, index) => (
        <Marker
          key={'cut-pt-' + index}
          position={[pt.lat, pt.lng]}
          icon={createVertexIcon(index + 1, index === 0)}
        />
      ))}

      {snappedLatLng && (
        <CircleMarker
          center={[snappedLatLng.lat, snappedLatLng.lng]}
          radius={8}
          pathOptions={{
            color: '#10b981',
            fillColor: '#6ee7b7',
            fillOpacity: 0.8,
            weight: 3
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#065f46' }}>Vértice Imán</span>
          </Tooltip>
        </CircleMarker>
      )}

      <div style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '10px 18px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: '#fef3c7',
          color: '#d97706',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Scissors size={18} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
              Modo Fraccionamiento de Predio
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              background: '#f1f5f9',
              color: '#475569',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {activePredio?.properties?.cod_catastral || 'Sin Código'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Haga clic para trazar la línea de corte atravesando el lote ({cutPoints.length} vértices)
          </span>
        </div>

        <div style={{ height: '28px', width: '1px', background: '#e2e8f0' }} />

        <button
          onClick={() => setCutPoints(prev => prev.slice(0, -1))}
          disabled={cutPoints.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: '600',
            color: cutPoints.length === 0 ? '#94a3b8' : '#334155',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: cutPoints.length === 0 ? 'not-allowed' : 'pointer'
          }}
          title="Deshacer último vértice (Ctrl+Z)"
        >
          <RotateCcw size={14} /> Deshacer
        </button>

        <button
          onClick={handleExecuteSplit}
          disabled={cutPoints.length < 2 || isProcessing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#ffffff',
            background: cutPoints.length < 2 ? '#94a3b8' : '#f59e0b',
            border: 'none',
            borderRadius: '6px',
            cursor: cutPoints.length < 2 ? 'not-allowed' : 'pointer',
            boxShadow: cutPoints.length >= 2 ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none'
          }}
          title="Finalizar corte y abrir confirmación (Enter)"
        >
          <Scissors size={14} /> {isProcessing ? 'Calculando...' : 'Cortar Lote'}
        </button>

        <button
          onClick={onCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#ef4444',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
          title="Cancelar fraccionamiento (Esc)"
        >
          <X size={14} /> Cancelar
        </button>
      </div>
    </>
  );
}
