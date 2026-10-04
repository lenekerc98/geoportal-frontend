const fs = require('fs');
const path = require('path');

const PREDIO_FORM_PATH = path.resolve(__dirname, '../../movil/src/pages/FormTab/PredioFormMobile.jsx');
const BUILD_GRADLE_PATH = path.resolve(__dirname, '../../movil/android/app/build.gradle');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../movil/package.json');

console.log('=== ELIMINANDO BOTÓN "GUARDAR SOLAMENTE EN TELÉFONO" ===\n');

// 1. Modificar PredioFormMobile.jsx
let formContent = fs.readFileSync(PREDIO_FORM_PATH, 'utf8');

const buttonRegex = /<button\s+type="button"\s+className="btn-cta-phone"[\s\S]*?<span>Guardar Solamente en Teléfono \(Offline\)<\/span>\s*<\/button>/;

if (buttonRegex.test(formContent)) {
  formContent = formContent.replace(buttonRegex, '');
  // Limpiar posibles fragmentos vacíos <> </>
  formContent = formContent.replace('<>\n            <button \n              type="button" \n              className="btn-cta-cloud"', '<button \n              type="button" \n              className="btn-cta-cloud"');
  formContent = formContent.replace('</button>\n\n          </>', '</button>');
  formContent = formContent.replace('<>\n          <button \n            type="button" \n            className="btn-cta-cloud"', '<button \n            type="button" \n            className="btn-cta-cloud"');
  formContent = formContent.replace('</button>\n          </>', '</button>');
  
  fs.writeFileSync(PREDIO_FORM_PATH, formContent, 'utf8');
  console.log('✓ Botón blanco "Guardar Solamente en Teléfono (Offline)" eliminado exitosamente.');
} else {
  console.warn('⚠️ No se encontró el botón con el regex principal, buscando alternativo...');
  const startBtn = formContent.indexOf('className="btn-cta-phone"');
  if (startBtn !== -1) {
    const btnTagStart = formContent.lastIndexOf('<button', startBtn);
    const btnTagEnd = formContent.indexOf('</button>', startBtn) + 9;
    formContent = formContent.substring(0, btnTagStart) + formContent.substring(btnTagEnd);
    fs.writeFileSync(PREDIO_FORM_PATH, formContent, 'utf8');
    console.log('✓ Botón eliminado por índice de etiquetas.');
  }
}

// 2. Incrementar versión a versionCode 28, versionName "3.8"
let buildGradle = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, 'versionCode 28');
buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, 'versionName "3.8"');
fs.writeFileSync(BUILD_GRADLE_PATH, buildGradle, 'utf8');

let pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
pkg.version = "3.8.0";
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2), 'utf8');

console.log('✓ Versión actualizada a v3.8 (versionCode 28).');

console.log('\n=== LISTO PARA COMPILAR VITE Y APK NATIVO ===');
