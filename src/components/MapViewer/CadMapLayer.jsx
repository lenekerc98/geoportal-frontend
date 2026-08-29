import React, { useMemo } from 'react';
import { GeoJSON, Marker } from 'react-leaflet';
import L from 'leaflet';

export default function CadMapLayer({ geojsonData, isVisible = true }) {
  // Separar puntos de texto y geometrías vectoriales
  const textFeatures = useMemo(() => {
    if (!isVisible || !geojsonData || !geojsonData.features) return [];
    return geojsonData.features.filter(f => f.geometry?.type === 'Point' && f.properties?.texto);
  }, [geojsonData, isVisible]);

  const vectorFeatures = useMemo(() => {
    if (!isVisible || !geojsonData || !geojsonData.features) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: geojsonData.features.filter(f => f.geometry?.type !== 'Point' || !f.properties?.texto)
    };
  }, [geojsonData, isVisible]);

  // Memoizar marcadores de texto para evitar saturar el DOM de Leaflet
  const renderedMarkers = useMemo(() => {
    if (!textFeatures || textFeatures.length === 0) return null;
    const visibleTexts = textFeatures.slice(0, 300);

    return visibleTexts.map((f, idx) => {
      const coords = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
      const texto = f.properties.texto;
      const layer = (f.properties.capa_cad || '').toUpperCase();

      let textColor = '#0f172a';
      let fontSize = 10;
      if (layer === 'VALORCUADRICULAR') {
        textColor = '#1e40af';
        fontSize = 9.5;
      } else if (layer === 'PROYECCION') {
        textColor = '#065f46';
        fontSize = 8.5;
      }

      const icon = L.divIcon({
        className: 'cad-text-label',
        html: `<div style="font-size: ${fontSize}px; font-weight: bold; color: ${textColor}; white-space: nowrap; text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff; pointer-events: none; user-select: none;">${texto}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      return <Marker key={`cad-text-${idx}-${layer}`} position={coords} icon={icon} interactive={false} />;
    });
  }, [textFeatures]);

  if (!isVisible || !geojsonData) return null;

  return (
    <>
      {/* Renderizado de Trazos Vectoriales (LineStrings) de las capas CAD */}
      {vectorFeatures.features.length > 0 && (
        <GeoJSON 
          key={`cad-vectors-${geojsonData.features.length}-${JSON.stringify(vectorFeatures.features.map(f => f.properties?.capa_cad).slice(0, 5))}`}
          data={vectorFeatures}
          style={(feature) => {
            const layer = (feature?.properties?.capa_cad || '').toUpperCase();
            let color = '#334155';
            let weight = 1.3;
            let dashArray = null;

            if (layer === 'CUADRICULAUTM') {
              color = '#2563eb';
              weight = 1;
              dashArray = '4, 4';
            } else if (layer === 'VALORGEOGRAFICO') {
              color = '#7c3aed';
              weight = 1.5;
            } else if (layer === 'INFORMACIONMARGI') {
              color = '#0f172a';
              weight = 2;
            } else if (layer === 'PROYECCION') {
              color = '#059669';
              weight = 1;
            } else if (layer === 'EDIFICACION') {
              color = '#dc2626';
              weight = 1.5;
            } else if (layer.includes('HIDRO')) {
              color = '#0284c7';
              weight = 1.5;
            }

            return {
              color: color,
              weight: weight,
              dashArray: dashArray,
              fillColor: 'transparent',
              opacity: 0.9
            };
          }}
        />
      )}

      {/* Renderizado de Textos / Anotaciones del CAD */}
      {renderedMarkers}
    </>
  );
}
