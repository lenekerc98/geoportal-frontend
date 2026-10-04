const fs = require('fs');
const path = require('path');

console.log('=== APLICANDO MEJORAS COMPLETAS EN MOVIL ===');

// =========================================================================
// 1. ACTUALIZAR MobileContext.jsx CON SINCRONIZACIÓN EN VIVO DESDE GEOPORTAL
// =========================================================================
const contextPath = path.resolve('..', 'movil', 'src', 'context', 'MobileContext.jsx');
if (fs.existsSync(contextPath)) {
  let content = fs.readFileSync(contextPath, 'utf8');

  // Asegurar que getServerUrl está importado si no lo está
  if (!content.includes('getServerUrl')) {
    content = content.replace(
      "import { getSetting, setSetting, getOfflinePrediosCount }",
      "import { getSetting, setSetting, getOfflinePrediosCount }\nimport { getServerUrl } from '../services/api';"
    );
  }

  // Reemplazar la lógica de syncMode por una función de sincronización proactiva con el Geoportal
  const syncModeOldPattern = /\/\/ Sync state[\s\S]*?const switchSyncMode = useCallback[\s\S]*?await setSetting\('sync_mode', mode\);\s*}, \[\]\);/;

  const syncModeNewLogic = `// Sync state con sincronización en tiempo real desde el Geoportal
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, message: '' });
  const [syncMode, setSyncModeState] = useState('manual'); // 'manual' | 'automatica'
  const [syncSource, setSyncSource] = useState('local'); // 'geoportal' | 'local'

  // Función proactiva para sincronizar los parámetros de la empresa desde el Geoportal
  const syncModeWithServer = useCallback(async () => {
    try {
      // 1. Carga inmediata de configuración local para disponibilidad offline
      const saved = await getSetting('sync_mode');
      if (saved) setSyncModeState(saved);

      // 2. Si hay conexión y servidor configurado, consultar el parámetro oficial del Geoportal
      const serverUrl = (await getServerUrl()).trim().replace(/\\/+$/, '');
      const token = auth?.token || (await getSetting('auth_token', ''));
      const empresaId = auth?.empresaId || (await getSetting('empresa_id', null));

      if (!serverUrl || !empresaId) return;

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = \`Bearer \${token}\`;

      let remoteMode = null;
      try {
        const res = await fetch(\`\${serverUrl}/api/empresas\`, { headers, signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            const activeEmp = list.find(e => e.id === Number(empresaId));
            if (activeEmp?.parametros?.modo_subida_movil) {
              remoteMode = activeEmp.parametros.modo_subida_movil;
            }
          }
        }
      } catch (e) {
        // En caso de fallo de red, se mantiene el modo local
      }

      if (remoteMode && (remoteMode === 'manual' || remoteMode === 'automatica')) {
        console.log(\`[MobileSync] Modo sincronizado exitosamente desde Geoportal: \${remoteMode}\`);
        setSyncModeState(remoteMode);
        setSyncSource('geoportal');
        await setSetting('sync_mode', remoteMode);
      }
    } catch (e) {
      console.warn('Aviso: modo de sincronización operando en caché local:', e);
    }
  }, [auth?.token, auth?.empresaId]);

  useEffect(() => {
    syncModeWithServer();
  }, [syncModeWithServer]);

  const switchSyncMode = useCallback(async (mode) => {
    setSyncModeState(mode);
    setSyncSource('local');
    await setSetting('sync_mode', mode);
  }, []);`;

  if (syncModeOldPattern.test(content)) {
    content = content.replace(syncModeOldPattern, syncNewPattern => syncModeNewLogic);
    // Exponer syncModeWithServer y syncSource en el Provider
    content = content.replace(
      "syncMode, switchSyncMode,",
      "syncMode, switchSyncMode, syncModeWithServer, syncSource,"
    );
    fs.writeFileSync(contextPath, content, 'utf8');
    console.log('✓ MobileContext.jsx actualizado con sincronización proactiva de parámetros de Geoportal');
  } else {
    console.log('! Patrón de syncMode no coincidió exactamente en MobileContext.jsx, revisando...');
  }
}

// =========================================================================
// 2. ACTUALIZAR PredioFormMobile.jsx CON OPCIÓN DE COORDENADAS Y BOTONES
// =========================================================================
const formPath = path.resolve('..', 'movil', 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
if (fs.existsSync(formPath)) {
  let content = fs.readFileSync(formPath, 'utf8');

  // Asegurar que si faltan vértices al guardar, ofrezca ingresar coordenadas interactivamente
  const incompleteGeomOld = `if (vertices.length < 3) {
      Swal.fire({
        icon: 'warning',
        title: 'Geometría Incompleta',
        text: 'Agrega al menos 3 puntos para formar el polígono del predio.',
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }`;

  const incompleteGeomNew = `if (vertices.length < 3) {
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
        denyButtonText: '✏️ Dibujar en Mapa',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0284c7',
        denyButtonColor: '#8b5cf6',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        background: '#ffffff',
        color: '#0f172a'
      });

      if (askVerts.isConfirmed) {
        handleOpenCoordinatesModal();
      } else if (askVerts.isDenied) {
        setActiveTab('map');
      }
      return;
    }`;

  if (content.includes(incompleteGeomOld)) {
    content = content.replace(incompleteGeomOld, incompleteGeomNew);
    console.log('✓ PredioFormMobile.jsx: Agregado asistente interactivo para ingresar coordenadas si faltan vértices');
  }

  // Mejorar handleSaveAndUpload en modo manual y en modo automático
  const manualSaveOld = `if (syncMode === 'manual') {
      try {
        predioData.sync_status = 'pending';
        await saveOfflinePredio(predioData);
        if (offlineId && offlineId !== predioData.offline_id) {
          await deleteOfflinePredio(offlineId);
        }
        await refreshOfflineCount();
        await loadLocalPredios();
        Swal.fire({
          icon: 'success',
          title: '¡Guardado en el Teléfono!',
          html: \`
            <div style="font-size:13px; text-align:left; color:#334155; line-height:1.5;">
              El predio <b>\${codigo || 'S/D'}</b> se guardó exitosamente en la memoria local (<b>Modo Manual</b>).<br/><br/>
              Podrás subirlo al servidor cuando desees desde la pestaña <b>Sincronización</b>.
            </div>
          \`,
          confirmButtonColor: '#0284c7',
          background: '#ffffff',
          color: '#0f172a'
        });
        setViewMode('list');
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error al Guardar', text: err.message });
      } finally {
        setIsSaving(false);
      }
      return;
    }`;

  const manualSaveNew = `if (syncMode === 'manual') {
      try {
        predioData.sync_status = 'pending';
        await saveOfflinePredio(predioData);
        if (offlineId && offlineId !== predioData.offline_id) {
          await deleteOfflinePredio(offlineId);
        }
        await refreshOfflineCount();
        await loadLocalPredios();

        const askDirect = await Swal.fire({
          icon: 'success',
          title: '¡Guardado en el Teléfono!',
          html: \`
            <div style="font-size:13px; text-align:left; color:#334155; line-height:1.5;">
              El predio <b>\${codigo || 'S/D'}</b> se guardó exitosamente en la memoria interna (<b>Modo Manual</b>).<br/><br/>
              \${isOnline 
                ? '🟢 Tienes conexión a internet disponible. ¿Deseas subirlo inmediatamente a la base central del Geoportal o mantenerlo guardado en el teléfono?' 
                : '📦 Tus datos están respaldados de forma segura. Podrás subirlos al volver con Wi-Fi desde la pestaña <b>Sincronización</b>.'}
            </div>
          \`,
          showCancelButton: isOnline,
          confirmButtonText: isOnline ? '⚡ Subir al Geoportal Ahora' : 'Entendido',
          cancelButtonText: 'Mantener en Teléfono',
          confirmButtonColor: isOnline ? '#10b981' : '#0284c7',
          cancelButtonColor: '#64748b',
          reverseButtons: true,
          background: '#ffffff',
          color: '#0f172a'
        });

        if (isOnline && askDirect.isConfirmed) {
          Swal.fire({
            title: 'Subiendo al Geoportal...',
            html: 'Enviando geometría y ficha catastral a la base de datos central.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            background: '#ffffff',
            color: '#0f172a'
          });
          const upRes = await uploadSinglePredio(predioData, auth);
          if (upRes.success) {
            predioData.sync_status = 'synced';
            await saveOfflinePredio(predioData);
            await refreshOfflineCount();
            await loadLocalPredios();
            Swal.fire({
              icon: 'success',
              title: '¡Subido con Éxito al Geoportal!',
              text: \`El predio \${codigo || ''} ya se encuentra registrado y disponible en el mapa central.\`,
              confirmButtonColor: '#10b981',
              background: '#ffffff',
              color: '#0f172a'
            });
          } else {
            Swal.fire({
              icon: 'warning',
              title: 'Guardado Offline',
              text: \`No se pudo conectar con el Geoportal (\${upRes.error}). El predio quedó guardado en el teléfono listo para sincronizar.\`,
              confirmButtonColor: '#0284c7',
              background: '#ffffff',
              color: '#0f172a'
            });
          }
        }

        setViewMode('list');
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error al Guardar', text: err.message });
      } finally {
        setIsSaving(false);
      }
      return;
    }`;

  if (content.includes(manualSaveOld)) {
    content = content.replace(manualSaveOld, manualSaveNew);
    console.log('✓ PredioFormMobile.jsx: Modo manual mejorado con opción de subida directa si hay conexión');
  }

  // Agregar función handleOpenCoordinatesModal en PredioFormMobile si no existe
  if (!content.includes('const handleOpenCoordinatesModal =')) {
    const coordsModalFunc = `
  // Modal interactivo para ingresar coordenadas (P01..P04) directamente en el formulario
  const handleOpenCoordinatesModal = async () => {
    const { value: formValues } = await Swal.fire({
      title: '📐 Puntos (P01, P02...) y Colindantes',
      width: '94%',
      customClass: { popup: 'swal-compact-modal' },
      html: \`
        <div style="display:flex; flex-direction:column; gap:8px; text-align:left; font-size:12px; width:100%; box-sizing:border-box;">
          <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:8px 10px; color:#0369a1; font-size:11px; line-height:1.4;">
            Ingresa las coordenadas UTM 17S (X, Y) y el colindante de cada lado del predio.
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <span style="font-weight:700; color:#0f172a; font-size:12px;">📍 Puntos y Colindantes:</span>
            <button id="swal-form-add-v-btn" type="button" style="background:#0284c7; color:#fff; border:none; border-radius:6px; padding:4px 8px; font-size:11px; font-weight:700; cursor:pointer;">
              + Añadir Punto
            </button>
          </div>
          <div id="swal-form-vertices-list" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto; padding-right:2px; margin-top:2px;">
          </div>
        </div>
      \`,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Guardar Coordenadas',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#64748b',
      background: '#ffffff',
      color: '#0f172a',
      didOpen: () => {
        const listContainer = document.getElementById('swal-form-vertices-list');
        const addBtn = document.getElementById('swal-form-add-v-btn');

        const createCard = (idx, total, initX = '', initY = '', initCol = '') => {
          const nextIdx = (idx % total) + 1;
          const card = document.createElement('div');
          card.className = 'swal-v-card';
          card.style.cssText = 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:6px; width:100%; box-sizing:border-box;';
          card.innerHTML = \`
            <div style="display:flex; align-items:center; gap:6px; width:100%; box-sizing:border-box;">
              <span class="swal-v-lbl" style="font-size:11px; font-weight:800; color:#0284c7; background:#e0f2fe; padding:3px 6px; border-radius:6px; flex-shrink:0;">P\${String(idx).padStart(2, "0")}</span>
              <input class="swal-v-x" type="number" step="0.01" value="\${initX}" placeholder="Este (X)" style="flex:1; min-width:0; height:32px; font-size:12px; background:#ffffff; color:#0f172a !important; border:1px solid #cbd5e1; border-radius:6px; padding:0 6px; box-sizing:border-box;">
              <input class="swal-v-y" type="number" step="0.01" value="\${initY}" placeholder="Norte (Y)" style="flex:1; min-width:0; height:32px; font-size:12px; background:#ffffff; color:#0f172a !important; border:1px solid #cbd5e1; border-radius:6px; padding:0 6px; box-sizing:border-box;">
              <button type="button" class="swal-v-del" style="width:28px; height:32px; background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.4); border-radius:6px; color:#f43f5e; font-size:12px; font-weight:bold; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>
            <div style="display:flex; align-items:center; gap:6px; width:100%; box-sizing:border-box;">
              <span class="swal-v-tramo-lbl" style="font-size:10px; color:#94a3b8; font-weight:600; white-space:nowrap; flex-shrink:0;">Lado P\${String(idx).padStart(2, "0")}➔P\${String(nextIdx).padStart(2, "0")}:</span>
              <input class="swal-v-colindante" type="text" value="\${initCol}" placeholder="Colindante (ej: Calle Pública / Vecino)" style="flex:1; min-width:0; height:28px; font-size:11px; background:#ffffff; color:#0f172a !important; border:1px solid #cbd5e1; border-radius:6px; padding:0 6px; box-sizing:border-box;">
            </div>
          \`;
          card.querySelector('.swal-v-del').onclick = () => {
            card.remove();
            renumber();
          };
          return card;
        };

        const renumber = () => {
          const cards = listContainer.querySelectorAll('.swal-v-card');
          const total = cards.length;
          cards.forEach((c, i) => {
            const idx = i + 1;
            const nextIdx = (idx % total) + 1;
            const lbl = c.querySelector('.swal-v-lbl');
            const tramoLbl = c.querySelector('.swal-v-tramo-lbl');
            if (lbl) lbl.textContent = \`P\${String(idx).padStart(2, "0")}\`;
            if (tramoLbl) tramoLbl.textContent = \`Lado P\${String(idx).padStart(2, "0")}➔P\${String(nextIdx).padStart(2, "0")}:\`;
          });
        };

        const currentV = vertices.length >= 3 ? vertices : [];
        if (currentV.length >= 3) {
          currentV.forEach((v, i) => {
            const vx = v.x ?? (Array.isArray(v) ? v[0] : '');
            const vy = v.y ?? (Array.isArray(v) ? v[1] : '');
            listContainer.appendChild(createCard(i + 1, currentV.length, vx, vy, v.colindante || ''));
          });
        } else {
          for (let i = 1; i <= 4; i++) {
            listContainer.appendChild(createCard(i, 4));
          }
        }

        if (addBtn) {
          addBtn.onclick = () => {
            const currentTotal = listContainer.querySelectorAll('.swal-v-card').length;
            listContainer.appendChild(createCard(currentTotal + 1, currentTotal + 1));
            renumber();
            listContainer.scrollTop = listContainer.scrollHeight;
          };
        }
      },
      preConfirm: () => {
        const listContainer = document.getElementById('swal-form-vertices-list');
        const cards = listContainer ? listContainer.querySelectorAll('.swal-v-card') : [];
        const parsed = [];
        cards.forEach((c, i) => {
          const vx = parseFloat(c.querySelector('.swal-v-x')?.value);
          const vy = parseFloat(c.querySelector('.swal-v-y')?.value);
          const col = c.querySelector('.swal-v-colindante')?.value?.trim() || '';
          if (!isNaN(vx) && !isNaN(vy)) {
            parsed.push({ x: vx, y: vy, orden: i + 1, colindante: col, accuracy: null });
          }
        });
        if (parsed.length < 3) {
          Swal.showValidationMessage('Ingresa al menos 3 puntos válidos (Este X y Norte Y).');
          return false;
        }
        return parsed;
      }
    });

    if (formValues && formValues.length >= 3) {
      const normalized = normalizeVerticesClockwiseFromNW(formValues);
      setVertices(normalized);
      setViewMode('form');
      Swal.fire({
        icon: 'success',
        title: 'Coordenadas Ingresadas',
        text: \`\${normalized.length} puntos cargados correctamente.\`,
        timer: 1500,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
    }
  };
`;
    content = content.replace(
      "// Crear nuevo predio en blanco (Ficha de Coordenadas y Colindantes)",
      coordsModalFunc + "\n  // Crear nuevo predio en blanco (Ficha de Coordenadas y Colindantes)"
    );

    // Conectar la opción 1 del menú para abrir este modal directamente
    content = content.replace(
      "if (optManual) optManual.onclick = () => {\n          Swal.close();\n          handleCreateBlankForm();\n        };",
      `if (optManual) optManual.onclick = () => {
          Swal.close();
          handleCreateBlankForm();
          setTimeout(() => handleOpenCoordinatesModal(), 200);
        };`
    );

    console.log('✓ PredioFormMobile.jsx: Opción 1 conectada al modal interactivo de coordenadas');
  }

  fs.writeFileSync(formPath, content, 'utf8');
}

// =========================================================================
// 3. ACTUALIZAR SettingsMobile.jsx CON ESTADO DE SINCRONIZACIÓN Y BOTÓN
// =========================================================================
const settingsPath = path.resolve('..', 'movil', 'src', 'pages', 'SettingsTab', 'SettingsMobile.jsx');
if (fs.existsSync(settingsPath)) {
  let content = fs.readFileSync(settingsPath, 'utf8');

  // Asegurar import de syncModeWithServer y syncSource
  if (!content.includes('syncModeWithServer')) {
    content = content.replace(
      "const { auth, logout, switchActiveEmpresa, switchActiveProyecto, syncMode, switchSyncMode } = useMobile();",
      "const { auth, logout, switchActiveEmpresa, switchActiveProyecto, syncMode, switchSyncMode, syncModeWithServer, syncSource } = useMobile();"
    );
  }

  // Añadir indicador y botón de sincronización de parámetros
  const syncCardOld = `<div className="form-card" style={{ border: '1.5px solid #0284c7' }}>
        <div className="form-card-title" style={{ color: '#0284c7' }}>
          <Smartphone size={16} /> Modo de Carga de Predios (Sincronización)
        </div>`;

  const syncCardNew = `<div className="form-card" style={{ border: '1.5px solid #0284c7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="form-card-title" style={{ color: '#0284c7', margin: 0 }}>
            <Smartphone size={16} /> Modo de Carga de Predios (Sincronización)
          </div>
          <button
            type="button"
            onClick={async () => {
              if (syncModeWithServer) {
                await syncModeWithServer();
                Swal.fire({
                  icon: 'info',
                  title: 'Parámetros Consultados',
                  text: 'Se verificó la configuración de la empresa en el Geoportal central.',
                  timer: 1600,
                  showConfirmButton: false,
                  background: '#ffffff',
                  color: '#0f172a'
                });
              }
            }}
            style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0284c7',
              fontSize: '11px',
              fontWeight: '700',
              padding: '4px 8px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            title="Sincronizar parámetro oficial desde el Geoportal"
          >
            🔄 Sincronizar Geoportal
          </button>
        </div>`;

  if (content.includes(syncCardOld)) {
    content = content.replace(syncCardOld, syncCardNew);
    fs.writeFileSync(settingsPath, content, 'utf8');
    console.log('✓ SettingsMobile.jsx actualizado con botón e indicador de sincronización');
  }
}

console.log('=== ACTUALIZACIONES COMPLETADAS CON ÉXITO ===');
