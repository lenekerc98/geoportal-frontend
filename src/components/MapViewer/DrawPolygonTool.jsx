import React, { useState } from 'react';
import { useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

export default function DrawPolygonTool({ isDrawing, drawPoints, setDrawPoints, setMousePos, onFinish, setIsSnapped }) {
  const [snappedLatLng, setSnappedLatLng] = useState(null);

  const map = useMap();

  useMapEvents({
    click(e) {
      if (isDrawing) {
        // Usa el punto con snap si existe, sino el punto del clic
        const pointToAdd = snappedLatLng ? snappedLatLng : e.latlng;
        setDrawPoints(prev => [...prev, pointToAdd]);
      }
    },
    mousemove(e) {
      if (isDrawing) {
        let bestSnap = null;
        let minDistance = 20; // 20 pixels threshold for snapping

        const mousePoint = map.latLngToLayerPoint(e.latlng);
        
        // 1. Snapping a los puntos que ya estamos dibujando (para cerrar el polígono)
        if (drawPoints.length > 0) {
          drawPoints.forEach((ptLatLng, index) => {
            const vPoint = map.latLngToLayerPoint(ptLatLng);
            const dist = mousePoint.distanceTo(vPoint);
            // Hacer el snap al primer punto más "fuerte" para facilitar el cierre
            const threshold = index === 0 ? 25 : 20;
            if (dist < threshold && dist < minDistance) {
              minDistance = dist;
              bestSnap = ptLatLng;
            }
          });
        }

        // 2. Snapping global a TODOS los polígonos/líneas renderizados en el mapa (AutoCAD like)
        map.eachLayer((layer) => {
          if (layer.getLatLngs) {
            const latlngs = layer.getLatLngs();
            
            // Función recursiva para buscar en arrays anidados (Polygon, MultiPolygon)
            const checkLatLngs = (coords) => {
              coords.forEach(coord => {
                if (Array.isArray(coord)) {
                  checkLatLngs(coord);
                } else if (coord && coord.lat !== undefined && coord.lng !== undefined) {
                  const vPoint = map.latLngToLayerPoint(coord);
                  const dist = mousePoint.distanceTo(vPoint);
                  if (dist < minDistance) {
                    minDistance = dist;
                    bestSnap = coord;
                  }
                }
              });
            };
            
            checkLatLngs(latlngs);
          }
        });

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
        // Prevenir zoom por doble clic
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        
        const pointToAdd = snappedLatLng ? snappedLatLng : e.latlng;
        const finalPoints = [...drawPoints, pointToAdd];
        
        // Finalizar
        onFinish(finalPoints);
      }
    }
  });

  // Cambiar el cursor del mapa cuando estamos dibujando
  React.useEffect(() => {
    const mapContainer = map.getContainer();
    if (isDrawing) {
      mapContainer.style.cursor = 'crosshair';
    } else {
      mapContainer.style.cursor = ''; // Restaurar por defecto
    }
  }, [isDrawing, map]);

  return null;
}
