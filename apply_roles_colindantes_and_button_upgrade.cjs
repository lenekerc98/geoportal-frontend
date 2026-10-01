const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '..', 'movil');

console.log('Applying roles permissions, linked colindantes, and button redesign...');

// =========================================================================
// 1. UPDATE movil/src/context/MobileContext.jsx (ROLE PERMISSIONS)
// =========================================================================
const ctxPath = path.join(movilDir, 'src', 'context', 'MobileContext.jsx');
let ctxCode = fs.readFileSync(ctxPath, 'utf8');

const oldPermissionsBlock = `  // Permisos Superadmin / Admin
  const roleLower = String(auth?.role || '').toLowerCase();
  const usernameLower = String(auth?.username || '').toLowerCase();
  const isAdminOrSuperAdmin = roleLower.includes('admin') || roleLower.includes('super') || usernameLower === 'admin' || usernameLower === 'lcedeno';`;

const newPermissionsBlock = `  // Permisos por Rol (Geoportal vs Brigadistas)
  const roleLower = String(auth?.role || '').toLowerCase();
  const usernameLower = String(auth?.username || '').toLowerCase();
  const isBrigadista = !!auth?.isBrigadista || roleLower === 'brigadista' || auth?.operador_temporal_id != null;
  const isAdminOrSuperAdmin = roleLower.includes('admin') || roleLower.includes('super') || usernameLower === 'admin' || usernameLower === 'lcedeno';
  const isGeoportalUser = !isBrigadista && !!auth?.username;

  const permissions = {
    isAdminOrSuperAdmin,
    isBrigadista,
    isGeoportalUser,
    canEditServerPredios: isGeoportalUser,
    canDeleteServerPredios: isAdminOrSuperAdmin,
    canEditLocalPredios: true,
    canDeleteLocalPredios: true,
    canCreatePredios: true
  };`;

if (ctxCode.includes(oldPermissionsBlock)) {
  ctxCode = ctxCode.replace(oldPermissionsBlock, newPermissionsBlock);
  ctxCode = ctxCode.replace(
    'isAdminOrSuperAdmin,',
    'isAdminOrSuperAdmin,\n      isBrigadista,\n      isGeoportalUser,\n      permissions,'
  );
  fs.writeFileSync(ctxPath, ctxCode, 'utf8');
  console.log('1. Updated MobileContext.jsx with fine-grained permissions by role');
} else {
  console.log('1. MobileContext already updated or regex mismatch');
}

// =========================================================================
// 2. UPDATE movil/src/components/PredioBottomSheet.jsx (READ-ONLY FOR BRIGADISTAS)
// =========================================================================
const sheetPath = path.join(movilDir, 'src', 'components', 'PredioBottomSheet.jsx');
let sheetCode = fs.readFileSync(sheetPath, 'utf8');

// Ensure Eye icon is imported
if (!sheetCode.includes('Eye,')) {
  sheetCode = sheetCode.replace(
    "import { MapPin, User, FileText, Trash2, Edit3, X, Cloud, CloudOff } from 'lucide-react';",
    "import { MapPin, User, FileText, Trash2, Edit3, X, Cloud, CloudOff, Eye, ShieldAlert } from 'lucide-react';"
  );
}

// Extract permissions from useMobile
sheetCode = sheetCode.replace(
  "const { setFormPreloadData, setActiveTab, refreshOfflineCount } = useMobile();",
  "const { auth, permissions, setFormPreloadData, setActiveTab, refreshOfflineCount } = useMobile();"
);

// Role check logic
const oldSheetActionLogic = `  if (!predio) return null;

  const isOfflineItem = !!predio.offline_id;

  const handleEdit = () => {
    setFormPreloadData(predio);
    onClose();
    setActiveTab('form');
  };`;

const newSheetActionLogic = `  if (!predio) return null;

  const isOfflineItem = !!predio.offline_id;
  const isBrigadista = permissions?.isBrigadista ?? (auth?.isBrigadista || auth?.role === 'brigadista');
  // Brigadistas NO pueden editar ni borrar predios oficiales del servidor
  const canEdit = isOfflineItem || !isBrigadista;
  const canDelete = isOfflineItem && (!isBrigadista || isOfflineItem);

  const handleEdit = () => {
    setFormPreloadData(predio);
    onClose();
    setActiveTab('form');
  };

  const handleViewReadOnly = () => {
    setFormPreloadData({ ...predio, isReadOnly: true });
    onClose();
    setActiveTab('form');
  };`;

if (sheetCode.includes(oldSheetActionLogic)) {
  sheetCode = sheetCode.replace(oldSheetActionLogic, newSheetActionLogic);
}

// Update Action Buttons JSX in sheet
const oldSheetButtons = `        {/* Acciones */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button className="btn-primary-mobile" onClick={handleEdit}>
            <Edit3 size={16} /> Editar / Abrir
          </button>

          {isOfflineItem && (
            <button 
              className="map-fab" 
              style={{ width: '48px', height: '48px', background: '#dc2626', border: 'none' }}
              onClick={handleDelete}
              title="Eliminar de almacenamiento local"
            >
              <Trash2 size={18} color="#fff" />
            </button>
          )}
        </div>`;

const newSheetButtons = `        {/* Acciones con control de roles */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {canEdit ? (
            <button className="btn-primary-mobile" onClick={handleEdit} style={{ height: '48px', fontSize: '14px', fontWeight: '800' }}>
              <Edit3 size={16} /> Editar / Abrir
            </button>
          ) : (
            <button 
              className="btn-secondary-mobile" 
              onClick={handleViewReadOnly} 
              style={{ 
                height: '48px', 
                fontSize: '14px', 
                fontWeight: '800',
                background: 'rgba(2, 132, 199, 0.2)', 
                border: '1.5px solid #0284c7', 
                color: '#38bdf8' 
              }}
            >
              <Eye size={17} /> Ver Ficha (Solo Lectura)
            </button>
          )}

          {canDelete && (
            <button 
              className="map-fab" 
              style={{ width: '48px', height: '48px', background: '#dc2626', border: 'none' }}
              onClick={handleDelete}
              title="Eliminar de almacenamiento local"
            >
              <Trash2 size={18} color="#fff" />
            </button>
          )}
        </div>

        {!canEdit && (
          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', justifyContent: 'center' }}>
            <ShieldAlert size={12} color="#f59e0b" />
            <span>Como brigadista puedes ver este predio pero no modificarlo.</span>
          </div>
        )}`;

if (sheetCode.includes(oldSheetButtons)) {
  sheetCode = sheetCode.replace(oldSheetButtons, newSheetButtons);
}

fs.writeFileSync(sheetPath, sheetCode, 'utf8');
console.log('2. Updated PredioBottomSheet.jsx with read-only view for brigadistas on server predios');

// =========================================================================
// 3. UPDATE movil/src/App.css (ENHANCED BUTTONS)
// =========================================================================
const appCssPath = path.join(movilDir, 'src', 'App.css');
let appCss = fs.readFileSync(appCssPath, 'utf8');

const newButtonStyles = `
/* ======================================================== */
/* NUEVOS BOTONES ULTRA ROBUSTOS, TACTILES Y ELEGANTES      */
/* ======================================================== */
.btn-primary-mobile {
  flex: 1;
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #1d4ed8 100%);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 14px;
  min-height: 50px;
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary-mobile:active {
  transform: translateY(2px) scale(0.98);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.4);
}

.btn-secondary-mobile {
  flex: 1;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: #e2e8f0;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  min-height: 50px;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary-mobile:active {
  transform: translateY(1px) scale(0.98);
}

.btn-cta-cloud {
  width: 100%;
  min-height: 56px;
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #1d4ed8 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 16px;
  font-size: 15.5px;
  font-weight: 800;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.55), 0 4px 10px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cta-cloud:active {
  transform: translateY(2px) scale(0.98);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.btn-cta-phone {
  width: 100%;
  min-height: 52px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: #38bdf8;
  border: 1.5px solid rgba(56, 189, 248, 0.5);
  border-radius: 16px;
  font-size: 14.5px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cta-phone:active {
  transform: translateY(2px) scale(0.98);
}

.btn-cta-cancel {
  width: 100%;
  min-height: 48px;
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  border: 1.5px solid rgba(239, 68, 68, 0.45);
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cta-cancel:active {
  background: rgba(239, 68, 68, 0.25);
  transform: translateY(1px);
}
`;

if (!appCss.includes('.btn-cta-cloud')) {
  appCss += newButtonStyles;
  fs.writeFileSync(appCssPath, appCss, 'utf8');
  console.log('3. Updated App.css with robust, premium mobile buttons');
}

// =========================================================================
// 4. UPDATE movil/src/pages/Login/LoginMobile.jsx (ROBUST LOGIN BUTTONS)
// =========================================================================
const loginPath = path.join(movilDir, 'src', 'pages', 'Login', 'LoginMobile.jsx');
let loginCode = fs.readFileSync(loginPath, 'utf8');

// Upgrade Segmented Switcher
const oldTabsRegex = /<div style=\{\{\s*display: 'grid',\s*gridTemplateColumns: '1fr 1fr',[\s\S]*?<\/button>\s*<\/div>/;
const newTabs = `<div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#0a0f1d',
          padding: '6px',
          borderRadius: '16px',
          border: '1.5px solid #1e293b',
          marginBottom: '20px',
          gap: '6px'
        }}>
          <button 
            type="button" 
            onClick={() => setActiveMode('login')}
            style={{
              padding: '12px 6px',
              borderRadius: '12px',
              border: activeMode === 'login' ? '1px solid rgba(255,255,255,0.2)' : 'none',
              fontSize: '13.5px',
              fontWeight: '800',
              cursor: 'pointer',
              background: activeMode === 'login' ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' : 'transparent',
              color: activeMode === 'login' ? '#ffffff' : '#94a3b8',
              boxShadow: activeMode === 'login' ? '0 4px 14px rgba(37, 99, 235, 0.5)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <LogIn size={16} /> Iniciar Sesión
          </button>

          <button 
            type="button" 
            onClick={() => setActiveMode('brigadista')}
            style={{
              padding: '12px 6px',
              borderRadius: '12px',
              border: activeMode === 'brigadista' ? '1px solid rgba(255,255,255,0.2)' : 'none',
              fontSize: '13.5px',
              fontWeight: '800',
              cursor: 'pointer',
              background: activeMode === 'brigadista' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent',
              color: activeMode === 'brigadista' ? '#ffffff' : '#94a3b8',
              boxShadow: activeMode === 'brigadista' ? '0 4px 14px rgba(16, 185, 129, 0.5)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <UserCheck size={16} /> Soy Brigadista
          </button>
        </div>`;

if (oldTabsRegex.test(loginCode)) {
  loginCode = loginCode.replace(oldTabsRegex, newTabs);
}

// Upgrade Submit Button Login
const oldBtnLogin = `<button 
              type="submit" 
              className="btn-primary-mobile" 
              style={{ 
                height: '52px', 
                fontSize: '16px', 
                fontWeight: '700', 
                borderRadius: '14px', 
                marginTop: '6px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                boxShadow: '0 4px 18px rgba(37, 99, 235, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={loading}
            >`;

const newBtnLogin = `<button 
              type="submit" 
              className="btn-cta-cloud" 
              style={{ minHeight: '56px', fontSize: '16px', fontWeight: '800', marginTop: '10px' }}
              disabled={loading}
            >`;

if (loginCode.includes(oldBtnLogin)) {
  loginCode = loginCode.replace(oldBtnLogin, newBtnLogin);
}

// Upgrade Submit Button Brigadista
const oldBtnBrig = `<button 
              type="submit" 
              className="btn-primary-mobile" 
              style={{ 
                height: '52px', 
                fontSize: '16px', 
                fontWeight: '700', 
                borderRadius: '14px', 
                marginTop: '6px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 18px rgba(16, 185, 129, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={loading}
            >`;

const newBtnBrig = `<button 
              type="submit" 
              className="btn-cta-cloud" 
              style={{ 
                minHeight: '56px', 
                fontSize: '16px', 
                fontWeight: '800', 
                marginTop: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #047857 100%)',
                boxShadow: '0 10px 25px -4px rgba(16, 185, 129, 0.55), 0 4px 10px rgba(0, 0, 0, 0.3)'
              }}
              disabled={loading}
            >`;

if (loginCode.includes(oldBtnBrig)) {
  loginCode = loginCode.replace(oldBtnBrig, newBtnBrig);
}

fs.writeFileSync(loginPath, loginCode, 'utf8');
console.log('4. Updated LoginMobile.jsx with thick, ergonomic segmented tabs and CTA buttons');

// =========================================================================
// 5. UPDATE movil/src/pages/FormTab/PredioFormMobile.jsx (COORDINATES + COLINDANTES)
// =========================================================================
const formPath = path.join(movilDir, 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
let formCode = fs.readFileSync(formPath, 'utf8');

// Imports
if (!formCode.includes('Compass')) {
  formCode = formCode.replace(
    "import { \n  Edit2, ",
    "import { \n  Edit2, \n  Compass, \n  X, \n  Eye, \n  ShieldAlert, "
  );
}

// Context: use permissions
formCode = formCode.replace(
  "auth \n  } = useMobile();",
  "auth, \n    permissions \n  } = useMobile();"
);

// Add isReadOnly state
if (!formCode.includes('isReadOnly')) {
  formCode = formCode.replace(
    "const [offlineId, setOfflineId] = useState(null);",
    "const [offlineId, setOfflineId] = useState(null);\n  const [isReadOnly, setIsReadOnly] = useState(false);"
  );
}

// Preload data effect: check read only
const oldPreloadStart = `  useEffect(() => {
    if (formPreloadData) {
      if (formPreloadData.offline_id) setOfflineId(formPreloadData.offline_id);`;

const newPreloadStart = `  useEffect(() => {
    if (formPreloadData) {
      const readOnlyRequested = !!formPreloadData.isReadOnly || (formPreloadData.isServer && permissions?.isBrigadista);
      setIsReadOnly(readOnlyRequested);
      if (formPreloadData.offline_id) setOfflineId(formPreloadData.offline_id);`;

if (formCode.includes(oldPreloadStart)) {
  formCode = formCode.replace(oldPreloadStart, newPreloadStart);
}

// Add functions: cancelEdit, orientation & segment distance calculation
const targetFuncsInsertion = `  const handleAutoGenerateCodigo = () => {`;
const newColindanteAndCancelFuncs = `  // Cancelar Edición y Descartar Cambios
  const handleCancelEdit = async () => {
    const hasData = codigo || propietario || cedula || vertices.length > 0;
    if (hasData && !isReadOnly) {
      const result = await Swal.fire({
        title: '¿Cancelar Edición?',
        text: 'Se descartarán los cambios no guardados en este predio.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Descartar',
        cancelButtonText: 'Continuar Editando',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        background: '#131d33',
        color: '#fff'
      });
      if (!result.isConfirmed) return;
    }

    setOfflineId(null);
    setIsReadOnly(false);
    setCodigo('');
    setPropietario('');
    setCedula('');
    setTelefono('');
    setNorte('');
    setSur('');
    setEste('');
    setOeste('');
    setObservaciones('');
    setVertices([]);
    setFotos([]);
    setPosesionarioFound(null);
    setNameSuggestions([]);
    setActiveTab('map');
  };

  // Cálculo de orientación geográfica y distancia por tramo de coordenadas
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

  // Sintetizar automáticamente Norte, Sur, Este y Oeste a partir de los colindantes por tramo
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

  const handleAutoGenerateCodigo = () => {`;

if (!formCode.includes('handleCancelEdit')) {
  formCode = formCode.replace(targetFuncsInsertion, newColindanteAndCancelFuncs);
}

// Remove handleQuickRectangle definition if still there
const oldHandleQuickRect = /const handleQuickRectangle = \(\) => \{[\s\S]*?setVertices\(gen\.vertices\);\s*\}\s*;/;
if (oldHandleQuickRect.test(formCode)) {
  formCode = formCode.replace(oldHandleQuickRect, '');
}

// Insert Banner when editing or read only at the top of JSX
const oldReturnStart = `  return (
    <div className="tab-scroll-container">`;

const newReturnStart = `  return (
    <div className="tab-scroll-container">
      {/* BANNER DE ESTADO: EDICIÓN O SOLO LECTURA */}
      {isReadOnly ? (
        <div style={{
          background: 'rgba(2, 132, 199, 0.15)',
          border: '1.5px solid #0284c7',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={18} color="#38bdf8" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>
                Ficha Oficial (Modo Solo Lectura)
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Los brigadistas pueden consultar este predio pero no modificarlo
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleCancelEdit}
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} /> Salir
          </button>
        </div>
      ) : (offlineId || codigo) && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 size={16} color="#fbbf24" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>
                Modo Edición: {codigo || 'Predio Local'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Modificando atributos y coordenadas
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleCancelEdit}
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} /> Cancelar
          </button>
        </div>
      )}`;

if (!formCode.includes('BANNER DE ESTADO: EDICIÓN O SOLO LECTURA')) {
  formCode = formCode.replace(oldReturnStart, newReturnStart);
}

// Clean Geometry Card: REMOVE "Rectángulo GPS" and keep clean buttons
const oldGeomButtonsRegex = /<div style=\{\{\s*display: 'grid',\s*gridTemplateColumns: '1fr 1fr',\s*gap: '8px'\s*\}\}>[\s\S]*?Rectángulo GPS[\s\S]*?<\/button>\s*<\/div>/;

const newGeomButtons = `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              type="button" 
              className="btn-primary-mobile" 
              style={{ minHeight: '46px', fontSize: '13px', fontWeight: '800' }}
              onClick={handleAddGPSVertex}
              disabled={isReadOnly}
            >
              <Plus size={16} /> + Vértice GPS
            </button>

            <button 
              type="button" 
              className="btn-secondary-mobile" 
              style={{ minHeight: '46px', fontSize: '12px', fontWeight: '700', border: '1.5px dashed #38bdf8', color: '#38bdf8' }}
              onClick={handleAddManualVertex}
              disabled={isReadOnly}
            >
              <Edit2 size={14} /> + Coordenada (X, Y)
            </button>
          </div>`;

if (oldGeomButtonsRegex.test(formCode)) {
  formCode = formCode.replace(oldGeomButtonsRegex, newGeomButtons);
  // Also remove old manual vertex button below it if redundant
  formCode = formCode.replace(/<button\s+type="button"\s+className="btn-secondary-mobile"\s+style=\{\{[^}]*background: 'rgba\(255, 255, 255, 0.05\)'[^}]*\}\}\s+onClick=\{handleAddManualVertex\}[\s\S]*?<\/button>/, '');
}

// Add Colindantes por Tramo in Coordinates card
const oldVerticesTableEnd = `            </table>
          </div>
        )}`;

const newVerticesAndColindantesSection = `            </table>
          </div>
        )}

        {/* 🧭 APARTADO DE COLINDANTES VINCULADOS A CADA COORDENADA / TRAMO */}
        {vertices.length >= 2 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Compass size={14} color="var(--accent-cyan)" /> Colindantes por Tramo de Vértices:
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{vertices.length} linderos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
              {vertices.map((v, i) => {
                const nextIdx = (i + 1) % vertices.length;
                const p1 = v;
                const p2 = vertices[nextIdx];
                const dir = getSegmentOrientation(p1, p2);
                const dist = getSegmentDistance(p1, p2);
                const dirColors = {
                  Norte: '#38bdf8',
                  Este: '#10b981',
                  Sur: '#f59e0b',
                  Oeste: '#ec4899'
                };

                return (
                  <div 
                    key={i} 
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#f8fafc' }}>
                        Tramo V{i + 1} ➔ V{nextIdx + 1} ({dist} m)
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: \`\${dirColors[dir]}22\`,
                        color: dirColors[dir],
                        border: \`1px solid \${dirColors[dir]}66\`
                      }}>
                        🧭 Hacia el {dir}
                      </span>
                    </div>

                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={\`Colindante del tramo V\${i + 1}-V\${nextIdx + 1} (ej: Juan Pérez / Calle pública)\`}
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
        )}`;

if (formCode.includes(oldVerticesTableEnd) && !formCode.includes('🧭 APARTADO DE COLINDANTES VINCULADOS')) {
  formCode = formCode.replace(oldVerticesTableEnd, newVerticesAndColindantesSection);
}

// Update Action Buttons at the bottom of the form
const oldBottomButtonsRegex = /\{\/\* BOTONES PRINCIPALES DE GUARDADO \*\/\}[\s\S]*?Guardar Solamente en Teléfono[\s\S]*?<\/button>\s*<\/div>/;

const newBottomButtons = `{/* BOTONES PRINCIPALES DE ACCIÓN (ROBUSTOS Y TÁCTILES) */}
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
            background: 'rgba(2, 132, 199, 0.15)',
            border: '1.5px solid #0284c7',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'center',
            color: '#bae6fd',
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
          <span>Cancelar Edición y Descartar Cambios</span>
        </button>
      </div>`;

if (oldBottomButtonsRegex.test(formCode)) {
  formCode = formCode.replace(oldBottomButtonsRegex, newBottomButtons);
}

fs.writeFileSync(formPath, formCode, 'utf8');
console.log('5. Updated PredioFormMobile.jsx with removed GPS Rectangle, per-coordinate colindantes, and cancel edit button');

// =========================================================================
// 6. BUMP VERSION TO 2.4 IN android/app/build.gradle
// =========================================================================
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
let gradleCode = fs.readFileSync(gradlePath, 'utf8');

gradleCode = gradleCode.replace(/versionCode\s+\d+/, 'versionCode 14');
gradleCode = gradleCode.replace(/versionName\s+"[^"]+"/, 'versionName "2.4"');

fs.writeFileSync(gradlePath, gradleCode, 'utf8');
console.log('6. Bumped build.gradle to version 2.4 (versionCode 14)');

console.log('\nAll role, colindante, and button improvements applied successfully!');
