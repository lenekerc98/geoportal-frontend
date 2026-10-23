import os
import re

api_path = r'C:\LNCZ\proyecto-catastro-2026\movil\src\services\api.js'
with open(api_path, 'r', encoding='utf-8') as f:
    api_content = f.read()

# 4. Replace uploadSinglePredio with robust auto-retry and conflict auto-resolution
new_upload_single = '''export async function uploadSinglePredio(predio, authInfo = {}, overwriteId = null) {
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
        const posController = new AbortController();
        const posTimeout = setTimeout(() => posController.abort(), 12000);
        const posRes = await fetch(`${baseUrl}/api/gis/posesionarios`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            cedula: String(predio.cedula || '').trim(),
            nombre: String(predio.propietario || '').trim()
          }),
          signal: posController.signal
        });
        clearTimeout(posTimeout);
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
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 30000);
      const h = { ...headers };
      if (tokenToUse) h['Authorization'] = `Bearer ${tokenToUse}`;
      try {
        const response = await fetch(url, {
          method,
          headers: h,
          body: JSON.stringify(payload),
          signal: c.signal
        });
        clearTimeout(t);
        return response;
      } catch (err) {
        clearTimeout(t);
        throw err;
      }
    };

    let res = await sendRequest(targetUrl, targetMethod, token);

    // Auto-renovar si dio 401
    if (res.status === 401) {
      const freshToken = await ensureValidToken({ ...authInfo, token: '' });
      if (freshToken && freshToken !== token) {
        token = freshToken;
        res = await sendRequest(targetUrl, targetMethod, token);
      }
    }

    // Auto-recuperar ID y hacer PUT si dio duplicado al hacer POST
    if (!res.ok && targetMethod === 'POST') {
      const errClone = await res.clone().text().catch(() => '');
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
    return { success: false, error: err.name === 'AbortError' ? 'Timeout: Señal de red insuficiente al subir (30s)' : err.message };
  }
}'''

# Locate uploadSinglePredio start and syncAllPendingPredios start
start_idx = api_content.find('export async function uploadSinglePredio(predio, authInfo = {}, overwriteId = null)')
end_idx = api_content.find('export async function syncAllPendingPredios(authInfo = {}, onProgress = null, onConflictResolve = null)')

if start_idx != -1 and end_idx != -1:
    api_content = api_content[:start_idx] + new_upload_single + '\n\n' + api_content[end_idx:]
    print('[OK] Replaced uploadSinglePredio successfully by index slicing')
else:
    print('[ERROR] Could not find start or end index for uploadSinglePredio')

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(api_content)
print('[OK] Saved api.js')

# 5. Patch SyncCenterMobile.jsx for offline check
sync_path = r'C:\LNCZ\proyecto-catastro-2026\movil\src\pages\SyncTab\SyncCenterMobile.jsx'
with open(sync_path, 'r', encoding='utf-8') as f:
    sync_content = f.read()

target_str = '''  const handleUploadSingle = async (predio) => {
    if (!isOnline) {'''

repl_str = '''  const handleUploadSingle = async (predio) => {
    if (!isOnline) {
      const quickCheck = await testConnection();
      if (!quickCheck.ok) {'''

if target_str in sync_content:
    sync_content = sync_content.replace(target_str, repl_str)
    # Also adjust the closing brace of the if block
    # original had:
    #       return;
    #     }
    # now:
    #       return;
    #       }
    #     }
    sub_target = '''      return;
    }

    try {'''
    sub_repl = '''      return;
      }
    }

    try {'''
    sync_content = sync_content.replace(sub_target, sub_repl)
    with open(sync_path, 'w', encoding='utf-8') as f:
        f.write(sync_content)
    print('[OK] Updated SyncCenterMobile.jsx offline tolerance successfully')
else:
    print('[WARN] target_str not found in SyncCenterMobile.jsx')
