const fs = require('fs');
const path = require('path');

const movilDir = 'C:\\LNCZ\\proyecto-catastro-2026\\movil';
console.log('--- Aplicando Algoritmo Inteligente P01 (NW) y Pestaña de Predios Dibujados ---');

// 1. ACTUALIZAR movil/src/utils/geoUtils.js
const geoUtilsPath = path.join(movilDir, 'src', 'utils', 'geoUtils.js');
if (fs.existsSync(geoUtilsPath)) {
  let content = fs.readFileSync(geoUtilsPath, 'utf8');

  if (!content.includes('normalizeVerticesClockwiseFromNW')) {
    const nwFunction = `
/**
 * Normaliza cualquier polígono para que:
 * 1. P01 sea estrictamente el vértice Nor-Oeste (NW) - "el que esté más al norte de izquierda a derecha".
 * 2. La secuencia de vértices (P01, P02, P03... Pn) recorra en SENTIDO HORARIO (Clockwise).
 */
export function normalizeVerticesClockwiseFromNW(vertices) {
  if (!vertices || vertices.length < 3) return vertices || [];

  const n = vertices.length;
  const pts = vertices.map((v, i) => {
    const x = v.x ?? (Array.isArray(v) ? v[0] : 0);
    const y = v.y ?? (Array.isArray(v) ? v[1] : 0);
    return { ...v, x: Number(x) || 0, y: Number(y) || 0 };
  });

  // 1. Cálculo de área con signo (Shoelace)
  // SignedArea < 0: Sentido Horario (CW). SignedArea > 0: Antihorario (CCW).
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    signedArea += (p1.x * p2.y - p2.x * p1.y);
  }
  signedArea *= 0.5;

  let ordered = [...pts];
  if (signedArea > 0) {
    ordered.reverse();
  }

  // 2. Bounding box planar
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = ordered[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  // 3. Selección del punto Nor-Oeste (NW): maximiza normY - normX
  let nwIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = ordered[i];
    const normX = (x - minX) / spanX;
    const normY = (y - minY) / spanY;
    const score = normY - normX;
    if (score > bestScore + 1e-4) {
      bestScore = score;
      nwIdx = i;
    } else if (Math.abs(score - bestScore) <= 1e-4) {
      const best = ordered[nwIdx];
      if (y > best.y || (Math.abs(y - best.y) <= 1e-4 && x < best.x)) {
        nwIdx = i;
      }
    }
  }

  // 4. Rotar para que P01 sea el vértice Nor-Oeste y enumerar P01, P02...
  const rotated = [];
  for (let i = 0; i < n; i++) {
    const idx = (nwIdx + i) % n;
    const item = { ...ordered[idx] };
    const pCode = 'P' + String(i + 1).padStart(2, '0');
    item.orden = i + 1;
    item.codigo = pCode;
    rotated.push(item);
  }

  return rotated;
}
`;
    content += nwFunction;
    fs.writeFileSync(geoUtilsPath, content, 'utf8');
    console.log('✅ geoUtils.js: Añadida función normalizeVerticesClockwiseFromNW.');
  }
}

// 2. ACTUALIZAR DrawingToolbarMobile.jsx para usar normalizeVerticesClockwiseFromNW
const drawingToolbarPath = path.join(movilDir, 'src', 'components', 'DrawingToolbarMobile.jsx');
if (fs.existsSync(drawingToolbarPath)) {
  let content = fs.readFileSync(drawingToolbarPath, 'utf8');

  // Asegurar import
  if (!content.includes('normalizeVerticesClockwiseFromNW')) {
    content = content.replace(
      "import { wgs84ToUtm, computePolygonArea, computePerimeter } from '../utils/geoUtils';",
      "import { wgs84ToUtm, computePolygonArea, computePerimeter, normalizeVerticesClockwiseFromNW } from '../utils/geoUtils';"
    );
  }

  // En handleFinishWalking: normalizar antes de pasar a la ficha
  content = content.replace(
    /const area = computePolygonArea\(perimeterVertices\);[\s\S]*?tipo_levantamiento:\s*'GPS_CAMINATA'\s*\};/,
    `const normalized = normalizeVerticesClockwiseFromNW(perimeterVertices);
    const area = computePolygonArea(normalized);
    const perimetro = computePerimeter(normalized);

    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const autoCode = \`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`;

    setFormPreloadData({
      codigo: autoCode,
      vertices: normalized,
      area: Math.round(area * 100) / 100,
      perimetro: Math.round(perimetro * 100) / 100,
      tipo_levantamiento: 'GPS_CAMINATA'
    });`
  );

  // En handleFinishManualDrawing: normalizar antes de pasar a la ficha
  content = content.replace(
    /const area = computePolygonArea\(manualVertices\);[\s\S]*?tipo_levantamiento:\s*'DIBUJO_PANTALLA'\s*\};/,
    `const normalized = normalizeVerticesClockwiseFromNW(manualVertices);
    const area = computePolygonArea(normalized);
    const perimetro = computePerimeter(normalized);

    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const autoCode = \`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`;

    setFormPreloadData({
      codigo: autoCode,
      vertices: normalized,
      area: Math.round(area * 100) / 100,
      perimetro: Math.round(perimetro * 100) / 100,
      tipo_levantamiento: 'DIBUJO_PANTALLA'
    });`
  );

  // En handleOpenCoordinatesAndColindantesModal: normalizar vertices manuales
  content = content.replace(
    /if \(formValues\) \{[\s\S]*?tipo_levantamiento:\s*'MANUAL_COORDENADAS'\s*\}\);/,
    `if (formValues) {
      const normalized = normalizeVerticesClockwiseFromNW(formValues.vertices);
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const autoCode = \`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`;

      let area = 0;
      let perimetro = 0;
      if (normalized.length >= 3) {
        area = Math.round(computePolygonArea(normalized) * 100) / 100;
        perimetro = Math.round(computePerimeter(normalized) * 100) / 100;
      }

      setFormPreloadData({
        codigo: autoCode,
        norte: formValues.norte,
        sur: formValues.sur,
        este: formValues.este,
        oeste: formValues.oeste,
        vertices: normalized,
        area: area,
        perimetro: perimetro,
        tipo_levantamiento: 'MANUAL_COORDENADAS'
      });`
  );

  fs.writeFileSync(drawingToolbarPath, content, 'utf8');
  console.log('✅ DrawingToolbarMobile.jsx: Normalización P01 (NW) integrada en levantamientos.');
}

// 3. ACTUALIZAR BottomNavBar.jsx (Renombrar "Nuevo" a "Predios")
const navBarPath = path.join(movilDir, 'src', 'components', 'BottomNavBar.jsx');
if (fs.existsSync(navBarPath)) {
  let content = fs.readFileSync(navBarPath, 'utf8');
  content = content.replace("{ id: 'form', label: 'Nuevo'", "{ id: 'form', label: 'Predios'");
  fs.writeFileSync(navBarPath, content, 'utf8');
  console.log('✅ BottomNavBar.jsx: Pestaña 2 actualizada a "Predios".');
}

// 4. ACTUALIZAR PredioFormMobile.jsx (Vista Lista de Predios Dibujados + Eliminar Fotos)
const predioFormPath = path.join(movilDir, 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
if (fs.existsSync(predioFormPath)) {
  const newPredioFormCode = `import React, { useState, useEffect } from 'react';
import { useMobile } from '../../context/MobileContext';
import { getOfflinePredios, saveOfflinePredio, deleteOfflinePredio } from '../../services/mobileDB';
import { uploadSinglePredio, searchPosesionarioByCedula, searchPosesionariosByName } from '../../services/api';
import { wgs84ToUtm, computePolygonArea, computePerimeter, normalizeVerticesClockwiseFromNW } from '../../utils/geoUtils';
import { 
  Edit2, 
  Compass, 
  X, 
  Eye, 
  Save, 
  CloudUpload, 
  MapPin, 
  Plus, 
  Trash2, 
  User, 
  Info,
  FolderGit2,
  Building2,
  List,
  Map,
  ArrowLeft,
  FileText,
  Clock
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function PredioFormMobile() {
  const { 
    gps, 
    getLatestGps, 
    formPreloadData, 
    setFormPreloadData, 
    refreshOfflineCount, 
    setActiveTab, 
    setSelectedPredio,
    isOnline,
    auth, 
    permissions 
  } = useMobile();

  // Control de Vista: 'list' (Listado de predios dibujados) o 'form' (Ficha / Edición de predio)
  const [viewMode, setViewMode] = useState('list');
  const [localPredios, setLocalPredios] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Estados del Formulario
  const [offlineId, setOfflineId] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [propietario, setPropietario] = useState('');
  const [cedula, setCedula] = useState('');
  const [telefono, setTelefono] = useState('');
  const [norte, setNorte] = useState('');
  const [sur, setSur] = useState('');
  const [este, setEste] = useState('');
  const [oeste, setOeste] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [vertices, setVertices] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchingCedula, setSearchingCedula] = useState(false);
  const [posesionarioFound, setPosesionarioFound] = useState(null);
  const [nameSuggestions, setNameSuggestions] = useState([]);

  // Cargar lista de predios dibujados en el móvil
  const loadLocalPredios = async () => {
    setLoadingList(true);
    try {
      const list = await getOfflinePredios();
      setLocalPredios(list || []);
    } catch (e) {
      console.warn('Error cargando predios locales:', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadLocalPredios();
  }, [viewMode]);

  // Si se envió un predio desde el mapa o modo de dibujo, abrir directamente en vista 'form'
  useEffect(() => {
    if (formPreloadData) {
      const readOnlyRequested = !!formPreloadData.isReadOnly || (formPreloadData.isServer && permissions?.isBrigadista);
      setIsReadOnly(readOnlyRequested);
      if (formPreloadData.offline_id) setOfflineId(formPreloadData.offline_id);
      if (formPreloadData.codigo) setCodigo(formPreloadData.codigo);
      if (formPreloadData.propietario) setPropietario(formPreloadData.propietario);
      if (formPreloadData.cedula) setCedula(formPreloadData.cedula);
      if (formPreloadData.telefono) setTelefono(formPreloadData.telefono);
      if (formPreloadData.norte) setNorte(formPreloadData.norte);
      if (formPreloadData.sur) setSur(formPreloadData.sur);
      if (formPreloadData.este) setEste(formPreloadData.este);
      if (formPreloadData.oeste) setOeste(formPreloadData.oeste);
      if (formPreloadData.observaciones) setObservaciones(formPreloadData.observaciones);
      if (formPreloadData.vertices && Array.isArray(formPreloadData.vertices)) {
        setVertices(normalizeVerticesClockwiseFromNW(formPreloadData.vertices));
      }
      setFormPreloadData(null);
      setViewMode('form');
    }
  }, [formPreloadData, setFormPreloadData, permissions]);

  // Abrir predio existente desde el listado para editar
  const handleEditFromList = (p) => {
    setOfflineId(p.offline_id || null);
    setIsReadOnly(false);
    setCodigo(p.codigo || '');
    setPropietario(p.propietario || '');
    setCedula(p.cedula || '');
    setTelefono(p.telefono || '');
    setNorte(p.norte || '');
    setSur(p.sur || '');
    setEste(p.este || '');
    setOeste(p.oeste || '');
    setObservaciones(p.observaciones || '');
    if (Array.isArray(p.vertices)) {
      setVertices(normalizeVerticesClockwiseFromNW(p.vertices));
    } else {
      setVertices([]);
    }
    setViewMode('form');
  };

  // Crear nuevo predio en blanco desde el listado
  const handleCreateNew = () => {
    setOfflineId(null);
    setIsReadOnly(false);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    setCodigo(\`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`);
    setPropietario('');
    setCedula('');
    setTelefono('');
    setNorte('');
    setSur('');
    setEste('');
    setOeste('');
    setObservaciones('');
    setVertices([]);
    setViewMode('form');
  };

  // Ver predio dibujado en el mapa
  const handleViewOnMap = (p) => {
    setSelectedPredio(p);
    setActiveTab('map');
  };

  // Eliminar predio local desde el listado
  const handleDeleteFromList = async (p) => {
    const res = await Swal.fire({
      title: '¿Eliminar Predio Local?',
      text: \`Se eliminará el predio \${p.codigo || 'seleccionado'} del teléfono.\`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      background: '#ffffff',
      color: '#0f172a'
    });

    if (res.isConfirmed) {
      await deleteOfflinePredio(p.offline_id);
      await refreshOfflineCount();
      await loadLocalPredios();
    }
  };

  // Búsqueda automática de posesionario por cédula
  const handleCedulaChange = async (val) => {
    setCedula(val);
    const clean = val.trim();
    if (clean.length >= 10) {
      setSearchingCedula(true);
      try {
        const found = await searchPosesionarioByCedula(clean);
        if (found && found.nombre) {
          setPropietario(found.nombre);
          setPosesionarioFound(found);
        } else {
          setPosesionarioFound(null);
        }
      } catch (e) {
        console.warn('Error buscando posesionario:', e);
      } finally {
        setSearchingCedula(false);
      }
    } else {
      setPosesionarioFound(null);
    }
  };

  // Sugerencias por nombre
  const handleNombreChange = async (val) => {
    setPropietario(val);
    if (val.trim().length >= 2) {
      const suggestions = await searchPosesionariosByName(val);
      setNameSuggestions(suggestions);
    } else {
      setNameSuggestions([]);
    }
  };

  const handleSelectSuggestion = (pos) => {
    if (pos.nombre) setPropietario(pos.nombre);
    if (pos.cedula) setCedula(pos.cedula);
    setPosesionarioFound(pos);
    setNameSuggestions([]);
  };

  // Cancelar edición y volver al listado
  const handleCancelEdit = async () => {
    const hasData = codigo || propietario || cedula || vertices.length > 0;
    if (hasData && !isReadOnly) {
      const result = await Swal.fire({
        title: '¿Salir al Listado?',
        text: 'Se descartarán los cambios no guardados en este predio.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Salir',
        cancelButtonText: 'Continuar Editando',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        background: '#ffffff',
        color: '#0f172a'
      });
      if (!result.isConfirmed) return;
    }
    setViewMode('list');
  };

  // Cálculo de orientación geográfica y distancia por tramo
  const getSegmentOrientation = (p1, p2) => {
    const x1 = p1.x ?? (Array.isArray(p1) ? p1[0] : 0);
    const y1 = p1.y ?? (Array.isArray(p1) ? p1[1] : 0);
    const x2 = p2.x ?? (Array.isArray(p2) ? p2[0] : 0);
    const y2 = p2.y ?? (Array.isArray(p2) ? p2[1] : 0);
    const dx = x2 - x1;
    const dy = y2 - y1;
    let angleDeg = Math.atan2(dx, dy) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;
    if (angleDeg >= 315 || angleDeg < 45) return 'Norte';
    if (angleDeg >= 45 && angleDeg < 135) return 'Este';
    if (angleDeg >= 135 && angleDeg < 225) return 'Sur';
    return 'Oeste';
  };

  const getSegmentDistance = (p1, p2) => {
    const x1 = p1.x ?? (Array.isArray(p1) ? p1[0] : 0);
    const y1 = p1.y ?? (Array.isArray(p1) ? p1[1] : 0);
    const x2 = p2.x ?? (Array.isArray(p2) ? p2[0] : 0);
    const y2 = p2.y ?? (Array.isArray(p2) ? p2[1] : 0);
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy).toFixed(2);
  };

  const handleColindanteChange = (index, val) => {
    setVertices(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], colindante: val };
      return copy;
    });
  };

  // Sintetizar automáticamente Norte, Sur, Este y Oeste según tramos en sentido horario
  useEffect(() => {
    if (vertices.length >= 3) {
      const colMap = { Norte: [], Sur: [], Este: [], Oeste: [] };
      for (let i = 0; i < vertices.length; i++) {
        const nextIdx = (i + 1) % vertices.length;
        const p1 = vertices[i];
        const p2 = vertices[nextIdx];
        const dir = getSegmentOrientation(p1, p2);
        const dist = getSegmentDistance(p1, p2);
        const col = (p1.colindante || '').trim();
        if (col) {
          colMap[dir].push(\`\${col} (\${dist}m)\`);
        }
      }
      if (colMap.Norte.length > 0) setNorte(colMap.Norte.join('; '));
      if (colMap.Sur.length > 0) setSur(colMap.Sur.join('; '));
      if (colMap.Este.length > 0) setEste(colMap.Este.join('; '));
      if (colMap.Oeste.length > 0) setOeste(colMap.Oeste.join('; '));
    }
  }, [vertices]);

  const handleAddGPSVertex = () => {
    const currentGps = getLatestGps ? getLatestGps() : gps;
    if (!currentGps.hasFix) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin GPS',
        text: 'Esperando señal de satélite con precisión.',
        confirmButtonColor: '#0284c7',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }

    const utm = wgs84ToUtm(currentGps.lng, currentGps.lat);
    const newV = {
      x: utm.x,
      y: utm.y,
      lat: currentGps.lat,
      lng: currentGps.lng,
      orden: vertices.length + 1,
      accuracy: currentGps.accuracy
    };
    const updated = [...vertices, newV];
    setVertices(updated.length >= 3 ? normalizeVerticesClockwiseFromNW(updated) : updated);
  };

  const handleEditVertex = async (index) => {
    const v = vertices[index];
    const currentX = (v.x ?? (Array.isArray(v) ? v[0] : 0)).toFixed(2);
    const currentY = (v.y ?? (Array.isArray(v) ? v[1] : 0)).toFixed(2);
    const pCode = 'P' + String(index + 1).padStart(2, '0');

    const { value: formValues } = await Swal.fire({
      title: \`Editar Punto \${pCode}\`,
      html: \`
        <div style="display:flex; flex-direction:column; gap:12px; text-align:left; padding:6px 0;">
          <div>
            <label style="font-size:12px; color:#475569; font-weight:600;">Coordenada Este (X) - UTM 17S:</label>
            <input id="swal-edit-x" class="swal2-input" type="number" step="0.01" value="\${currentX}" style="width:100%; margin:4px 0 0 0; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; height:42px; font-size:14px; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; color:#475569; font-weight:600;">Coordenada Norte (Y) - UTM 17S:</label>
            <input id="swal-edit-y" class="swal2-input" type="number" step="0.01" value="\${currentY}" style="width:100%; margin:4px 0 0 0; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; height:42px; font-size:14px; box-sizing:border-box;">
          </div>
        </div>
      \`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar Cambios',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      background: '#ffffff',
      color: '#0f172a',
      preConfirm: () => {
        const x = parseFloat(document.getElementById('swal-edit-x').value);
        const y = parseFloat(document.getElementById('swal-edit-y').value);
        if (isNaN(x) || isNaN(y)) {
          Swal.showValidationMessage('Ingresa números válidos para Este y Norte');
          return false;
        }
        return { x, y };
      }
    });

    if (formValues) {
      setVertices(prev => {
        const copy = [...prev];
        copy[index] = { ...copy[index], x: formValues.x, y: formValues.y };
        return copy.length >= 3 ? normalizeVerticesClockwiseFromNW(copy) : copy;
      });
    }
  };

  const handleAddManualVertex = async () => {
    const nextCode = 'P' + String(vertices.length + 1).padStart(2, '0');
    const { value: formValues } = await Swal.fire({
      title: \`Nuevo Punto \${nextCode}\`,
      html: \`
        <div style="display:flex; flex-direction:column; gap:12px; text-align:left; padding:6px 0;">
          <div>
            <label style="font-size:12px; color:#475569; font-weight:600;">Coordenada Este (X) - UTM 17S:</label>
            <input id="swal-new-x" class="swal2-input" type="number" step="0.01" placeholder="Ej: 623282.10" style="width:100%; margin:4px 0 0 0; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; height:42px; font-size:14px; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; color:#475569; font-weight:600;">Coordenada Norte (Y) - UTM 17S:</label>
            <input id="swal-new-y" class="swal2-input" type="number" step="0.01" placeholder="Ej: 9765499.63" style="width:100%; margin:4px 0 0 0; background:#ffffff; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; height:42px; font-size:14px; box-sizing:border-box;">
          </div>
        </div>
      \`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Agregar Coordenada',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      background: '#ffffff',
      color: '#0f172a',
      preConfirm: () => {
        const x = parseFloat(document.getElementById('swal-new-x').value);
        const y = parseFloat(document.getElementById('swal-new-y').value);
        if (isNaN(x) || isNaN(y)) {
          Swal.showValidationMessage('Ingresa números válidos para Este y Norte');
          return false;
        }
        return { x, y };
      }
    });

    if (formValues) {
      const newV = {
        x: formValues.x,
        y: formValues.y,
        orden: vertices.length + 1,
        accuracy: null
      };
      const updated = [...vertices, newV];
      setVertices(updated.length >= 3 ? normalizeVerticesClockwiseFromNW(updated) : updated);
    }
  };

  const handleRemoveVertex = (index) => {
    setVertices(prev => {
      const copy = prev.filter((_, i) => i !== index);
      return copy.length >= 3 ? normalizeVerticesClockwiseFromNW(copy) : copy;
    });
  };

  const areaCalc = computePolygonArea(vertices);
  const perimCalc = computePerimeter(vertices);

  // Guardar Localmente en Teléfono (Offline)
  const handleSaveOffline = async () => {
    if (!codigo.trim() && !propietario.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Ingresa al menos la Clave Catastral o el Nombre del Propietario/Posesionario.',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }

    if (vertices.length < 3) {
      Swal.fire({
        icon: 'warning',
        title: 'Polígono Incompleto',
        text: 'Se requieren al menos 3 puntos para delimitar el predio.',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }

    setIsSaving(true);
    const sortedVertices = normalizeVerticesClockwiseFromNW(vertices);
    const predioData = {
      offline_id: offlineId,
      codigo: codigo.trim() || \`PREDIO-\${Date.now()}\`,
      propietario: propietario.trim(),
      cedula: cedula.trim(),
      telefono: telefono.trim(),
      area: Math.round(areaCalc * 100) / 100,
      perimetro: Math.round(perimCalc * 100) / 100,
      norte: norte.trim(),
      sur: sur.trim(),
      este: este.trim(),
      oeste: oeste.trim(),
      observaciones: observaciones.trim(),
      vertices: sortedVertices,
      gps_accuracy: gps.accuracy,
      tipo_levantamiento: 'APP_MOVIL_CAMPO',
      empresa_id: auth.empresaId,
      proyecto_id: auth.activeProyectoId,
      proyecto_nombre: auth.activeProyectoNombre
    };

    try {
      await saveOfflinePredio(predioData);
      await refreshOfflineCount();
      await loadLocalPredios();
      Swal.fire({
        icon: 'success',
        title: '¡Guardado en el Teléfono!',
        text: 'Predio guardado localmente con numeración P01 iniciada al Nor-Oeste.',
        timer: 1800,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
      setViewMode('list');
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error al Guardar',
        text: e.message,
        background: '#ffffff',
        color: '#0f172a'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Guardar y Subir al Servidor
  const handleSaveAndUpload = async () => {
    if (!codigo.trim() && !propietario.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Ingresa al menos la Clave Catastral o el Nombre del Propietario.',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }

    if (vertices.length < 3) {
      Swal.fire({
        icon: 'warning',
        title: 'Geometría Incompleta',
        text: 'Agrega al menos 3 puntos para formar el polígono del predio.',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }

    setIsSaving(true);
    const sortedVertices = normalizeVerticesClockwiseFromNW(vertices);
    const predioData = {
      offline_id: offlineId,
      codigo: codigo.trim() || \`PREDIO-\${Date.now()}\`,
      propietario: propietario.trim(),
      cedula: cedula.trim(),
      telefono: telefono.trim(),
      area: Math.round(areaCalc * 100) / 100,
      perimetro: Math.round(perimCalc * 100) / 100,
      norte: norte.trim(),
      sur: sur.trim(),
      este: este.trim(),
      oeste: oeste.trim(),
      observaciones: observaciones.trim(),
      vertices: sortedVertices,
      gps_accuracy: gps.accuracy,
      tipo_levantamiento: 'APP_MOVIL_CAMPO',
      empresa_id: auth.empresaId,
      proyecto_id: auth.activeProyectoId,
      proyecto_nombre: auth.activeProyectoNombre
    };

    try {
      const uploadRes = await uploadSinglePredio(predioData, auth);
      if (uploadRes.success) {
        if (offlineId) {
          await deleteOfflinePredio(offlineId);
        }
        await refreshOfflineCount();
        await loadLocalPredios();
        Swal.fire({
          icon: 'success',
          title: '¡Subido con Éxito!',
          text: \`El predio quedó registrado en el servidor en el proyecto \${auth.activeProyectoNombre}.\`,
          confirmButtonColor: '#10b981',
          background: '#ffffff',
          color: '#0f172a'
        });
        setViewMode('list');
      } else {
        predioData.sync_status = 'pending';
        predioData.sync_error = uploadRes.error;
        await saveOfflinePredio(predioData);
        await refreshOfflineCount();
        await loadLocalPredios();
        Swal.fire({
          icon: 'warning',
          title: 'Guardado Offline',
          text: \`Servidor no disponible (\${uploadRes.error}). Guardado localmente listo para sincronizar.\`,
          confirmButtonColor: '#f59e0b',
          background: '#ffffff',
          color: '#0f172a'
        });
        setViewMode('list');
      }
    } catch (err) {
      predioData.sync_status = 'pending';
      await saveOfflinePredio(predioData);
      await refreshOfflineCount();
      await loadLocalPredios();
      Swal.fire({
        icon: 'warning',
        title: 'Respaldado en Teléfono',
        text: 'Guardado en tu teléfono listo para sincronizar cuando haya internet.',
        confirmButtonColor: '#f59e0b',
        background: '#ffffff',
        color: '#0f172a'
      });
      setViewMode('list');
    } finally {
      setIsSaving(false);
    }
  };

  // ==============================================================
  // VISTA 1: LISTADO DE PREDIOS DIBUJADOS EN CAMPO
  // ==============================================================
  if (viewMode === 'list') {
    return (
      <div className="tab-scroll-container">
        {/* Encabezado y Acción Principal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={20} color="#0284c7" /> Predios en Memoria
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              {localPredios.length === 0 ? 'Sin levantamientos locales' : \`\${localPredios.length} predio(s) levantados en el teléfono\`}
            </p>
          </div>

          <button 
            type="button" 
            className="btn-primary-mobile"
            style={{ minHeight: '44px', height: '44px', fontSize: '13px', padding: '0 14px', flex: '0 0 auto' }}
            onClick={handleCreateNew}
          >
            <Plus size={18} /> + Nuevo Predio
          </button>
        </div>

        {/* Lista de Predios */}
        {loadingList ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
            Cargando predios locales...
          </div>
        ) : localPredios.length === 0 ? (
          <div style={{
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '16px',
            padding: '36px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            marginTop: '10px'
          }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              🗺️
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              No tienes predios dibujados aún
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, maxWidth: '280px', lineHeight: '1.4' }}>
              Puedes dibujar un polígono en la pestaña <b>Mapa</b> o presionar <b>+ Nuevo Predio</b> para ingresar coordenadas.
            </p>
            <button 
              type="button" 
              className="btn-primary-mobile"
              style={{ minHeight: '46px', width: '100%', maxWidth: '240px', marginTop: '6px' }}
              onClick={handleCreateNew}
            >
              <Plus size={18} /> + Levantar Primer Predio
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {localPredios.map((p) => {
              const numVerts = Array.isArray(p.vertices) ? p.vertices.length : 0;
              const areaM2 = Number(p.area) || 0;
              const isSynced = p.sync_status === 'synced';

              return (
                <div 
                  key={p.offline_id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '14px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="mono" style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7' }}>
                          {p.codigo || 'Sin Clave'}
                        </span>
                        <span className="pill-badge" style={{ fontSize: '10px', padding: '2px 6px', background: isSynced ? '#ecfdf5' : '#fffbeb', borderColor: isSynced ? '#a7f3d0' : '#fde68a', color: isSynced ? '#059669' : '#d97706' }}>
                          {isSynced ? '✅ Subido' : '⏳ Local'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>
                        👤 {p.propietario || 'Sin Propietario'} {p.cedula ? \`(\${p.cedula})\` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Resumen Métrico */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: '#f8fafc', padding: '8px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Área:</span>
                      <div className="mono" style={{ fontWeight: '800', color: '#10b981' }}>{areaM2.toFixed(1)} m²</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Perímetro:</span>
                      <div className="mono" style={{ fontWeight: '800', color: '#f59e0b' }}>{(Number(p.perimetro) || 0).toFixed(1)} m</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Puntos:</span>
                      <div className="mono" style={{ fontWeight: '800', color: '#0284c7' }}>{numVerts > 0 ? \`\${numVerts} (P01..)\` : '0 pts'}</div>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button" 
                      className="btn-secondary-mobile"
                      style={{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1, color: '#0284c7', borderColor: '#bae6fd' }}
                      onClick={() => handleEditFromList(p)}
                    >
                      <Edit2 size={14} /> Editar Datos
                    </button>

                    <button 
                      type="button" 
                      className="btn-secondary-mobile"
                      style={{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1 }}
                      onClick={() => handleViewOnMap(p)}
                    >
                      <Map size={14} /> Ver en Mapa
                    </button>

                    <button 
                      type="button" 
                      style={{ width: '38px', height: '38px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => handleDeleteFromList(p)}
                      title="Eliminar Predio"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==============================================================
  // VISTA 2: FORMULARIO Y EDICIÓN DEL PREDIO
  // ==============================================================
  return (
    <div className="tab-scroll-container">
      {/* Botón Superior para Regresar al Listado de Predios */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <button 
          type="button" 
          onClick={handleCancelEdit}
          className="btn-secondary-mobile"
          style={{ height: '38px', minHeight: '38px', fontSize: '12px', padding: '0 12px', flex: '0 0 auto', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Mis Predios
        </button>

        <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
          {offlineId ? 'Editando Predio' : 'Nuevo Levantamiento'}
        </span>
      </div>

      {/* BANNER DE ESTADO: EDICIÓN O SOLO LECTURA */}
      {isReadOnly ? (
        <div style={{
          background: '#f0f9ff',
          border: '1.5px solid #0284c7',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={18} color="#0284c7" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                Ficha Oficial (Modo Solo Lectura)
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Los brigadistas pueden consultar este predio pero no modificarlo
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleCancelEdit}
            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} /> Salir
          </button>
        </div>
      ) : (offlineId || codigo) && (
        <div style={{
          background: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 size={16} color="#d97706" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                Modo Edición: {codigo || 'Predio Local'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Modificando datos y linderos del predio
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleCancelEdit}
            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} /> Cancelar
          </button>
        </div>
      )}

      {/* VINCULACIÓN A PROYECTO ACTIVO */}
      <div style={{
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '12px',
        padding: '10px 14px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderGit2 size={16} color="#0284c7" />
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Proyecto Asignado
            </span>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
              {auth.activeProyectoNombre || 'Proyecto General'}
            </div>
          </div>
        </div>

        {auth.empresaId && (
          <div className="pill-badge" style={{ fontSize: '10px' }}>
            <Building2 size={10} /> Empresa #{auth.empresaId}
          </div>
        )}
      </div>

      {/* 1. CLAVE CATASTRAL / CÓDIGO */}
      <div className="form-card">
        <div className="form-card-title">
          <MapPin size={16} /> Identificación Catastral
        </div>

        <div className="form-group">
          <label className="form-label">Clave Catastral / Código del Predio</label>
          <input 
            type="text" 
            className="form-input mono" 
            placeholder="ej: 1301010101001"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            disabled={isReadOnly}
            required
          />
        </div>
      </div>

      {/* 2. DATOS DEL POSESIONARIO / PROPIETARIO */}
      <div className="form-card">
        <div className="form-card-title">
          <User size={16} /> Posesionario / Propietario
        </div>

        <div className="form-group">
          <label className="form-label">
            Cédula de Identidad {searchingCedula && <span style={{ color: '#0284c7' }}>🔍 Consultando...</span>}
          </label>
          <input 
            type="tel" 
            className="form-input mono" 
            placeholder="ej: 1205567890 (Autocompleta nombre)"
            value={cedula}
            onChange={(e) => handleCedulaChange(e.target.value)}
            disabled={isReadOnly}
            maxLength={13}
          />
          {posesionarioFound && (
            <div style={{ fontSize: '11px', color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px', border: '1px solid #a7f3d0', marginTop: '2px' }}>
              ✓ Posesionario verificado en catálogo central
            </div>
          )}
        </div>

        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label">Nombre y Apellido</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Nombre del posesionario o dueño"
            value={propietario}
            onChange={(e) => handleNombreChange(e.target.value)}
            disabled={isReadOnly}
            autoComplete="off"
          />
          {nameSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
              zIndex: 100,
              maxHeight: '160px',
              overflowY: 'auto'
            }}>
              {nameSuggestions.map((pos, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleSelectSuggestion(pos)}
                  style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '12px', color: '#0f172a' }}
                >
                  <div style={{ fontWeight: 'bold' }}>{pos.nombre}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Cédula: {pos.cedula || 'N/D'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Teléfono / Celular de Contacto</label>
          <input 
            type="tel" 
            className="form-input" 
            placeholder="ej: 0987654321"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* 3. VÉRTICES / PUNTOS (P01, P02...) Y COLINDANTES POR TRAMO */}
      <div className="form-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="form-card-title" style={{ margin: 0 }}>
            <Compass size={16} /> Puntos y Linderos ({vertices.length})
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              type="button" 
              className="btn-primary-mobile" 
              style={{ minHeight: '44px', height: '44px', fontSize: '12px', padding: '0 10px', flex: '0 0 auto' }}
              onClick={handleAddGPSVertex}
              disabled={isReadOnly}
            >
              <Plus size={16} /> + Punto GPS
            </button>

            <button 
              type="button" 
              className="btn-secondary-mobile" 
              style={{ minHeight: '44px', height: '44px', fontSize: '12px', fontWeight: '700', border: '1.5px dashed #0284c7', color: '#0284c7', flex: '0 0 auto' }}
              onClick={handleAddManualVertex}
              disabled={isReadOnly}
            >
              <Edit2 size={14} /> + Coordenada (Pto)
            </button>
          </div>
        </div>

        {/* Resumen Métrico */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Área Calculada</span>
            <div className="mono" style={{ fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>
              {areaCalc.toLocaleString('es-EC', { maximumFractionDigits: 2 })} m²
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              ({(areaCalc / 10000).toFixed(4)} ha)
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Perímetro Total</span>
            <div className="mono" style={{ fontSize: '15px', fontWeight: 'bold', color: '#f59e0b' }}>
              {perimCalc.toFixed(2)} m
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              (P01 inicia al Nor-Oeste)
            </span>
          </div>
        </div>

        {/* Tabla de Puntos */}
        {vertices.length > 0 && (
          <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '6px' }}>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#64748b' }}>
                  <th style={{ padding: '6px' }}>Pto</th>
                  <th style={{ padding: '6px' }}>Este (X)</th>
                  <th style={{ padding: '6px' }}>Norte (Y)</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {vertices.map((v, i) => {
                  const vx = (v.x ?? (Array.isArray(v) ? v[0] : 0)).toFixed(2);
                  const vy = (v.y ?? (Array.isArray(v) ? v[1] : 0)).toFixed(2);
                  const pCode = 'P' + String(i + 1).padStart(2, '0');
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px', fontWeight: 'bold', color: '#0284c7' }}>{pCode}</td>
                      <td className="mono" style={{ padding: '6px', cursor: 'pointer' }} onClick={() => !isReadOnly && handleEditVertex(i)} title="Toca para editar">
                        {vx}
                      </td>
                      <td className="mono" style={{ padding: '6px', cursor: 'pointer' }} onClick={() => !isReadOnly && handleEditVertex(i)} title="Toca para editar">
                        {vy}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button 
                          type="button" 
                          onClick={() => handleEditVertex(i)}
                          title="Editar Coordenadas del Punto"
                          style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', marginRight: '6px' }}
                          disabled={isReadOnly}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveVertex(i)}
                          title="Eliminar Punto"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          disabled={isReadOnly}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 🧭 COLINDANTES POR TRAMO DE PUNTOS */}
        {vertices.length >= 2 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Compass size={14} color="#0284c7" /> Colindantes por Tramo de Puntos:
              </span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>{vertices.length} linderos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '2px' }}>
              {vertices.map((v, i) => {
                const nextIdx = (i + 1) % vertices.length;
                const p1 = v;
                const p2 = vertices[nextIdx];
                const dir = getSegmentOrientation(p1, p2);
                const dist = getSegmentDistance(p1, p2);
                const pCode1 = 'P' + String(i + 1).padStart(2, '0');
                const pCode2 = 'P' + String(nextIdx + 1).padStart(2, '0');
                const dirColors = {
                  Norte: '#0284c7',
                  Este: '#10b981',
                  Sur: '#f59e0b',
                  Oeste: '#ec4899'
                };

                return (
                  <div 
                    key={i} 
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a' }}>
                        Tramo {pCode1} ➔ {pCode2} ({dist} m)
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: \`\${dirColors[dir]}15\`,
                        color: dirColors[dir],
                        border: \`1px solid \${dirColors[dir]}44\`
                      }}>
                        🧭 Hacia el {dir}
                      </span>
                    </div>

                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={\`Colindante del tramo \${pCode1}-\${pCode2} (ej: Juan Pérez / Calle pública)\`}
                      value={v.colindante || ''}
                      onChange={(e) => handleColindanteChange(i, e.target.value)}
                      disabled={isReadOnly}
                      style={{ height: '38px', fontSize: '12px' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. OBSERVACIONES DE CAMPO */}
      <div className="form-card">
        <div className="form-card-title">
          <Info size={16} /> Observaciones de Campo
        </div>

        <div className="form-group">
          <textarea 
            className="form-input" 
            rows="3"
            placeholder="Detalles del predio, estado de la vivienda o posesión..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>
      </div>

      {/* BOTONES PRINCIPALES DE ACCIÓN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px', marginBottom: '36px' }}>
        {!isReadOnly ? (
          <>
            <button 
              type="button" 
              className="btn-cta-cloud" 
              onClick={handleSaveAndUpload}
              disabled={isSaving}
            >
              <CloudUpload size={22} />
              <span>{isSaving ? 'Guardando...' : (isOnline ? 'Guardar y Subir al Servidor' : 'Guardar en Teléfono (Sin Internet)')}</span>
            </button>

            <button 
              type="button" 
              className="btn-cta-phone" 
              onClick={handleSaveOffline}
              disabled={isSaving}
            >
              <Save size={20} />
              <span>Guardar Solamente en Teléfono (Offline)</span>
            </button>
          </>
        ) : (
          <div style={{
            background: '#f0f9ff',
            border: '1.5px solid #0284c7',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'center',
            color: '#0369a1',
            fontSize: '13px'
          }}>
            🛡️ Este predio está en <b>Modo Solo Lectura</b> para brigadistas.
          </div>
        )}

        <button 
          type="button" 
          className="btn-cta-cancel"
          onClick={handleCancelEdit}
          disabled={isSaving}
        >
          <X size={18} />
          <span>Volver al Listado / Cancelar</span>
        </button>
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(predioFormPath, newPredioFormCode, 'utf8');
  console.log('✅ PredioFormMobile.jsx: Actualizado con listado de predios dibujados, modo edición y eliminación de fotos.');
}

// 5. BUMP VERSION EN build.gradle A v2.7 (code 17)
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/versionCode\s+\d+/, 'versionCode 17');
  content = content.replace(/versionName\s+"[^"]+"/, 'versionName "2.7"');
  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log('✅ build.gradle: Versión actualizada a v2.7 (Code 17).');
}

console.log('--- Proceso completado exitosamente ---');
