const fs = require('fs');
const path = require('path');

const movilDir = path.resolve('c:/LNCZ/proyecto-catastro-2026/movil');

console.log('=== APLICANDO CORRECCIONES DE SINCRONIZACIÓN INDIVIDUAL ===');

// 1. Modificar movil/src/services/api.js
const apiPath = path.join(movilDir, 'src/services/api.js');
let apiContent = fs.readFileSync(apiPath, 'utf8');

// Reemplazar checkPredioConflict con timeout de 4s
const oldCheckConflict = `export async function checkPredioConflict(predio, authInfo = {}) {
  try {
    const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
    const token = authInfo.token || (await getSetting('auth_token', ''));

    const headers = {
      'Content-Type': 'application/json',
      'X-Database-Env': 'prod'
    };
    if (token) headers['Authorization'] = \`Bearer \${token}\`;

    const res = await fetch(\`\${baseUrl}/api/gis/predios/verificar-conflicto\`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cod_catastral: predio.codigo || predio.clave_catastral || null
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Aviso verificando conflicto:', e);
  }
  return { conflicto: false };
}`;

const newCheckConflict = `export async function checkPredioConflict(predio, authInfo = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  try {
    const baseUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
    const token = authInfo?.token || (await getSetting('auth_token', ''));

    const headers = {
      'Content-Type': 'application/json',
      'X-Database-Env': 'prod'
    };
    if (token) headers['Authorization'] = \`Bearer \${token}\`;

    const res = await fetch(\`\${baseUrl}/api/gis/predios/verificar-conflicto\`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cod_catastral: predio.codigo || predio.clave_catastral || null
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn('Aviso verificando conflicto:', e);
  }
  return { conflicto: false };
}`;

if (apiContent.includes(oldCheckConflict)) {
  apiContent = apiContent.replace(oldCheckConflict, newCheckConflict);
  console.log('✓ checkPredioConflict actualizado con AbortController (4s)');
} else {
  console.log('⚠ checkPredioConflict ya estaba modificado o texto difiere');
}

// Asegurar timeouts independientes en uploadSinglePredio
const oldUploadSingleStart = `  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    let posesionarioId = predio.posesionario_id || null;
    if (!posesionarioId && predio.propietario && predio.cedula) {
      try {
        const posRes = await fetch(\`\${baseUrl}/api/gis/posesionarios\`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            cedula: String(predio.cedula || '').trim(),
            nombre: String(predio.propietario || '').trim()
          }),
          signal: controller.signal
        });
        if (posRes.ok) {
          const posData = await posRes.json();
          posesionarioId = posData.id;
        }
      } catch (posErr) {
        console.warn('Aviso: posesionario independiente no registrado:', posErr);
      }
    }`;

const newUploadSingleStart = `  try {
    let posesionarioId = predio.posesionario_id || null;
    if (!posesionarioId && predio.propietario && predio.cedula) {
      try {
        const posController = new AbortController();
        const posTimeout = setTimeout(() => posController.abort(), 4000);
        const posRes = await fetch(\`\${baseUrl}/api/gis/posesionarios\`, {
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
    }`;

if (apiContent.includes(oldUploadSingleStart)) {
  apiContent = apiContent.replace(oldUploadSingleStart, newUploadSingleStart);
  console.log('✓ Timeouts independientes en posesionario configurados');
}

// Timeout para la subida del predio
const oldPredioFetch = `    const targetUrl = overwriteId ? \`\${baseUrl}/api/gis/predios/\${overwriteId}\` : \`\${baseUrl}/api/gis/predios\`;
    const targetMethod = overwriteId ? 'PUT' : 'POST';
    const res = await fetch(targetUrl, {
      method: targetMethod,
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);`;

const newPredioFetch = `    const predioController = new AbortController();
    const predioTimeout = setTimeout(() => predioController.abort(), 8000);
    const targetUrl = overwriteId ? \`\${baseUrl}/api/gis/predios/\${overwriteId}\` : \`\${baseUrl}/api/gis/predios\`;
    const targetMethod = overwriteId ? 'PUT' : 'POST';
    const res = await fetch(targetUrl, {
      method: targetMethod,
      headers,
      body: JSON.stringify(payload),
      signal: predioController.signal
    });
    clearTimeout(predioTimeout);`;

if (apiContent.includes(oldPredioFetch)) {
  apiContent = apiContent.replace(oldPredioFetch, newPredioFetch);
  console.log('✓ Timeout independiente en predio fetch (8s) configurado');
}

// En el catch de uploadSinglePredio
const oldUploadCatch = `  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, error: err.name === 'AbortError' ? 'Timeout: Señal de red insuficiente' : err.message };
  }`;

const newUploadCatch = `  } catch (err) {
    return { success: false, error: err.name === 'AbortError' ? 'Timeout: Señal de red insuficiente al subir' : err.message };
  }`;

if (apiContent.includes(oldUploadCatch)) {
  apiContent = apiContent.replace(oldUploadCatch, newUploadCatch);
}

fs.writeFileSync(apiPath, apiContent, 'utf8');
console.log('✓ api.js guardado.');

// 2. Modificar movil/src/services/mobileDB.js
const dbPath = path.join(movilDir, 'src/services/mobileDB.js');
let dbContent = fs.readFileSync(dbPath, 'utf8');

const oldDeleteOffline = `export async function deleteOfflinePredio(id) {
  const db = await initDB();
  return db.delete('offline_predios', id);
}`;

const newDeleteOffline = `export async function deleteOfflinePredio(id) {
  try {
    const db = await initDB();
    await db.delete('offline_predios', id);
  } catch (e) {
    console.warn('[mobileDB] Error eliminando de IndexedDB:', e);
  }

  // Eliminar también del backup LocalStorage
  try {
    const raw = localStorage.getItem('catastro_offline_predios_backup') || '[]';
    const list = JSON.parse(raw);
    const filtered = list.filter(p => p.offline_id !== id);
    localStorage.setItem('catastro_offline_predios_backup', JSON.stringify(filtered));
  } catch (e) {
    console.warn('[mobileDB] Error eliminando de LocalStorage backup:', e);
  }
}`;

if (dbContent.includes(oldDeleteOffline)) {
  dbContent = dbContent.replace(oldDeleteOffline, newDeleteOffline);
  console.log('✓ deleteOfflinePredio sincronizado con IndexedDB y LocalStorage');
}

const oldUpdateStatus = `export async function updatePredioSyncStatus(id, status, errorMsg = null) {
  const db = await initDB();
  const item = await db.get('offline_predios', id);
  if (item) {
    item.sync_status = status;
    if (errorMsg) item.sync_error = errorMsg;
    if (status === 'synced') item.synced_at = new Date().toISOString();
    await db.put('offline_predios', item);
  }
  return item;
}`;

const newUpdateStatus = `export async function updatePredioSyncStatus(id, status, errorMsg = null) {
  let item = null;
  try {
    const db = await initDB();
    item = await db.get('offline_predios', id);
    if (item) {
      item.sync_status = status;
      if (errorMsg) item.sync_error = errorMsg;
      if (status === 'synced') item.synced_at = new Date().toISOString();
      await db.put('offline_predios', item);
    }
  } catch (e) {
    console.warn('[mobileDB] Error actualizando IndexedDB:', e);
  }

  // Actualizar también en LocalStorage backup
  try {
    const raw = localStorage.getItem('catastro_offline_predios_backup') || '[]';
    const list = JSON.parse(raw);
    const idx = list.findIndex(p => p.offline_id === id);
    if (idx !== -1) {
      list[idx].sync_status = status;
      if (errorMsg) list[idx].sync_error = errorMsg;
      if (status === 'synced') list[idx].synced_at = new Date().toISOString();
      localStorage.setItem('catastro_offline_predios_backup', JSON.stringify(list));
      if (!item) item = list[idx];
    }
  } catch (e) {
    console.warn('[mobileDB] Error actualizando LocalStorage backup:', e);
  }
  return item;
}`;

if (dbContent.includes(oldUpdateStatus)) {
  dbContent = dbContent.replace(oldUpdateStatus, newUpdateStatus);
  console.log('✓ updatePredioSyncStatus sincronizado con IndexedDB y LocalStorage');
}

const oldGetOfflineCount = `export async function getOfflineCount() {
  const db = await initDB();
  const all = await db.getAll('offline_predios');
  return all.filter(p => p.sync_status !== 'synced').length;
}`;

const newGetOfflineCount = `export async function getOfflineCount() {
  const all = await getOfflinePredios();
  return (all || []).filter(p => p.sync_status !== 'synced').length;
}`;

if (dbContent.includes(oldGetOfflineCount)) {
  dbContent = dbContent.replace(oldGetOfflineCount, newGetOfflineCount);
  console.log('✓ getOfflineCount unificado con getOfflinePredios');
}

fs.writeFileSync(dbPath, dbContent, 'utf8');
console.log('✓ mobileDB.js guardado.');

// 3. Modificar movil/src/pages/SyncTab/SyncCenterMobile.jsx
const syncPath = path.join(movilDir, 'src/pages/SyncTab/SyncCenterMobile.jsx');
let syncContent = fs.readFileSync(syncPath, 'utf8');

// Arreglar imports de SyncCenterMobile.jsx
syncContent = syncContent.replace(
  "import { getOfflinePredios, deleteOfflinePredio, exportBackupJSON, importBackupJSON } from '../../services/mobileDB';",
  "import { getOfflinePredios, deleteOfflinePredio, updatePredioSyncStatus, exportBackupJSON, importBackupJSON } from '../../services/mobileDB';"
);

syncContent = syncContent.replace(
  "import { uploadSinglePredio, promptRenewSession } from '../../services/api';",
  "import { uploadSinglePredio, promptRenewSession, checkPredioConflict } from '../../services/api';"
);

// Reemplazar handleUploadSingle con la versión robusta y a prueba de fallos
const handleUploadSingleRegex = /  \/\/ Subir un solo predio[\s\S]*?  \/\/ Eliminar predio local/;

const newHandleUploadSingleCode = `  // Subir un solo predio
  const handleUploadSingle = async (predio) => {
    if (!isOnline) {
      Swal.fire({
        icon: 'warning',
        title: 'Modo Offline',
        text: 'Se requiere conexión a internet para subir el predio.',
        confirmButtonColor: '#0284c7',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }

    try {
      // 1. Mostrar loader inicial institucional
      Swal.fire({
        title: 'Subiendo Predio...',
        html: \`<div style="font-size: 13px; color: #475569; margin-top: 8px;">
                 Sincronizando <b>\${predio.codigo || 'Predio'}</b> con el servidor central de Catastro...
               </div>\`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
        background: '#ffffff',
        color: '#0f172a'
      });

      // 2. Verificar conflicto primero
      let overwriteId = null;
      let finalPredio = predio;
      const conflictCheck = await checkPredioConflict(predio, auth);

      if (conflictCheck && conflictCheck.conflicto) {
        Swal.close();
        const userChoice = await Swal.fire({
          title: '⚠️ Conflicto de Predio',
          html: \`
            <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.5;">
              El código <b style="color: #0284c7;">\${predio.codigo || 'S/C'}</b> ya existe en la base central de Urdaneta.
              <div style="background: #f8fafc; padding: 10px; border-radius: 8px; margin: 10px 0; border: 1px solid #e2e8f0;">
                <div style="font-size: 11px; color: #64748b; font-weight:bold;">REGISTRO EN SERVIDOR:</div>
                <div>👤 Posesionario: <b>\${conflictCheck.predio_existente?.posesionario || conflictCheck.predio_existente?.posesionario_nombre || 'Sin posesionario'}</b></div>
                <div>📐 Área: <b>\${conflictCheck.predio_existente?.area_ha ? (conflictCheck.predio_existente.area_ha * 10000).toFixed(1) + ' m²' : 'N/A'}</b></div>
                <div>✍️ Creador: <b>\${conflictCheck.predio_existente?.creador || conflictCheck.predio_existente?.creador_nombre || 'Sistema'}</b></div>
              </div>
              ¿Deseas sobreescribir el predio existente con tu nuevo levantamiento de campo?
            </div>
          \`,
          showDenyButton: true,
          showCancelButton: true,
          reverseButtons: true,
          confirmButtonText: '🔄 Sobreescribir',
          denyButtonText: '➕ Nuevo Código',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#f59e0b',
          denyButtonColor: '#0284c7',
          cancelButtonColor: '#94a3b8',
          background: '#ffffff',
          color: '#0f172a',
          allowOutsideClick: false
        });

        if (userChoice.isConfirmed) {
          overwriteId = conflictCheck.predio_existente?.id || null;
        } else if (userChoice.isDenied) {
          const pad = (n) => String(n).padStart(2, '0');
          const d = new Date();
          finalPredio = { ...predio, codigo: \`\${predio.codigo}-\${pad(d.getSeconds())}\` };
        } else {
          return; // Cancelar
        }

        Swal.fire({
          title: 'Subiendo Predio...',
          html: \`<div style="font-size: 13px; color: #475569; margin-top: 8px;">
                   Guardando <b>\${finalPredio.codigo}</b> en la base de datos central...
                 </div>\`,
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            Swal.showLoading();
          },
          background: '#ffffff',
          color: '#0f172a'
        });
      }

      // 3. Subir predio
      let res = await uploadSinglePredio(finalPredio, auth, overwriteId);

      // Si fue error de credenciales / sesión
      if (!res.success && (res.isAuthError || String(res.error).includes('401') || String(res.error).includes('credentials') || String(res.error).includes('expirada'))) {
        Swal.close();
        const renewRes = await promptRenewSession(auth?.username || 'lcedeno');
        if (renewRes.success && renewRes.token) {
          const updatedAuth = { ...auth, token: renewRes.token };
          if (setAuthState) await setAuthState(updatedAuth);
          Swal.fire({
            title: 'Subiendo Predio...',
            html: \`<div style="font-size: 13px; color: #475569; margin-top: 8px;">
                     Reintentando subida con nueva sesión...
                   </div>\`,
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
              Swal.showLoading();
            },
            background: '#ffffff',
            color: '#0f172a'
          });
          res = await uploadSinglePredio(finalPredio, updatedAuth, overwriteId);
        }
      }

      Swal.close();

      if (res.success) {
        await updatePredioSyncStatus(predio.offline_id, 'synced');
        await refreshOfflineCount();
        await loadList();
        Swal.fire({
          icon: 'success',
          title: '¡Predio Sincronizado!',
          text: \`El predio \${finalPredio.codigo || 'sin código'} fue guardado con éxito en el Geoportal central.\`,
          confirmButtonColor: '#10b981',
          confirmButtonText: 'Aceptar',
          background: '#ffffff',
          color: '#0f172a'
        });
      } else {
        await updatePredioSyncStatus(predio.offline_id, 'error', res.error);
        await refreshOfflineCount();
        await loadList();
        Swal.fire({
          icon: res.isAuthError ? 'warning' : 'error',
          title: res.isAuthError ? 'Sesión Expirada' : 'Error al subir',
          text: res.isAuthError ? 'Tu sesión expiró. Inicia sesión en Ajustes para sincronizar.' : (res.error || 'No se pudo conectar con el servidor.'),
          confirmButtonColor: '#f59e0b',
          confirmButtonText: 'Entendido',
          background: '#ffffff',
          color: '#0f172a'
        });
      }
    } catch (err) {
      console.error('Error al subir predio individual:', err);
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error de sincronización',
        text: err?.message || 'Ocurrió un error inesperado al subir el predio.',
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Entendido',
        background: '#ffffff',
        color: '#0f172a'
      });
    }
  };

  // Eliminar predio local`;

if (handleUploadSingleRegex.test(syncContent)) {
  syncContent = syncContent.replace(handleUploadSingleRegex, newHandleUploadSingleCode);
  console.log('✓ handleUploadSingle reemplazado con gestión completa de errores y loader');
} else {
  console.error('❌ No se pudo encontrar el bloque handleUploadSingle para reemplazar');
}

// Mejorar handleDelete para que tenga reverseButtons y cancelButtonColor correcto
syncContent = syncContent.replace(
  `    const res = await Swal.fire({
      title: '¿Eliminar predio local?',
      text: 'Se borrará permanentemente de la memoria del teléfono.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#0f172a'
    });`,
  `    const res = await Swal.fire({
      title: '¿Eliminar predio local?',
      text: 'Se borrará permanentemente de la memoria del teléfono.',
      icon: 'warning',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#0f172a'
    });`
);

fs.writeFileSync(syncPath, syncContent, 'utf8');
console.log('✓ SyncCenterMobile.jsx guardado.');

// 4. Actualizar versiones a 4.7.4 (código 44)
const pkgPath = path.join(movilDir, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '4.7.4';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log('✓ movil/package.json actualizado a v4.7.4');

const gradlePath = path.join(movilDir, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, 'versionCode 44');
gradle = gradle.replace(/versionName "[^"]+"/, 'versionName "4.7.4"');
fs.writeFileSync(gradlePath, gradle, 'utf8');
console.log('✓ build.gradle actualizado a versionCode 44 / versionName 4.7.4');

const headerPath = path.join(movilDir, 'src/components/MobileHeader.jsx');
let header = fs.readFileSync(headerPath, 'utf8');
header = header.replace(/v4\.7\.\d+/g, 'v4.7.4');
fs.writeFileSync(headerPath, header, 'utf8');
console.log('✓ MobileHeader.jsx actualizado a v4.7.4');

const loginPath = path.join(movilDir, 'src/pages/Login/LoginMobile.jsx');
let login = fs.readFileSync(loginPath, 'utf8');
login = login.replace(/v4\.7\.\d+/g, 'v4.7.4');
fs.writeFileSync(loginPath, login, 'utf8');
console.log('✓ LoginMobile.jsx actualizado a v4.7.4');

console.log('=== TODAS LAS CORRECCIONES APLICADAS CON ÉXITO ===');
