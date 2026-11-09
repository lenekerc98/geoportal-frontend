import React, { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export default function FreeDrawHandler({ drawingMode, setDrawingMode, currentDrawing, setCurrentDrawing, addCompletedDrawing, removeLastDrawing, setMousePos, freeDrawings, setIsSnapped }) {
  const map = useMap();

  useEffect(() => {
    if (drawingMode) {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [drawingMode, map]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        if ((drawingMode === 'Polyline' || drawingMode === 'Polygon') && currentDrawing.length > 1) {
          addCompletedDrawing({ type: drawingMode, positions: currentDrawing });
          setCurrentDrawing([]);
        }
      } else if (e.key === 'Escape') {
        setCurrentDrawing([]);
        setDrawingMode(null);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (currentDrawing.length > 0) {
          setCurrentDrawing(prev => prev.slice(0, -1));
        } else {
          removeLastDrawing();
        }
      }
    };
    if (drawingMode) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingMode, currentDrawing, addCompletedDrawing, setCurrentDrawing, setDrawingMode, removeLastDrawing]);

  const getSnappedPoint = (latlng) => {
    let snapped = null;
    let minDistance = 20;
    const checkSnap = (pt) => {
      const ptPoint = map.latLngToContainerPoint(pt);
      const mousePoint = map.latLngToContainerPoint(latlng);
      const distance = ptPoint.distanceTo(mousePoint);
      if (distance < minDistance) {
        minDistance = distance;
        snapped = pt;
      }
    };
    currentDrawing.forEach(checkSnap);
    freeDrawings.forEach(d => d.positions.forEach(checkSnap));
    return snapped;
  };

  const freeDrawRaf = useRef(null);
  useMapEvents({
    mousemove(e) {
      if (!drawingMode) return;
      if (freeDrawRaf.current) return;
      freeDrawRaf.current = requestAnimationFrame(() => {
        freeDrawRaf.current = null;
        const snapped = getSnappedPoint(e.latlng);
        if (snapped) {
          setIsSnapped(true);
          setMousePos(snapped);
        } else {
          setIsSnapped(false);
          setMousePos(e.latlng);
        }
      });
    },
    click(e) {
      if (!drawingMode) return;
      const finalPt = getSnappedPoint(e.latlng) || e.latlng;

      if (drawingMode === 'Point') {
        addCompletedDrawing({ type: 'Point', positions: [finalPt] });
      } else if (drawingMode === 'Line') {
        if (currentDrawing.length === 0) {
          setCurrentDrawing([finalPt]);
        } else {
          addCompletedDrawing({ type: 'Line', positions: [currentDrawing[0], finalPt] });
          setCurrentDrawing([]);
        }
      } else if (drawingMode === 'Polyline' || drawingMode === 'Polygon') {
        setCurrentDrawing(prev => {
          // Evitar agregar el mismo punto exacto dos veces seguidas
          if (prev.length > 0 && prev[prev.length - 1].lat === finalPt.lat && prev[prev.length - 1].lng === finalPt.lng) {
            return prev;
          }
          return [...prev, finalPt];
        });
      }
    },
    dblclick(e) {
      if (!drawingMode) return;
      if ((drawingMode === 'Polyline' || drawingMode === 'Polygon') && currentDrawing.length > 1) {
        addCompletedDrawing({ type: drawingMode, positions: currentDrawing });
        setCurrentDrawing([]);
      }
    }
  });
  return null;
}

