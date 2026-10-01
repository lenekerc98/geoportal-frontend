const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/context/MobileContext.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Replace the messed up useState for authLoaded
const brokenRegex = /const \[authLoaded[\s\S]*?setAuthLoaded\] = useState\(false\);/;
content = content.replace(brokenRegex, "const [authLoaded, setAuthLoaded] = useState(false);");

// Ensure toast, showToast, dismissToast are in value
if (!content.includes('toast,') || !content.includes('showToast,')) {
  content = content.replace(
    'authLoaded,\n      setAuthState,',
    'authLoaded,\n      toast,\n      showToast,\n      dismissToast,\n      setAuthState,'
  );
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('MobileContext cleaned and fixed!');
