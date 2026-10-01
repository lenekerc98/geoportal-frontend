const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/context/MobileContext.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

content = content.replace(
  'authLoaded,',
  `authLoaded,
      toast,
      showToast,
      dismissToast,`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('MobileContext Provider value successfully updated!');
