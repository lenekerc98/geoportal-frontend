const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/context/MobileContext.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Add toast state and helpers inside MobileProvider
if (!content.includes('const [toast, setToast] = useState(null);')) {
  content = content.replace(
    "const [activeBaseMap, setActiveBaseMap] = useState('satellite');",
    `const [activeBaseMap, setActiveBaseMap] = useState('satellite');

  // Sistema de Alertas Ligeras y Deslizables (Swipeable Toast)
  const [toast, setToast] = useState(null);
  const showToast = useCallback((t) => {
    setToast(t);
  }, []);
  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);`
  );

  // Export in context value
  content = content.replace(
    'authLoaded,',
    `authLoaded,
      toast,
      showToast,
      dismissToast,`
  );

  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('MobileContext.jsx updated with toast state and methods!');
} else {
  console.log('MobileContext.jsx already has toast state!');
}
