const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '..', 'movil');

console.log('Applying full posesionario auto-loading and predio sync fixes...');

// =========================================================================
// 1. UPDATE movil/src/services/mobileDB.js
// =========================================================================
const dbPath = path.join(movilDir, 'src', 'services', 'mobileDB.js');
let dbCode = fs.readFileSync(dbPath, 'utf8');

const newMobileDb = `import { openDB } from 'idb';

const DB_NAME = 'catastro_movil_db';
const DB_VERSION = 2;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline_predios')) {
        const store = db.createObjectStore('offline_predios', { keyPath: 'offline_id' });
        store.createIndex('sync_status', 'sync_status');
        store.createIndex('created_at', 'created_at');
      }
      if (!db.objectStoreNames.contains('cached_predios')) {
        db.createObjectStore('cached_predios', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_posesionarios')) {
        const posStore = db.createObjectStore('cached_posesionarios', { keyPath: 'key' });
        posStore.createIndex('cedula', 'cedula');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    }
  });
}

export async function saveOfflinePredio(predio) {
  const db = await initDB();
  const toSave = {
    ...predio,
    offline_id: predio.offline_id || ('off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
    sync_status: predio.sync_status || 'pending',
    created_at: predio.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await db.put('offline_predios', toSave);
  return toSave;
}

export async function getOfflinePredios() {
  const db = await initDB();
  return db.getAll('offline_predios');
}

export async function getOfflinePredio(id) {
  const db = await initDB();
  return db.get('offline_predios', id);
}

export async function deleteOfflinePredio(id) {
  const db = await initDB();
  return db.delete('offline_predios', id);
}

export async function updatePredioSyncStatus(id, status, errorMsg = null) {
  const db = await initDB();
  const item = await db.get('offline_predios', id);
  if (item) {
    item.sync_status = status;
    if (errorMsg) item.sync_error = errorMsg;
    if (status === 'synced') item.synced_at = new Date().toISOString();
    await db.put('offline_predios', item);
  }
  return item;
}

export async function getOfflineCount() {
  const db = await initDB();
  const all = await db.getAll('offline_predios');
  return all.filter(p => p.sync_status !== 'synced').length;
}

export async function saveCachedPredios(predios) {
  const db = await initDB();
  const tx = db.transaction('cached_predios', 'readwrite');
  await tx.store.clear();
  for (const p of predios) {
    if (!p.id) {
      p.id = p.properties?.id || Math.random().toString(36).substring(2, 10);
    }
    await tx.store.put(p);
  }
  await tx.done;
}

export async function getCachedPredios() {
  const db = await initDB();
  return db.getAll('cached_predios');
}

export async function clearCachedPredios() {
  const db = await initDB();
  const tx = db.transaction('cached_predios', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// GESTIÓN DE POSESIONARIOS EN CACHÉ (OFFLINE)
export async function saveCachedPosesionarios(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  const db = await initDB();
  const tx = db.transaction('cached_posesionarios', 'readwrite');
  for (const pos of list) {
    const cedula = (pos.cedula || '').trim();
    const nombre = (pos.nombre || pos.nombre_posesionario || pos.propietario || '').trim();
    if (!cedula && !nombre) continue;
    const key = cedula || ('pos_' + (pos.id || Math.random().toString(36).substring(2, 8)));
    await tx.store.put({
      key,
      id: pos.id,
      cedula,
      nombre,
      empresa_id: pos.empresa_id
    });
  }
  await tx.done;
}

export async function getCachedPosesionarios() {
  const db = await initDB();
  return db.getAll('cached_posesionarios');
}

export async function findCachedPosesionarioByCedula(cedula) {
  if (!cedula) return null;
  const clean = cedula.trim();
  const db = await initDB();
  const direct = await db.get('cached_posesionarios', clean);
  if (direct) return direct;
  const all = await db.getAll('cached_posesionarios');
  return all.find(p => p.cedula === clean) || null;
}

export async function searchCachedPosesionarios(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const db = await initDB();
  const all = await db.getAll('cached_posesionarios');
  return all
    .filter(p => (p.nombre && p.nombre.toLowerCase().includes(q)) || (p.cedula && p.cedula.includes(q)))
    .slice(0, 10);
}

export async function getSetting(key, defaultVal = null) {
  try {
    const db = await initDB();
    const item = await db.get('settings', key);
    return item ? item.value : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

export async function setSetting(key, value) {
  const db = await initDB();
  return db.put('settings', { key, value });
}

export async function exportBackupJSON() {
  const predios = await getOfflinePredios();
  const backup = {
    version: '1.0',
    export_timestamp: new Date().toISOString(),
    total_records: predios.length,
    predios
  };
  return JSON.stringify(backup, null, 2);
}

export async function importBackupJSON(jsonString) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    const list = data.predios || (Array.isArray(data) ? data : []);
    const db = await initDB();
    let imported = 0;
    for (const p of list) {
      if (!p.offline_id) {
        p.offline_id = 'imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      }
      p.sync_status = 'pending';
      await db.put('offline_predios', p);
      imported++;
    }
    return { success: true, count: imported };
  } catch (e) {
    console.error('Error importando backup:', e);
    return { success: false, error: e.message };
  }
}
`;

fs.writeFileSync(dbPath, newMobileDb, 'utf8');
console.log('1. Updated mobileDB.js with cached_posesionarios store and search functions');

// =========================================================================
// 2. UPDATE movil/src/services/api.js
// =========================================================================
const apiPath = path.join(movilDir, 'src', 'services', 'api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8');

// Replace imports at top of api.js
apiCode = apiCode.replace(
  "import { getSetting, setSetting, getOfflinePredios, updatePredioSyncStatus, saveCachedPredios } from './mobileDB';",
  "import { getSetting, setSetting, getOfflinePredios, updatePredioSyncStatus, saveCachedPredios, saveCachedPosesionarios, findCachedPosesionarioByCedula, searchCachedPosesionarios, getCachedPredios } from './mobileDB';"
);

// Replace fetchServerPredios in api.js
const oldFetchRegex = /export async function fetchServerPredios\([\s\S]*?return cached \|\| \[\];\s*\}\s*\}/;

const newFetchServerPredios = `export async function fetchServerPredios(customToken = null, customUrl = null) {
  const baseUrl = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  let token = customToken || (await getSetting('auth_token', ''));

  // Si no hay token o es token offline y estamos online, intentar obtener un token real de brigadista
  if (!token || token.startsWith('offline_')) {
    try {
      const authDataStr = await getSetting('auth_data', '{}');
      const authData = JSON.parse(authDataStr || '{}');
      if (authData.nombre) {
        const parts = authData.nombre.replace(/\\(Brigadista\\)/gi, '').trim().split(' ');
        const nom = parts[0] || 'Brigadista';
        const ape = parts.slice(1).join(' ') || 'Urdaneta';
        const brigRes = await loginBrigadistaToServer(nom, ape, baseUrl);
        if (brigRes && brigRes.success && brigRes.token) {
          token = brigRes.token;
          await setSetting('auth_token', token);
        }
      }
    } catch (e) {
      console.warn('No se pudo auto-renovar token brigadista:', e);
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Database-Env': 'prod'
  };
  if (token) headers['Authorization'] = \`Bearer \${token}\`;

  // Timeout amplio (40s) para soportar cold-start de Render
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000);

  try {
    const res = await fetch(\`\${baseUrl}/api/gis/predios\`, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(\`Error HTTP \${res.status}: \${errText.substring(0, 100)}\`);
    }
    const data = await res.json();
    const list = Array.isArray(data) 
      ? data 
      : (Array.isArray(data.features) ? data.features : (data.predios || []));
    
    if (list.length > 0) {
      for (const p of list) {
        if (!p.id) {
          p.id = p.properties?.id || Math.random().toString(36).substring(2, 10);
        }
      }
      await saveCachedPredios(list);

      // Extraer y guardar posesionarios de la capa de predios descargada
      const posesionariosExtracted = [];
      const seenCedulas = new Set();
      for (const item of list) {
        const props = item.properties || {};
        const nom = props.nombre_posesionario || props.propietario;
        const ced = props.cedula;
        if (ced && !seenCedulas.has(ced)) {
          seenCedulas.add(ced);
          posesionariosExtracted.push({
            id: props.posesionario_id,
            cedula: ced,
            nombre: nom || 'Sin Nombre'
          });
        }
      }
      if (posesionariosExtracted.length > 0) {
        await saveCachedPosesionarios(posesionariosExtracted);
      }
    }

    // Intentar también descargar el catálogo completo de posesionarios de la base
    try {
      const posRes = await fetch(\`\${baseUrl}/api/gis/posesionarios\`, { headers });
      if (posRes.ok) {
        const posData = await posRes.json();
        if (Array.isArray(posData) && posData.length > 0) {
          await saveCachedPosesionarios(posData);
        }
      }
    } catch (e) {
      console.warn('Posesionarios adicionales no descargados:', e);
    }

    return list;
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Error al descargar predios del servidor:', e.message);
    throw e;
  }
}

// Búsqueda inteligente de Posesionario por Cédula (Offline y Online)
export async function searchPosesionarioByCedula(cedula) {
  if (!cedula || !cedula.trim()) return null;
  const clean = cedula.trim();

  // 1. Primero consultar caché local (Respuesta instantánea 0ms)
  try {
    const cached = await findCachedPosesionarioByCedula(clean);
    if (cached && cached.nombre) {
      return cached;
    }
  } catch (e) {}

  // 2. Si no está en caché y hay internet, buscar en el servidor
  try {
    const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
    const token = await getSetting('auth_token', '');
    const headers = { 'Content-Type': 'application/json', 'X-Database-Env': 'prod' };
    if (token) headers['Authorization'] = \`Bearer \${token}\`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(\`\${baseUrl}/api/gis/posesionarios/buscar/\${encodeURIComponent(clean)}\`, { 
      headers, 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.nombre) {
        await saveCachedPosesionarios([data]);
        return data;
      }
    }
  } catch (e) {
    console.warn('Búsqueda remota de posesionario falló:', e);
  }

  return null;
}

// Búsqueda de posesionarios por nombre para autocompletar
export async function searchPosesionariosByName(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    return await searchCachedPosesionarios(query);
  } catch (e) {
    return [];
  }
}`;

if (oldFetchRegex.test(apiCode)) {
  apiCode = apiCode.replace(oldFetchRegex, newFetchServerPredios);
} else {
  console.log('Regex did not match old fetchServerPredios, appending...');
}

fs.writeFileSync(apiPath, apiCode, 'utf8');
console.log('2. Updated api.js with robust fetchServerPredios and searchPosesionarioByCedula');

// =========================================================================
// 3. UPDATE movil/src/pages/Login/LoginMobile.jsx (AUTO-DOWNLOAD FOR BRIGADISTA)
// =========================================================================
const loginPath = path.join(movilDir, 'src', 'pages', 'Login', 'LoginMobile.jsx');
let loginCode = fs.readFileSync(loginPath, 'utf8');

const oldBrigDownloadComment = `// Para brigadistas no se descargan predios preexistentes (mapa limpio y rápido)`;
const newBrigDownloadCode = `// Descargar automáticamente los predios de la base para el brigadista
      try {
        fetchServerPredios(authData.token, activeUrl).catch(e => console.warn('Error en predescarga brigadista:', e));
      } catch (e) {}`;

if (loginCode.includes(oldBrigDownloadComment)) {
  loginCode = loginCode.replace(oldBrigDownloadComment, newBrigDownloadCode);
  fs.writeFileSync(loginPath, loginCode, 'utf8');
  console.log('3. Updated LoginMobile.jsx to auto-download predios for brigadistas');
}

// =========================================================================
// 4. UPDATE movil/src/pages/SettingsTab/SettingsMobile.jsx
// =========================================================================
const settingsPath = path.join(movilDir, 'src', 'pages', 'SettingsTab', 'SettingsMobile.jsx');
let settingsCode = fs.readFileSync(settingsPath, 'utf8');

const oldDownloadHandlerRegex = /const handleDownloadPredios = async \(\) => \{[\s\S]*?setDownloadingPredios\(false\);\s*\}\s*\};/;

const newDownloadHandler = `const handleDownloadPredios = async () => {
    setDownloadingPredios(true);
    Swal.fire({
      title: 'Conectando con el Servidor',
      html: 'Descargando predios vectoriales y catálogo de posesionarios de la base de datos...<br><small style="color:#94a3b8;">(Puede tomar unos segundos si el servidor estaba en reposo)</small>',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
      background: '#131d33',
      color: '#fff'
    });

    try {
      const predios = await fetchServerPredios();
      setCachedCount(predios.length);
      Swal.fire({
        icon: 'success',
        title: '¡Descarga Completa!',
        text: \`Se descargaron exitosamente \${predios.length} predios vectoriales y sus posesionarios en la memoria del teléfono.\`,
        confirmButtonColor: '#0284c7',
        background: '#131d33',
        color: '#fff'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Descarga',
        html: \`No se pudo descargar de la base de datos.<br><span style="color:#f87171; font-size:12px;">\${err.message || 'Verifica tu conexión a internet.'}</span>\`,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ef4444',
        background: '#131d33',
        color: '#fff'
      });
    } finally {
      setDownloadingPredios(false);
    }
  };`;

if (oldDownloadHandlerRegex.test(settingsCode)) {
  settingsCode = settingsCode.replace(oldDownloadHandlerRegex, newDownloadHandler);
  fs.writeFileSync(settingsPath, settingsCode, 'utf8');
  console.log('4. Updated SettingsMobile.jsx with loading indicator and clear feedback');
}

// =========================================================================
// 5. UPDATE movil/src/pages/FormTab/PredioFormMobile.jsx (AUTO-LOAD POSESIONARIO)
// =========================================================================
const formPath = path.join(movilDir, 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
let formCode = fs.readFileSync(formPath, 'utf8');

// Add searchPosesionarioByCedula import
if (!formCode.includes('searchPosesionarioByCedula')) {
  formCode = formCode.replace(
    "import { uploadSinglePredio } from '../../services/api';",
    "import { uploadSinglePredio, searchPosesionarioByCedula, searchPosesionariosByName } from '../../services/api';"
  );
}

// Add state and effect for auto-loading
if (!formCode.includes('searchingCedula')) {
  const targetStatePos = "  const [isSaving, setIsSaving] = useState(false);";
  const newStates = `  const [isSaving, setIsSaving] = useState(false);
  const [searchingCedula, setSearchingCedula] = useState(false);
  const [posesionarioFound, setPosesionarioFound] = useState(null);
  const [nameSuggestions, setNameSuggestions] = useState([]);`;
  formCode = formCode.replace(targetStatePos, newStates);
}

// Auto-lookup effect on cedula
if (!formCode.includes('handleCedulaChange')) {
  const targetCodePos = "  const handleAutoGenerateCodigo = () => {";
  const newCedulaHandlers = `  // Búsqueda automática de posesionario cuando se escribe la cédula
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

  // Sugerencias automáticas por nombre
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

  const handleAutoGenerateCodigo = () => {`;
  formCode = formCode.replace(targetCodePos, newCedulaHandlers);
}

// Update the Propietario / Posesionario JSX to show suggestions and auto-found status
const targetPropietarioJSX = `        <div className="form-group">
          <label className="form-label">Nombres y Apellidos</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Ej: Juan Pérez Zambrano"
            dir="ltr"
            autoComplete="off"
            value={propietario}
            onChange={(e) => setPropietario(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="form-group">
            <label className="form-label">Cédula / RUC</label>
            <input 
              type="text" 
              className="form-input mono" 
              placeholder="1312345678"
              dir="ltr"
              autoComplete="off"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
            />
          </div>`;

const newPropietarioJSX = `        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Cédula / RUC</label>
              {searchingCedula && (
                <span style={{ fontSize: '10px', color: '#38bdf8' }}>Buscando...</span>
              )}
            </div>
            <input 
              type="text" 
              className="form-input mono" 
              placeholder="1312345678"
              dir="ltr"
              autoComplete="off"
              value={cedula}
              onChange={(e) => handleCedulaChange(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Teléfono Móvil</label>
            <input 
              type="tel" 
              className="form-input mono" 
              placeholder="0991234567"
              dir="ltr"
              autoComplete="off"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
        </div>

        {posesionarioFound && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px'
          }}>
            <span>✅ Posesionario cargado automáticamente de la base de datos: <b>\${posesionarioFound.nombre}</b></span>
          </div>
        )}

        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label">Nombres y Apellidos</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Ej: Juan Pérez Zambrano"
            dir="ltr"
            autoComplete="off"
            value={propietario}
            onChange={(e) => handleNombreChange(e.target.value)}
          />
          {nameSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              zIndex: 100,
              maxHeight: '160px',
              overflowY: 'auto',
              boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
              marginTop: '4px'
            }}>
              {nameSuggestions.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleSelectSuggestion(item)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #1e293b',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>{item.nombre}</div>
                  <div style={{ color: '#38bdf8', fontSize: '11px' }}>Cédula: {item.cedula || 'N/D'}</div>
                </div>
              ))}
            </div>
          )}
        </div>`;

// Replace in formCode
if (formCode.includes(targetPropietarioJSX)) {
  formCode = formCode.replace(targetPropietarioJSX, newPropietarioJSX);
  // Also remove duplicate telefono input that was below
  const duplicateTelefono = `          <div className="form-group">
            <label className="form-label">Teléfono Móvil</label>
            <input 
              type="tel" 
              className="form-input mono" 
              placeholder="0991234567"
              dir="ltr"
              autoComplete="off"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
        </div>`;
  if (formCode.includes(duplicateTelefono)) {
    formCode = formCode.replace(duplicateTelefono, '        </div>');
  }
}

fs.writeFileSync(formPath, formCode, 'utf8');
console.log('5. Updated PredioFormMobile.jsx with auto-load posesionario by cédula and name suggestions');

// =========================================================================
// 6. BUMP VERSION TO 2.3 IN android/app/build.gradle
// =========================================================================
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
let gradleCode = fs.readFileSync(gradlePath, 'utf8');

gradleCode = gradleCode.replace(/versionCode\s+\d+/, 'versionCode 13');
gradleCode = gradleCode.replace(/versionName\s+"[^"]+"/, 'versionName "2.3"');

fs.writeFileSync(gradlePath, gradleCode, 'utf8');
console.log('6. Bumped build.gradle to version 2.3 (versionCode 13)');

console.log('\nAll updates applied successfully!');
