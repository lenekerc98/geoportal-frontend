import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function InteractiveZoomHandler({ mode, setMode }) {
  const map = useMap();

  useEffect(() => {
    if (!mode) {
      if (map) {
        map.eachLayer(layer => {
          if (layer instanceof L.Rectangle && layer.options && (layer.options.color === '#ff0000' || layer.options.color === '#0078ff') && layer.options.interactive === false) {
            try { map.removeLayer(layer); } catch (e) { }
          }
        });
      }
      if (map && map.boxZoom && !map.boxZoom.enabled()) {
        map.boxZoom.enable();
      }
      return;
    }

    let box = null;
    let startLatLng = null;

    const onMouseDown = (e) => {
      if (e.originalEvent.button !== 0) return; // solo click izquierdo
      map.dragging.disable();
      startLatLng = e.latlng;
      if (mode === 'in' || mode === 'out') {
        box = L.rectangle([startLatLng, startLatLng], { color: mode === 'in' ? '#0078ff' : '#ff0000', weight: 2, fillOpacity: 0.2, interactive: false }).addTo(map);
      }
    };

    const onMouseMove = (e) => {
      if (!startLatLng || !box) return;
      box.setBounds([startLatLng, e.latlng]);
    };

    const onMouseUp = (e) => {
      if (!startLatLng) return;

      const clickLatLng = startLatLng;

      if (box) {
        const bounds = box.getBounds();
        try { map.removeLayer(box); } catch (e) { }
        box = null;
        startLatLng = null;
        map.dragging.enable();

        if (!bounds.getNorthEast().equals(bounds.getSouthWest())) {
          if (mode === 'in') {
            map.fitBounds(bounds);
          } else if (mode === 'out') {
            const boundsZoom = map.getBoundsZoom(bounds);
            const zoomDiff = boundsZoom - map.getZoom();
            const newZoom = map.getZoom() - zoomDiff;
            map.setView(bounds.getCenter(), newZoom > 0 ? newZoom : 0);
          }
          return;
        }
      } else {
        startLatLng = null;
        map.dragging.enable();
      }

      // If it was just a click (no box drawn)
      if (mode === 'in') {
        map.setZoomAround(clickLatLng, map.getZoom() + 1);
      } else if (mode === 'out') {
        map.setZoomAround(clickLatLng, map.getZoom() - 1);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (box) {
          try { map.removeLayer(box); } catch (err) { }
          box = null;
        }
        startLatLng = null;
        map.dragging.enable();
        if (setMode) setMode(null);
      }
    };

    map.getContainer().style.cursor = mode === 'in' ? 'zoom-in' : 'zoom-out';
    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (box) {
        try { map.removeLayer(box); } catch (e) { }
        box = null;
      }
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      map.getContainer().style.cursor = '';
      map.dragging.enable();
    };
  }, [mode, map, setMode]);

  return null;
}

