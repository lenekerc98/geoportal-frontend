import React, { useState, useEffect, useRef, useContext } from 'react';
import Draggable from 'react-draggable';
//, useEffect, useRef, useContext } from 'react';
import { X, Save, Loader2, Check, MousePointer2, Upload, FileDown, Building2, Printer, MapPin } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../services/api';
import * as XLSX from 'xlsx';
import proj4 from 'proj4';
import { detectarUbicacionCliente } from '../../utils/geoDetection';
import { validateVerticesWithinUrdaneta, showOutsideUrdanetaAlert, isPointInsideUrdaneta } from '../../utils/cantonValidation';

proj4.defs("EPSG:32717", "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs");

export default function PredioForm({ onSubmit, onCancel, initialData, onStartDrawing }) {
  const { activeEmpresa, activeProyecto } = useContext(AppContext);
  const formatInitialCoords = (rawVal) => {
    if (!rawVal) return '';

    // Si ya es un texto plano de coordenadas (ej: "599202.0 9796078.0\n..."), mantenerlo
    if (typeof rawVal === 'string' && !rawVal.trim().startsWith('{') && !rawVal.trim().startsWith('[')) {
      return rawVal;
    }

    try {
      let parsed = rawVal;
      if (typeof rawVal === 'string') {
        parsed = JSON.parse(rawVal);
      }
      if (parsed && parsed.geometry) {
        parsed = parsed.geometry;
      }

      let rings = null;
      if (parsed && parsed.type === 'Polygon' && parsed.coordinates && parsed.coordinates[0]) {
        rings = parsed.coordinates[0];
      } else if (parsed && parsed.type === 'MultiPolygon' && parsed.coordinates && parsed.coordinates[0] && parsed.coordinates[0][0]) {
        rings = parsed.coordinates[0][0];
      }

      if (rings && Array.isArray(rings)) {
        return rings.map(coord => {
          if (!Array.isArray(coord) || coord.length < 2) return '';
          const c0 = parseFloat(coord[0]);
          const c1 = parseFloat(coord[1]);
          if (isNaN(c0) || isNaN(c1)) return '';

          // Si son grados WGS84 (Lng, Lat), proyectar a UTM 17S (X Este, Y Norte)
          if (Math.abs(c0) <= 180 && Math.abs(c1) <= 90) {
            const utm = proj4('EPSG:4326', 'EPSG:32717', [c0, c1]);
            return `${utm[0].toFixed(2)} ${utm[1].toFixed(2)}`;
          }
          return `${c0.toFixed(2)} ${c1.toFixed(2)}`;
        }).filter(Boolean).join('\n');
      }
    } catch (e) {
      console.error("Error al formatear coordenadas iniciales:", e);
    }
    return typeof rawVal === 'string' ? rawVal : '';
  };

  const initialCoords = formatInitialCoords(initialData?.geom_text || initialData?.geom_geojson || initialData?.geometry) || '';
  const detectedInitLoc = detectarUbicacionCliente(initialCoords || initialData?.geometry || initialData?.latlng);

  let initCodCat = initialData?.cod_catastral || '';
  let initParr = initialData?.parroquia || '';
  if ((!initCodCat || initCodCat.trim().length < 6) && detectedInitLoc) {
    initCodCat = (detectedInitLoc.prefijo_clave + (initCodCat.substring(6) || '')).padEnd(19, ' ');
  }
  if (!initParr && detectedInitLoc) {
    initParr = detectedInitLoc.parroquia;
  }

  const [formData, setFormData] = useState({
    posesionario_id: initialData?.posesionario_id || '',
    cod_catastral: initCodCat,
    geom_geojson: initialCoords,
    parroquia: initParr,
    sector: initialData?.sector || '',
  });
  const [colindantes, setColindantes] = useState([]);
  const [rumbosCustom, setRumbosCustom] = useState([]);

  useEffect(() => {
    if (initialData) {
      const coords = formatInitialCoords(initialData.geom_text || initialData.geom_geojson || initialData.geometry) || '';
      const detectedLoc = detectarUbicacionCliente(coords || initialData.geometry || initialData.latlng);

      setFormData(prev => {
        let cod = initialData.cod_catastral !== undefined ? initialData.cod_catastral : prev.cod_catastral;
        let parr = initialData.parroquia !== undefined ? initialData.parroquia : prev.parroquia;

        if ((!cod || cod.trim().length < 6) && detectedLoc) {
          cod = (detectedLoc.prefijo_clave + (cod ? cod.substring(6) : '')).padEnd(19, ' ');
        }
        if (!parr && detectedLoc) {
          parr = detectedLoc.parroquia;
        }

        return {
          ...prev,
          posesionario_id: initialData.posesionario_id !== undefined ? initialData.posesionario_id : prev.posesionario_id,
          cod_catastral: cod,
          geom_geojson: coords || prev.geom_geojson || '',
          parroquia: parr || '',
          sector: initialData.sector !== undefined ? initialData.sector : prev.sector || ''
        };
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (initialData && initialData.id) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/gis/predios/detalle-id/${initialData.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data) {
            const p = data.predio || data;
            if (p.parroquia) {
              setFormData(prev => ({ ...prev, parroquia: p.parroquia }));
            }
            if (p.sector) {
              setFormData(prev => ({ ...prev, sector: p.sector }));
            }
            if (data.linderos && data.linderos.length > 0) {
              const sorted = data.linderos.sort((a, b) => a.id - b.id);
              setColindantes(sorted.map(l => l.colindante || ''));
              setRumbosCustom(sorted.map(l => l.rumbo || ''));
            }
          }
        })
        .catch(e => console.error("Error cargando colindantes:", e));
    }
  }, [initialData]);



  const [empresasList, setEmpresasList] = useState([]);
  const [proyectosList, setProyectosList] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(initialData?.empresa_id || activeEmpresa?.id || '');
  const [selectedProyectoId, setSelectedProyectoId] = useState(initialData?.proyecto_id || activeProyecto?.id || '');

  useEffect(() => {
    if (!activeEmpresa) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/empresas`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setEmpresasList(data);
            if (data.length === 1 && !selectedEmpresaId) {
              setSelectedEmpresaId(data[0].id);
            }
          }
        })
        .catch(console.error);
    }
  }, [activeEmpresa, selectedEmpresaId]);

  useEffect(() => {
    const targetEmpresaId = activeEmpresa?.id || selectedEmpresaId;
    if (targetEmpresaId && (!activeProyecto || !activeProyecto.empresas_ids || !activeProyecto.empresas_ids.includes(parseInt(targetEmpresaId)))) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/proyectos`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const filtered = data.filter(p => p.empresas_ids && p.empresas_ids.includes(parseInt(targetEmpresaId)));
            setProyectosList(filtered);
            if (filtered.length === 1 && !selectedProyectoId) {
              setSelectedProyectoId(filtered[0].id);
            }
          }
        })
        .catch(console.error);
    }
  }, [activeProyecto, selectedEmpresaId, activeEmpresa]);

  const [cedula, setCedula] = useState('');
  const [nombrePosesionario, setNombrePosesionario] = useState('');
  const [loadingCedula, setLoadingCedula] = useState(false);
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [codigoMsg, setCodigoMsg] = useState('');
  const [inputMode, setInputMode] = useState('table');
  const [isNewPosesionario, setIsNewPosesionario] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (cedula && cedula.length >= 10) {
      buscarPosesionario();
    } else {
      setNombrePosesionario('');
      setFormData(prev => ({ ...prev, posesionario_id: '' }));
    }
  }, [cedula]);

  const buscarPosesionario = async () => {
    setLoadingCedula(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/gis/posesionarios/buscar/${cedula}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNombrePosesionario(data.nombre);
        setFormData(prev => ({ ...prev, posesionario_id: data.id }));
        setIsNewPosesionario(false);
      } else {
        setNombrePosesionario('');
        setFormData(prev => ({ ...prev, posesionario_id: '' }));
        setIsNewPosesionario(true);
      }
    } catch (e) {
      setNombrePosesionario('');
      setIsNewPosesionario(true);
    } finally {
      setLoadingCedula(false);
    }
  };

  useEffect(() => {
    if (formData.cod_catastral && formData.cod_catastral.trim().length >= 5) {
      const delay = setTimeout(() => {
        buscarCodigo();
      }, 500);
      return () => clearTimeout(delay);
    } else {
      setCodigoMsg('');
    }
  }, [formData.cod_catastral]);

  // Fase 2: Detección Espacial Automática (Inmediata Local + Refinamiento PostGIS en backend)
  useEffect(() => {
    if (!formData.geom_geojson || formData.geom_geojson.trim().length < 5) return;

    // 1. Detección territorial inmediata client-side (0ms, sin esperar red)
    const clientLoc = detectarUbicacionCliente(formData.geom_geojson);
    if (clientLoc) {
      setFormData(prev => {
        let currCod = prev.cod_catastral ? prev.cod_catastral.padEnd(19, ' ') : '                   ';
        const prefix6 = currCod.substring(0, 6).trim();
        let updatedCod = currCod;

        if (!prefix6 || prefix6.startsWith('0') || prefix6.startsWith('TE') || prefix6.length < 6) {
          updatedCod = (clientLoc.prefijo_clave + currCod.substring(6)).padEnd(19, ' ').substring(0, 19);
        } else if (prefix6.substring(0, 4) === '1206' && prefix6.substring(4, 6) !== clientLoc.cod_parroquia) {
          updatedCod = (prefix6.substring(0, 4) + clientLoc.cod_parroquia + currCod.substring(6)).padEnd(19, ' ').substring(0, 19);
        }

        return {
          ...prev,
          parroquia: prev.parroquia || clientLoc.parroquia,
          cod_catastral: updatedCod
        };
      });
    }

    // 2. Refinamiento espacial preciso por PostGIS (Sector de predios cercanos y confirmación)
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('catastro_token');
        const res = await fetch(`${API_URL}/api/gis/detectar-ubicacion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            geom_text: formData.geom_geojson,
            es_utm: true
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.cod_parroquia) {
            setFormData(prev => {
              let currCod = prev.cod_catastral ? prev.cod_catastral.padEnd(19, ' ') : '                   ';
              const prov = data.cod_provincia || '12';
              const cant = data.cod_canton || '06';
              const parr = data.cod_parroquia; // '50', '51', o '52'

              const prefix6 = currCod.substring(0, 6).trim();
              let updatedCod = currCod;

              // Solo autocompletar o actualizar los 6 primeros dígitos si están vacíos, son temporales, o se detectó la parroquia
              if (!prefix6 || prefix6.startsWith('0') || prefix6.startsWith('TE') || prefix6.length < 6) {
                updatedCod = (prov + cant + parr + currCod.substring(6)).padEnd(19, ' ').substring(0, 19);
              } else if (prefix6.substring(0, 4) === '1206') {
                updatedCod = (prefix6.substring(0, 4) + parr + currCod.substring(6)).padEnd(19, ' ').substring(0, 19);
              }

              return {
                ...prev,
                parroquia: prev.parroquia || data.parroquia || '',
                sector: prev.sector || (data.sector && data.sector !== 'RURAL' ? data.sector : (prev.sector || 'RURAL')),
                cod_catastral: updatedCod
              };
            });
          }
        }
      } catch (err) {
        console.warn('Error en detección espacial de ubicación:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.geom_geojson]);


  const buscarCodigo = async () => {
    setLoadingCodigo(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const codParaBuscar = encodeURIComponent(formData.cod_catastral.replace(/\s/g, ''));
      const res = await fetch(`${API_URL}/api/gis/codigos/buscar/${codParaBuscar}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCodigoMsg('Registrado');
        if (data.cedula_posesionario) {
          setCedula(data.cedula_posesionario); // Esto activará el otro useEffect
        } else {
          setCedula('');
        }
      } else {
        setCodigoMsg('Código libre');
      }
    } catch (e) {
      setCodigoMsg('Error');
    } finally {
      setLoadingCodigo(false);
    }
  };

  const calcularRumbo = (x1, y1, x2, y2) => {
    if (!x1 || !y1 || !x2 || !y2) return '-';
    const dx = parseFloat(x2) - parseFloat(x1);
    const dy = parseFloat(y2) - parseFloat(y1);
    if (dx === 0 && dy === 0) return '-';

    let ang = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
    const g = Math.floor(ang);
    const m = Math.floor((ang - g) * 60);
    const s = ((ang - g - m / 60) * 3600).toFixed(1);

    let ns = dy >= 0 ? 'N' : 'S';
    let ew = dx >= 0 ? 'E' : 'W';

    return `${ns} ${g}°${m}'${s}" ${ew}`;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        setFormData(prev => ({ ...prev, geom_geojson: text }));
        setInputMode('table');
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length > 1) {
          const rows = json.slice(1);
          let text = rows.map(r => `${r[0] || ''} ${r[1] || ''}`).filter(r => r.trim().length > 3).join('\n');
          setFormData(prev => ({ ...prev, geom_geojson: text }));
          setInputMode('table');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = null;
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Coordenada X (Este)": "", "Coordenada Y (Norte)": "" }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Coordenadas.xlsx");
  };

  const handleCaptureCurrentGPSPoint = () => {
    if (!navigator.geolocation) {
      alert("Tu dispositivo o navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const utm = proj4('EPSG:4326', 'EPSG:32717', [longitude, latitude]);
        const xStr = utm[0].toFixed(2);
        const yStr = utm[1].toFixed(2);
        
        if (!isPointInsideUrdaneta({ x: utm[0], y: utm[1], lat: latitude, lng: longitude })) {
          alert(`⚠️ Alerta: El punto GPS capturado (X=${xStr}, Y=${yStr}) se encuentra fuera de los límites territoriales del cantón Urdaneta.`);
          return;
        }

        const current = formData.geom_geojson ? formData.geom_geojson.trim() : '';
        const newLine = `${xStr} ${yStr}`;
        const updated = current ? `${current}\n${newLine}` : newLine;
        
        setFormData(prev => ({ ...prev, geom_geojson: updated }));
        alert(`Punto GPS capturado: X=${xStr}, Y=${yStr} (Precisión ±${accuracy.toFixed(1)}m)`);
      },
      (err) => {
        alert("Error al capturar ubicación GPS: " + (err.message || "Permiso denegado"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleGenerateAtCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert("Tu dispositivo o navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const utm = proj4('EPSG:4326', 'EPSG:32717', [longitude, latitude]);
        const half = 10; // 20m x 20m polígono (400 m2)
        const utmX = utm[0];
        const utmY = utm[1];
        
        if (!isPointInsideUrdaneta({ x: utmX, y: utmY, lat: latitude, lng: longitude })) {
          alert("⚠️ Alerta: Tu ubicación GPS actual se encuentra fuera de los límites territoriales de Urdaneta.");
          return;
        }

        // P01: NO, P02: NE, P03: SE, P04: SO, P01: Cierre
        const coords = [
          [utmX - half, utmY + half],
          [utmX + half, utmY + half],
          [utmX + half, utmY - half],
          [utmX - half, utmY - half],
          [utmX - half, utmY + half]
        ];
        
        const coordsText = coords.map(c => `${c[0].toFixed(2)} ${c[1].toFixed(2)}`).join('\n');
        setFormData(prev => ({ ...prev, geom_geojson: coordsText }));
        setInputMode('table');
        alert(`Predio base de 20x20m (400 m²) generado en tu posición GPS actual (Precisión ±${accuracy.toFixed(1)}m).`);
      },
      (err) => {
        alert("Error al capturar ubicación GPS: " + (err.message || "Permiso denegado"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalCod = formData.cod_catastral.replace(/\s/g, '');
    if (finalCod.length !== 19) {
      alert('La Clave Catastral debe tener exactamente 19 dígitos.');
      return;
    }

    if (finalCod.includes('999999') || finalCod.endsWith('9999999999999') || finalCod.startsWith('1206509999') || finalCod.startsWith('1206519999') || finalCod.startsWith('1206529999')) {
      alert(`⚠️ Alerta: El predio con clave ${finalCod} se encuentra fuera del rango territorial o zona catastral válida. No se permite registrar esta clave ficticia.`);
      return;
    }

    let finalPosesionarioId = formData.posesionario_id;
    if (!finalPosesionarioId && cedula && nombrePosesionario) {
      try {
        if (!navigator.onLine) throw new Error("offline");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const token = localStorage.getItem('catastro_token');
        const res = await fetch(`${API_URL}/api/gis/posesionarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ cedula, nombre: nombrePosesionario }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          finalPosesionarioId = data.id;
        } else {
          // Si falla en línea, no bloquear al usuario en campo: guardar como temporal
          finalPosesionarioId = null;
        }
      } catch (err) {
        // Red no disponible o lenta (timeout), no bloquear al usuario en el campo!
        finalPosesionarioId = null;
      }
    }

    let parsedGeojson = null;
    let esUtm = false;

    if (formData.geom_geojson) {
      const rawText = formData.geom_geojson.trim();

      if (rawText.startsWith('{')) {
        // Asume GeoJSON normal
        try {
          parsedGeojson = JSON.parse(rawText);
        } catch (err) {
          alert('El GeoJSON ingresado no es válido');
          return;
        }
      } else {
        // Parsea texto plano (X Y por línea, detecta si es UTM)
        try {
          const lines = rawText.split('\n');
          let isUtmCoords = false;
          let coords = lines.map(line => {
            const parts = line.trim().split(/[\s,;\t]+/).filter(Boolean);
            if (parts.length < 2) return null;
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            if (Math.abs(x) > 180 || Math.abs(y) > 180) isUtmCoords = true;
            return [x, y];
          }).filter(c => c !== null && !isNaN(c[0]) && !isNaN(c[1]));

          // Validar límites lógicos de coordenadas para prevenir errores graves
          let hasError = false;
          let errorMsg = '';
          for (const c of coords) {
            const [x, y] = c;
            if (isUtmCoords) {
              // Valores UTM deben estar típicamente en 100,000 a 900,000 en X y 0 a 10,000,000 en Y
              if (x > 2000000 || x < -2000000 || y > 20000000 || y < -20000000) {
                hasError = true;
                errorMsg = `La coordenada UTM X=${x}, Y=${y} excede los límites lógicos. Revisa si hay un dígito de más (ej. 98 millones en lugar de 9.8 millones).`;
                break;
              }
            } else {
              // Coordenadas geográficas lat/lon
              if (x < -180 || x > 180 || y < -90 || y > 90) {
                hasError = true;
                errorMsg = `La coordenada geográfica Lon=${x}, Lat=${y} es inválida. Longitud debe estar entre -180 y 180, Latitud entre -90 y 90.`;
                break;
              }
            }
          }

          if (hasError) {
            alert(errorMsg);
            return;
          }

          if (coords.length < 3) {
            alert('Se necesitan al menos 3 coordenadas para formar un polígono.');
            return;
          }

          // Validar que todas las coordenadas pertenezcan al cantón Urdaneta
          const valUrdaneta = validateVerticesWithinUrdaneta(coords.map((c, i) => ({
            x: isUtmCoords ? c[0] : null,
            y: isUtmCoords ? c[1] : null,
            lng: !isUtmCoords ? c[0] : null,
            lat: !isUtmCoords ? c[1] : null,
            codigo: `P${String(i + 1).padStart(2, '0')}`
          })));

          if (!valUrdaneta.isValid) {
            showOutsideUrdanetaAlert(valUrdaneta, '⚠️ Coordenadas Fuera del Cantón Urdaneta');
            return;
          }

          // Asegurar que el polígono esté cerrado
          if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push([...coords[0]]);
          }

          parsedGeojson = {
            type: "Polygon",
            coordinates: [coords]
          };
          esUtm = isUtmCoords;
        } catch (err) {
          alert('Error al procesar las coordenadas UTM. Asegúrate de usar el formato X Y por cada línea.');
          return;
        }
      }
    }

    const finalData = {
      ...formData,
      parroquia: formData.parroquia ? formData.parroquia.trim().toUpperCase() : null,
      sector: formData.sector ? formData.sector.trim().toUpperCase() : null,
      cod_catastral: finalCod,
      posesionario_id: finalPosesionarioId ? parseInt(finalPosesionarioId, 10) : null,
      cedula_temporal: (!finalPosesionarioId && cedula) ? cedula : undefined,
      nombre_temporal: (!finalPosesionarioId && nombrePosesionario) ? nombrePosesionario : undefined,
      empresa_id: selectedEmpresaId ? parseInt(selectedEmpresaId, 10) : null,
      proyecto_id: activeProyecto ? activeProyecto.id : (selectedProyectoId ? parseInt(selectedProyectoId, 10) : null),
      geom_geojson: parsedGeojson || { type: 'Polygon', coordinates: [] }, // Asegurarnos de mandar un dict si json
      colindantes: colindantes,
      rumbos: rumbosCustom,
      es_utm: esUtm
    };
    if (!parsedGeojson) finalData.geom_text = rawText;

    onSubmit(finalData);
  };


  const nodeRef = useRef(null);

  const isTemp = formData.cod_catastral && formData.cod_catastral.includes('TEMP');
  const getBoxVal = (start, end) => {
    if (isTemp && start >= 6) return '';
    return (formData.cod_catastral || '').substring(start, end).trim();
  };

  const handleBoxChange = (start, end, val, nextId) => {
    let curr = formData.cod_catastral ? formData.cod_catastral.padEnd(19, ' ') : '                   ';
    // Si era un código temporal (ej: 120650-TEMP-...), limpiar la parte posterior a los 6 dígitos
    if (isTemp) {
      const prefix6 = curr.substring(0, 6).padEnd(6, ' ');
      curr = prefix6 + '             '; // 6 + 13 = 19
    }
    const len = end - start;
    let newCod = (curr.substring(0, start) + val.padEnd(len, ' ') + curr.substring(end)).substring(0, 19);
    setFormData({ ...formData, cod_catastral: newCod });
    if (val.length === len && nextId) {
      document.getElementById(nextId)?.focus();
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Draggable nodeRef={nodeRef} handle=".drag-handle" cancel="button, input, select, textarea, .no-drag">
        <div ref={nodeRef} className="predio-form-modal" style={{ pointerEvents: 'auto', padding: '25px 30px', maxWidth: '640px', width: '92%', margin: '0 auto', border: '1px solid var(--card-border)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--card-bg, #ffffff)', opacity: 1, backdropFilter: 'none', WebkitBackdropFilter: 'none', borderRadius: '16px', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)' }}>
          <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px', cursor: 'move' }}>
            <h2 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '20px' }}>{initialData && initialData.id ? 'Editar Predio' : 'Nuevo Predio (Coordenadas)'}</h2>

            <div style={{ display: 'flex', gap: '10px' }}>
              {initialData && initialData.id && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {initialData.id}</span>
              )}
              <button type="button" onClick={onCancel} style={{ background: 'var(--bg-main)', border: '1px solid var(--card-border)', color: 'var(--text-main)', cursor: 'pointer', padding: '5px', borderRadius: '50%', display: 'flex' }}><X size={20} /></button>
            </div>
          </div>

          {((!activeEmpresa && empresasList.length > 1) || (!activeProyecto && proyectosList.length > 1)) && (
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
              {!activeEmpresa && empresasList.length > 1 && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Empresa *</label>
                  <select className="input-dynamic" value={selectedEmpresaId} onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedProyectoId(''); }} required>
                    <option value="">Seleccione Empresa...</option>
                    {empresasList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              )}
              {!activeProyecto && proyectosList.length > 1 && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Proyecto *</label>
                  <select className="input-dynamic" value={selectedProyectoId} onChange={e => setSelectedProyectoId(e.target.value)} required disabled={!selectedEmpresaId}>
                    <option value="">Seleccione Proyecto...</option>
                    {proyectosList.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isTemp && (
              <div style={{
                background: '#fef3c7',
                border: '1.5px solid #f59e0b',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', color: '#92400e' }}>
                  <span>🟡 Código Temporal:</span>
                  <span style={{ fontFamily: 'monospace', background: '#fde68a', padding: '2px 6px', borderRadius: '4px' }}>{formData.cod_catastral}</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#b45309' }}>
                  Los primeros 6 dígitos de la parroquia ya están asignados. Complete los casilleros de abajo para formalizar la clave catastral definitiva de 19 dígitos.
                </div>
              </div>
            )}

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
                <span>Clave Catastral (19 dígitos) *</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Prov-Cant-Parr-Zona-Sect-Pol-Pred-Div</span>
              </label>
              <div style={{ display: 'flex', gap: '4px', position: 'relative', width: '100%', overflowX: 'auto', paddingBottom: '5px' }}>
                <input id="cc-0" type="text" maxLength="2" placeholder="Pr" title="Provincia (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(0, 2)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  handleBoxChange(0, 2, val, 'cc-1');
                }} required />
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                <input id="cc-1" type="text" maxLength="2" placeholder="Ca" title="Cantón (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(2, 4)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  handleBoxChange(2, 4, val, 'cc-2');
                }} required />
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                <input id="cc-2" type="text" maxLength="2" placeholder="Pa" title="Parroquia (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(4, 6)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  let currParr = formData.parroquia;
                  if (!currParr) {
                    if (val === '50') currParr = 'CATARAMA';
                    else if (val === '51') currParr = 'RICAURTE';
                    else if (val === '52') currParr = 'PIJULLO';
                  }
                  if (currParr !== formData.parroquia) setFormData(prev => ({ ...prev, parroquia: currParr }));
                  handleBoxChange(4, 6, val, 'cc-3');
                }} required />
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                <input id="cc-3" type="text" maxLength="2" placeholder="Zo" title="Zona (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(6, 8)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  handleBoxChange(6, 8, val, 'cc-4');
                }} required />
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                <input id="cc-4" type="text" maxLength="2" placeholder="Se" title="Sector (2 dígitos)" className="input-dynamic" style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(8, 10)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  handleBoxChange(8, 10, val, 'cc-5');
                }} required />
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                <input id="cc-5" type="text" maxLength="3" placeholder="Pol" title="Polígono (3 dígitos)" className="input-dynamic" style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(10, 13)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  handleBoxChange(10, 13, val, 'cc-6');
                }} required />
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                <input id="cc-6" type="text" maxLength="3" placeholder="Pre" title="Predio (3 dígitos)" className="input-dynamic" style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(13, 16)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  handleBoxChange(13, 16, val, 'cc-7');
                }} required />
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                <input id="cc-7" type="text" maxLength="3" placeholder="Div" title="División (3 dígitos)" className="input-dynamic" style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(16, 19)} onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  handleBoxChange(16, 19, val, null);
                }} required />


                <div style={{ position: 'absolute', right: '-25px', top: '50%', transform: 'translateY(-50%)' }}>
                  {loadingCodigo && <Loader2 size={16} className="spin" color="var(--accent-color)" />}
                  {!loadingCodigo && codigoMsg === 'Registrado' && <Check size={16} color="var(--warning)" />}
                </div>
              </div>
              <small style={{ color: codigoMsg === 'Código libre' ? 'var(--success)' : 'var(--text-muted)', marginTop: '5px', display: 'block', minHeight: '15px' }}>
                {codigoMsg === 'Registrado' ? 'Código existente (asignando posesionario...)' : (formData.cod_catastral.replace(/\s/g, '').length !== 19 && formData.cod_catastral.length > 0 ? 'Faltan dígitos (19 obligatorios)' : codigoMsg)}
              </small>
            </div>

            <div className="predio-form-header">
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Cédula Posesionario *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={cedula}
                    onChange={e => setCedula(e.target.value)}
                    className="input-dynamic"
                    placeholder="Ej. 1712345678"
                    required
                    maxLength={10}
                  />
                  {loadingCedula && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}><Loader2 size={16} className="spin" color="var(--accent-color)" /></div>}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Nombre Posesionario</label>
                <input
                  type="text"
                  value={nombrePosesionario || ''}
                  onChange={e => isNewPosesionario && setNombrePosesionario(e.target.value)}
                  className="input-dynamic"
                  placeholder={isNewPosesionario ? "Escriba el nombre..." : "Se autocompleta..."}
                  disabled={!isNewPosesionario}
                  style={{ opacity: isNewPosesionario ? 1 : 0.7 }}
                  required={isNewPosesionario}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
                  Parroquia del Predio
                </label>
                <input
                  type="text"
                  value={formData.parroquia || ''}
                  onChange={e => {
                    const val = e.target.value;
                    let curr = formData.cod_catastral ? formData.cod_catastral.padEnd(19, ' ') : '                   ';
                    const norm = val.trim().toLowerCase();
                    let parrCode = '';
                    if (norm.includes('catarama')) parrCode = '50';
                    else if (norm.includes('ricaurte')) parrCode = '51';
                    else if (norm.includes('pijullo')) parrCode = '52';

                    let newCod = curr;
                    if (parrCode) {
                      const prefix4 = curr.substring(0, 4).trim().length === 4 ? curr.substring(0, 4) : '1206';
                      newCod = (prefix4 + parrCode + curr.substring(6)).padEnd(19, ' ').substring(0, 19);
                    }
                    setFormData({ ...formData, parroquia: val, cod_catastral: newCod });
                  }}
                  className="input-dynamic"
                  list="parroquias-urdaneta-list"
                  placeholder="Escriba la parroquia (CATARAMA, RICAURTE, PIJULLO...)"
                  style={{ width: '100%' }}
                />
                <datalist id="parroquias-urdaneta-list">
                  <option value="CATARAMA" />
                  <option value="RICAURTE" />
                  <option value="PIJULLO" />
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
                  Sector del Predio
                </label>
                <input
                  type="text"
                  value={formData.sector || ''}
                  onChange={e => setFormData({ ...formData, sector: e.target.value })}
                  className="input-dynamic"
                  placeholder="Escriba el sector (ej. URBANO, SAN ANTONIO...)"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                    Coordenadas del Predio
                  </label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setInputMode('table')} style={{ background: inputMode === 'table' ? 'var(--accent-color)' : 'transparent', color: inputMode === 'table' ? 'white' : 'var(--text-muted)', border: `1px solid ${inputMode === 'table' ? 'var(--accent-color)' : 'var(--card-border)'}`, padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Tabla de Puntos</button>
                    <button type="button" onClick={() => setInputMode('text')} style={{ background: inputMode === 'text' ? 'var(--accent-color)' : 'transparent', color: inputMode === 'text' ? 'white' : 'var(--text-muted)', border: `1px solid ${inputMode === 'text' ? 'var(--accent-color)' : 'var(--card-border)'}`, padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Pegar Texto</button>

                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".txt,.xlsx" onChange={handleFileUpload} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Upload size={14} /> Subir Archivo
                    </button>
                    <button type="button" onClick={handleDownloadTemplate} style={{ background: 'transparent', color: 'var(--success)', border: '1px solid var(--card-border)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FileDown size={14} /> Plantilla Excel
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleGenerateAtCurrentGPS}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                    title="Generar predio de 20x20m centrado en mi coordenada GPS actual"
                  >
                    <MapPin size={15} /> Generar en mi punto GPS
                  </button>
                  {!(initialData && initialData.id) && onStartDrawing && (
                    <button
                      type="button"
                      onClick={onStartDrawing}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--primary-glow)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      <MousePointer2 size={16} /> Dibujar en el Mapa
                    </button>
                  )}
                </div>
              </div>

              {inputMode === 'text' ? (
                <>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Ej. <code>599202.0 9796078.0</code> o separadas por tabulador/comas.
                  </p>
                  <textarea
                    value={formData.geom_geojson}
                    onChange={e => setFormData({ ...formData, geom_geojson: e.target.value })}
                    className="input-dynamic"
                    style={{ height: '200px', fontFamily: 'monospace', padding: '15px', resize: 'vertical' }}
                    placeholder={"599202.0 9796078.0\n599245.9 9796098.8\n599287.0 9796030.0"}
                    required={!(initialData && initialData.id)}
                  />
                </>
              ) : (
                <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div className="predio-table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <div className="predio-table-wrapper">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr>
                            <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>N°</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Coordenada X (Este)</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Coordenada Y (Norte)</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>Colindantes</th>
                            <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const lines = formData.geom_geojson ? formData.geom_geojson.split('\n') : [];
                            if (lines.length === 0) lines.push('');
                            return lines.map((line, index) => {
                              const parts = line.trim().split(/[\s,;\t]+/).filter(Boolean);
                              const x = parts[0] || '';
                              const y = parts[1] || '';
                              return (
                                <tr key={index} style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                                  <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{index + 1}</td>
                                  <td style={{ padding: '8px' }}>
                                    <input type="text" value={x} className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                      const newLines = [...lines];
                                      newLines[index] = `${e.target.value} ${y}`;
                                      setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                    }} />
                                  </td>
                                  <td style={{ padding: '8px' }}>
                                    <input type="text" value={y} className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                      const newLines = [...lines];
                                      newLines[index] = `${x} ${e.target.value}`;
                                      setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                    }} />
                                  </td>
                                  <td style={{ padding: '8px' }}>
                                    <input type="text" value={colindantes[index] || ''} placeholder="Pedro Castillo" className="input-dynamic" style={{ padding: '4px 8px', width: '100%' }} onChange={(e) => {
                                      const newCols = [...colindantes];
                                      newCols[index] = e.target.value;
                                      setColindantes(newCols);
                                    }} />
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>
                                    <button type="button" onClick={() => {
                                      const newLines = [...lines];
                                      newLines.splice(index, 1);
                                      setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                      const newCols = [...colindantes];
                                      newCols.splice(index, 1);
                                      setColindantes(newCols);
                                    }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}>
                                      <X size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="table-footer" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => {
                      const current = formData.geom_geojson ? formData.geom_geojson : '';
                      setFormData({ ...formData, geom_geojson: current + (current.endsWith('\n') || !current ? '' : '\n') + ' ' });
                    }} className="btn-add-vertex">
                      + Añadir Vértice
                    </button>
                    <button
                      type="button"
                      onClick={handleCaptureCurrentGPSPoint}
                      className="btn-add-vertex"
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      title="Obtener la coordenada actual del GPS del teléfono y agregarla a la tabla"
                    >
                      <MapPin size={14} /> + Capturar mi Punto GPS
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              {initialData && initialData.id && (
                <button 
                  type="button" 
                  onClick={() => {
                    const code = initialData.cod_catastral || initialData.id;
                    window.open(`/reporte/planimetrico/codigo/${code}`, '_blank');
                  }} 
                  style={{ padding: '12px 20px', backgroundColor: 'var(--primary-glow)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 'bold' }}>
                  <Printer size={18} /> Imprimir Planimetría
                </button>
              )}
              <button type="button" onClick={onCancel} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px' }}>
                Cancelar
              </button>
              <button type="submit" className="btn-dynamic">
                <Save size={18} /> Guardar Predio
              </button>
            </div>
          </form>
        </div>
      </Draggable>
    </div>
  );
}
