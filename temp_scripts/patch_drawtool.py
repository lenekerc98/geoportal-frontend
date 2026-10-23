import re

filepath = "C:/LNCZ/proyecto-catastro-2026/frontend/src/components/MapViewer/DrawPolygonTool.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Import useRef and create latestMousePos
content = content.replace("import React, { useState } from 'react';", "import React, { useState, useRef } from 'react';")

state_old = """  const [cachedSnapPoints, setCachedSnapPoints] = useState([]);

  const map = useMap();"""

state_new = """  const [cachedSnapPoints, setCachedSnapPoints] = useState([]);
  const latestMousePos = useRef(null);

  const map = useMap();"""

content = content.replace(state_old, state_new)

# 2. Update mousemove
mousemove_old = """    mousemove(e) {
      if (isDrawing) {"""
mousemove_new = """    mousemove(e) {
      latestMousePos.current = e.latlng;
      if (isDrawing) {"""
content = content.replace(mousemove_old, mousemove_new)

# 3. Update Enter logic
enter_old = """      } else if (e.key === 'Enter') {
        e.preventDefault();
        const finalPoints = [...drawPoints];
        if (snappedLatLng) finalPoints.push(snappedLatLng);
        onFinish(finalPoints);
      }"""
enter_new = """      } else if (e.key === 'Enter') {
        e.preventDefault();
        const finalPoints = [...drawPoints];
        if (snappedLatLng) {
            finalPoints.push(snappedLatLng);
        } else if (latestMousePos.current) {
            finalPoints.push(latestMousePos.current);
        }
        if (setIsSnapped) setIsSnapped(false);
        onFinish(finalPoints);
      }"""
content = content.replace(enter_old, enter_new)

# 4. Update cursor useEffect
cursor_old = """  // Cambiar el cursor del mapa cuando estamos dibujando
  React.useEffect(() => {
    const mapContainer = map.getContainer();
    if (isDrawing) {
      mapContainer.style.cursor = 'crosshair';
    } else {
      mapContainer.style.cursor = ''; // Restaurar por defecto
    }
  }, [isDrawing, map]);"""
cursor_new = """  // Cambiar el cursor del mapa cuando estamos dibujando
  React.useEffect(() => {
    const mapContainer = map.getContainer();
    if (isDrawing) {
      mapContainer.style.cursor = 'crosshair';
    } else {
      mapContainer.style.cursor = ''; // Restaurar por defecto
    }
    return () => {
      mapContainer.style.cursor = '';
    };
  }, [isDrawing, map]);"""
content = content.replace(cursor_old, cursor_new)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("DrawPolygonTool patched successfully.")
