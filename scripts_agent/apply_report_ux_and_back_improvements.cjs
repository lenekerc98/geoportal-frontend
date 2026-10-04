const fs = require('fs');
const path = require('path');

const MOVIL_ROOT = path.resolve(__dirname, '../../movil');

console.log('=== APLICANDO MEJORAS DE UX DEL REPORTE, MAPA INTERACTIVO, PDF Y BOTÓN ATRÁS ===\n');

// 1. ACTUALIZAR MainActivity.java
const mainActivityPath = path.join(MOVIL_ROOT, 'android/app/src/main/java/com/gad/catastromovil/MainActivity.java');
const mainActivityCode = `package com.gad.catastromovil;

import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private long lastBackPressTime = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(Color.WHITE);
            bridge.getWebView().addJavascriptInterface(new AndroidBridgeInterface(), "AndroidBridge");
        }
    }

    public class AndroidBridgeInterface {
        @JavascriptInterface
        public void print(String documentName) {
            runOnUiThread(() -> {
                try {
                    if (bridge != null && bridge.getWebView() != null) {
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            String docName = (documentName != null && !documentName.isEmpty()) ? documentName : "Reporte_Planimetrico";
                            PrintDocumentAdapter printAdapter = bridge.getWebView().createPrintDocumentAdapter(docName);
                            printManager.print(docName, printAdapter, new PrintAttributes.Builder().build());
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (bridge != null && bridge.getWebView() != null) {
            // Disparar evento personalizado en JavaScript para manejar regreso sin salir de la app
            bridge.getWebView().evaluateJavascript(
                "(function() { " +
                "  var ev = new CustomEvent('androidHardwareBack', { cancelable: true }); " +
                "  var dispatched = window.dispatchEvent(ev); " +
                "  return ev.defaultPrevented; " +
                "})()",
                value -> {
                    // Si ningún componente en JS capturó el evento (ev.defaultPrevented == false):
                    if (!"true".equals(value)) {
                        long currentTime = System.currentTimeMillis();
                        if (currentTime - lastBackPressTime < 2000) {
                            super.onBackPressed();
                        } else {
                            lastBackPressTime = currentTime;
                            Toast.makeText(MainActivity.this, "Presione atrás nuevamente para salir", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }
}
`;
fs.writeFileSync(mainActivityPath, mainActivityCode, 'utf8');
console.log('✓ MainActivity.java actualizado: Soporte nativo de Impresión/PDF y gestión inteligente del botón Atrás.');


// 2. ACTUALIZAR ReportePlanimetricoSheet.jsx (Permitir interactuar con el plano: arrastrar, zoom táctil, doble tap)
const sheetPath = path.join(MOVIL_ROOT, 'src/components/ReportePlanimetricoSheet.jsx');
let sheet = fs.readFileSync(sheetPath, 'utf8');

// Modificar MapContainer del plano principal
sheet = sheet.replace(
  `zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}`,
  `zoomControl={true}
                        scrollWheelZoom={true}
                        doubleClickZoom={true}
                        dragging={true}
                        touchZoom={true}`
);

// Modificar MapContainer del minimapa para permitir arrastre si se desea
sheet = sheet.replace(
  `zoomControl={false}
                          scrollWheelZoom={false}
                          doubleClickZoom={false}
                          dragging={false}
                          touchZoom={false}`,
  `zoomControl={false}
                          scrollWheelZoom={true}
                          doubleClickZoom={true}
                          dragging={true}
                          touchZoom={true}`
);

fs.writeFileSync(sheetPath, sheet, 'utf8');
console.log('✓ ReportePlanimetricoSheet.jsx actualizado: Plano ahora 100% interactivo (Zoom táctil, arrastre y controles).');


// 3. ACTUALIZAR ReportePlanimetricoModal.jsx
const modalPath = path.join(MOVIL_ROOT, 'src/components/ReportePlanimetricoModal.jsx');
let modal = fs.readFileSync(modalPath, 'utf8');

// A) Reemplazar el botón "Cerrar" por solo el icono "X"
const oldCloseBtn = `<button
            type="button"
            onClick={onClose}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <X size={16} /> Cerrar
          </button>`;

const newCloseBtn = `<button
            type="button"
            onClick={onClose}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
            }}
            title="Cerrar Reporte"
          >
            <X size={18} />
          </button>`;

if (modal.includes(oldCloseBtn)) {
  modal = modal.replace(oldCloseBtn, newCloseBtn);
  console.log('✓ Botón cerrar reemplazado por solo el icono X.');
}

// B) Agregar escucha de botón atrás en el modal para cerrarlo sin salir de la app
if (!modal.includes('androidHardwareBack')) {
  const insertBackEffect = `
  // Escuchar botón físico o gesto Atrás de Android para cerrar el modal sin salir de la app
  useEffect(() => {
    const handleBack = (e) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('androidHardwareBack', handleBack);
    return () => window.removeEventListener('androidHardwareBack', handleBack);
  }, [onClose]);
`;
  modal = modal.replace('if (!predio) return null;', insertBackEffect + '\n  if (!predio) return null;');
  console.log('✓ Escucha de botón atrás de Android agregada al modal.');
}

// C) Actualizar funciones de impresión y descarga PDF para invocar AndroidBridge.print
const oldPrintFuncRegex = /const handlePrint = \(\) => \{[\s\S]*?window\.print\(\);\s*\};/;
const newPrintFunc = `const handlePrint = () => {
    const docName = \`Reporte_Planimetrico_\${predio.codigo || 'Predio'}\`;
    if (window.AndroidBridge && typeof window.AndroidBridge.print === 'function') {
      window.AndroidBridge.print(docName);
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = () => {
    // En Android, abrir el diálogo del sistema permite guardar directamente como PDF oficial
    handlePrint();
  };`;

if (oldPrintFuncRegex.test(modal)) {
  modal = modal.replace(oldPrintFuncRegex, newPrintFunc);
  console.log('✓ Función de impresión vinculada con el servicio nativo de Android Print/PDF.');
}

// D) Actualizar botones de descarga en la barra de herramientas
modal = modal.replace(
  'onClick={handleDownloadReport}',
  'onClick={handleDownloadPdf}'
);
modal = modal.replace(
  '<span>Descargar (PDF/HTML)</span>',
  '<span>Descargar PDF</span>'
);

fs.writeFileSync(modalPath, modal, 'utf8');
console.log('✓ ReportePlanimetricoModal.jsx guardado.');


// 4. ACTUALIZAR App.jsx (Gestionar botón atrás a nivel de pestañas)
const appPath = path.join(MOVIL_ROOT, 'src/App.jsx');
let appJsx = fs.readFileSync(appPath, 'utf8');

if (!appJsx.includes('androidHardwareBack')) {
  const backNavigationSnippet = `
  // Navegación con botón atrás de Android (regresar a mapa en lugar de cerrar la app)
  React.useEffect(() => {
    const handleHardwareBack = (e) => {
      if (e.defaultPrevented) return;
      if (activeTab !== 'map') {
        e.preventDefault();
        setActiveTab('map');
      }
    };
    window.addEventListener('androidHardwareBack', handleHardwareBack);
    return () => window.removeEventListener('androidHardwareBack', handleHardwareBack);
  }, [activeTab, setActiveTab]);
`;
  appJsx = appJsx.replace('export default function App() {', 'export default function App() {\n' + backNavigationSnippet);
  appJsx = appJsx.replace('const { activeTab, auth, authLoaded, toast, dismissToast } = useMobile();', 'const { activeTab, setActiveTab, auth, authLoaded, toast, dismissToast } = useMobile();');
  fs.writeFileSync(appPath, appJsx, 'utf8');
  console.log('✓ App.jsx actualizado con navegación hacia atrás fluida.');
}


// 5. INCREMENTAR A v4.0 (versionCode 30)
const gradlePath = path.join(MOVIL_ROOT, 'android/app/build.gradle');
let buildGradle = fs.readFileSync(gradlePath, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, 'versionCode 30');
buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, 'versionName "4.0"');
fs.writeFileSync(gradlePath, buildGradle, 'utf8');

const pkgPath = path.join(MOVIL_ROOT, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = "4.0.0";
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

console.log('✓ Versión actualizada a v4.0 (versionCode 30).');
console.log('\n=== LISTO PARA COMPILAR VITE Y APK NATIVO ===');
