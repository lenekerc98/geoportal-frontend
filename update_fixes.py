# -*- coding: utf-8 -*-
import os

movil_dir = r'C:\LNCZ\proyecto-catastro-2026\movil'

# 1. Create flavorConfig.js
flavor_config_path = os.path.join(movil_dir, 'src', 'flavorConfig.js')
with open(flavor_config_path, 'w', encoding='utf-8') as f:
    f.write("// Configuración de sabor generada automáticamente\nexport const APP_FLAVOR = 'gad';\n")
print('1. Created src/flavorConfig.js')

# 2. Update build_apk.js so it writes APP_FLAVOR = flavorKey into src/flavorConfig.js
build_apk_path = os.path.join(movil_dir, 'build_apk.js')
with open(build_apk_path, 'r', encoding='utf-8') as f:
    build_apk_content = f.read()

old_cfg_flavor = """  // 5. index.html
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  indexHtml = indexHtml.replace(/<title>[^<]+<\/title>/, `<title>${appName} | Campo Offline</title>`);
    indexHtml = indexHtml.replace(/<script id="app-flavor">.*?<\/script>\s*/s, '');
  indexHtml = indexHtml.replace('</head>', `<script id="app-flavor">window.__APP_FLAVOR__ = '${flavorKey}';</script>\\n  </head>`);
  fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');"""

new_cfg_flavor = """  // 5. index.html y src/flavorConfig.js (GARANTÍA TOTAL DE DETECCIÓN DE SABOR)
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  indexHtml = indexHtml.replace(/<title>[^<]+<\/title>/, `<title>${appName} | Campo Offline</title>`);
  indexHtml = indexHtml.replace(/<script id="app-flavor">.*?<\/script>\s*/s, '');
  indexHtml = indexHtml.replace('</head>', `<script id="app-flavor">window.__APP_FLAVOR__ = '${flavorKey}';</script>\\n  </head>`);
  fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');

  // Hardcode en módulo JS para que Vite lo compile directamente en el bundle
  const flavorConfigPath = path.join(movilRoot, 'src', 'flavorConfig.js');
  fs.writeFileSync(flavorConfigPath, `// Generado automaticamente en compilacion\\nexport const APP_FLAVOR = '${flavorKey}';\\n`, 'utf8');"""

if old_cfg_flavor in build_apk_content:
    build_apk_content = build_apk_content.replace(old_cfg_flavor, new_cfg_flavor)
    with open(build_apk_path, 'w', encoding='utf-8') as f:
        f.write(build_apk_content)
    print('2. Updated build_apk.js with flavorConfig injection')
else:
    print('2. build_apk.js target not matched (checking...)')

# 3. Update ReportePlanimetricoSheet.jsx
sheet_path = os.path.join(movil_dir, 'src', 'components', 'ReportePlanimetricoSheet.jsx')
with open(sheet_path, 'r', encoding='utf-8') as f:
    sheet_content = f.read()

# Add import of APP_FLAVOR if not present
if "import { APP_FLAVOR } from '../flavorConfig';" not in sheet_content:
    sheet_content = "import { APP_FLAVOR } from '../flavorConfig';\n" + sheet_content

# Update isEcc detection and header
old_isEcc_block = """              const isEcc = (
                (typeof window !== 'undefined' && (
                  window.__APP_FLAVOR__ === 'ecc' ||
                  window.location.hostname.includes('ecc') ||
                  document.title.toLowerCase().includes('ecc')
                )) ||
                (activeEmpresa?.nombre && activeEmpresa.nombre.toLowerCase().includes('ecc'))
              );"""

new_isEcc_block = """              const isEcc = (
                APP_FLAVOR === 'ecc' ||
                (typeof window !== 'undefined' && (
                  window.__APP_FLAVOR__ === 'ecc' ||
                  (window.__ANDROID_PACKAGE__ && window.__ANDROID_PACKAGE__.includes('ecc')) ||
                  (window.AndroidBridge && typeof window.AndroidBridge.getAppFlavor === 'function' && window.AndroidBridge.getAppFlavor() === 'ecc') ||
                  (document.title && document.title.toLowerCase().includes('ecc')) ||
                  (window.location && (window.location.hostname.includes('ecc') || window.location.pathname.includes('ecc')))
                )) ||
                (activeEmpresa?.nombre && activeEmpresa.nombre.toLowerCase().includes('ecc'))
              );"""

if old_isEcc_block in sheet_content:
    sheet_content = sheet_content.replace(old_isEcc_block, new_isEcc_block)

# Update showP1 and showP2 to force both when printing
old_show_pages = """  const showP1 = sheetToShow === 'both' || sheetToShow === 'page1';
  const showP2 = sheetToShow === 'both' || sheetToShow === 'page2';"""

new_show_pages = """  const isPrinting = (typeof document !== 'undefined' && document.body.classList.contains('is-printing-report'));
  const showP1 = isPrinting || sheetToShow === 'both' || sheetToShow === 'page1';
  const showP2 = isPrinting || sheetToShow === 'both' || sheetToShow === 'page2';"""

if old_show_pages in sheet_content:
    sheet_content = sheet_content.replace(old_show_pages, new_show_pages)

# Update Lámina 2 signatures: Director on the RIGHT, technician on the LEFT
old_lamina2_signatures = """                    <div className="firmas-grid">
                      <div className="firma-box">
                        <div className="firma-box-title">RESPONSABILIDAD TÉCNICA</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '8px', fontWeight: 'bold' }}>{directorNombre}</div>
                          <div style={{ fontSize: '7.5px' }}>Director(a) de Catastro</div>
                        </div>
                      </div>
                      <div className="firma-box" style={{ borderLeft: 'none' }}>
                        <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '8px', fontWeight: 'bold', color: 'transparent', userSelect: 'none' }}>.</div>
                          <div style={{ fontSize: '7.5px', color: 'transparent', userSelect: 'none' }}>.</div>
                        </div>
                      </div>
                    </div>"""

new_lamina2_signatures = """                    <div className="firmas-grid">
                      <div className="firma-box">
                        <div className="firma-box-title">RESPONSABILIDAD TÉCNICA</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '7.5px', minHeight: '12px' }}></div>
                        </div>
                      </div>
                      <div className="firma-box" style={{ borderLeft: 'none' }}>
                        <div className="firma-box-title">REVISADO Y APROBADO POR:</div>
                        <div style={{ marginTop: 'auto', marginBottom: '2px', textAlign: 'center', height: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto 2px auto' }}></div>
                          <div style={{ fontSize: '8px', fontWeight: 'bold' }}>{directorNombre}</div>
                          <div style={{ fontSize: '7.5px' }}>Director(a) de Catastro</div>
                        </div>
                      </div>
                    </div>"""

if old_lamina2_signatures in sheet_content:
    sheet_content = sheet_content.replace(old_lamina2_signatures, new_lamina2_signatures)
    print('3. Updated Lámina 2 signatures (director on the right)')
else:
    print('3. Lámina 2 signatures target not matched')

# Ensure Lámina 1 signature also uses directorNombre on the right
old_lamina1_sig = """                    <div style={{ flex: 1, padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '7.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>REVISADO Y APROBADO POR:</div>
                      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                        <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                        <div style={{ fontSize: '7px' }}>{activeEmpresa?.nombre_director || 'Ing. Mauricio Basantes Rodríguez'}</div>
                      </div>
                    </div>"""

new_lamina1_sig = """                    <div style={{ flex: 1, padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '7.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>REVISADO Y APROBADO POR:</div>
                      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                        <div style={{ borderTop: '1px solid black', width: '85%', margin: '0 auto 2px auto' }}></div>
                        <div style={{ fontSize: '7px', fontWeight: 'bold' }}>{directorNombre}</div>
                      </div>
                    </div>"""

if old_lamina1_sig in sheet_content:
    sheet_content = sheet_content.replace(old_lamina1_sig, new_lamina1_sig)

with open(sheet_path, 'w', encoding='utf-8') as f:
    f.write(sheet_content)
print('3. ReportePlanimetricoSheet.jsx updated completely')

# 4. Update ReportePlanimetricoModal.jsx (force activeSheet='both' on print)
modal_path = os.path.join(movil_dir, 'src', 'components', 'ReportePlanimetricoModal.jsx')
with open(modal_path, 'r', encoding='utf-8') as f:
    modal_content = f.read()

target_modal_print = """  const handlePrint = () => {
    document.body.classList.add('is-printing-report');
    const docName = `Reporte_${effectivePredio?.codigo || 'Planimetrico'}`;

    // Permitir que el DOM aplique las clases de impresión A4 antes de capturar el documento
    setTimeout(() => {
      if (window.AndroidBridge && typeof window.AndroidBridge.print === 'function') {
        console.log('[PRINT] Invocando servicio nativo de impresión AndroidBridge.print con:', docName);
        window.AndroidBridge.print(docName);
      } else {
        console.log('[PRINT] Invocando fallback window.print()...');
        window.print();
      }

      setTimeout(() => {
        document.body.classList.remove('is-printing-report');
      }, 3500);
    }, 200);
  };"""

replacement_modal_print = """  const handlePrint = () => {
    // 1. Forzar visualización de ambas láminas para que ambas existan en el DOM al imprimir
    setActiveSheet('both');
    document.body.classList.add('is-printing-report');
    const docName = `Reporte_${effectivePredio?.codigo || 'Planimetrico'}`;

    // 2. Dar 350ms para que React actualice el estado a 'both' y el DOM expanda ambas láminas
    setTimeout(() => {
      try {
        if (window.AndroidBridge && typeof window.AndroidBridge.print === 'function') {
          console.log('[PRINT] Invocando AndroidBridge.print con:', docName);
          window.AndroidBridge.print(docName);
        } else {
          console.log('[PRINT] Invocando window.print fallback...');
          window.print();
        }
      } catch (err) {
        console.error('Error al imprimir:', err);
        window.print();
      }

      setTimeout(() => {
        document.body.classList.remove('is-printing-report');
      }, 4000);
    }, 350);
  };"""

if target_modal_print in modal_content:
    modal_content = modal_content.replace(target_modal_print, replacement_modal_print)
    with open(modal_path, 'w', encoding='utf-8') as f:
        f.write(modal_content)
    print('4. ReportePlanimetricoModal.jsx updated to force both sheets on print')
else:
    print('4. target_modal_print not matched')

# 5. Update ReportePlanimetrico.css for body.is-printing-report unclipped layout
css_path = os.path.join(movil_dir, 'src', 'components', 'ReportePlanimetrico.css')
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

target_css_print = """/* Al preparar o ejecutar impresión nativa, ocultar TODO el árbol principal (#root) */
body.is-printing-report #root,
body.is-printing-report .app-container,
body.is-printing-report .main-content,
body.is-printing-report .mobile-header,
body.is-printing-report .bottom-nav-bar,
body.is-printing-report .bottom-sheet,
body.is-printing-report .bottom-sheet-backdrop,
body.is-printing-report .swal2-container,
body.is-printing-report .no-print,
body.is-printing-report .report-header-bar,
body.is-printing-report .report-floating-panel,
body.is-printing-report button {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
}"""

replacement_css_print = """/* Al preparar o ejecutar impresión nativa, ocultar TODO el árbol principal (#root) */
body.is-printing-report #root,
body.is-printing-report .app-container,
body.is-printing-report .main-content,
body.is-printing-report .mobile-header,
body.is-printing-report .bottom-nav-bar,
body.is-printing-report .bottom-sheet,
body.is-printing-report .bottom-sheet-backdrop,
body.is-printing-report .swal2-container,
body.is-printing-report .no-print,
body.is-printing-report .report-header-bar,
body.is-printing-report .report-floating-panel,
body.is-printing-report button {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
}

body.is-printing-report {
  background: #ffffff !important;
  overflow: visible !important;
  height: auto !important;
}

body.is-printing-report .report-modal-overlay {
  position: static !important;
  inset: auto !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  overflow: visible !important;
  background: #ffffff !important;
  display: block !important;
  padding: 0 !important;
  margin: 0 !important;
  z-index: auto !important;
}

body.is-printing-report .report-sheets-scroll-area {
  overflow: visible !important;
  background: #ffffff !important;
  padding: 0 !important;
  margin: 0 !important;
  height: auto !important;
  display: block !important;
}

body.is-printing-report .report-sheets-sizer {
  width: auto !important;
  min-width: 0 !important;
  height: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  position: static !important;
  overflow: visible !important;
}

body.is-printing-report .report-sheets-zoom-wrapper {
  position: static !important;
  transform: none !important;
  width: auto !important;
  height: auto !important;
  display: block !important;
}

body.is-printing-report .report-print-container {
  display: flex !important;
  flex-direction: column !important;
  gap: 20px !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
}

body.is-printing-report .print-page {
  width: 297mm !important;
  height: 209mm !important;
  min-height: 209mm !important;
  max-height: 209mm !important;
  margin: 0 auto !important;
  padding: 8mm !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
  box-shadow: none !important;
  overflow: hidden !important;
  position: relative !important;
  display: flex !important;
  visibility: visible !important;
  flex-direction: column !important;
  page-break-after: always !important;
  break-after: page !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

body.is-printing-report .print-page + .print-page {
  page-break-before: always !important;
  break-before: page !important;
}"""

if target_css_print in css_content:
    css_content = css_content.replace(target_css_print, replacement_css_print)
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css_content)
    print('5. ReportePlanimetrico.css updated with multi-page print layout')
else:
    print('5. target_css_print not matched')

# 6. Update MainActivity.java (getAppFlavor & package evaluation)
ma_path = os.path.join(movil_dir, 'android', 'app', 'src', 'main', 'java', 'com', 'gad', 'catastromovil', 'MainActivity.java')
with open(ma_path, 'r', encoding='utf-8') as f:
    ma_content = f.read()

target_ma_bridge = """    public class AndroidBridgeInterface {
        @JavascriptInterface
        public void print(String documentName) {"""

replacement_ma_bridge = """    public class AndroidBridgeInterface {
        @JavascriptInterface
        public String getAppFlavor() {
            return getPackageName().contains("ecc") ? "ecc" : "gad";
        }

        @JavascriptInterface
        public void print(String documentName) {"""

if target_ma_bridge in ma_content and "getAppFlavor" not in ma_content:
    ma_content = ma_content.replace(target_ma_bridge, replacement_ma_bridge)
    with open(ma_path, 'w', encoding='utf-8') as f:
        f.write(ma_content)
    print('6. MainActivity.java updated with getAppFlavor()')
else:
    print('6. MainActivity.java already has getAppFlavor() or target not matched')
