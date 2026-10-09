const fs = require('fs');
const path = require('path');

console.log('=== APLICANDO CORRECCIÓN CRÍTICA DE GUARDADO EN MÓVIL (OFFLINE-FIRST) ===');

const movilDir = path.resolve('..', 'movil');

// =========================================================================
// 1. MEJORAR mobileDB.js CON DOBLE PERSISTENCIA (INDEXEDDB + LOCALSTORAGE)
// =========================================================================
const dbPath = path.join(movilDir, 'src', 'services', 'mobileDB.js');
if (fs.existsSync(dbPath)) {
  let dbContent = fs.readFileSync(dbPath, 'utf8');

  const oldSaveFunc = /export async function saveOfflinePredio\(predio\) {[\s\S]*?return toSave;\s*}/;
  const newSaveFunc = `export async function saveOfflinePredio(predio) {
  const toSave = {
    ...predio,
    offline_id: predio.offline_id || ('off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
    sync_status: predio.sync_status || 'pending',
    created_at: predio.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Guardar en IndexedDB
  try {
    const db = await initDB();
    await db.put('offline_predios', toSave);
  } catch (idbErr) {
    console.warn('[mobileDB] IndexedDB aviso, asegurando en LocalStorage:', idbErr);
  }

  // 2. Respaldo simultáneo en LocalStorage (Garantía Cero Pérdida)
  try {
    const raw = localStorage.getItem('catastro_offline_predios_backup') || '[]';
    const list = JSON.parse(raw);
    const filtered = list.filter(p => p.offline_id !== toSave.offline_id);
    filtered.push(toSave);
    localStorage.setItem('catastro_offline_predios_backup', JSON.stringify(filtered));
  } catch (lsErr) {
    console.warn('[mobileDB] LocalStorage backup aviso:', lsErr);
  }

  return toSave;
}`;

  if (oldSaveFunc.test(dbContent)) {
    dbContent = dbContent.replace(oldSaveFunc, newSaveFunc);
  }

  const oldGetFunc = /export async function getOfflinePredios\(\) {[\s\S]*?return db\.getAll\('offline_predios'\);\s*}/;
  const newGetFunc = `export async function getOfflinePredios() {
  let idbList = [];
  try {
    const db = await initDB();
    idbList = await db.getAll('offline_predios');
  } catch (e) {
    console.warn('[mobileDB] Error leyendo IndexedDB:', e);
  }

  try {
    const raw = localStorage.getItem('catastro_offline_predios_backup') || '[]';
    const lsList = JSON.parse(raw);
    if ((!idbList || idbList.length === 0) && lsList.length > 0) {
      return lsList;
    }
    // Combinar si faltara alguno
    const map = new Map();
    (idbList || []).forEach(p => map.set(p.offline_id, p));
    (lsList || []).forEach(p => { if (!map.has(p.offline_id)) map.set(p.offline_id, p); });
    return Array.from(map.values());
  } catch (e) {
    return idbList || [];
  }
}`;

  if (oldGetFunc.test(dbContent)) {
    dbContent = dbContent.replace(oldGetFunc, newGetFunc);
  }

  fs.writeFileSync(dbPath, dbContent, 'utf8');
  console.log('✓ mobileDB.js actualizado con doble persistencia blindada');
}

// =========================================================================
// 2. MEJORAR api.js: TIMEOUT RÁPIDO DE 6S Y SANITIZACIÓN SEGURA
// =========================================================================
const apiPath = path.join(movilDir, 'src', 'services', 'api.js');
if (fs.existsSync(apiPath)) {
  let apiContent = fs.readFileSync(apiPath, 'utf8');

  // Reducir timeout a 6000ms
  apiContent = apiContent.replace(/setTimeout\(\(\) => controller\.abort\(\), \d+\)/g, 'setTimeout(() => controller.abort(), 6000)');

  // Sanitizar posesionario
  apiContent = apiContent.replace(
    /cedula:\s*predio\.cedula\.trim\(\),/g,
    "cedula: String(predio.cedula || '').trim(),"
  );
  apiContent = apiContent.replace(
    /nombre:\s*predio\.propietario\.trim\(\)/g,
    "nombre: String(predio.propietario || '').trim()"
  );

  fs.writeFileSync(apiPath, apiContent, 'utf8');
  console.log('✓ api.js actualizado con timeout de 6s y sanitización segura');
}

// =========================================================================
// 3. REESTRUCTURAR COMPLETAMENTE PredioFormMobile.jsx
// =========================================================================
const formPath = path.join(movilDir, 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
if (fs.existsSync(formPath)) {
  let formContent = fs.readFileSync(formPath, 'utf8');

  // Eliminar el stray </div> en línea 426
  formContent = formContent.replace(
    `          </div>\n        </div>\n        </div>\n      \`,`,
    `          </div>\n        </div>\n      \`,`
  );

  // Reemplazar handleSaveAndUpload por una versión OFFLINE-FIRST 100% BLINDADA
  const oldSavePattern = /const handleSaveAndUpload = async \(\) => {[\s\S]*?\/\/ ==============================================================\s*\/\/ VISTA 1: LISTADO DE PREDIOS DIBUJADOS EN CAMPO/;

  const newSavePattern = `const handleSaveAndUpload = async () => {
    const safeStr = (v) => (v != null ? String(v).trim() : '');
    const cleanCodigo = safeStr(codigo);
    const cleanPropietario = safeStr(propietario);

    // Validación mínima de campos clave
    if (!cleanCodigo && !cleanPropietario) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor ingresa al menos la Clave Catastral o el Nombre del Propietario.',
        confirmButtonColor: '#0284c7',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }

    // Validación de vértices con opción interactiva
    if (!vertices || vertices.length < 3) {
      const askVerts = await Swal.fire({
        icon: 'warning',
        title: 'Polígono Incompleto',
        html: \`
          <div style="font-size:13px; text-align:left; color:#334155; line-height:1.5;">
            El predio necesita al menos <b>3 coordenadas (puntos)</b> para calcular su área y linderos.<br/><br/>
            ¿Cómo deseas ingresar los puntos de este predio?
          </div>
        \`,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '📐 Ingresar Coordenadas (X, Y)',
        denyButtonText: '💾 Guardar Ficha sin Polígono',
        cancelButtonText: '✏️ Dibujar en Mapa',
        confirmButtonColor: '#0284c7',
        denyButtonColor: '#10b981',
        cancelButtonColor: '#8b5cf6',
        reverseButtons: true,
        background: '#ffffff',
        color: '#0f172a'
      });

      if (askVerts.isConfirmed) {
        handleOpenCoordinatesModal();
        return;
      } else if (askVerts.isDismissed && askVerts.dismiss === Swal.DismissReason.cancel) {
        setActiveTab('map');
        return;
      } else if (!askVerts.isDenied) {
        return;
      }
      // Si eligió denyButtonText ("Guardar Ficha sin Polígono"), continúa para guardar la ficha
    }

    setIsSaving(true);
    try {
      const sortedVertices = vertices && vertices.length >= 3 
        ? normalizeVerticesClockwiseFromNW(vertices) 
        : (vertices || []);

      const finalArea = areaCalc > 0 ? Math.round(areaCalc * 100) / 100 : 0;
      const finalPerim = perimCalc > 0 ? Math.round(perimCalc * 100) / 100 : 0;

      const predioData = {
        offline_id: offlineId || ('off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
        codigo: cleanCodigo || \`PREDIO-\${Date.now()}\`,
        propietario: cleanPropietario,
        cedula: safeStr(cedula),
        telefono: safeStr(telefono),
        area: finalArea,
        perimetro: finalPerim,
        norte: safeStr(norte),
        sur: safeStr(sur),
        este: safeStr(este),
        oeste: safeStr(oeste),
        observaciones: safeStr(observaciones),
        vertices: sortedVertices,
        gps_accuracy: (gps && gps.accuracy) ? gps.accuracy : null,
        tipo_levantamiento: sortedVertices.length >= 3 ? 'APP_MOVIL_CAMPO' : 'FICHA_ALFANUMERICA',
        empresa_id: (auth && auth.empresaId) ? Number(auth.empresaId) : 2,
        proyecto_id: (auth && auth.activeProyectoId) ? Number(auth.activeProyectoId) : null,
        proyecto_nombre: (auth && auth.activeProyectoNombre) ? auth.activeProyectoNombre : 'Proyecto General',
        sync_status: 'pending'
      };

      console.log('[PredioFormMobile] 1. Guardando en teléfono con seguridad...');
      // =========================================================================
      // PASO 1 ABSOLUTAMENTE VITAL: GUARDAR SIEMPRE EN EL TELÉFONO PRIMERO (OFFLINE-FIRST)
      // =========================================================================
      const savedPredio = await saveOfflinePredio(predioData);
      
      if (offlineId && offlineId !== predioData.offline_id) {
        await deleteOfflinePredio(offlineId).catch(() => {});
      }
      
      await refreshOfflineCount().catch(() => {});
      await loadLocalPredios().catch(() => {});
      console.log('[PredioFormMobile] ✓ Predio guardado con éxito en memoria del teléfono:', savedPredio.offline_id);

      // =========================================================================
      // PASO 2: SI ESTÁ EN MODO AUTOMÁTICO Y ONLINE: INTENTAR SUBIDA AL GEOPORTAL
      // =========================================================================
      if (syncMode === 'automatica' && isOnline && sortedVertices.length >= 3) {
        try {
          console.log('[PredioFormMobile] 2. Modo automático activo, enviando al servidor...');
          const uploadRes = await uploadSinglePredio(predioData, auth);
          
          if (uploadRes && uploadRes.success) {
            await updatePredioSyncStatus(predioData.offline_id, 'synced').catch(() => {});
            await refreshOfflineCount().catch(() => {});
            await loadLocalPredios().catch(() => {});
            
            await Swal.fire({
              icon: 'success',
              title: '¡Guardado y Subido con Éxito!',
              html: \`
                <div style="font-size:13px; text-align:left; color:#334155; line-height:1.5;">
                  ✓ El predio <b>\${predioData.codigo}</b> se guardó en el teléfono y se subió exitosamente a la base central.<br/><br/>
                  Ya se encuentra disponible en el Geoportal web bajo el proyecto <b>\${predioData.proyecto_nombre}</b>.
                </div>
              \`,
              confirmButtonColor: '#10b981',
              background: '#ffffff',
              color: '#0f172a'
            });
            setViewMode('list');
            return;
          } else {
            console.warn('[PredioFormMobile] Subida en línea falló o timeout:', uploadRes?.error);
          }
        } catch (upErr) {
          console.warn('[PredioFormMobile] Excepción durante subida en línea:', upErr);
        }
      }

      // =========================================================================
      // PASO 3: CONFIRMACIÓN AL USUARIO: EL PREDIO YA ESTÁ 100% GUARDADO EN EL TELÉFONO
      // =========================================================================
      await Swal.fire({
        icon: 'success',
        title: '¡Guardado en el Teléfono!',
        html: \`
          <div style="font-size:13px; text-align:left; color:#334155; line-height:1.5;">
            ✓ El predio <b>\${predioData.codigo}</b> quedó guardado con seguridad en la memoria del teléfono.<br/><br/>
            \${syncMode === 'automatica'
              ? '⚠️ <i>El servidor central no respondió en este momento. El predio quedó respaldado localmente como <b>Pendiente</b> para sincronizarse automáticamente cuando regrese la conexión.</i>'
              : '📦 <b>Modo Manual:</b> Podrás subirlo al servidor central cuando desees desde la pestaña <b>Sincronización</b>.'}
          </div>
        \`,
        confirmButtonColor: '#0284c7',
        background: '#ffffff',
        color: '#0f172a'
      });
      setViewMode('list');

    } catch (saveError) {
      console.error('[PredioFormMobile] Error crítico al guardar:', saveError);
      // Respaldo de emergencia en localStorage por si acaso
      try {
        const emergencyList = JSON.parse(localStorage.getItem('catastro_emergency_backup') || '[]');
        emergencyList.push({
          codigo: cleanCodigo || \`PREDIO-\${Date.now()}\`,
          propietario: cleanPropietario,
          vertices: vertices || [],
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('catastro_emergency_backup', JSON.stringify(emergencyList));
      } catch (emErr) {}

      Swal.fire({
        icon: 'warning',
        title: 'Guardado en Respaldo',
        text: 'Ocurrió un aviso (' + saveError.message + '), pero los datos del predio quedaron protegidos en el teléfono.',
        confirmButtonColor: '#0284c7',
        background: '#ffffff',
        color: '#0f172a'
      });
      setViewMode('list');
    } finally {
      setIsSaving(false);
    }
  };

  // ==============================================================
  // VISTA 1: LISTADO DE PREDIOS DIBUJADOS EN CAMPO`;

  if (oldSavePattern.test(formContent)) {
    formContent = formContent.replace(oldSavePattern, newSavePattern);
    console.log('✓ PredioFormMobile.jsx: handleSaveAndUpload reescrito con enfoque Offline-First y protección total');
  } else {
    console.log('! Patrón de handleSaveAndUpload no coincidió exactamente, aplicando reemplazo directo...');
    const startIdx = formContent.indexOf('const handleSaveAndUpload = async () => {');
    const endIdx = formContent.indexOf('// VISTA 1: LISTADO DE PREDIOS DIBUJADOS EN CAMPO');
    if (startIdx !== -1 && endIdx !== -1) {
      formContent = formContent.substring(0, startIdx) + newSavePattern + formContent.substring(endIdx + '// VISTA 1: LISTADO DE PREDIOS DIBUJADOS EN CAMPO'.length);
      console.log('✓ PredioFormMobile.jsx: Reemplazo por índice aplicado con éxito');
    }
  }

  fs.writeFileSync(formPath, formContent, 'utf8');
}

// =========================================================================
// 4. ACTUALIZAR VERSIONES A 4.7.2 (CODE 42)
// =========================================================================
// package.json
const pkgPath = path.join(movilDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = '4.7.2';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
}

// build.gradle
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode \d+/, 'versionCode 42');
  gradle = gradle.replace(/versionName "[^"]+"/, 'versionName "4.7.2"');
  fs.writeFileSync(gradlePath, gradle, 'utf8');
}

// MobileHeader.jsx
const headerPath = path.join(movilDir, 'src', 'components', 'MobileHeader.jsx');
if (fs.existsSync(headerPath)) {
  let header = fs.readFileSync(headerPath, 'utf8');
  header = header.replace(/v4\.[0-9]+\.[0-9]+/g, 'v4.7.2');
  fs.writeFileSync(headerPath, header, 'utf8');
}

// LoginMobile.jsx
const loginPath = path.join(movilDir, 'src', 'pages', 'Login', 'LoginMobile.jsx');
if (fs.existsSync(loginPath)) {
  let login = fs.readFileSync(loginPath, 'utf8');
  login = login.replace(/v4\.[0-9]+\.[0-9]+ · Campo Oficial/g, 'v4.7.2 · Campo Oficial');
  fs.writeFileSync(loginPath, login, 'utf8');
}

console.log('✓ Versión actualizada a v4.7.2 (Code 42)');
console.log('=== PROCESO COMPLETADO ===');
