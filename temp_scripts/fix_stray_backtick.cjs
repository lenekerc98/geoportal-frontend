const fs = require('fs');
const file = 'C:\\LNCZ\\proyecto-catastro-2026\\movil\\src\\pages\\FormTab\\PredioFormMobile.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'title: `Editar Punto P${String(index + 1).padStart(2, "0")}`,`',
  'title: `Editar Punto P${String(index + 1).padStart(2, "0")}`,'
);

content = content.replace(
  'title: `Nuevo Punto P${String(vertices.length + 1).padStart(2, "0")}`,`',
  'title: `Nuevo Punto P${String(vertices.length + 1).padStart(2, "0")}`,'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed stray backticks in PredioFormMobile.jsx');
