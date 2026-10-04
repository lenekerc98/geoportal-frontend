const fs = require('fs');
const path = require('path');

console.log('=== HABILITANDO MODAL DE 3 MÉTODOS PARA TODOS LOS PERFILES Y BRIGADISTAS ===');

// 1. MODIFICAR DrawingToolbarMobile.jsx
const toolbarFile = path.resolve('c:/LNCZ/proyecto-catastro-2026/movil/src/components/DrawingToolbarMobile.jsx');
let tbContent = fs.readFileSync(toolbarFile, 'utf8');

// A. Habilitar handleAddPredioClick para todos sin restricción de isAdminOrSuperAdmin
tbContent = tbContent.replace(
  `  const handleAddPredioClick = () => {
    if (isAdminOrSuperAdmin) {
      handleOpenAddPredioMenu();
    } else {
      handleOpenCoordinatesAndColindantesModal();
    }
  };`,
  `  // 5. MANEJADOR PRINCIPAL DEL BOTÓN "+ AGREGAR PREDIO"
  // HABILITADO PARA TODOS LOS PERFILES Y BRIGADISTAS: Abre el menú de 3 opciones
  const handleAddPredioClick = () => {
    handleOpenAddPredioMenu();
  };`
);

// B. Mejorar handleAddVertex para dar feedback claro si no hay señal GPS y avisar al capturar
tbContent = tbContent.replace(
  `  // Capturar vértice en la posición actual con GPS
  const handleAddVertex = () => {
    if (!gps.hasFix) return;
    const utm = wgs84ToUtm(gps.lng, gps.lat);
    const newVertex = {
      x: utm.x,
      y: utm.y,
      lat: gps.lat,
      lng: gps.lng,
      orden: perimeterVertices.length + 1,
      accuracy: gps.accuracy
    };

    setPerimeterVertices(prev => [...prev, newVertex]);
  };`,
  `  // Capturar vértice en la posición actual con GPS
  const handleAddVertex = () => {
    if (!gps.hasFix) {
      Swal.fire({
        icon: 'warning',
        title: 'Buscando Satélites GPS',
        text: 'Espera un instante a que el teléfono obtenga señal satelital precisa al aire libre.',
        timer: 3000,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
      return;
    }
    const utm = wgs84ToUtm(gps.lng, gps.lat);
    const newVertex = {
      x: utm.x,
      y: utm.y,
      lat: gps.lat,
      lng: gps.lng,
      orden: perimeterVertices.length + 1,
      accuracy: gps.accuracy
    };

    setPerimeterVertices(prev => [...prev, newVertex]);

    if (showToast) {
      showToast({
        type: 'success',
        title: \`✓ Vértice P0\${perimeterVertices.length + 1} Capturado\`,
        message: \`Posición registrada con precisión de ±\${gps.accuracy || 0}m\`,
        duration: 2500
      });
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(80); } catch (e) {}
    }
  };`
);

fs.writeFileSync(toolbarFile, tbContent, 'utf8');
console.log('✓ DrawingToolbarMobile.jsx actualizado');

// 2. MODIFICAR PredioFormMobile.jsx PARA QUE "+ Nuevo Predio" TAMBIÉN OFREZCA EL MENÚ DE 3 OPCIONES
const formFile = path.resolve('c:/LNCZ/proyecto-catastro-2026/movil/src/pages/FormTab/PredioFormMobile.jsx');
let formContent = fs.readFileSync(formFile, 'utf8');

// Asegurar que useMobile tenga las funciones de dibujo y caminata
formContent = formContent.replace(
  `    auth, 
    permissions,
    showToast 
  } = useMobile();`,
  `    auth, 
    permissions,
    showToast,
    setIsManualDrawing,
    setManualVertices,
    setIsPerimeterWalking,
    setPerimeterVertices
  } = useMobile();`
);

// Reemplazar handleCreateNew para desplegar el modal interactivo
const oldCreateNew = `  // Crear nuevo predio en blanco desde el listado
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
  };`;

const newCreateNew = `  // Crear nuevo predio en blanco (Ficha de Coordenadas y Colindantes)
  const handleCreateBlankForm = () => {
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

  // Menú interactivo "+ Agregar Predio" disponible para todos los perfiles y brigadistas
  const handleCreateNew = async () => {
    await Swal.fire({
      title: '➕ Agregar Predio',
      html: \`
        <div style="text-align: left; padding: 4px 0;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 14px;">
            Selecciona el método para registrar el nuevo predio:
          </div>

          <!-- Opción 1: Coordenadas y Colindantes -->
          <div id="swal-form-opt-manual" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: #f8fafc; border: 1.5px solid #0284c7; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-radius: 14px; margin-bottom: 10px; cursor: pointer;">
            <div style="background: rgba(56, 189, 248, 0.15); color: #0284c7; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">📐</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #0f172a !important;">1. Coordenadas (Puntos P01, P02...) y Colindantes</div>
              <div style="font-size: 11px; color: #64748b; line-height: 1.3;">Ingresar vértices UTM y colindantes por cada lado del predio</div>
            </div>
          </div>

          <!-- Opción 2: Dibujar Polígono en Mapa -->
          <div id="swal-form-opt-draw" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: #f8fafc; border: 1.5px solid #8b5cf6; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-radius: 14px; margin-bottom: 10px; cursor: pointer;">
            <div style="background: rgba(168, 85, 247, 0.15); color: #7c3aed; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">✏️</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #0f172a !important;">2. Dibujar en el Mapa</div>
              <div style="font-size: 11px; color: #64748b; line-height: 1.3;">Tocar directamente sobre el mapa satelital para trazar vértices</div>
            </div>
          </div>

          <!-- Opción 3: Agregar en Camino (Caminata GPS) -->
          <div id="swal-form-opt-walk" style="display: flex; align-items: center; gap: 12px; padding: 13px 14px; background: #f8fafc; border: 1.5px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-radius: 14px; cursor: pointer;">
            <div style="background: rgba(16, 185, 129, 0.15); color: #059669; width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">🚶</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; color: #0f172a !important;">3. Agregar en Camino (Caminata GPS)</div>
              <div style="font-size: 11px; color: #64748b; line-height: 1.3;">Caminar a cada esquina del terreno con el GPS del teléfono</div>
            </div>
          </div>
        </div>
      \`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      cancelButtonColor: '#334155',
      background: '#ffffff',
      color: '#0f172a',
      didOpen: () => {
        const optManual = document.getElementById('swal-form-opt-manual');
        const optDraw = document.getElementById('swal-form-opt-draw');
        const optWalk = document.getElementById('swal-form-opt-walk');

        if (optManual) optManual.onclick = () => {
          Swal.close();
          handleCreateBlankForm();
        };
        if (optDraw) optDraw.onclick = () => {
          Swal.close();
          if (setIsPerimeterWalking) {
            setIsPerimeterWalking(false);
            setPerimeterVertices([]);
          }
          if (setIsManualDrawing) {
            setIsManualDrawing(true);
            setManualVertices([]);
          }
          setActiveTab('map');
        };
        if (optWalk) optWalk.onclick = () => {
          Swal.close();
          if (setIsManualDrawing) {
            setIsManualDrawing(false);
            setManualVertices([]);
          }
          if (setIsPerimeterWalking) {
            setIsPerimeterWalking(true);
            setPerimeterVertices([]);
          }
          setActiveTab('map');
        };
      }
    });
  };`;

formContent = formContent.replace(oldCreateNew, newCreateNew);
fs.writeFileSync(formFile, formContent, 'utf8');
console.log('✓ PredioFormMobile.jsx actualizado');
console.log('=== COMPLETADO CON ÉXITO ===');
