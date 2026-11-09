import React, { useState, useEffect, useRef } from 'react';
import { useMap, CircleMarker, Polyline, Polygon, Marker } from 'react-leaflet';
import L from 'leaflet';

export const FeatureEditor = ({ feature, onUpdate }) => {
  const lineRef = useRef(null);
  const polygonRef = useRef(null);

  const [positions, setPositions] = useState(feature.positions);

  useEffect(() => {
    setPositions(feature.positions);
  }, [feature]);

  const handleDrag = (idx, e) => {
    const newLatLng = e.target.getLatLng();
    const newPositions = [...positions];
    newPositions[idx] = newLatLng;

    // Live update the leaflet element without re-rendering React
    if (lineRef.current) {
      lineRef.current.setLatLngs(newPositions);
    }
    if (polygonRef.current) {
      polygonRef.current.setLatLngs(newPositions);
    }
  };

  const handleDragEnd = (idx, e) => {
    const newLatLng = e.target.getLatLng();
    const newPositions = [...positions];
    newPositions[idx] = newLatLng;
    setPositions(newPositions);
    onUpdate(newPositions);
  };

  return (
    <>
      {feature.type === 'Point' && <CircleMarker center={positions[0]} radius={5} color="#ef4444" fillColor="#fca5a5" fillOpacity={1} weight={2} />}
      {(feature.type === 'Line' || feature.type === 'Polyline') && <Polyline ref={lineRef} positions={positions} color="#ef4444" weight={3} dashArray="4, 6" />}
      {feature.type === 'Polygon' && <Polygon ref={polygonRef} positions={positions} color="#ef4444" fillColor="#ef4444" weight={3} fillOpacity={0.2} dashArray="4, 6" />}

      {positions.map((pos, idx) => (
        <Marker
          key={`edit-${idx}`}
          position={pos}
          draggable={true}
          icon={L.divIcon({ html: '<div style="width:14px;height:14px;background:#fff;border:3px solid #ef4444;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>', iconSize: [0, 0] })}
          eventHandlers={{
            drag: (e) => handleDrag(idx, e),
            dragend: (e) => handleDragEnd(idx, e)
          }}
        />
      ))}
    </>
  );
};

export const PredioVertexEditor = ({ positions, onUpdate }) => {
  const map = useMap();
  const polygonRef = useRef(null);
  const currentPositionsRef = useRef(positions);

  useEffect(() => {
    currentPositionsRef.current = positions;
    if (polygonRef.current) {
      polygonRef.current.setLatLngs(positions.map(p => [p.lat, p.lng]));
    }
  }, [positions]);

  const handleDrag = (idx, e) => {
    const newLatLng = e.target.getLatLng();
    const updated = [...currentPositionsRef.current];
    updated[idx] = { lat: newLatLng.lat, lng: newLatLng.lng };
    currentPositionsRef.current = updated;

    // Actualizar el polígono en vivo sin re-renderizar React
    if (polygonRef.current) {
      polygonRef.current.setLatLngs(updated.map(p => [p.lat, p.lng]));
    }
  };

  const handleDragEnd = (idx, e) => {
    if (map && map.dragging) map.dragging.enable();
    const newLatLng = e.target.getLatLng();
    const updated = [...currentPositionsRef.current];
    updated[idx] = { lat: newLatLng.lat, lng: newLatLng.lng };
    currentPositionsRef.current = updated;
    onUpdate(updated);
  };

  return (
    <>
      <Polygon
        ref={polygonRef}
        positions={positions.map(p => [p.lat, p.lng])}
        interactive={false}
        pathOptions={{
          color: '#3b82f6',
          weight: 3.5,
          fillColor: '#3b82f6',
          fillOpacity: 0.25,
          dashArray: '6, 6'
        }}
      />
      {positions.map((pos, idx) => (
        <Marker
          key={`vert-marker-${idx}`}
          position={[pos.lat, pos.lng]}
          draggable={true}
          zIndexOffset={10000}
          icon={L.divIcon({
            className: 'draggable-predio-vertex',
            html: `<div style="
              width: 28px;
              height: 28px;
              background: #2563eb;
              border: 3px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 4px 10px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-size: 13px;
              font-weight: 800;
              cursor: grab;
              user-select: none;
              touch-action: none;
            ">${idx + 1}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })}
          eventHandlers={{
            add: (e) => {
              const marker = e.target;
              if (marker.dragging) {
                marker.dragging.enable();
              }
              const el = marker.getElement();
              if (el) {
                el.addEventListener('touchstart', (ev) => {
                  ev.stopPropagation();
                  if (map && map.dragging) map.dragging.disable();
                }, { passive: false });
                el.addEventListener('touchend', () => {
                  if (map && map.dragging) map.dragging.enable();
                }, { passive: true });
                el.addEventListener('touchcancel', () => {
                  if (map && map.dragging) map.dragging.enable();
                }, { passive: true });
              }
            },
            dragstart: () => {
              if (map && map.dragging) map.dragging.disable();
            },
            drag: (e) => handleDrag(idx, e),
            dragend: (e) => handleDragEnd(idx, e)
          }}
        />
      ))}
    </>
  );
};

