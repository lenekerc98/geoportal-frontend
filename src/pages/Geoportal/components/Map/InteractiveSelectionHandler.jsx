import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function InteractiveSelectionHandler({ mode, freeDrawings, setSelectedFeatureIds }) {
  const map = useMap();

  useEffect(() => {
    if (mode !== 'Select') {
      if (map) {
        map.eachLayer(layer => {
          if (layer instanceof L.Rectangle && layer.options && layer.options.color === '#22c55e' && layer.options.interactive === false) {
            try { map.removeLayer(layer); } catch (e) { }
          }
        });
      }
      if (map && map.boxZoom && !map.boxZoom.enabled()) map.boxZoom.enable();
      return;
    }

    if (map.boxZoom) map.boxZoom.disable();
    map.dragging.disable();

    let box = null;
    let startLatLng = null;

    const onMouseDown = (e) => {
      if (e.originalEvent.button !== 0) return;

      // Prevenir la selección de texto en la interfaz (UI) al arrastrar
      document.body.style.userSelect = 'none';
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }

      startLatLng = e.latlng;
      box = L.rectangle([startLatLng, startLatLng], {
        color: '#22c55e',
        weight: 1,
        fillOpacity: 0.15,
        dashArray: '4,4',
        interactive: false
      }).addTo(map);
    };

    const onMouseMove = (e) => {
      if (!startLatLng || !box) return;
      box.setBounds([startLatLng, e.latlng]);
    };

    const onMouseUp = (e) => {
      // Restaurar la selección de texto
      document.body.style.userSelect = '';
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }

      if (!startLatLng) return;

      if (box) {
        const bounds = box.getBounds();
        try { map.removeLayer(box); } catch (e) { }
        box = null;
        startLatLng = null;

        if (!bounds.getNorthEast().equals(bounds.getSouthWest())) {
          const newSelected = [];
          freeDrawings.forEach(d => {
            const isInside = d.positions.some(pos => bounds.contains(pos));
            if (isInside) newSelected.push(d.id);
          });

          setSelectedFeatureIds(prev => {
            if (e.originalEvent.shiftKey) {
              return Array.from(new Set([...prev, ...newSelected]));
            }
            return newSelected;
          });
        } else {
          if (!e.originalEvent.shiftKey && e.originalEvent.target === map.getContainer()) {
            setSelectedFeatureIds([]);
          }
        }
      }
    };

    map.getContainer().style.cursor = 'crosshair';
    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      if (box) {
        try { map.removeLayer(box); } catch (e) { }
        box = null;
      }
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.getContainer().style.cursor = '';
      map.dragging.enable();
      if (map.boxZoom && !map.boxZoom.enabled()) map.boxZoom.enable();
    };
  }, [mode, map, freeDrawings, setSelectedFeatureIds]);

  return null;
}

