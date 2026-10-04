const fs = require('fs');
const path = require('path');

const movilDir = path.resolve('..', 'movil');

// 1. package.json
const pkgPath = path.join(movilDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = '4.7.1';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
}

// 2. build.gradle
const gradlePath = path.join(movilDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode \d+/, 'versionCode 41');
  gradle = gradle.replace(/versionName "[^"]+"/, 'versionName "4.7.1"');
  fs.writeFileSync(gradlePath, gradle, 'utf8');
}

// 3. MobileHeader.jsx
const headerPath = path.join(movilDir, 'src', 'components', 'MobileHeader.jsx');
if (fs.existsSync(headerPath)) {
  let header = fs.readFileSync(headerPath, 'utf8');
  header = header.replace(/v4\.[0-9]+\.[0-9]+/g, 'v4.7.1');
  fs.writeFileSync(headerPath, header, 'utf8');
}

// 4. LoginMobile.jsx
const loginPath = path.join(movilDir, 'src', 'pages', 'Login', 'LoginMobile.jsx');
if (fs.existsSync(loginPath)) {
  let login = fs.readFileSync(loginPath, 'utf8');
  login = login.replace(/v4\.[0-9]+\.[0-9]+ · Campo Oficial/g, 'v4.7.1 · Campo Oficial');
  fs.writeFileSync(loginPath, login, 'utf8');
}

console.log('✓ Versión actualizada a v4.7.1 (Code 41)');
