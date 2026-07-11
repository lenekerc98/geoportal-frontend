import React, { useState, useEffect } from 'react';
import proj4 from 'proj4';

// Definir UTM 17S (WGS 84 / UTM zone 17S - EPSG:32717)
proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

export default function QgisStatusBar({ map }) {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });
  const [utmCoords, setUtmCoords] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1000);
  const [inputScale, setInputScale] = useState(1000);

  useEffect(() => {
    if (!map) return;
    
    const onMouseMove = (e) => {
      setCoords(e.latlng);
      // Proyectar Lat/Lng a UTM 17S
      const utm = proj4('EPSG:4326', 'EPSG:32717', [e.latlng.lng, e.latlng.lat]);
      setUtmCoords({ x: utm[0], y: utm[1] });
    };
    
    const updateScale = () => {
      const lat = map.getCenter().lat;
      const zoom = map.getZoom();
      const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
      const currentScale = Math.round(mpp * 3779.529);
      setScale(currentScale);
      setInputScale(currentScale);
    };

    map.on('mousemove', onMouseMove);
    map.on('zoomend', updateScale);
    map.on('moveend', updateScale);
    updateScale();
    
    return () => {
      map.off('mousemove', onMouseMove);
      map.off('zoomend', updateScale);
      map.off('moveend', updateScale);
    };
  }, [map]);

  const handleScaleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!map || !inputScale) return;
    const lat = map.getCenter().lat;
    const mpp = inputScale / 3779.529;
    const targetZoom = Math.log2((156543.03392 * Math.cos(lat * Math.PI / 180)) / mpp);
    map.setZoom(targetZoom);
  };

  return (
    <div className="qgis-status-bar">
      <div className="qgis-status-item">
        <span>Coordenada</span>
        <input 
          className="qgis-input" 
          readOnly 
          style={{ width: '150px' }}
          value={`${utmCoords.x.toFixed(2)}, ${utmCoords.y.toFixed(2)}`} 
        />
      </div>
      
      <form onSubmit={handleScaleSubmit} className="qgis-status-item" style={{ margin: 0 }}>
        <span>Escala 1:</span>
        <input 
          className="qgis-input scale-input" 
          type="number"
          value={inputScale}
          onChange={(e) => setInputScale(Number(e.target.value))}
          style={{ width: '100px' }}
        />
        <button type="submit" style={{ display: 'none' }}>Ir</button>
      </form>

      <div className="qgis-status-item qgis-hide-mobile">
        <span>Lupa</span>
        <select className="qgis-select" defaultValue="100%">
          <option>100%</option>
          <option>150%</option>
        </select>
      </div>

      <div className="qgis-status-item qgis-hide-mobile">
        <span>Rotación</span>
        <input className="qgis-input" readOnly value="0.0" style={{ width: '50px' }} />
      </div>

      <div className="qgis-status-item qgis-hide-mobile">
        <input type="checkbox" id="render-cb" defaultChecked />
        <label htmlFor="render-cb" style={{ marginLeft: '4px' }}>Renderizar</label>
      </div>
    </div>
  );
}
