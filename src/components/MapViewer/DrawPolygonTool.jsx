import React, { useState } from 'react';
import { useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import Swal from 'sweetalert2';
import proj4 from 'proj4';

// Definir UTM 17S si no está definido
if (!proj4.defs('EPSG:32717')) {
  proj4.defs('EPSG:32717', '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs');
}

export default function DrawPolygonTool({ isDrawing, drawPoints, setDrawPoints, setMousePos, onFinish, setIsSnapped }) {
  const [snappedLatLng, setSnappedLatLng] = useState(null);
  const [cachedSnapPoints, setCachedSnapPoints] = useState([]);

  const map = useMap();

  React.useEffect(() => {
    if (isDrawing) {
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
      setCachedSnapPoints([]);
    }
  }, [isDrawing, map]);

  useMapEvents({
    click(e) {
      if (isDrawing) {
        // Usa el punto con snap si existe, sino el punto del clic
        const pointToAdd = snappedLatLng ? snappedLatLng : e.latlng;
        setDrawPoints(prev => [...prev, pointToAdd]);
      }
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
            // Proyectar de UTM 32717 a WGS84 4326
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

        // 2. Snapping global a TODOS los polígonos/líneas renderizados en el mapa usando caché
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
