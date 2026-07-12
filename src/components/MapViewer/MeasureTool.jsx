import React, { useState, useEffect } from 'react';
import { useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

export default function MeasureTool({ isMeasuring, measurePoints, setMeasurePoints, setMousePos }) {
  const [snappedLatLng, setSnappedLatLng] = useState(null);
  
  const map = useMap();
  
  useMapEvents({
    click(e) {
      if (isMeasuring) {
        const pointToAdd = snappedLatLng ? snappedLatLng : e.latlng;
        setMeasurePoints(prev => [...prev, pointToAdd]);
      }
    },
    mousemove(e) {
      if (isMeasuring && measurePoints.length > 0) {
        let bestSnap = null;
        let minDistance = Infinity;
        const mousePoint = map.latLngToLayerPoint(e.latlng);

        // Snapping a los puntos de medición previos
        measurePoints.forEach((ptLatLng) => {
          const vPoint = map.latLngToLayerPoint(ptLatLng);
          const dist = mousePoint.distanceTo(vPoint);
          if (dist < 15 && dist < minDistance) {
            minDistance = dist;
            bestSnap = ptLatLng;
          }
        });

        if (bestSnap) {
          setSnappedLatLng(bestSnap);
          setMousePos(bestSnap);
        } else {
          setSnappedLatLng(null);
          setMousePos(e.latlng);
        }
      } else if (!isMeasuring) {
        setMousePos(null);
        setSnappedLatLng(null);
      }
    },
    contextmenu(e) { // Clic derecho para borrar
      if (isMeasuring) {
        setMeasurePoints([]);
        setMousePos(null);
        setSnappedLatLng(null);
      }
    }
  });

  // Cursor tipo cruz (crosshair)
  useEffect(() => {
    const mapContainer = map.getContainer();
    if (isMeasuring) {
      mapContainer.style.cursor = 'crosshair';
    } else {
      mapContainer.style.cursor = '';
    }
  }, [isMeasuring, map]);

  return null;
}
