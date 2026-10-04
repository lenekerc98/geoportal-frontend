const fs = require('fs');
const path = require('path');

const MOVIL_ROOT = path.resolve(__dirname, '../../movil');

console.log('=== APLICANDO CORRECCIÓN CRÍTICA: PANTALLA NEGRA -> BLANCA Y OFFLINE NATIVO ===\n');

// 1. Corregir capacitor.config.json (Eliminar URL de emulador 10.0.2.2 para que cargue localmente desde dist/)
const capConfigPath = path.join(MOVIL_ROOT, 'capacitor.config.json');
const capConfig = {
  appId: "com.gad.catastromovil",
  appName: "Catastro Móvil 2026",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};
fs.writeFileSync(capConfigPath, JSON.stringify(capConfig, null, 2), 'utf8');
console.log('✓ capacitor.config.json actualizado (se eliminó la URL de emulador para carga 100% offline desde dist/).');

// También actualizar en android assets si ya existe
const androidAssetsCap = path.join(MOVIL_ROOT, 'android/app/src/main/assets/capacitor.config.json');
if (fs.existsSync(androidAssetsCap)) {
  fs.writeFileSync(androidAssetsCap, JSON.stringify(capConfig, null, 2), 'utf8');
  console.log('✓ android/app/src/main/assets/capacitor.config.json sincronizado.');
}

// 2. Corregir MainActivity.java (Cambiar fondo de WebView de #090d16 negro a Color.WHITE blanco)
const mainActivityPath = path.join(MOVIL_ROOT, 'android/app/src/main/java/com/gad/catastromovil/MainActivity.java');
const mainActivityCode = `package com.gad.catastromovil;

import android.graphics.Color;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(Color.WHITE);
        }
    }
}
`;
fs.writeFileSync(mainActivityPath, mainActivityCode, 'utf8');
console.log('✓ MainActivity.java actualizado: WebView ahora inicia en Color.WHITE (blanco puro).');

// 3. Corregir styles.xml (Cambiar temas nativos de negro a blanco con iconos oscuros de barra de estado)
const stylesPath = path.join(MOVIL_ROOT, 'android/app/src/main/res/values/styles.xml');
const stylesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Base application theme: Siempre Blanco Puro y Limpio -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="colorPrimary">#0284c7</item>
        <item name="colorPrimaryDark">#ffffff</item>
        <item name="colorAccent">#0284c7</item>
        <item name="android:windowBackground">#ffffff</item>
        <item name="android:colorBackground">#ffffff</item>
        <item name="android:navigationBarColor">#ffffff</item>
        <item name="android:statusBarColor">#ffffff</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowBackground">#ffffff</item>
        <item name="android:colorBackground">#ffffff</item>
        <item name="android:navigationBarColor">#ffffff</item>
        <item name="android:statusBarColor">#ffffff</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">#ffffff</item>
        <item name="windowSplashScreenBackground">#ffffff</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>
</resources>
`;
fs.writeFileSync(stylesPath, stylesXml, 'utf8');
console.log('✓ styles.xml actualizado: Splash y temas nativos configurados en #FFFFFF.');

// 4. Corregir index.html (color-scheme light, theme-color blanco, body blanco)
const indexPath = path.join(MOVIL_ROOT, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace('content="dark"', 'content="light"');
indexHtml = indexHtml.replace('content="#0f172a"', 'content="#ffffff"');
indexHtml = indexHtml.replace('content="black-translucent"', 'content="default"');
if (!indexHtml.includes('style="background-color: #ffffff')) {
  indexHtml = indexHtml.replace('<body>', '<body style="background-color: #ffffff; color: #0f172a; margin: 0; padding: 0;">');
}
fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('✓ index.html actualizado: color-scheme light y theme-color #ffffff.');

// 5. Corregir index.css (Fondo blanco en :root y html, body, #root)
const indexCssPath = path.join(MOVIL_ROOT, 'src/index.css');
let indexCss = fs.readFileSync(indexCssPath, 'utf8');
indexCss = indexCss.replace('--bg-primary: #f8fafc;', '--bg-primary: #ffffff;');
indexCss = indexCss.replace('background-color: #f8fafc;', 'background-color: #ffffff;');
fs.writeFileSync(indexCssPath, indexCss, 'utf8');
console.log('✓ index.css actualizado: fondos base en #ffffff.');

// 6. Corregir App.jsx (Pantalla de carga inicial en blanco)
const appJsxPath = path.join(MOVIL_ROOT, 'src/App.jsx');
let appJsx = fs.readFileSync(appJsxPath, 'utf8');
appJsx = appJsx.replace("background: '#f8fafc'", "background: '#ffffff'");
fs.writeFileSync(appJsxPath, appJsx, 'utf8');
console.log('✓ App.jsx actualizado: pantalla de carga inicial en #ffffff.');

// 7. Modificar build_apk.js para asegurar que NUNCA vuelva a empaquetar una URL en el APK
const buildApkPath = path.join(MOVIL_ROOT, 'build_apk.js');
let buildApk = fs.readFileSync(buildApkPath, 'utf8');
if (!buildApk.includes('Asegurar que capacitor.config.json no tenga url de desarrollo')) {
  const sanitizeSnippet = `
// Asegurar que capacitor.config.json no tenga url de desarrollo al compilar el APK
try {
  const cfgPath = path.join(movilRoot, 'capacitor.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (cfg.server && cfg.server.url) {
    console.log('Limpiando server.url de capacitor.config.json para empaquetado 100% offline...');
    delete cfg.server.url;
    delete cfg.server.cleartext;
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  }
} catch (e) {}
`;
  buildApk = buildApk.replace("console.log('1. Sincronizando", sanitizeSnippet + "\nconsole.log('1. Sincronizando");
  fs.writeFileSync(buildApkPath, buildApk, 'utf8');
  console.log('✓ build_apk.js actualizado con salvaguarda permanente contra URLs de emulador.');
}

// 8. Incrementar versión a versionCode 26, versionName "3.6"
const gradlePath = path.join(MOVIL_ROOT, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode 26');
gradle = gradle.replace(/versionName\s+"[^"]+"/, 'versionName "3.6"');
fs.writeFileSync(gradlePath, gradle, 'utf8');

const pkgPath = path.join(MOVIL_ROOT, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = "3.6.0";
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

console.log('✓ build.gradle y package.json actualizados: v3.6 (versionCode 26).');

console.log('\n=== LISTO PARA COMPILAR VITE Y APK NATIVO ===');
