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

export default function PredioForm({ onSubmit, onCancel, initialData, onStartDrawing, onEditOnMap }) {
  const isEditing = Boolean(initialData && (initialData.id || initialData.predio_id));
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
    initCodCat = (detectedInitLoc.prefijo_clave + (initCodCat.substring(6) || '')).padEnd(14, ' ');
  }
  if (!initParr && detectedInitLoc) {
    initParr = detectedInitLoc.parroquia;
  }

  const [formData, setFormData] = useState({
    posesionario_id: initialData?.posesionario_id || '',
    cod_catastral: initCodCat,
    geom_geojson: initialCoords,
    parroquia: initParr,
    sector: (initialData?.sector && initialData.sector !== initialData.sector !== initialData?.nombre_posesionario) ? initialData.sector : '',
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
          cod = (detectedLoc.prefijo_clave + (cod ? cod.substring(6) : '')).padEnd(14, ' ');
        }
        if (!parr && detectedLoc) {
          parr = detectedLoc.parroquia;
        }

        const isNameInSector = !initialData.nombre_posesionario && !initialData.posesionario_nombre && initialData.sector && initialData.sector.includes(' ') && !initialData.sector.toUpperCase().startsWith('SECTOR');
        return {
          ...prev,
          posesionario_id: initialData.posesionario_id !== undefined ? initialData.posesionario_id : prev.posesionario_id,
          cod_catastral: cod,
          geom_geojson: coords || prev.geom_geojson || '',
          parroquia: parr || '',
          sector: (initialData.sector && initialData.sector !== initialData.sector !== initialData.nombre_posesionario && !isNameInSector) ? initialData.sector : (prev.sector && prev.sector !== !isNameInSector ? prev.sector : '')
        };
      });

      if (initialData.cedula || initialData.cedula_posesionario) {
        setCedula(initialData.cedula || initialData.cedula_posesionario);
      }
      if (initialData.nombre_posesionario || initialData.posesionario_nombre) {
        setNombrePosesionario(initialData.nombre_posesionario || initialData.posesionario_nombre);
      } else if (initialData.sector && initialData.sector.includes(' ') && !initialData.sector.toUpperCase().startsWith('SECTOR')) {
        setNombrePosesionario(initialData.sector);
      }
      if (initialData.empresa_id) setSelectedEmpresaId(initialData.empresa_id);
      if (initialData.proyecto_id) setSelectedProyectoId(initialData.proyecto_id);
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
            const isNameInSector = !p.nombre_posesionario && p.sector && p.sector.includes(' ') && !p.sector.toUpperCase().startsWith('SECTOR');
            if (p.nombre_posesionario) {
              setNombrePosesionario(p.nombre_posesionario);
            } else if (isNameInSector) {
              setNombrePosesionario(p.sector);
            }
            if (p.sector && p.sector !== p.sector !== p.nombre_posesionario && !isNameInSector) {
              setFormData(prev => ({ ...prev, sector: p.sector }));
            } else {
              setFormData(prev => ({ ...prev, sector: '' }));
            }
            if (p.cedula) {
              setCedula(p.cedula);
            }
            if (p.posesionario_id) {
              setFormData(prev => ({ ...prev, posesionario_id: p.posesionario_id }));
            }
            if (p.cod_catastral) {
              setFormData(prev => ({ ...prev, cod_catastral: p.cod_catastral }));
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

  const [cedula, setCedula] = useState(initialData?.cedula || initialData?.cedula_posesionario || '');
  const [nombrePosesionario, setNombrePosesionario] = useState(
    initialData?.nombre_posesionario || initialData?.posesionario_nombre ||
    (initialData?.sector && initialData.sector.includes(' ') && !initialData.sector.toUpperCase().startsWith('SECTOR') ? initialData.sector : '')
  );
  const [loadingCedula, setLoadingCedula] = useState(false);
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [codigoMsg, setCodigoMsg] = useState('');
  const [allowEditCodigo, setAllowEditCodigo] = useState(false);
  const [sqlRefDetected, setSqlRefDetected] = useState(null);
  const [territorialInfo, setTerritorialInfo] = useState(null);
  const [codigoMode, setCodigoMode] = useState(() => {
    const cod = String(initialData?.cod_catastral || '').replace(/\s/g, '');
    return cod.length === 19 ? '19' : '14';
  });

  const convert19to14 = (cod19) => {
    if (!cod19) return '';
    const clean = String(cod19).replace(/\s/g, '');
    if (clean.length === 19) {
      const prov = clean.substring(0, 2);
      const cant = clean.substring(2, 4);
      const parr = clean.substring(4, 6);
      const zona = clean.substring(7, 8) || clean.substring(6, 7);
      const sect = clean.substring(9, 10) || '1';
      const pol = clean.substring(10, 13);
      const pred = clean.substring(13, 16);
      return `${prov}${cant}${parr}${zona}${sect}${pol}${pred}`;
    }
    return clean;
  };

  const convert14to19 = (cod14) => {
    if (!cod14) return '';
    const clean = String(cod14).replace(/\s/g, '');
    if (clean.length === 14) {
      const prov = clean.substring(0, 2);
      const cant = clean.substring(2, 4);
      const parr = clean.substring(4, 6);
      const zona = '5' + clean.substring(6, 7);
      const sect = '0' + clean.substring(7, 8);
      const pol = clean.substring(8, 11);
      const pred = clean.substring(11, 14);
      const div = '000';
      return `${prov}${cant}${parr}${zona}${sect}${pol}${pred}${div}`;
    }
    return clean;
  };

  const [inputMode, setInputMode] = useState('table');
  const [isNewPosesionario, setIsNewPosesionario] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (cedula && cedula.trim().length >= 10) {
      buscarPosesionario();
    } else {
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
        setFormData(prev => ({ ...prev, posesionario_id: '' }));
        setIsNewPosesionario(true);
      }
    } catch (e) {
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
        let currCod = prev.cod_catastral ? prev.cod_catastral.padEnd(14, ' ') : '              ';
        const prefix6 = currCod.substring(0, 6).trim();
        let updatedCod = currCod;

        if (!prefix6 || prefix6.startsWith('0') || prefix6.startsWith('TE') || prefix6.length < 6) {
          updatedCod = (clientLoc.prefijo_clave + currCod.substring(6)).padEnd(14, ' ').substring(0, 14);
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
          if (data) {
            setTerritorialInfo(data);
            if (data.cod_parroquia) {
              setFormData(prev => {
                let currCod = prev.cod_catastral ? prev.cod_catastral.padEnd(14, ' ') : '              ';
                const prov = data.cod_provincia || '12';
                const cant = data.cod_canton || '06';
                const parr = data.cod_parroquia; // '50', '51', o '52'

                const prefix6 = currCod.substring(0, 6).trim();
                let updatedCod = currCod;

                // Opción 2: Solo autocompletar si no tiene clave o es temporal (NO sobreescribir si ya tiene clave válida o adoptada de SQL)
                if (!prefix6 || prefix6.startsWith('0') || prefix6.startsWith('TE') || prefix6.length < 6) {
                  updatedCod = (prov + cant + parr + currCod.substring(6)).padEnd(14, ' ').substring(0, 14);
                }

                return {
                  ...prev,
                  parroquia: prev.parroquia || data.parroquia || '',
                  sector: (prev.sector) ? prev.sector : '',
                  cod_catastral: updatedCod
                };
              });
            }
          }
        }
        // 3. Detección espacial de Punto de Referencia SQL Server dentro del predio
        try {
          const matchRes = await fetch(`${API_URL}/api/gis/match-referencia-espacial`, {
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
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            if (matchData && matchData.encontrado && matchData.referencia) {
              setSqlRefDetected(matchData.referencia);
            } else {
              setSqlRefDetected(null);
            }
          }
        } catch (matchErr) {
          console.warn('Error verificando referencia SQL espacial:', matchErr);
        }
      } catch (err) {
        console.warn('Error en detección espacial de ubicación:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.geom_geojson]);

  const applySqlReference = (ref, targetMode = '19') => {
    if (!ref) return;
    const sqlCod = String(ref.cod_catastral || '').trim();
    
    let codToApply = sqlCod;
    if (targetMode === '14') {
      codToApply = convert19to14(sqlCod);
      setCodigoMode('14');
    } else {
      setCodigoMode(sqlCod.length === 19 ? '19' : '14');
    }

    // Nombre de parroquia según la clave SQL adoptada
    let nomParr = '';
    const sqlParrNum = sqlCod.substring(4, 6);
    if (sqlParrNum === '50') nomParr = 'CATARAMA';
    else if (sqlParrNum === '51') nomParr = 'RICAURTE';
    else if (sqlParrNum === '52') nomParr = 'PIJULLO';

    setFormData(prev => ({
      ...prev,
      cod_catastral: codToApply || prev.cod_catastral,
      parroquia: nomParr || prev.parroquia || '',
      sector: ref.sitio || prev.sector || ''
    }));

    if (ref.id_titular) setCedula(ref.id_titular);
    if (ref.propietario) setNombrePosesionario(ref.propietario);
    if (isEditing) setAllowEditCodigo(true);
  };


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
          setCedula(data.cedula_posesionario);
        }
        if (data.nombre_posesionario) {
          setNombrePosesionario(data.nombre_posesionario);
        }
        if (data.posesionario_id) {
          setFormData(prev => ({ ...prev, posesionario_id: data.posesionario_id }));
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

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        setFormData(prev => ({ ...prev, geom_geojson: text }));
        setInputMode('table');
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!rows || rows.length === 0) {
            alert('El archivo Excel no contiene filas con datos.');
            return;
          }

          // Analizar dinámicamente las columnas disponibles
          const firstRow = rows[0];
          let codCol = null;
          let vertCol = null;
          let xCol = null;
          let yCol = null;
          let colindCol = null;

          Object.keys(firstRow).forEach(key => {
            const k = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (k.includes('cod') || k.includes('clave') || k === 'predio') codCol = key;
            else if (k.includes('vert') || k.includes('pto') || k === 'punto' || k === 'n°' || k === 'no' || k === 'n') vertCol = key;
            else if (k.includes('este') || k === 'x' || k.includes('coord x') || k.includes('coordenada x')) xCol = key;
            else if (k.includes('norte') || k === 'y' || k.includes('coord y') || k.includes('coordenada y')) yCol = key;
            else if (k.includes('colind') || k.includes('lindero')) colindCol = key;
          });

          // Si no se detectaron por nombre, buscar por posición
          const keys = Object.keys(firstRow);
          if (!xCol || !yCol) {
            if (keys.length >= 4) {
              codCol = keys[0];
              vertCol = keys[1];
              xCol = keys[2];
              yCol = keys[3];
              if (keys.length >= 5) colindCol = keys[4];
            } else if (keys.length >= 2) {
              xCol = keys[0];
              yCol = keys[1];
            }
          }

          const parsedPoints = [];
          const detectedCodes = new Set();

          rows.forEach((row, idx) => {
            const rawX = xCol ? row[xCol] : null;
            const rawY = yCol ? row[yCol] : null;
            if (rawX !== null && rawX !== undefined && rawY !== null && rawY !== undefined) {
              const xNum = parseFloat(String(rawX).replace(',', '.').trim());
              const yNum = parseFloat(String(rawY).replace(',', '.').trim());
              if (!isNaN(xNum) && !isNaN(yNum)) {
                let order = idx + 1;
                if (vertCol && row[vertCol]) {
                  const pNum = parseInt(String(row[vertCol]), 10);
                  if (!isNaN(pNum)) order = pNum;
                }
                const code = codCol && row[codCol] ? String(row[codCol]).trim() : '';
                if (code) detectedCodes.add(code);

                const colind = colindCol && row[colindCol] ? String(row[colindCol]).trim() : '';

                parsedPoints.push({
                  order,
                  x: xNum.toFixed(2),
                  y: yNum.toFixed(2),
                  colind,
                  code
                });
              }
            }
          });

          if (parsedPoints.length === 0) {
            alert('No se pudieron encontrar coordenadas numéricas X e Y válidas en el archivo Excel.');
            return;
          }

          // Si hay múltiples códigos catastrales en el archivo, cargar el primero y avisar
          if (detectedCodes.size > 1) {
            const firstCode = Array.from(detectedCodes)[0];
            const filtered = parsedPoints.filter(p => p.code === firstCode);
            filtered.sort((a, b) => a.order - b.order);
            const textLines = filtered.map(p => `${p.x} ${p.y}`).join('\n');
            setFormData(prev => ({
              ...prev,
              cod_catastral: firstCode || prev.cod_catastral,
              geom_geojson: textLines
            }));
            setColindantes(filtered.map(p => p.colind || ''));
            alert(`ℹ️ Se detectaron ${detectedCodes.size} predios en este archivo. Se cargaron los vértices del primer predio (${firstCode}).\n\nPara importar todos los predios masivamente con sus polígonos, utiliza la opción "Importar Shapefile o Excel Masivo" en el menú de capas.`);
          } else {
            parsedPoints.sort((a, b) => a.order - b.order);
            const textLines = parsedPoints.map(p => `${p.x} ${p.y}`).join('\n');
            const singleCode = Array.from(detectedCodes)[0];
            setFormData(prev => ({
              ...prev,
              cod_catastral: singleCode || prev.cod_catastral,
              geom_geojson: textLines
            }));
            setColindantes(parsedPoints.map(p => p.colind || ''));
          }

          setInputMode('table');
        } catch (err) {
          console.error('Error procesando Excel en PredioForm:', err);
          alert('Hubo un error al leer el archivo Excel.');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = null;
  };

  const handleDownloadTemplate = () => {
    const defaultCod = formData.cod_catastral ? formData.cod_catastral.replace(/\s/g, '') : "1206500101001001001";
    const ws = XLSX.utils.json_to_sheet([
      {
        "Codigo Catastral": defaultCod,
        "Vertice": 1,
        "Coordenada X (Este)": 667633.72,
        "Coordenada Y (Norte)": 9825070.46,
        "Colindantes": "Pedro Castillo"
      },
      {
        "Codigo Catastral": defaultCod,
        "Vertice": 2,
        "Coordenada X (Este)": 668254.63,
        "Coordenada Y (Norte)": 9825240.77,
        "Colindantes": "Pedro Castillo"
      },
      {
        "Codigo Catastral": defaultCod,
        "Vertice": 3,
        "Coordenada X (Este)": 668454.79,
        "Coordenada Y (Norte)": 9824690.40,
        "Colindantes": "Pedro Castillo"
      },
      {
        "Codigo Catastral": defaultCod,
        "Vertice": 4,
        "Coordenada X (Este)": 667738.44,
        "Coordenada Y (Norte)": 9824615.03,
        "Colindantes": "Pedro Castillo"
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Coordenadas");
    XLSX.writeFile(wb, "Plantilla_Coordenadas_Predio.xlsx");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalCod = formData.cod_catastral ? formData.cod_catastral.replace(/\s/g, '') : '';
    if ((!isEditing || allowEditCodigo) && finalCod.length !== 14 && finalCod.length !== 19) {
      alert(`La Clave Catastral debe tener 19 dígitos (formato SQL Server) o 14 dígitos (formato manual). Actualmente tiene ${finalCod.length} dígitos.`);
      return;
    }

    if (finalCod.includes('999999') || finalCod.endsWith('99999999')) {
      alert(`⚠️ Alerta: El predio con clave ${finalCod} contiene una secuencia ficticia no válida. Verifique la clave catastral.`);
      return;
    }

    let finalPosesionarioId = formData.posesionario_id;
    const cleanNombre = (nombrePosesionario || '').trim();
    const cleanCedula = (cedula || '').trim();

    if (!finalPosesionarioId && cleanNombre) {
      try {
        if (!navigator.onLine) throw new Error("offline");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const token = localStorage.getItem('catastro_token');
        const res = await fetch(`${API_URL}/api/gis/posesionarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ cedula: cleanCedula || null, nombre: cleanNombre }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          finalPosesionarioId = data.id;
        }
      } catch (err) {
        finalPosesionarioId = null;
      }
    } else if (finalPosesionarioId && cleanNombre) {
      try {
        const token = localStorage.getItem('catastro_token');
        await fetch(`${API_URL}/api/gis/posesionarios/${finalPosesionarioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ cedula: cleanCedula || null, nombre: cleanNombre })
        });
      } catch (e) {
        console.error("Error actualizando posesionario:", e);
      }
    }

    let parsedGeojson = null;
    let esUtm = false;
    let rawText = '';

    if (formData.geom_geojson) {
      rawText = formData.geom_geojson.trim();

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

    const cleanSector = (formData.sector && formData.sector.trim()) ? formData.sector.trim().toUpperCase() : '';
    const cleanParroquia = (formData.parroquia && formData.parroquia.trim()) ? formData.parroquia.trim().toUpperCase() : '';

    const finalData = {
      ...formData,
      parroquia: cleanParroquia || null,
      sector: cleanSector, // Cadena vacía '' indica al backend borrarlo (SET sector = NULL)
      cod_catastral: finalCod,
      posesionario_id: finalPosesionarioId ? parseInt(finalPosesionarioId, 10) : null,
      cedula_temporal: (!finalPosesionarioId && cleanCedula) ? cleanCedula : undefined,
      nombre_temporal: (!finalPosesionarioId && cleanNombre) ? cleanNombre : undefined,
      nombre_posesionario: cleanNombre || undefined,
      empresa_id: selectedEmpresaId ? parseInt(selectedEmpresaId, 10) : null,
      proyecto_id: activeProyecto ? activeProyecto.id : (selectedProyectoId ? parseInt(selectedProyectoId, 10) : null),
      colindantes: colindantes,
      rumbos: rumbosCustom,
      es_utm: esUtm
    };

    if (parsedGeojson) {
      finalData.geom_geojson = parsedGeojson;
    } else if (isEditing) {
      delete finalData.geom_geojson;
    } else {
      finalData.geom_geojson = { type: 'Polygon', coordinates: [] };
    }

    if (rawText && !parsedGeojson) finalData.geom_text = rawText;

    onSubmit(finalData);
  };


  const nodeRef = useRef(null);

  const isTemp = Boolean(formData.cod_catastral && formData.cod_catastral.includes('TEMP'));
  const getBoxVal = (start, end) => {
    if (isTemp) {
      if (start === 0 && end === 2) return territorialInfo?.cod_provincia || '12';
      if (start === 2 && end === 4) return territorialInfo?.cod_canton || '06';
      if (start === 4 && end === 6) return territorialInfo?.cod_parroquia || '50';
      return '';
    }
    return (formData.cod_catastral || '').substring(start, end).trim();
  };

  const handleBoxChange = (start, end, val, nextId) => {
    const targetLen = codigoMode === '19' ? 19 : 14;
    let curr = formData.cod_catastral ? formData.cod_catastral.padEnd(targetLen, ' ') : ' '.repeat(targetLen);
    // Si era un código temporal (ej: TEMP-de77abf9), sustituir base con los 6 dígitos territoriales
    if (isTemp) {
      const p = territorialInfo?.cod_provincia || '12';
      const c = territorialInfo?.cod_canton || '06';
      const pa = territorialInfo?.cod_parroquia || '50';
      curr = (p + c + pa).padEnd(6, ' ') + ' '.repeat(targetLen - 6);
    }
    const len = end - start;
    let newCod = (curr.substring(0, start) + val.padEnd(len, ' ') + curr.substring(end)).substring(0, targetLen);
    setFormData(prev => ({ ...prev, cod_catastral: newCod }));
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
            <h2 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '20px' }}>{isEditing ? `Editar Predio (ID: ${initialData.id || initialData.predio_id})` : 'Nuevo Predio (Coordenadas)'}</h2>

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
                  <select className="input-dynamic" value={selectedEmpresaId} onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedProyectoId(''); }} required={!isEditing}>
                    <option value="">Seleccione Empresa...</option>
                    {empresasList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              )}
              {!activeProyecto && proyectosList.length > 1 && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Proyecto *</label>
                  <select className="input-dynamic" value={selectedProyectoId} onChange={e => setSelectedProyectoId(e.target.value)} required={!isEditing && Boolean(selectedEmpresaId)} disabled={!selectedEmpresaId}>
                    <option value="">Seleccione Proyecto...</option>
                    {proyectosList.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {sqlRefDetected && (() => {
              const sqlParr = (sqlRefDetected.cod_catastral || '').substring(4, 6);
              const terrParr = sqlRefDetected.parroquia_territorial_cod || territorialInfo?.cod_parroquia;
              const terrNom = sqlRefDetected.parroquia_territorial_nombre || territorialInfo?.parroquia || 'Pijullo';
              const hayDiscrepancia = Boolean(sqlParr && terrParr && sqlParr !== terrParr);

              return (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.08))',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '15px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#b45309' }}>
                        <span>📍 Punto de Referencia SQL Detectado</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', lineHeight: '1.4' }}>
                        <div><b>Código SQL:</b> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{sqlRefDetected.cod_catastral}</span></div>
                        {sqlRefDetected.propietario && <div><b>Propietario:</b> {sqlRefDetected.propietario}</div>}
                        {sqlRefDetected.id_titular && <div><b>Cédula:</b> {sqlRefDetected.id_titular}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                      <button
                        type="button"
                        onClick={() => applySqlReference(sqlRefDetected, '19')}
                        style={{
                          background: '#f59e0b',
                          color: '#ffffff',
                          border: 'none',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 2px 5px rgba(245, 158, 11, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap'
                        }}
                        title="Asignar la clave original completa de SQL Server (19 dígitos) y titular"
                      >
                        ⚡ Adoptar Clave SQL (19d)
                      </button>
                      <button
                        type="button"
                        onClick={() => applySqlReference(sqlRefDetected, '14')}
                        style={{
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: '#1d4ed8',
                          border: '1px solid #3b82f6',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                        title="Adoptar titular y convertir inmediatamente al nuevo estándar de 14 dígitos"
                      >
                        ✨ Adoptar como Nueva Clave (14d)
                      </button>
                    </div>
                  </div>

                  {hayDiscrepancia && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 10px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      color: '#1e40af',
                      lineHeight: '1.4'
                    }}>
                      <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>ℹ️ Opción 2: Parroquia Conservada de SQL</span>
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        La clave SQL original tiene Parroquia <b>{sqlParr} ({sqlParr === '51' ? 'Ricaurte' : sqlParr === '50' ? 'Catarama' : sqlParr})</b>, aunque territorialmente se ubica en <b>{terrNom} ({terrParr})</b>. Según la <b>Opción 2</b>, se conservará la clave con parroquia <b>{sqlParr}</b> para estandarizarla posteriormente.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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
                  Los primeros 6 dígitos de la parroquia ya están asignados. Complete los casilleros de abajo para formalizar la clave catastral definitiva de 14 dígitos.
                </div>
              </div>
            )}

            {isEditing && !allowEditCodigo ? (
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
                    Clave Catastral ({String(formData.cod_catastral || '').replace(/\s/g, '').length === 19 ? '19 dígitos - SQL' : '14 dígitos'})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.cod_catastral) {
                        const cod = String(formData.cod_catastral).trim();
                        if (cod.length === 19) {
                          setCodigoMode('19');
                        } else if (cod.length === 14) {
                          setCodigoMode('14');
                        } else if (cod.includes('TEMP')) {
                          setCodigoMode('14');
                          const p = territorialInfo?.cod_provincia || '12';
                          const c = territorialInfo?.cod_canton || '06';
                          const pa = territorialInfo?.cod_parroquia || '50';
                          setFormData(prev => ({ ...prev, cod_catastral: (p + c + pa).padEnd(14, ' ') }));
                        }
                      }
                      setAllowEditCodigo(true);
                    }}
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#2563eb',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Permite formalizar o reasignar la clave catastral de este predio"
                  >
                    ✏️ Modificar Clave
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.cod_catastral || ''}
                  readOnly
                  disabled
                  className="input-dynamic"
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    cursor: 'not-allowed',
                    opacity: 0.95
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <label style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Clave Catastral ({codigoMode === '19' ? '19 dígitos - SQL' : '14 dígitos - Manual'}) *</span>
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      {codigoMode === '19' ? 'Prov(2)-Cant(2)-Parr(2)-Zona(2)-Sect(2)-Pol(3)-Pred(3)-Div(3)' : 'Prov(2)-Cant(2)-Parr(2)-Zona(1)-Sect(1)-Pol(3)-Pred(3)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-main, #f1f5f9)', borderRadius: '6px', padding: '2px', border: '1px solid var(--card-border, #cbd5e1)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (codigoMode !== '19') {
                            const newCod = convert14to19(formData.cod_catastral);
                            setFormData(prev => ({ ...prev, cod_catastral: newCod }));
                            setCodigoMode('19');
                          }
                        }}
                        style={{
                          background: codigoMode === '19' ? '#f59e0b' : 'transparent',
                          color: codigoMode === '19' ? '#ffffff' : 'var(--text-muted)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: codigoMode === '19' ? 'bold' : 'normal',
                          cursor: 'pointer'
                        }}
                        title="Código completo original de SQL Server (19 dígitos)"
                      >
                        🏛️ SQL (19d)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (codigoMode !== '14') {
                            const newCod = convert19to14(formData.cod_catastral);
                            setFormData(prev => ({ ...prev, cod_catastral: newCod }));
                            setCodigoMode('14');
                          }
                        }}
                        style={{
                          background: codigoMode === '14' ? '#3b82f6' : 'transparent',
                          color: codigoMode === '14' ? '#ffffff' : 'var(--text-muted)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: codigoMode === '14' ? 'bold' : 'normal',
                          cursor: 'pointer'
                        }}
                        title="Nueva clave manual estandarizada (14 dígitos)"
                      >
                        📐 Manual (14d)
                      </button>
                    </div>

                    {isEditing && allowEditCodigo && (
                      <button
                        type="button"
                        onClick={() => setAllowEditCodigo(false)}
                        style={{
                          background: 'rgba(100, 116, 139, 0.1)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--card-border)',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar cambio
                      </button>
                    )}
                  </div>
                </div>

                {codigoMode === '19' ? (
                  <div style={{ display: 'flex', gap: '3px', position: 'relative', width: '100%', overflowX: 'auto', paddingBottom: '5px' }}>
                    <input id="cc19-0" type="text" maxLength="2" placeholder="Pr" title="Provincia (2 dígitos)" className="input-dynamic" style={{ width: '36px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(0, 2)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(0, 2, val, 'cc19-1');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc19-1" type="text" maxLength="2" placeholder="Ca" title="Cantón (2 dígitos)" className="input-dynamic" style={{ width: '36px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(2, 4)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(2, 4, val, 'cc19-2');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc19-2" type="text" maxLength="2" placeholder="Pa" title="Parroquia (2 dígitos)" className="input-dynamic" style={{ width: '36px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(4, 6)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      let currParr = formData.parroquia;
                      if (!currParr) {
                        if (val === '50') currParr = 'CATARAMA';
                        else if (val === '51') currParr = 'RICAURTE';
                        else if (val === '52') currParr = 'PIJULLO';
                      }
                      if (currParr !== formData.parroquia) setFormData(prev => ({ ...prev, parroquia: currParr }));
                      handleBoxChange(4, 6, val, 'cc19-3');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc19-3" type="text" maxLength="2" placeholder="Zo" title="Zona (2 dígitos)" className="input-dynamic" style={{ width: '36px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(6, 8)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(6, 8, val, 'cc19-4');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc19-4" type="text" maxLength="2" placeholder="Se" title="Sector (2 dígitos)" className="input-dynamic" style={{ width: '36px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(8, 10)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(8, 10, val, 'cc19-5');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc19-5" type="text" maxLength="3" placeholder="Pol" title="Polígono (3 dígitos)" className="input-dynamic" style={{ width: '44px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(10, 13)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(10, 13, val, 'cc19-6');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc19-6" type="text" maxLength="3" placeholder="Pre" title="Predio (3 dígitos)" className="input-dynamic" style={{ width: '44px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(13, 16)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(13, 16, val, 'cc19-7');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc19-7" type="text" maxLength="3" placeholder="Div" title="División (3 dígitos)" className="input-dynamic" style={{ width: '44px', padding: '4px 2px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(16, 19)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(16, 19, val, null);
                    }} required />

                    <div style={{ position: 'absolute', right: '-25px', top: '50%', transform: 'translateY(-50%)' }}>
                      {loadingCodigo && <Loader2 size={16} className="spin" color="var(--accent-color)" />}
                      {!loadingCodigo && codigoMsg === 'Registrado' && <Check size={16} color="var(--warning)" />}
                    </div>
                  </div>
                ) : (
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
                    <input id="cc-3" type="text" maxLength="1" placeholder="Zo" title="Zona (1 dígito)" className="input-dynamic" style={{ width: '36px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(6, 7)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(6, 7, val, 'cc-4');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc-4" type="text" maxLength="1" placeholder="Se" title="Sector (1 dígito)" className="input-dynamic" style={{ width: '36px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(7, 8)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(7, 8, val, 'cc-5');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc-5" type="text" maxLength="3" placeholder="Pol" title="Polígono (3 dígitos)" className="input-dynamic" style={{ width: '48px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(8, 11)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(8, 11, val, 'cc-6');
                    }} required />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>-</span>
                    <input id="cc-6" type="text" maxLength="3" placeholder="Pre" title="Predio (3 dígitos)" className="input-dynamic" style={{ width: '48px', padding: '4px', textAlign: 'center', fontSize: '12px' }} value={getBoxVal(11, 14)} onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      handleBoxChange(11, 14, val, null);
                    }} required />

                    <div style={{ position: 'absolute', right: '-25px', top: '50%', transform: 'translateY(-50%)' }}>
                      {loadingCodigo && <Loader2 size={16} className="spin" color="var(--accent-color)" />}
                      {!loadingCodigo && codigoMsg === 'Registrado' && <Check size={16} color="var(--warning)" />}
                    </div>
                  </div>
                )}

                <small style={{ color: codigoMsg === 'Código libre' ? 'var(--success)' : 'var(--text-muted)', marginTop: '5px', display: 'block', minHeight: '15px' }}>
                  {codigoMsg === 'Registrado' ? 'Código existente (asignando posesionario...)' : (
                    formData.cod_catastral.replace(/\s/g, '').length !== (codigoMode === '19' ? 19 : 14) && formData.cod_catastral.length > 0
                      ? `Faltan dígitos (${codigoMode === '19' ? '19' : '14'} obligatorios)`
                      : codigoMsg
                  )}
                </small>

                {(() => {
                  const currentParr = (formData.cod_catastral || '').substring(4, 6);
                  const terrParr = territorialInfo?.cod_parroquia;
                  const terrNom = territorialInfo?.parroquia;
                  if (currentParr && terrParr && currentParr !== terrParr && currentParr !== '  ' && currentParr.length === 2) {
                    return (
                      <div style={{
                        marginTop: '6px',
                        padding: '5px 8px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <span>ℹ️</span>
                        <span><b>Opción 2:</b> Parroquia de la Clave: <b>{currentParr} ({currentParr === '51' ? 'Ricaurte' : currentParr === '50' ? 'Catarama' : currentParr})</b> | Ubicación en mapa: <b>{terrNom || 'Pijullo'} ({terrParr})</b></span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            <div className="predio-form-header">
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
                  Cédula Posesionario <span style={{ fontWeight: 'normal', fontSize: '11px', color: '#94a3b8' }}>(Opcional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={cedula}
                    onChange={e => setCedula(e.target.value)}
                    className="input-dynamic"
                    placeholder="Ej. 1712345678 (opcional)"
                    maxLength={10}
                  />
                  {loadingCedula && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}><Loader2 size={16} className="spin" color="var(--accent-color)" /></div>}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
                  Nombre Posesionario
                </label>
                <input
                  type="text"
                  value={nombrePosesionario || ''}
                  onChange={e => setNombrePosesionario(e.target.value)}
                  className="input-dynamic"
                  placeholder="Nombre y Apellidos del Posesionario..."
                  style={{ opacity: 1 }}
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
                    let curr = formData.cod_catastral ? formData.cod_catastral.padEnd(14, ' ') : '              ';
                    const norm = val.trim().toLowerCase();
                    let parrCode = '';
                    if (norm.includes('catarama')) parrCode = '50';
                    else if (norm.includes('ricaurte')) parrCode = '51';
                    else if (norm.includes('pijullo')) parrCode = '52';

                    let newCod = curr;
                    if (parrCode) {
                      const prefix4 = curr.substring(0, 4).trim().length === 4 ? curr.substring(0, 4) : '1206';
                      newCod = (prefix4 + parrCode + curr.substring(6)).padEnd(14, ' ').substring(0, 14);
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
                  placeholder="Escriba el nombre del sector..."
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
                  {onEditOnMap && (
                    <button
                      type="button"
                      onClick={() => onEditOnMap(formData.geom_geojson)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 6px rgba(59, 130, 246, 0.35)' }}
                      title="Mover y ajustar los puntos del predio directamente sobre el mapa"
                    >
                      <MousePointer2 size={15} /> Editar puntos en el mapa
                    </button>
                  )}
                  {onStartDrawing && (
                    <button
                      type="button"
                      onClick={onStartDrawing}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--primary-glow)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      <MousePointer2 size={16} /> Volver a dibujar
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
                                  <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        title="Mover vértice hacia arriba"
                                        disabled={index === 0}
                                        onClick={() => {
                                          if (index === 0) return;
                                          const newLines = [...lines];
                                          const tempL = newLines[index];
                                          newLines[index] = newLines[index - 1];
                                          newLines[index - 1] = tempL;
                                          setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                          const newCols = [...colindantes];
                                          const tempC = newCols[index];
                                          newCols[index] = newCols[index - 1];
                                          newCols[index - 1] = tempC;
                                          setColindantes(newCols);
                                        }}
                                        style={{
                                          background: 'var(--bg-main, #f8fafc)',
                                          border: '1px solid var(--card-border, #cbd5e1)',
                                          borderRadius: '4px',
                                          color: index === 0 ? 'var(--text-muted, #94a3b8)' : 'var(--text-main, #334155)',
                                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                                          padding: '2px 6px',
                                          fontSize: '11px',
                                          opacity: index === 0 ? 0.35 : 1
                                        }}
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        title="Mover vértice hacia abajo"
                                        disabled={index === lines.length - 1}
                                        onClick={() => {
                                          if (index === lines.length - 1) return;
                                          const newLines = [...lines];
                                          const tempL = newLines[index];
                                          newLines[index] = newLines[index + 1];
                                          newLines[index + 1] = tempL;
                                          setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                          const newCols = [...colindantes];
                                          const tempC = newCols[index];
                                          newCols[index] = newCols[index + 1];
                                          newCols[index + 1] = tempC;
                                          setColindantes(newCols);
                                        }}
                                        style={{
                                          background: 'var(--bg-main, #f8fafc)',
                                          border: '1px solid var(--card-border, #cbd5e1)',
                                          borderRadius: '4px',
                                          color: index === lines.length - 1 ? 'var(--text-muted, #94a3b8)' : 'var(--text-main, #334155)',
                                          cursor: index === lines.length - 1 ? 'not-allowed' : 'pointer',
                                          padding: '2px 6px',
                                          fontSize: '11px',
                                          opacity: index === lines.length - 1 ? 0.35 : 1
                                        }}
                                      >
                                        ▼
                                      </button>
                                      <button
                                        type="button"
                                        title="Eliminar vértice"
                                        onClick={() => {
                                          const newLines = [...lines];
                                          newLines.splice(index, 1);
                                          setFormData({ ...formData, geom_geojson: newLines.join('\n') });
                                          const newCols = [...colindantes];
                                          newCols.splice(index, 1);
                                          setColindantes(newCols);
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                                      >
                                        <X size={15} />
                                      </button>
                                    </div>
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
                    {onEditOnMap && (
                      <button
                        type="button"
                        onClick={() => onEditOnMap(formData.geom_geojson)}
                        className="btn-add-vertex"
                        style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', borderColor: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: '600' }}
                        title="Ajustar y arrastrar los vértices interactivamente en el mapa"
                      >
                        <MousePointer2 size={14} /> Editar puntos en el mapa
                      </button>
                    )}
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
