import React, { useState } from 'react';
import { useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

export default function DrawPolygonTool({ isDrawing, drawPoints, setDrawPoints, setMousePos, onFinish, verticesData }) {
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
        let minDistance = Infinity;

        // Búsqueda de snapping (Autocad-like)
        const mousePoint = map.latLngToLayerPoint(e.latlng);
        
        // 1. Snapping a los puntos que ya estamos dibujando (para cerrar el polígono)
        if (drawPoints.length > 0) {
          drawPoints.forEach((ptLatLng, index) => {
            const vPoint = map.latLngToLayerPoint(ptLatLng);
            const dist = mousePoint.distanceTo(vPoint);
            // Hacer el snap al primer punto más "fuerte" para facilitar el cierre
            const threshold = index === 0 ? 20 : 15;
            if (dist < threshold && dist < minDistance) {
              minDistance = dist;
              bestSnap = ptLatLng;
            }
          });
        }

        // 2. Snapping a la capa de vértices catastrales
        if (verticesData && verticesData.features) {
          verticesData.features.forEach(f => {
            if (f.geometry && f.geometry.coordinates) {
              // GeoJSON es [lon, lat]
              const vLatLng = L.latLng(f.geometry.coordinates[1], f.geometry.coordinates[0]);
              const vPoint = map.latLngToLayerPoint(vLatLng);
              const dist = mousePoint.distanceTo(vPoint);

              if (dist < 15 && dist < minDistance) { // Snap si está a menos de 15 píxeles
                minDistance = dist;
                bestSnap = vLatLng;
              }
            }
          });
        }

        if (bestSnap) {
          setSnappedLatLng(bestSnap);
          setMousePos(bestSnap);
        } else {
          setSnappedLatLng(null);
          setMousePos(e.latlng);
        }
      } else {
        setMousePos(null);
        setSnappedLatLng(null);
      }
    },
    dblclick(e) {
      if (isDrawing) {
        // Prevenir zoom por doble clic
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        
        const pointToAdd = snappedLatLng ? snappedLatLng : e.latlng;
        // Si el doble click snap al primer punto, no lo duplicamos. Si no, lo agregamos.
        // Pero para simplificar, sólo mandamos los puntos al finish y él verifica.
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
