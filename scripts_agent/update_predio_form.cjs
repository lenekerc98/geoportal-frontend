const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/pages/FormTab/PredioFormMobile.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Imports
if (!content.includes('ReportePlanimetricoModal')) {
  content = content.replace(
    "import Swal from 'sweetalert2';",
    `import Swal from 'sweetalert2';
import ReportePlanimetricoModal from '../../components/ReportePlanimetricoModal';`
  );
}

content = content.replace(
  "wgs84ToUtm, computePolygonArea, computePerimeter, normalizeVerticesClockwiseFromNW",
  "wgs84ToUtm, computePolygonArea, computePerimeter, normalizeVerticesClockwiseFromNW, extractVerticesFromPredio, calculateLinderosAndTramos"
);

// 2. Destructure showToast from useMobile
content = content.replace(
  "permissions \n  } = useMobile();",
  `permissions,
    showToast 
  } = useMobile();`
);
if (!content.includes('showToast')) {
  content = content.replace(
    "permissions\n  } = useMobile();",
    `permissions,
    showToast 
  } = useMobile();`
  );
}

// 3. Add states for Reporte modal
content = content.replace(
  "const [nameSuggestions, setNameSuggestions] = useState([]);",
  `const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [selectedPredioForReport, setSelectedPredioForReport] = useState(null);`
);

// 4. Update preload useEffect to extract vertices unconditionally
const oldPreloadRegex = /\/\/ Si se envi[óo] un predio desde el mapa[\s\S]*?setViewMode\('form'\);\s*\}\s*\}, \[formPreloadData, setFormPreloadData, permissions\]\);/;

const newPreload = `// Si se envió un predio desde el mapa o modo de dibujo, abrir directamente en vista 'form'
  useEffect(() => {
    if (formPreloadData) {
      const readOnlyRequested = !!formPreloadData.isReadOnly || (formPreloadData.isServer && permissions?.isBrigadista);
      setIsReadOnly(readOnlyRequested);
      if (formPreloadData.offline_id) setOfflineId(formPreloadData.offline_id);
      
      const cod = formPreloadData.codigo || formPreloadData.clave_catastral || formPreloadData.cod_catastral || formPreloadData.raw?.properties?.cod_catastral;
      if (cod) setCodigo(cod);

      const prop = formPreloadData.propietario || formPreloadData.nombre_posesionario || formPreloadData.posesionario || formPreloadData.raw?.properties?.nombre_posesionario;
      if (prop) setPropietario(prop);

      const ced = formPreloadData.cedula || formPreloadData.raw?.properties?.cedula;
      if (ced) setCedula(ced);

      const tel = formPreloadData.telefono || formPreloadData.celular || formPreloadData.raw?.properties?.telefono;
      if (tel) setTelefono(tel);

      const n = formPreloadData.norte || formPreloadData.lindero_norte || formPreloadData.raw?.properties?.lindero_norte;
      if (n) setNorte(n);

      const s = formPreloadData.sur || formPreloadData.lindero_sur || formPreloadData.raw?.properties?.lindero_sur;
      if (s) setSur(s);

      const e = formPreloadData.este || formPreloadData.lindero_este || formPreloadData.raw?.properties?.lindero_este;
      if (e) setEste(e);

      const o = formPreloadData.oeste || formPreloadData.lindero_oeste || formPreloadData.raw?.properties?.lindero_oeste;
      if (o) setOeste(o);

      const obs = formPreloadData.observaciones || formPreloadData.raw?.properties?.observaciones;
      if (obs) setObservaciones(obs);

      // Extraer y normalizar vértices siempre
      const verts = extractVerticesFromPredio(formPreloadData);
      if (verts.length >= 3) {
        setVertices(verts);
      } else if (Array.isArray(formPreloadData.vertices) && formPreloadData.vertices.length > 0) {
        setVertices(normalizeVerticesClockwiseFromNW(formPreloadData.vertices));
      }

      setFormPreloadData(null);
      setViewMode('form');
    }
  }, [formPreloadData, setFormPreloadData, permissions]);`;

content = content.replace(oldPreloadRegex, newPreload);

// 5. Update handleEditFromList
const oldEditFromListRegex = /const handleEditFromList = \(p\) => \{[\s\S]*?setViewMode\('form'\);\s*\};/;

const newEditFromList = `const handleEditFromList = (p) => {
    setOfflineId(p.offline_id || null);
    setIsReadOnly(false);
    setCodigo(p.codigo || p.clave_catastral || '');
    setPropietario(p.propietario || p.nombre_posesionario || '');
    setCedula(p.cedula || '');
    setTelefono(p.telefono || '');
    setNorte(p.norte || '');
    setSur(p.sur || '');
    setEste(p.este || '');
    setOeste(p.oeste || '');
    setObservaciones(p.observaciones || '');
    
    const verts = extractVerticesFromPredio(p);
    if (verts.length >= 3) {
      setVertices(verts);
    } else if (Array.isArray(p.vertices) && p.vertices.length > 0) {
      setVertices(normalizeVerticesClockwiseFromNW(p.vertices));
    } else {
      setVertices([]);
    }
    setViewMode('form');
  };`;

content = content.replace(oldEditFromListRegex, newEditFromList);

// 6. Add Reporte button in list items
const oldListActionsRegex = /<button \s*type="button" \s*className="btn-secondary-mobile"\s*style=\{\{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1, color: '#0284c7', borderColor: '#bae6fd' \}\}\s*onClick=\{\(\) => handleEditFromList\(p\)\}\s*>\s*<Edit2 size=\{14\} \/> Editar Datos\s*<\/button>/;

const newListActions = `<button 
                      type="button" 
                      className="btn-secondary-mobile"
                      style={{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1, color: '#0284c7', borderColor: '#bae6fd' }}
                      onClick={() => handleEditFromList(p)}
                    >
                      <Edit2 size={14} /> Editar Datos
                    </button>

                    <button 
                      type="button" 
                      className="btn-secondary-mobile"
                      style={{ height: '38px', minHeight: '38px', fontSize: '12px', flex: 1, color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff' }}
                      onClick={() => {
                        setSelectedPredioForReport(p);
                        setShowReporteModal(true);
                      }}
                    >
                      <FileText size={14} /> Reporte
                    </button>`;

content = content.replace(oldListActionsRegex, newListActions);

// 7. Add Ver Reporte button in form top bar
content = content.replace(
  `<button 
          type="button" 
          onClick={handleCancelEdit}
          className="btn-secondary-mobile"
          style={{ height: '38px', minHeight: '38px', fontSize: '12px', padding: '0 12px', flex: '0 0 auto', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Mis Predios
        </button>`,
  `<button 
          type="button" 
          onClick={handleCancelEdit}
          className="btn-secondary-mobile"
          style={{ height: '38px', minHeight: '38px', fontSize: '12px', padding: '0 12px', flex: '0 0 auto', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Mis Predios
        </button>

        <button 
          type="button" 
          onClick={() => {
            const currentObj = {
              codigo,
              propietario,
              cedula,
              telefono,
              norte,
              sur,
              este,
              oeste,
              observaciones,
              vertices,
              area: areaCalc,
              perimetro: perimCalc
            };
            setSelectedPredioForReport(currentObj);
            setShowReporteModal(true);
          }}
          className="btn-secondary-mobile"
          style={{ height: '38px', minHeight: '38px', fontSize: '12px', padding: '0 12px', color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff', gap: '6px' }}
        >
          <FileText size={15} /> 📄 Ver Reporte Oficial
        </button>`
);

// 8. In handleSaveOffline, use showToast instead of big Swal
content = content.replace(
  `      Swal.fire({
        icon: 'success',
        title: '¡Guardado en el Teléfono!',
        text: 'Predio guardado localmente con numeración P01 iniciada al Nor-Oeste.',
        timer: 1800,
        showConfirmButton: false,
        background: '#ffffff',
        color: '#0f172a'
      });
      setViewMode('list');`,
  `      if (showToast) {
        showToast({
          type: 'success',
          title: '✓ Guardado en el Teléfono',
          message: 'Predio guardado con numeración P01 al Nor-Oeste. (Desliza para cerrar)',
          duration: 3800
        });
      }
      setViewMode('list');`
);

// 9. Add modal render before closing form container
content = content.replace(
  `      </div>
    </div>
  );
}`,
  `      </div>

      {/* Modal de Reporte Planimétrico Oficial */}
      {showReporteModal && (
        <ReportePlanimetricoModal 
          predio={selectedPredioForReport} 
          onClose={() => {
            setShowReporteModal(false);
            setSelectedPredioForReport(null);
          }} 
        />
      )}
    </div>
  );
}`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('PredioFormMobile.jsx successfully updated with Reporte and vertex normalization!');
