const fs = require('fs');
const path = require('path');

const file = path.resolve('c:/LNCZ/proyecto-catastro-2026/movil/src/pages/FormTab/PredioFormMobile.jsx');
let content = fs.readFileSync(file, 'utf8');

const target = `  const renderListContent = () => (
        {/* Encabezado y Acción Principal */}`;

const replacement = `  const renderListContent = () => (
    <div className="tab-scroll-container">
      {/* Encabezado y Acción Principal */}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched PredioFormMobile.jsx');
} else {
  // Let's inspect where renderListContent is
  console.log('Target not found directly, checking regex...');
  const regex = /const renderListContent = \(\) => \(\s*\{\/\* Encabezado y Acción Principal \*\/\}/;
  if (regex.test(content)) {
    content = content.replace(regex, `const renderListContent = () => (\n    <div className="tab-scroll-container">\n      {/* Encabezado y Acción Principal */}`);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully patched via regex');
  } else {
    console.error('Neither target nor regex matched');
  }
}
