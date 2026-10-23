const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '..', 'movil');
const settingsPath = path.join(movilDir, 'src', 'pages', 'SettingsTab', 'SettingsMobile.jsx');

let code = fs.readFileSync(settingsPath, 'utf8');

// 1. Update imports
if (!code.includes('fetchServerPredios')) {
  code = code.replace(
    "import { getServerUrl, testConnection, getDefaultServerUrl } from '../../services/api';",
    "import { getServerUrl, testConnection, getDefaultServerUrl, fetchServerPredios } from '../../services/api';"
  );
}

if (!code.includes('Download')) {
  code = code.replace(
    "RotateCcw\n} from 'lucide-react';",
    "RotateCcw,\n  Download\n} from 'lucide-react';"
  );
}

// 2. Add handleDownloadPredios state and function
if (!code.includes('handleDownloadPredios')) {
  const targetState = "  const [cachedCount, setCachedCount] = useState(0);";
  const replacementState = `  const [cachedCount, setCachedCount] = useState(0);
  const [downloadingPredios, setDownloadingPredios] = useState(false);

  const handleDownloadPredios = async () => {
    setDownloadingPredios(true);
    try {
      const predios = await fetchServerPredios();
      setCachedCount(predios.length);
      Swal.fire({
        icon: 'success',
        title: 'Predios Descargados',
        text: \`Se descargaron \${predios.length} predios vectoriales en la memoria del teléfono para trabajar sin internet.\`,
        background: '#131d33',
        color: '#fff'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Descarga',
        text: err.message || 'No se pudo conectar al servidor.',
        background: '#131d33',
        color: '#fff'
      });
    } finally {
      setDownloadingPredios(false);
    }
  };`;

  code = code.replace(targetState, replacementState);
}

// 3. Update Cache Card JSX
const targetJSX = `<button 
            className="btn-secondary-mobile" 
            style={{ height: '36px', fontSize: '11px', padding: '0 10px' }}
            onClick={handleClearCache}
          >
            <Trash2 size={13} /> Limpiar
          </button>`;

const replacementJSX = `<div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn-secondary-mobile" 
              style={{ height: '36px', fontSize: '11px', padding: '0 10px', background: '#0284c7', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={handleDownloadPredios}
              disabled={downloadingPredios}
            >
              <Download size={13} /> {downloadingPredios ? 'Descargando...' : 'Descargar Predios'}
            </button>
            <button 
              className="btn-secondary-mobile" 
              style={{ height: '36px', fontSize: '11px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={handleClearCache}
              disabled={downloadingPredios}
            >
              <Trash2 size={13} /> Limpiar
            </button>
          </div>`;

if (code.includes(targetJSX)) {
  code = code.replace(targetJSX, replacementJSX);
}

fs.writeFileSync(settingsPath, code, 'utf8');
console.log('Successfully updated SettingsMobile.jsx with Descargar Predios button!');
