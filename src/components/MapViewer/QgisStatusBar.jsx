import React, { useState, useEffect } from 'react';
import proj4 from 'proj4';

// Definir UTM 17S (WGS 84 / UTM zone 17S - EPSG:32717)
proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

export default function QgisStatusBar({ map }) {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });
  const [utmCoords, setUtmCoords] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState('');
  const [inputScale, setInputScale] = useState('');

  useEffect(() => {
    if (!map) return;
    
    if (map.options) {
      map.options.zoomSnap = 0;
    }

    const onMouseMove = (e) => {
      setCoords(e.latlng);
      // Proyectar Lat/Lng a UTM 17S
      const utm = proj4('EPSG:4326', 'EPSG:32717', [e.latlng.lng, e.latlng.lat]);
      setUtmCoords({ x: utm[0], y: utm[1] });
    };
    
    const updateScale = () => {
      if (!map) return;
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        if (!center || zoom === undefined || isNaN(zoom)) return;
        const mpp = (156543.03392 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom);
        const currentScale = Math.round(mpp * 3779.529);
        setScale(currentScale);
        setInputScale(String(currentScale));
      } catch (err) {
        console.error("Error updating scale:", err);
      }
    };

    map.on('mousemove', onMouseMove);
    map.on('zoomend', updateScale);
    map.on('moveend', updateScale);
    
    if (map.whenReady) {
      map.whenReady(updateScale);
    }
    updateScale();
    
    return () => {
      map.off('mousemove', onMouseMove);
      map.off('zoomend', updateScale);
      map.off('moveend', updateScale);
    };
  }, [map]);

  const handleScaleChange = (e) => {
    // Permitir solo dígitos y limpiar ceros a la izquierda
    let val = e.target.value.replace(/[^\d]/g, '');
    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '');
    }
    setInputScale(val);
  };

  const handleScaleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!map) return;
    
    let target = parseInt(inputScale, 10);
    if (!target || target <= 0) {
      if (scale) {
        setInputScale(String(scale));
      }
      return;
    }
    
    setInputScale(String(target));
    if (map.options) {
      map.options.zoomSnap = 0;
    }
    const lat = map.getCenter().lat;
    const mpp = target / 3779.529;
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
      
      <form onSubmit={handleScaleSubmit} className="qgis-status-item" style={{ margin: 0 }} autoComplete="off">
        <span>Escala 1:</span>
        <input 
          className="qgis-input scale-input" 
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={inputScale}
          onChange={handleScaleChange}
          onBlur={handleScaleSubmit}
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
