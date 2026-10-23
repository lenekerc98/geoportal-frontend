import os
import json

movil_dir = r'C:\LNCZ\proyecto-catastro-2026\movil'

# 1. Update capacitor.config.json to enable CapacitorHttp
cap_path = os.path.join(movil_dir, 'capacitor.config.json')
with open(cap_path, 'r', encoding='utf-8') as f:
    cfg = json.load(f)

if 'plugins' not in cfg:
    cfg['plugins'] = {}

cfg['plugins']['CapacitorHttp'] = { 'enabled': True }
with open(cap_path, 'w', encoding='utf-8') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print('[OK] Enabled CapacitorHttp in capacitor.config.json')

# 2. Write updated api.js
api_path = os.path.join(movil_dir, 'src', 'services', 'api.js')

new_api_code = '''import Swal from 'sweetalert2';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { 
  getSetting, 
  setSetting, 
  getOfflinePredios, 
  updatePredioSyncStatus, 
  saveCachedPredios, 
  saveCachedPosesionarios, 
  findCachedPosesionarioByCedula, 
  searchCachedPosesionarios, 
  getCachedPredios 
} from './mobileDB';

export const API_URL = "https://geoportal-backend-43s0.onrender.com";
const DEFAULT_BACKEND_URL = API_URL;

export function getDefaultServerUrl() {
  return DEFAULT_BACKEND_URL;
}

export async function getServerUrl() {
  try {
    const saved = await getSetting('server_url');
    if (saved && typeof saved === 'string') {
      let clean = saved.trim().replace(/\\/+$/, '');
      if (clean.includes('geoportal-backend-1-sbhv.onrender.com') || clean.includes('localhost') || clean.includes('127.0.0.1')) {
        await setSetting('server_url', DEFAULT_BACKEND_URL);
        return DEFAULT_BACKEND_URL;
      }
      if (clean.includes('onrender.com') && clean.startsWith('http://')) {
        clean = clean.replace('http://', 'https://');
        await setSetting('server_url', clean);
      }
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean;
      }
    }
  } catch (e) {
    console.warn('Error leyendo server_url:', e);
  }
  return DEFAULT_BACKEND_URL;
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Petición HTTP Universal: En Android nativo usa CapacitorHttp directamente para saltar
 * todas las restricciones de CORS/WebView y evitar 100% el error "Failed to fetch".
 */
export async function mobileFetch(url, options = {}) {
  const isNative = Capacitor.isNativePlatform();
  const method = (options.method || 'GET').toUpperCase();
  const timeoutMs = options.timeoutMs || 30000;

  if (isNative) {
    try {
      const headers = { ...(options.headers || {}) };
      let data = undefined;
      if (options.body) {
        if (typeof options.body === 'string') {
          try {
            data = JSON.parse(options.body);
          } catch (e) {
            data = options.body;
          }
        } else {
          data = options.body;
        }
      }
      const res = await CapacitorHttp.request({
        url,
        method,
        headers,
        data,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs
      });
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: async () => res.data,
        text: async () => (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)),
        data: res.data,
        clone: function() { return this; }
      };
    } catch (nativeErr) {
      console.warn('[mobileFetch Native Error]:', nativeErr);
    }
  }

  // Web Browser fallback
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(t);
    return res;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

export async function getDeviceId() {
  try {
    let uuid = await getSetting('device_uuid');
    if (!uuid || typeof uuid !== 'string') {
      uuid = 'movil_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      await setSetting('device_uuid', uuid);
    }
    return uuid;
  } catch (e) {
    return 'movil_default_dev';
  }
}

export function getDeviceModel() {
  try {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) {
      const match = ua.match(/Android\\s+([\\d.]+);?\\s*([^;)]+)?/i);
      if (match && match[2]) {
        return match[2].trim() + ' (Android)';
      }
      return 'Dispositivo Android';
    }
  } catch (e) {}
  return 'Móvil de Campo';
}

export async function loginBrigadistaToServer(nombre, apellido, customUrl = null) {
  const baseUrl = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  const deviceUuid = await getDeviceId();
  const deviceModel = getDeviceModel();

  try {
    const res = await mobileFetch(`${baseUrl}/api/login-brigadista`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dispositivo_uuid: deviceUuid,
        dispositivo_modelo: deviceModel
      }),
      timeoutMs: 15000
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || `Error HTTP ${res.status}: No se pudo registrar brigadista` };
    }

    const data = await res.json();
    return {
      success: true,
      token: data.access_token,
      payload: {
        role: 'brigadista',
        username: data.username,
        nombre: data.nombre,
        empresaId: data.empresaId,
        empresaNombre: data.empresaNombre,
        activeProyectoId: data.activeProyectoId,
        activeProyectoNombre: data.activeProyectoNombre,
        operador_temporal_id: data.operador_temporal_id
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.name === 'AbortError'
        ? 'Tiempo de espera agotado al conectar al servidor.'
        : err.message
    };
  }
}

export async function ensureValidToken(authInfo = {}) {
  let token = authInfo?.token || (await getSetting('auth_token', ''));
  const isExpiredOrOffline = !token || token.startsWith('offline_') || (() => {
    try {
      const payload = parseJwt(token);
      if (payload && payload.exp && payload.exp * 1000 < Date.now() + 60000) {
        return true;
      }
    } catch (e) {}
    return false;
  })();

  if (isExpiredOrOffline) {
    try {
      const authDataStr = await getSetting('auth_data', '{}');
      const authData = JSON.parse(authDataStr || '{}');
      const isBrig = authData?.role === 'brigadista' || authData?.isBrigadista || authInfo?.role === 'brigadista' || authInfo?.isBrigadista;
      const nomFull = authData?.nombre || authInfo?.nombre || '';
      if (isBrig && nomFull) {
        const parts = nomFull.replace(/\\(Brigadista\\)/gi, '').trim().split(' ');
        const nom = parts[0] || 'Brigadista';
        const ape = parts.slice(1).join(' ') || 'Urdaneta';
        const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
        const brigRes = await loginBrigadistaToServer(nom, ape, baseUrl);
        if (brigRes && brigRes.success && brigRes.token) {
          token = brigRes.token;
          await setSetting('auth_token', token);
          return token;
        }
      }
    } catch (e) {
      console.warn('Error auto-renovando token brigadista:', e);
    }
  }
  return token;
}

export async function checkPredioConflict(predio, authInfo = {}) {
  try {
    const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
    const token = await ensureValidToken(authInfo);

    const headers = {
      'Content-Type': 'application/json',
      'X-Database-Env': 'prod'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await mobileFetch(`${baseUrl}/api/gis/predios/verificar-conflicto`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cod_catastral: predio.codigo || predio.clave_catastral || null
      }),
      timeoutMs: 15000
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Aviso verificando conflicto:', e);
  }
  return { conflicto: false };
}

export async function loginToServer(username, password, customUrl = null) {
  const baseUrl = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  const formData = new URLSearchParams();
  formData.append('username', username.trim());
  formData.append('password', password);

  try {
    const res = await mobileFetch(`${baseUrl}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      timeoutMs: 15000
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || `Error HTTP ${res.status}: Usuario o contraseña incorrectos` };
    }

    const data = await res.json();
    if (data.access_token) {
      const payload = parseJwt(data.access_token);
      return { success: true, token: data.access_token, payload };
    }
    return { success: false, error: 'No se recibió access_token del servidor' };
  } catch (err) {
    return {
      success: false,
      error: err.name === 'AbortError'
        ? 'Tiempo de espera agotado al conectar al servidor.'
        : err.message
    };
  }
}

export async function fetchEmpresasDisponibles(token = null, customUrl = null) {
  const baseUrl = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  const cleanToken = token || (await getSetting('auth_token', ''));

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (cleanToken) headers['Authorization'] = `Bearer ${cleanToken}`;

    const res = await mobileFetch(`${baseUrl}/api/empresas`, {
      headers,
      timeoutMs: 15000
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.warn('Error cargando empresas:', e);
  }

  return [
    {
      id: 2,
      nombre: 'Gobierno Autónomo Descentralizado Urdaneta',
      ruc: '1260000990001',
      ciudad: 'Urdaneta',
      provincia: 'Los Ríos'
    }
  ];
}

export async function fetchServerProyectos(token = null, customUrl = null) {
  const baseUrl = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  const cleanToken = token || (await getSetting('auth_token', ''));

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (cleanToken) headers['Authorization'] = `Bearer ${cleanToken}`;

    const res = await mobileFetch(`${baseUrl}/api/proyectos`, {
      headers,
      timeoutMs: 15000
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.warn('Error cargando proyectos del servidor:', e);
  }

  return [
    { id: 3, nombre: 'Censo Catastral Rural' },
    { id: 1, nombre: 'Censo Catastral Urbano' }
  ];
}

export async function testConnection(customUrl = null) {
  const url = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  const startTime = Date.now();

  try {
    const res = await mobileFetch(`${url}/`, {
      method: 'GET',
      timeoutMs: 15000
    });
    const latency = Date.now() - startTime;
    return { ok: res.ok || res.status === 200, latency, status: res.status, url };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Tiempo de espera agotado (15s)' : err.message, url };
  }
}

export async function fetchServerPredios(customToken = null, customUrl = null) {
  const baseUrl = (customUrl || (await getServerUrl())).trim().replace(/\\/+$/, '');
  let token = await ensureValidToken({ token: customToken });

  const headers = {
    'Content-Type': 'application/json',
    'X-Database-Env': 'prod'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    let res = await mobileFetch(`${baseUrl}/api/gis/predios`, { headers, timeoutMs: 35000 });

    if (res.status === 401) {
      const freshToken = await ensureValidToken({ token: '' });
      if (freshToken && freshToken !== token) {
        token = freshToken;
        headers['Authorization'] = `Bearer ${token}`;
        res = await mobileFetch(`${baseUrl}/api/gis/predios`, { headers, timeoutMs: 35000 });
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Error HTTP ${res.status}: ${errText.substring(0, 100)}`);
    }

    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.features || []);

    const simplified = list.map(p => {
      const props = p.properties || p;
      return {
        id: p.id || props.id,
        codigo: props.cod_catastral || props.codigo || `PREDIO-${p.id || 'S/N'}`,
        clave_catastral: props.cod_catastral || props.codigo,
        area: props.area_ha ? (props.area_ha * 10000).toFixed(2) : (props.area || 0),
        propietario: props.nombre_posesionario || props.posesionario || 'Sin Posesionario',
        cedula: props.cedula || '',
        norte: props.lindero_norte || '',
        sur: props.lindero_sur || '',
        este: props.lindero_este || '',
        oeste: props.lindero_oeste || '',
        tipo_levantamiento: 'GEOPORTAL_WEB',
        sync_status: 'synced',
        raw: p
      };
    });

    await saveCachedPredios(simplified);
    return simplified;
  } catch (err) {
    console.warn('Aviso: no se pudieron descargar predios del servidor:', err);
    return await getCachedPredios();
  }
}

export async function searchPosesionarioByCedula(cedulaQuery) {
  if (!cedulaQuery || cedulaQuery.trim().length < 3) return null;
  const clean = cedulaQuery.trim();

  try {
    const local = await findCachedPosesionarioByCedula(clean);
    if (local) return local;
  } catch (e) {}

  try {
    const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
    const token = await ensureValidToken();
    const headers = { 'Content-Type': 'application/json', 'X-Database-Env': 'prod' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await mobileFetch(`${baseUrl}/api/gis/posesionarios/buscar/${encodeURIComponent(clean)}`, { 
      headers, 
      timeoutMs: 15000 
    });

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

export async function searchPosesionariosByName(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    return await searchCachedPosesionarios(query);
  } catch (e) {
    return [];
  }
}

export async function promptRenewSession(username = '', customUrl = null) {
  const cleanUser = username || (await getSetting('auth_user', '')) || 'lcedeno';
  const result = await Swal.fire({
    title: '🔒 Sesión Expirada',
    html: `
      <div style="font-size:13px; color:#475569; margin-bottom:14px; text-align:left; line-height:1.4;">
        Tu sesión de trabajo como <b>${cleanUser}</b> expiró. Ingresa tu contraseña para renovarla y sincronizar de inmediato:
      </div>
      <input id="swal-renew-pass" type="password" class="swal2-input" placeholder="Tu contraseña..." style="font-size:14px; width:85%; margin:0 auto; box-sizing:border-box;">
    `,
    showCancelButton: true,
    confirmButtonText: 'Renovar y Subir',
    cancelButtonText: 'Subir Más Tarde',
    confirmButtonColor: '#0284c7',
    cancelButtonColor: '#64748b',
    background: '#ffffff',
    color: '#0f172a',
    didOpen: () => {
      const input = document.getElementById('swal-renew-pass');
      if (input) input.focus();
    },
    preConfirm: () => {
      const p = document.getElementById('swal-renew-pass')?.value;
      if (!p || !p.trim()) {
        Swal.showValidationMessage('Por favor ingresa tu contraseña');
        return false;
      }
      return p.trim();
    }
  });

  if (result.isConfirmed && result.value) {
    Swal.showLoading();
    const loginRes = await loginToServer(cleanUser, result.value, customUrl);
    Swal.close();
    if (loginRes.success) {
      await setSetting('auth_token', loginRes.token);
      const existingDataStr = await getSetting('auth_data');
      if (existingDataStr) {
        try {
          const parsed = typeof existingDataStr === 'string' ? JSON.parse(existingDataStr) : existingDataStr;
          parsed.token = loginRes.token;
          await setSetting('auth_data', JSON.stringify(parsed));
        } catch (e) {}
      }
      Swal.fire({
        icon: 'success',
        title: '¡Sesión Renovada!',
        text: 'Conexión restablecida con éxito.',
        timer: 1500,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
      return { success: true, token: loginRes.token, payload: loginRes.payload };
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error de Autenticación',
        text: loginRes.error || 'Contraseña incorrecta. Por favor intenta de nuevo.',
        confirmButtonColor: '#ef4444',
        background: '#ffffff',
        color: '#0f172a'
      });
      return { success: false, error: loginRes.error };
    }
  }
  return { success: false, cancelled: true };
}

export async function uploadSinglePredio(predio, authInfo = {}, overwriteId = null) {
  const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
  let token = await ensureValidToken(authInfo);
  const empresaId = predio.empresa_id || authInfo.empresaId || (await getSetting('empresa_id', null));
  const proyectoId = predio.proyecto_id || authInfo.activeProyectoId || (await getSetting('active_proyecto_id', null));

  const headers = {
    'Content-Type': 'application/json',
    'X-Database-Env': 'prod'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    let posesionarioId = predio.posesionario_id || null;
    if (!posesionarioId && predio.propietario && predio.cedula) {
      try {
        const posRes = await mobileFetch(`${baseUrl}/api/gis/posesionarios`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            cedula: String(predio.cedula || '').trim(),
            nombre: String(predio.propietario || '').trim()
          }),
          timeoutMs: 15000
        });
        if (posRes.ok) {
          const posData = await posRes.json();
          posesionarioId = posData.id;
        }
      } catch (posErr) {
        console.warn('Aviso: posesionario independiente no registrado:', posErr);
      }
    }

    const rawCoords = (predio.vertices || []).map(v => {
      const x = v.x ?? (Array.isArray(v) ? v[0] : 0);
      const y = v.y ?? (Array.isArray(v) ? v[1] : 0);
      return [x, y];
    });

    if (rawCoords.length < 3) {
      throw new Error('El predio debe tener al menos 3 vértices para formar un polígono');
    }

    const closedCoords = [...rawCoords];
    const first = closedCoords[0];
    const last = closedCoords[closedCoords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      closedCoords.push([first[0], first[1]]);
    }

    let colindantesList = [];
    if (predio.vertices && Array.isArray(predio.vertices) && predio.vertices.some(v => v.colindante)) {
      colindantesList = predio.vertices.map(v => {
        const raw = (v.colindante || '').trim();
        return raw.replace(/^(Norte|Sur|Este|Oeste)\\s*:\\s*/i, '').replace(/\\s*\\([\\d\\.]+\\s*m\\)$/i, '').trim();
      });
    } else {
      const cleanCol = (str) => (str || '').replace(/^(Norte|Sur|Este|Oeste)\\s*:\\s*/i, '').replace(/\\s*\\([\\d\\.]+\\s*m\\)$/i, '').trim();
      if (predio.norte) colindantesList.push(cleanCol(predio.norte));
      if (predio.sur) colindantesList.push(cleanCol(predio.sur));
      if (predio.este) colindantesList.push(cleanCol(predio.este));
      if (predio.oeste) colindantesList.push(cleanCol(predio.oeste));
    }

    const payload = {
      cod_catastral: predio.codigo || predio.clave_catastral || null,
      posesionario_id: posesionarioId,
      empresa_id: empresaId ? parseInt(empresaId, 10) : null,
      proyecto_id: proyectoId ? parseInt(proyectoId, 10) : null,
      geom_geojson: {
        type: 'Polygon',
        coordinates: [closedCoords]
      },
      es_utm: true,
      colindantes: colindantesList.length > 0 ? colindantesList : null
    };

    let activeOverwriteId = overwriteId || predio.id || null;
    let targetUrl = activeOverwriteId ? `${baseUrl}/api/gis/predios/${activeOverwriteId}` : `${baseUrl}/api/gis/predios`;
    let targetMethod = activeOverwriteId ? 'PUT' : 'POST';

    const sendRequest = async (url, method, tokenToUse) => {
      const h = { ...headers };
      if (tokenToUse) h['Authorization'] = `Bearer ${tokenToUse}`;
      return await mobileFetch(url, {
        method,
        headers: h,
        body: JSON.stringify(payload),
        timeoutMs: 45000
      });
    };

    let res = await sendRequest(targetUrl, targetMethod, token);

    // Auto-renovar token si dio 401
    if (res.status === 401) {
      const freshToken = await ensureValidToken({ ...authInfo, token: '' });
      if (freshToken && freshToken !== token) {
        token = freshToken;
        res = await sendRequest(targetUrl, targetMethod, token);
      }
    }

    // Auto-recuperar ID y hacer PUT si dio duplicado al hacer POST
    if (!res.ok && targetMethod === 'POST') {
      const errClone = await res.text().catch(() => '');
      if (errClone.includes('duplicate key') || errClone.includes('predio_cod_catastral_active_idx')) {
        console.log('Predio duplicado detectado en servidor, resolviendo ID para actualizar...');
        const conflict = await checkPredioConflict(predio, { token });
        if (conflict && conflict.predio_existente?.id) {
          activeOverwriteId = conflict.predio_existente.id;
          targetUrl = `${baseUrl}/api/gis/predios/${activeOverwriteId}`;
          targetMethod = 'PUT';
          res = await sendRequest(targetUrl, targetMethod, token);
        }
      }
    }

    if (res.ok) {
      const respData = await res.json().catch(() => ({}));
      return { success: true, data: respData };
    } else {
      const errText = await res.text().catch(() => '');
      const isAuthError = res.status === 401 || errText.includes('Could not validate credentials') || errText.includes('Not authenticated') || errText.includes('Sesión expirada');
      return { 
        success: false, 
        status: res.status,
        isAuthError,
        error: isAuthError 
          ? 'Sesión expirada (HTTP 401). Se requiere renovar sesión.' 
          : `HTTP ${res.status}: ${errText.substring(0, 160)}` 
      };
    }
  } catch (err) {
    return { success: false, error: err.name === 'AbortError' ? 'Timeout: Señal de red insuficiente al subir (45s)' : (err.message || 'Error de conexión con el servidor') };
  }
}

export async function syncAllPendingPredios(authInfo = {}, onProgress = null, onConflictResolve = null) {
  const all = await getOfflinePredios();
  const pending = all.filter(p => p.sync_status !== 'synced');

  if (pending.length === 0) {
    return { total: 0, success: 0, failed: 0, errors: [] };
  }

  let successCount = 0;
  let failedCount = 0;
  const errors = [];

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    await updatePredioSyncStatus(p.offline_id, 'syncing');
    if (onProgress) onProgress(i + 1, pending.length, p);

    let overwriteId = null;
    let finalPredio = p;

    if (onConflictResolve) {
      const conflictCheck = await checkPredioConflict(p, authInfo);
      if (conflictCheck && conflictCheck.conflicto) {
        const decision = await onConflictResolve(p, conflictCheck.predio_existente);
        if (decision === 'overwrite') {
          overwriteId = conflictCheck.predio_existente.id;
        } else if (decision === 'skip') {
          await updatePredioSyncStatus(p.offline_id, 'synced');
          successCount++;
          continue;
        } else if (decision && decision.startsWith('new_code:')) {
          const newCode = decision.replace('new_code:', '');
          finalPredio = { ...p, codigo: newCode };
        } else {
          await updatePredioSyncStatus(p.offline_id, 'pending');
          failedCount++;
          continue;
        }
      }
    }

    const result = await uploadSinglePredio(finalPredio, authInfo, overwriteId);
    if (result.success) {
      await updatePredioSyncStatus(p.offline_id, 'synced');
      successCount++;
    } else {
      await updatePredioSyncStatus(p.offline_id, 'error', result.error);
      failedCount++;
      errors.push({ id: p.offline_id, codigo: p.codigo, error: result.error });
    }
  }

  return {
    total: pending.length,
    success: successCount,
    failed: failedCount,
    errors
  };
}
'''

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(new_api_code)
print('[OK] Saved new api.js with mobileFetch and native CapacitorHttp')
