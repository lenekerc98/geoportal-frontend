const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../../movil/src/pages/FormTab/PredioFormMobile.jsx');
let content = fs.readFileSync(file, 'utf8');

const target = `            </button>

            
          </>

        <button`;

const replacement = `            </button>

        <button`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✓ Fragmento corregido.');
} else {
  // En caso de que difiera en espacios
  content = content.replace(/\s*<\/>\s*(<button\s+type="button"\s+className="btn-cta-cancel")/g, '\n\n        $1');
  fs.writeFileSync(file, content, 'utf8');
  console.log('✓ Fragmento corregido por regex.');
}
