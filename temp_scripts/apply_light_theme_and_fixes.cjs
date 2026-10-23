const fs = require('fs');
const path = require('path');

const movilDir = 'C:\\LNCZ\\proyecto-catastro-2026\\movil';

console.log('--- Aplicando Correcciones y Tema Claro Total a Catastro Móvil ---');

// 1. CORREGIR CRASH EN MobileContext.jsx
const mobileContextPath = path.join(movilDir, 'src', 'context', 'MobileContext.jsx');
if (fs.existsSync(mobileContextPath)) {
  let content = fs.readFileSync(mobileContextPath, 'utf8');

  // Arreglar definición de permissions y eliminar auto-referencia TDZ
  content = content.replace(
    /const permissions = \{[\s\S]*?canCreatePredios: true\s*\};/,
    `const permissions = {
    isAdminOrSuperAdmin,
    isBrigadista,
    isGeoportalUser,
    canEditServerPredios: isGeoportalUser,
    canDeleteServerPredios: isAdminOrSuperAdmin,
    canEditLocalPredios: true,
    canDeleteLocalPredios: true,
    canCreatePredios: true
  };`
  );

  // Asegurar que permissions, isBrigadista, isGeoportalUser se exportan en el Provider
  if (!content.includes('permissions,') && content.includes('isAdminOrSuperAdmin,')) {
    content = content.replace(
      'isAdminOrSuperAdmin,',
      'isAdminOrSuperAdmin,\n      permissions,\n      isBrigadista,\n      isGeoportalUser,'
    );
  }

  // Eliminar backgrounds oscuros hardcodeados en Swal de MobileContext
  content = content.replace(/background:\s*'#131d33',\s*color:\s*'#fff'/g, "background: '#ffffff', color: '#0f172a'");

  fs.writeFileSync(mobileContextPath, content, 'utf8');
  console.log('✅ MobileContext.jsx: TDZ bug corregido y permissions exportados.');
}

// 2. ACTUALIZAR App.jsx (Pantalla de carga en tema claro)
const appJsxPath = path.join(movilDir, 'src', 'App.jsx');
if (fs.existsSync(appJsxPath)) {
  let content = fs.readFileSync(appJsxPath, 'utf8');
  content = content.replace(
    /background:\s*'#090d16',\s*color:\s*'#38bdf8'/,
    "background: '#f8fafc', color: '#0284c7'"
  );
  fs.writeFileSync(appJsxPath, content, 'utf8');
  console.log('✅ App.jsx: Pantalla de carga actualizada a tema claro.');
}

// 3. ACTUALIZAR index.css (Tema Claro Global y SweetAlert Claro)
const indexCssPath = path.join(movilDir, 'src', 'index.css');
if (fs.existsSync(indexCssPath)) {
  const lightIndexCss = `:root {
  color-scheme: light;
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-card: #ffffff;
  --bg-card-hover: #f1f5f9;
  --border-color: #e2e8f0;
  --border-focus: #0284c7;

  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;

  --accent-cyan: #0284c7;
  --accent-blue: #2563eb;
  --accent-emerald: #10b981;
  --accent-amber: #f59e0b;
  --accent-rose: #ef4444;

  --safe-top: max(env(safe-area-inset-top, 0px), 38px);
  --safe-bottom: max(env(safe-area-inset-bottom, 0px), 12px);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  width: 100%;
  min-height: 100%;
  background-color: #f8fafc;
  color: #0f172a;
  overflow-x: hidden;
}

#root {
  width: 100%;
  min-height: 100%;
  background-color: #f8fafc;
  color: var(--text-primary);
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
  -webkit-user-select: none;
}

input, textarea, select {
  user-select: auto;
  -webkit-user-select: auto;
  font-size: 16px !important;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}

/* Custom Scrollbars */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.25);
  border-radius: 4px;
}

/* Leaflet Overrides for Touch & Mobile */
.leaflet-container {
  width: 100%;
  height: 100%;
  background-color: #f1f5f9 !important;
  font-family: inherit;
}
.leaflet-bar {
  border: none !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1) !important;
}
.leaflet-bar a {
  background-color: #ffffff !important;
  color: #1e293b !important;
  border-bottom: 1px solid #e2e8f0 !important;
  width: 38px !important;
  height: 38px !important;
  line-height: 38px !important;
}
.leaflet-bar a:hover {
  background-color: #f8fafc !important;
}
.leaflet-control-attribution {
  display: none !important;
}

/* Pulse Keyframes */
@keyframes pulseGlow {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

@keyframes pulseGlowAmber {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}

.pulse-dot-green {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--accent-emerald);
  animation: pulseGlow 2s infinite;
}

.pulse-dot-amber {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--accent-amber);
  animation: pulseGlowAmber 2s infinite;
}

.pulse-dot-red {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--accent-rose);
}

select option {
  background-color: #ffffff !important;
  color: #0f172a !important;
  font-size: 15px !important;
}

/* ========================================== */
/* SWEETALERT2 LIGHT THEME & CRISP CONTRAST   */
/* ========================================== */
.swal2-popup {
  background: #ffffff !important;
  color: #0f172a !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 20px !important;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15) !important;
}

.swal2-title, .swal2-content, .swal2-html-container {
  color: #0f172a !important;
}

.swal2-radio {
  background: transparent !important;
  color: #0f172a !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  margin: 16px 0 !important;
}

.swal2-radio label {
  color: #0f172a !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  cursor: pointer !important;
  padding: 12px 14px !important;
  background: #f8fafc !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 12px !important;
}

.swal2-radio label span {
  color: #0f172a !important;
  font-size: 15px !important;
  font-weight: 600 !important;
}

.swal2-radio input[type="radio"] {
  accent-color: #0284c7 !important;
  width: 20px !important;
  height: 20px !important;
  cursor: pointer !important;
}

.swal2-select {
  background: #ffffff !important;
  color: #0f172a !important;
  border: 1.5px solid #cbd5e1 !important;
  border-radius: 10px !important;
  font-size: 15px !important;
  padding: 10px !important;
  width: 90% !important;
}

.swal2-select option {
  background: #ffffff !important;
  color: #0f172a !important;
}

.swal2-input, .swal2-textarea {
  background: #ffffff !important;
  color: #0f172a !important;
  border: 1.5px solid #cbd5e1 !important;
  border-radius: 10px !important;
  font-size: 15px !important;
}

.swal2-input::placeholder, .swal2-textarea::placeholder {
  color: #94a3b8 !important;
}

select, select option {
  color-scheme: light !important;
  background-color: #ffffff !important;
  color: #0f172a !important;
}

/* Modal Compacto para Coordenadas y Colindantes */
.swal-compact-modal {
  max-width: 440px !important;
  width: 95% !important;
  padding: 14px 10px !important;
  box-sizing: border-box !important;
}
`;
  fs.writeFileSync(indexCssPath, lightIndexCss, 'utf8');
  console.log('✅ index.css: Convertido a Tema Claro.');
}

// 4. ACTUALIZAR App.css (Diseño Claro, Header, Barra Inferior, Tarjetas, Inputs, Botones)
const appCssPath = path.join(movilDir, 'src', 'App.css');
if (fs.existsSync(appCssPath)) {
  const lightAppCss = `.app-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  position: relative;
  background: #f8fafc;
}

/* HEADER SUPERIOR */
.mobile-header {
  height: auto;
  min-height: calc(56px + var(--safe-top));
  padding-top: var(--safe-top);
  padding-bottom: 8px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
  padding-left: 14px;
  padding-right: 14px;
  z-index: 1000;
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.header-title-box h1 {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #0f172a;
  line-height: 1.1;
}

.header-title-box span {
  font-size: 10px;
  color: #0284c7;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-status-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.pill-badge.online {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #059669;
}

.pill-badge.offline {
  border-color: #fde68a;
  color: #d97706;
  background: #fffbeb;
}

.pill-badge.sync-alert {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
  cursor: pointer;
}

/* ÁREA DE CONTENIDO PRINCIPAL */
.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  height: calc(100dvh - 56px - 62px - var(--safe-top) - var(--safe-bottom));
  background: #f8fafc;
}

.tab-scroll-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  padding-bottom: 24px;
}

/* BOTTOM NAVIGATION BAR */
.bottom-nav {
  height: calc(62px + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid #e2e8f0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.03);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  z-index: 1000;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 6px 0;
  position: relative;
  transition: all 0.2s ease;
}

.nav-item.active {
  color: #0284c7;
}

.nav-item span {
  font-size: 11px;
  font-weight: 600;
}

.nav-badge {
  position: absolute;
  top: 4px;
  right: 25%;
  background: #f59e0b;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

/* FLOATING CONTROLS EN EL MAPA */
.map-floating-controls {
  position: absolute;
  right: 14px;
  top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 500;
}

.map-fab {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid #cbd5e1;
  color: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.15s ease;
}

.map-fab:active {
  transform: scale(0.92);
  background: #e2e8f0;
}

.map-fab.active {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
}

.map-bottom-bar {
  position: absolute;
  bottom: 16px;
  left: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 500;
}

/* PERIMETER WALKING FLOATING BANNER */
.walking-panel {
  position: absolute;
  bottom: 18px;
  left: 14px;
  right: 14px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1.5px solid #10b981;
  border-radius: 14px;
  padding: 10px 14px;
  z-index: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.walking-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.walking-actions {
  display: flex;
  gap: 6px;
}

/* BOTTOM SHEET MODAL */
.bottom-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(2px);
  z-index: 900;
}

.bottom-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-top: 1px solid #e2e8f0;
  padding: 16px;
  z-index: 950;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 80%;
  overflow-y: auto;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  background: #cbd5e1;
  border-radius: 4px;
  margin: 0 auto 6px auto;
}

/* FORM STYLES */
.form-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.form-card-title {
  font-size: 13px;
  font-weight: 700;
  color: #0284c7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.form-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  color: #0f172a;
  outline: none;
  font-size: 15px;
  direction: ltr !important;
  text-align: left;
  transition: all 0.15s ease;
}

.form-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}

/* PHOTO ATTACHMENT GRID */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 6px;
}

.photo-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* BOTONES TÁCTILES Y ERGONÓMICOS */
.btn-primary-mobile {
  flex: 1;
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #1d4ed8 100%);
  color: #ffffff;
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
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary-mobile:active {
  transform: translateY(2px) scale(0.98);
  box-shadow: 0 3px 8px rgba(37, 99, 235, 0.3);
}

.btn-secondary-mobile {
  flex: 1;
  background: #ffffff;
  color: #334155;
  border: 1.5px solid #cbd5e1;
  border-radius: 14px;
  min-height: 50px;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary-mobile:active {
  transform: translateY(1px) scale(0.98);
  background: #f1f5f9;
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
  box-shadow: 0 8px 22px rgba(37, 99, 235, 0.4);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cta-cloud:active {
  transform: translateY(2px) scale(0.98);
  box-shadow: 0 3px 10px rgba(37, 99, 235, 0.3);
}

.btn-cta-phone {
  width: 100%;
  min-height: 52px;
  background: #ffffff;
  color: #0284c7;
  border: 1.5px solid #0284c7;
  border-radius: 16px;
  font-size: 14.5px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.12);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cta-phone:active {
  transform: translateY(2px) scale(0.98);
  background: #f0f9ff;
}

.btn-cta-cancel {
  width: 100%;
  min-height: 48px;
  background: #fee2e2;
  color: #dc2626;
  border: 1.5px solid #fca5a5;
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
  background: #fecaca;
  transform: translateY(1px);
}
`;
  fs.writeFileSync(appCssPath, lightAppCss, 'utf8');
  console.log('✅ App.css: Convertido a Tema Claro con estilos limpios.');
}

// 5. ACTUALIZAR MobileHeader.jsx
const mobileHeaderPath = path.join(movilDir, 'src', 'components', 'MobileHeader.jsx');
if (fs.existsSync(mobileHeaderPath)) {
  let content = fs.readFileSync(mobileHeaderPath, 'utf8');

  // Barra de proyecto activo
  content = content.replace("background: 'rgba(30, 41, 59, 0.6)'", "background: '#f1f5f9'");
  content = content.replace("border: '1px solid rgba(255, 255, 255, 0.08)'", "border: '1px solid #e2e8f0'");
  content = content.replace("color: '#94a3b8'", "color: '#64748b'");
  content = content.replace("color: '#f8fafc'", "color: '#0f172a'");

  // Swal en header
  content = content.replace(/background:\s*'#131d33',\s*color:\s*'#fff(?:fff)?'/g, "background: '#ffffff', color: '#0f172a'");
  content = content.replace(/background:\s*'#131d33'/g, "background: '#ffffff'");
  content = content.replace("color: '#ffffff'", "color: '#0f172a'");
  content = content.replace("color:#ffffff !important;", "color:#0f172a !important;");
  content = content.replace("background:${isSelected ? 'rgba(2,132,199,0.22)' : 'rgba(30,41,59,0.85)'};", "background:${isSelected ? '#e0f2fe' : '#ffffff'};");
  content = content.replace("border:1.5px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.1)'};", "border:1.5px solid ${isSelected ? '#0284c7' : '#e2e8f0'};");
  content = content.replace("color:#e2e8f0;", "color:#0f172a;");

  fs.writeFileSync(mobileHeaderPath, content, 'utf8');
  console.log('✅ MobileHeader.jsx: Estilos actualizados a tema claro.');
}

// 6. ACTUALIZAR PredioBottomSheet.jsx
const bottomSheetPath = path.join(movilDir, 'src', 'components', 'PredioBottomSheet.jsx');
if (fs.existsSync(bottomSheetPath)) {
  let content = fs.readFileSync(bottomSheetPath, 'utf8');

  content = content.replace(/color:\s*'#fff',/g, "color: '#0f172a',");
  content = content.replace(/background:\s*'#0f172a',\s*padding:\s*'10px',\s*borderRadius:\s*'10px',\s*border:\s*'1px solid #1e293b'/g,
    "background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0'");
  content = content.replace("color: '#f8fafc'", "color: '#0f172a'");
  content = content.replace("color: '#38bdf8'", "color: '#0284c7'");
  content = content.replace("color: '#cbd5e1'", "color: '#0f172a'");
  content = content.replace("color: '#94a3b8'", "color: '#64748b'");
  content = content.replace(/background:\s*'#131d33',\s*color:\s*'#fff'/g, "background: '#ffffff', color: '#0f172a'");

  fs.writeFileSync(bottomSheetPath, content, 'utf8');
  console.log('✅ PredioBottomSheet.jsx: Estilos actualizados a tema claro.');
}

// 7. ACTUALIZAR LoginMobile.jsx
const loginMobilePath = path.join(movilDir, 'src', 'pages', 'Login', 'LoginMobile.jsx');
if (fs.existsSync(loginMobilePath)) {
  let content = fs.readFileSync(loginMobilePath, 'utf8');

  // Fondo principal y contenedor de tarjeta
  content = content.replace(
    "background: 'radial-gradient(circle at 50% 15%, #172554 0%, #090d16 75%)',",
    "background: 'radial-gradient(circle at 50% 15%, #e0f2fe 0%, #f8fafc 75%)',"
  );
  content = content.replace(
    "background: 'rgba(19, 29, 51, 0.95)',\n        backdropFilter: 'blur(16px)',\n        border: '1px solid rgba(255, 255, 255, 0.12)',\n        borderRadius: '22px',\n        padding: '24px 20px',\n        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',",
    "background: '#ffffff',\n        borderRadius: '22px',\n        border: '1px solid #e2e8f0',\n        padding: '24px 20px',\n        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.08)',"
  );

  // Título
  content = content.replace("color: '#fff',", "color: '#0f172a',");

  // Barra de pestañas selectoras
  content = content.replace("background: 'rgba(15, 23, 42, 0.85)',", "background: '#f1f5f9',");
  content = content.replace("border: '1px solid rgba(255, 255, 255, 0.1)'", "border: '1px solid #e2e8f0'");
  content = content.replace("color: activeMode === 'login' ? '#ffffff' : '#94a3b8'", "color: activeMode === 'login' ? '#ffffff' : '#64748b'");
  content = content.replace("color: activeMode === 'brigadista' ? '#ffffff' : '#94a3b8'", "color: activeMode === 'brigadista' ? '#ffffff' : '#64748b'");

  // Aviso de brigadista verde
  content = content.replace("color: '#a7f3d0',", "color: '#065f46',");
  content = content.replace("background: 'rgba(16, 185, 129, 0.12)',", "background: '#ecfdf5',");
  content = content.replace("border: '1px solid rgba(16, 185, 129, 0.3)',", "border: '1px solid #a7f3d0',");

  // Botón configuración url
  content = content.replace("background: 'rgba(255, 255, 255, 0.08)', \n              border: '1px solid rgba(255, 255, 255, 0.15)',",
    "background: '#f8fafc', \n              border: '1px solid #cbd5e1',");

  // Swal backgrounds
  content = content.replace(/background:\s*'#131d33',\s*color:\s*'#fff'/g, "background: '#ffffff', color: '#0f172a'");

  fs.writeFileSync(loginMobilePath, content, 'utf8');
  console.log('✅ LoginMobile.jsx: Estilos actualizados a tema claro.');
}

// 8. ACTUALIZAR SettingsMobile.jsx
const settingsMobilePath = path.join(movilDir, 'src', 'pages', 'SettingsTab', 'SettingsMobile.jsx');
if (fs.existsSync(settingsMobilePath)) {
  let content = fs.readFileSync(settingsMobilePath, 'utf8');

  // Tarjeta de sesión activa
  content = content.replace(
    "background: 'linear-gradient(135deg, rgba(30,58,138,0.4), rgba(19,29,51,0.9))'",
    "background: 'linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%)', border: '1px solid #bae6fd'"
  );
  content = content.replace("color: '#fff'", "color: '#0f172a'");
  content = content.replace(/style=\{\{\s*background:\s*'#0f172a',\s*color:\s*'#ffffff',\s*fontWeight:\s*'600'\s*\}\}/g,
    "style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: '600' }}");
  content = content.replace(/background:\s*'#1e293b',\s*color:\s*'#ffffff'/g, "background: '#ffffff', color: '#0f172a'");
  content = content.replace(/background:\s*'#0f172a'/g, "background: '#f8fafc'");
  content = content.replace(/border:\s*'1px solid #1e293b'/g, "border: '1px solid #e2e8f0'");
  content = content.replace(/background:\s*'#131d33'/g, "background: '#ffffff'");
  content = content.replace(/color:\s*'#fff'/g, "color: '#0f172a'");

  fs.writeFileSync(settingsMobilePath, content, 'utf8');
  console.log('✅ SettingsMobile.jsx: Estilos actualizados a tema claro.');
}

// 9. ACTUALIZAR SyncCenterMobile.jsx
const syncCenterPath = path.join(movilDir, 'src', 'pages', 'SyncTab', 'SyncCenterMobile.jsx');
if (fs.existsSync(syncCenterPath)) {
  let content = fs.readFileSync(syncCenterPath, 'utf8');

  content = content.replace(
    "background: 'linear-gradient(135deg, rgba(30,58,138,0.5), rgba(19,29,51,0.9))'",
    "background: 'linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%)', border: '1px solid #bae6fd'"
  );
  content = content.replace("color: '#fff'", "color: '#0f172a'");
  content = content.replace("background: '#0f172a'", "background: '#e2e8f0'");
  content = content.replace("color: '#cbd5e1'", "color: '#0f172a'");
  content = content.replace("filter === t ? '#2563eb' : '#1e293b'", "filter === t ? '#2563eb' : '#e2e8f0'");
  content = content.replace("filter === t ? '#fff' : '#94a3b8'", "filter === t ? '#ffffff' : '#64748b'");
  content = content.replace(/background:\s*'#131d33'/g, "background: '#ffffff'");
  content = content.replace(/color:\s*'#fff'/g, "color: '#0f172a'");

  fs.writeFileSync(syncCenterPath, content, 'utf8');
  console.log('✅ SyncCenterMobile.jsx: Estilos actualizados a tema claro.');
}

// 10. ACTUALIZAR PredioFormMobile.jsx
const predioFormPath = path.join(movilDir, 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
if (fs.existsSync(predioFormPath)) {
  let content = fs.readFileSync(predioFormPath, 'utf8');

  // Inputs y tablas
  content = content.replace(/background:#0f172a; color:#fff;/g, "background:#ffffff; color:#0f172a;");
  content = content.replace(/border:1px solid #334155;/g, "border:1px solid #cbd5e1;");
  content = content.replace("background: '#0f172a', padding: '10px', borderRadius: '10px'",
    "background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px'");
  content = content.replace("background: '#0f172a', color: '#94a3b8'", "background: '#f1f5f9', color: '#64748b'");
  content = content.replace(/border:\s*'1px solid #1e293b'/g, "border: '1px solid #e2e8f0'");
  content = content.replace(/borderTop:\s*'1px solid #1e293b'/g, "borderTop: '1px solid #e2e8f0'");
  content = content.replace("color: '#e2e8f0'", "color: '#0f172a'");
  content = content.replace("background: '#0f172a',\n                      border: '1px solid #334155',",
    "background: '#f8fafc',\n                      border: '1px solid #e2e8f0',");
  content = content.replace("color: '#f8fafc'", "color: '#0f172a'");
  content = content.replace("color: '#bae6fd'", "color: '#0369a1'");
  content = content.replace("background: 'rgba(2, 132, 199, 0.15)',", "background: '#f0f9ff',");
  content = content.replace(/background:\s*'#131d33'/g, "background: '#ffffff'");
  content = content.replace(/color:\s*'#fff'/g, "color: '#0f172a'");

  fs.writeFileSync(predioFormPath, content, 'utf8');
  console.log('✅ PredioFormMobile.jsx: Estilos y modales actualizados a tema claro.');
}

// 11. ACTUALIZAR DrawingToolbarMobile.jsx
const drawingToolbarPath = path.join(movilDir, 'src', 'components', 'DrawingToolbarMobile.jsx');
if (fs.existsSync(drawingToolbarPath)) {
  let content = fs.readFileSync(drawingToolbarPath, 'utf8');

  // Tip del modal
  content = content.replace("background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); border-radius:10px; padding:8px 10px; color:#bae6fd;",
    "background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:8px 10px; color:#0369a1;");
  content = content.replace("color:#e2e8f0;", "color:#0f172a;");

  // Tarjeta dinámica de vértice en el modal
  content = content.replace(
    "card.style.cssText = 'background:#0f172a; border:1px solid #334155; border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:6px; width:100%; box-sizing:border-box;';",
    "card.style.cssText = 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:6px; width:100%; box-sizing:border-box;';"
  );
  content = content.replace(/background:#090d16; color:#fff !important; border:1px solid #334155;/g,
    "background:#ffffff; color:#0f172a !important; border:1px solid #cbd5e1;");

  // Opciones del menú "+ Agregar Predio"
  content = content.replace(/background: rgba\(30, 41, 59, 0\.9\); border: 1\.5px solid rgba\(56, 189, 248, 0\.4\);/g,
    "background: #f8fafc; border: 1.5px solid #0284c7; box-shadow: 0 2px 8px rgba(0,0,0,0.04);");
  content = content.replace(/background: rgba\(30, 41, 59, 0\.9\); border: 1\.5px solid rgba\(168, 85, 247, 0\.4\);/g,
    "background: #f8fafc; border: 1.5px solid #8b5cf6; box-shadow: 0 2px 8px rgba(0,0,0,0.04);");
  content = content.replace(/background: rgba\(30, 41, 59, 0\.9\); border: 1\.5px solid rgba\(16, 185, 129, 0\.4\);/g,
    "background: #f8fafc; border: 1.5px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.04);");
  content = content.replace(/color: #ffffff !important;/g, "color: #0f172a !important;");

  // Banner flotante de dibujo
  content = content.replace("background: 'rgba(15, 23, 42, 0.96)'", "background: 'rgba(255, 255, 255, 0.96)', border: '1px solid #8b5cf6', boxShadow: '0 8px 24px rgba(0,0,0,0.1)'");
  content = content.replace("color: '#fff', fontSize: '11px'", "color: '#0f172a', fontSize: '11px'");

  // Swal colors
  content = content.replace(/background:\s*'#131d33'/g, "background: '#ffffff'");
  content = content.replace(/color:\s*'#fff'/g, "color: '#0f172a'");

  fs.writeFileSync(drawingToolbarPath, content, 'utf8');
  console.log('✅ DrawingToolbarMobile.jsx: Modal y herramientas actualizadas a tema claro.');
}

// 12. BUMP VERSION EN build.gradle A v2.5 (code 15)
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/versionCode\s+\d+/, 'versionCode 15');
  content = content.replace(/versionName\s+"[^"]+"/, 'versionName "2.5"');
  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log('✅ build.gradle: Versión actualizada a v2.5 (Code 15).');
}

console.log('--- Proceso completado exitosamente ---');
