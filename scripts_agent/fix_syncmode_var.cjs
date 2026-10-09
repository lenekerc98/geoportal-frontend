const fs = require('fs');
const path = require('path');

console.log('=== CORRIGIENDO VARIABLES FALTANTES EN PredioFormMobile.jsx ===');

const movilDir = path.resolve('..', 'movil');
const formPath = path.join(movilDir, 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');

if (fs.existsSync(formPath)) {
  let content = fs.readFileSync(formPath, 'utf8');

  // 1. Asegurar importación de updatePredioSyncStatus
  if (!content.includes('updatePredioSyncStatus')) {
    content = content.replace(
      "import { getOfflinePredios, saveOfflinePredio, deleteOfflinePredio, getCachedPredios }",
      "import { getOfflinePredios, saveOfflinePredio, deleteOfflinePredio, updatePredioSyncStatus, getCachedPredios }"
    );
    console.log('✓ updatePredioSyncStatus agregado a las importaciones de mobileDB');
  }

  // 2. Desestructurar syncMode de useMobile
  if (!content.includes('syncMode,') && !content.includes('syncMode }')) {
    content = content.replace(
      "setIsPerimeterWalking,\n    setPerimeterVertices\n  } = useMobile();",
      "setIsPerimeterWalking,\n    setPerimeterVertices,\n    syncMode,\n    switchSyncMode\n  } = useMobile();"
    ).replace(
      "setIsPerimeterWalking,\r\n    setPerimeterVertices\r\n  } = useMobile();",
      "setIsPerimeterWalking,\r\n    setPerimeterVertices,\r\n    syncMode,\r\n    switchSyncMode\r\n  } = useMobile();"
    );
    console.log('✓ syncMode desestructurado correctamente de useMobile()');
  }

  fs.writeFileSync(formPath, content, 'utf8');
}

// 3. ACTUALIZAR VERSIONES A 4.7.3 (CODE 43)
// package.json
const pkgPath = path.join(movilDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = '4.7.3';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
}

// build.gradle
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode \d+/, 'versionCode 43');
  gradle = gradle.replace(/versionName "[^"]+"/, 'versionName "4.7.3"');
  fs.writeFileSync(gradlePath, gradle, 'utf8');
}

// MobileHeader.jsx
const headerPath = path.join(movilDir, 'src', 'components', 'MobileHeader.jsx');
if (fs.existsSync(headerPath)) {
  let header = fs.readFileSync(headerPath, 'utf8');
  header = header.replace(/v4\.[0-9]+\.[0-9]+/g, 'v4.7.3');
  fs.writeFileSync(headerPath, header, 'utf8');
}

// LoginMobile.jsx
const loginPath = path.join(movilDir, 'src', 'pages', 'Login', 'LoginMobile.jsx');
if (fs.existsSync(loginPath)) {
  let login = fs.readFileSync(loginPath, 'utf8');
  login = login.replace(/v4\.[0-9]+\.[0-9]+ · Campo Oficial/g, 'v4.7.3 · Campo Oficial');
  fs.writeFileSync(loginPath, login, 'utf8');
}

console.log('✓ Versión actualizada a v4.7.3 (Code 43)');
console.log('=== CORRECCIÓN COMPLETADA ===');
