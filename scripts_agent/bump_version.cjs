const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/android/app/build.gradle');
let content = fs.readFileSync(targetPath, 'utf8');

content = content.replace(/versionCode\s+\d+/, 'versionCode 18');
content = content.replace(/versionName\s+"[^"]+"/, 'versionName "2.8"');

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Updated build.gradle to versionCode 18, versionName 2.8');
