const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../../movil/src/App.jsx');
let content = fs.readFileSync(file, 'utf8');

const target = `export default function App() {

  // Navegación con botón atrás de Android (regresar a mapa en lugar de cerrar la app)
  React.useEffect(() => {
    const handleHardwareBack = (e) => {
      if (e.defaultPrevented) return;
      if (activeTab !== 'map') {
        e.preventDefault();
        setActiveTab('map');
      }
    };
    window.addEventListener('androidHardwareBack', handleHardwareBack);
    return () => window.removeEventListener('androidHardwareBack', handleHardwareBack);
  }, [activeTab, setActiveTab]);

  const { activeTab, setActiveTab, auth, authLoaded, toast, dismissToast } = useMobile();`;

const replacement = `export default function App() {
  const { activeTab, setActiveTab, auth, authLoaded, toast, dismissToast } = useMobile();

  // Navegación con botón atrás de Android (regresar a mapa en lugar de cerrar la app)
  React.useEffect(() => {
    const handleHardwareBack = (e) => {
      if (e.defaultPrevented) return;
      if (activeTab !== 'map') {
        e.preventDefault();
        setActiveTab('map');
      }
    };
    window.addEventListener('androidHardwareBack', handleHardwareBack);
    return () => window.removeEventListener('androidHardwareBack', handleHardwareBack);
  }, [activeTab, setActiveTab]);`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✓ App.jsx ordering fixed.');
} else {
  console.warn('Target block not found exactly, verifying lines...');
}
