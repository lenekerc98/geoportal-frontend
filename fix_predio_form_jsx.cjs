const fs = require('fs');
const path = require('path');

const formPath = path.resolve(__dirname, '..', 'movil', 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
let code = fs.readFileSync(formPath, 'utf8');

const regexToReplace = /\{\/\* 2\. PROPIETARIO \/ POSESIONARIO \*\/\}[\s\S]*?\{\/\* 3\. GEOMETRÍA GPS Y VÉRTICES \*\/\}/;

const cleanSection = `{\/* 2. PROPIETARIO / POSESIONARIO *\/}
      <div className="form-card">
        <div className="form-card-title">
          <User size={16} /> Propietario / Posesionario
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Cédula / RUC</label>
              {searchingCedula && (
                <span style={{ fontSize: '10px', color: '#38bdf8' }}>Buscando...</span>
              )}
            </div>
            <input 
              type="text" 
              className="form-input mono" 
              placeholder="1312345678"
              dir="ltr"
              autoComplete="off"
              value={cedula}
              onChange={(e) => handleCedulaChange(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Teléfono Móvil</label>
            <input 
              type="tel" 
              className="form-input mono" 
              placeholder="0991234567"
              dir="ltr"
              autoComplete="off"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
        </div>

        {posesionarioFound && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            margin: '4px 0 8px 0'
          }}>
            <span>✅ Posesionario cargado automáticamente: <b>{posesionarioFound.nombre}</b></span>
          </div>
        )}

        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label">Nombres y Apellidos</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Ej: Juan Pérez Zambrano"
            dir="ltr"
            autoComplete="off"
            value={propietario}
            onChange={(e) => handleNombreChange(e.target.value)}
          />
          {nameSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              zIndex: 100,
              maxHeight: '160px',
              overflowY: 'auto',
              boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
              marginTop: '4px'
            }}>
              {nameSuggestions.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleSelectSuggestion(item)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #1e293b',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>{item.nombre}</div>
                  <div style={{ color: '#38bdf8', fontSize: '11px' }}>Cédula: {item.cedula || 'N/D'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {\/* 3. GEOMETRÍA GPS Y VÉRTICES *\/}`;

if (regexToReplace.test(code)) {
  code = code.replace(regexToReplace, cleanSection);
  fs.writeFileSync(formPath, code, 'utf8');
  console.log('Successfully fixed clean section in PredioFormMobile.jsx!');
} else {
  console.error('Regex did not match!');
}
