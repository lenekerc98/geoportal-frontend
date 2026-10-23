const fs = require('fs');
const p = 'c:/LNCZ/proyecto-catastro-2026/movil/src/services/api.js';
let c = fs.readFileSync(p, 'utf8');

// Replace top lines with clean imports and constants
c = c.replace(
  /\/\/ IP local por defecto del servidor Catastro 2026[\s\S]*?export function getDefaultServerUrl/,
  `// IP local por defecto del servidor Catastro 2026\nexport const API_URL = 'https://geoportal-backend-43s0.onrender.com';\nconst DEFAULT_BACKEND_URL = API_URL;\n\nexport function getDefaultServerUrl`
);

fs.writeFileSync(p, c, 'utf8');
console.log('✓ Successfully fixed api.js with API_URL and DEFAULT_BACKEND_URL');
