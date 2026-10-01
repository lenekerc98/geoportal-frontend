const fs = require('fs');
const path = require('path');

const formPath = path.resolve(__dirname, '..', 'movil', 'src', 'pages', 'FormTab', 'PredioFormMobile.jsx');
let code = fs.readFileSync(formPath, 'utf8');

const regexToReplace = /\{\/\* 2\. PROPIETARIO \/ POSESIONARIO \*\/\}[\s\S]*?\{\/\* 4\. LINDEROS \*\/\}/;

const correctCards = `{\/* 2. PROPIETARIO / POSESIONARIO *\/}
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
              disabled={isReadOnly}
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
              disabled={isReadOnly}
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
            disabled={isReadOnly}
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

      {\/* 3. GEOMETRÍA GPS Y VÉRTICES *\/}
      <div className="form-card">
        <div className="form-card-title" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} /> Geometría UTM 17S
          </div>
          <div className="mono" style={{ fontSize: '11px', color: '#38bdf8' }}>
            {vertices.length} vértices
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              type="button" 
              className="btn-primary-mobile" 
              style={{ minHeight: '46px', fontSize: '13px', fontWeight: '800' }}
              onClick={handleAddGPSVertex}
              disabled={isReadOnly}
            >
              <Plus size={16} /> + Vértice GPS
            </button>

            <button 
              type="button" 
              className="btn-secondary-mobile" 
              style={{ minHeight: '46px', fontSize: '12px', fontWeight: '700', border: '1.5px dashed #38bdf8', color: '#38bdf8' }}
              onClick={handleAddManualVertex}
              disabled={isReadOnly}
            >
              <Edit2 size={14} /> + Coordenada (X, Y)
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#0f172a', padding: '10px', borderRadius: '10px', marginTop: '6px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Área Calculada</span>
            <div className="mono" style={{ fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}>
              {areaCalc.toLocaleString('es-EC', { maximumFractionDigits: 2 })} m²
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              ({(areaCalc / 10000).toFixed(4)} ha)
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Perímetro Total</span>
            <div className="mono" style={{ fontSize: '15px', fontWeight: 'bold', color: '#f59e0b' }}>
              {perimCalc.toFixed(2)} m
            </div>
          </div>
        </div>

        {vertices.length > 0 && (
          <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #1e293b', borderRadius: '8px', marginTop: '6px' }}>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
                  <th style={{ padding: '6px' }}>V#</th>
                  <th style={{ padding: '6px' }}>Este (X)</th>
                  <th style={{ padding: '6px' }}>Norte (Y)</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {vertices.map((v, i) => {
                  const vx = (v.x ?? (Array.isArray(v) ? v[0] : 0)).toFixed(2);
                  const vy = (v.y ?? (Array.isArray(v) ? v[1] : 0)).toFixed(2);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #1e293b' }}>
                      <td style={{ padding: '6px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>V{i + 1}</td>
                      <td className="mono" style={{ padding: '6px', cursor: 'pointer' }} onClick={() => !isReadOnly && handleEditVertex(i)} title="Toca para editar">
                        {vx}
                      </td>
                      <td className="mono" style={{ padding: '6px', cursor: 'pointer' }} onClick={() => !isReadOnly && handleEditVertex(i)} title="Toca para editar">
                        {vy}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button 
                          type="button" 
                          onClick={() => handleEditVertex(i)}
                          title="Editar Coordenadas"
                          style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', marginRight: '6px' }}
                          disabled={isReadOnly}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveVertex(i)}
                          title="Eliminar Vértice"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          disabled={isReadOnly}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {\/* 🧭 APARTADO DE COLINDANTES VINCULADOS A CADA COORDENADA / TRAMO *\/}
        {vertices.length >= 2 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Compass size={14} color="var(--accent-cyan)" /> Colindantes por Tramo de Vértices:
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{vertices.length} linderos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
              {vertices.map((v, i) => {
                const nextIdx = (i + 1) % vertices.length;
                const p1 = v;
                const p2 = vertices[nextIdx];
                const dir = getSegmentOrientation(p1, p2);
                const dist = getSegmentDistance(p1, p2);
                const dirColors = {
                  Norte: '#38bdf8',
                  Este: '#10b981',
                  Sur: '#f59e0b',
                  Oeste: '#ec4899'
                };

                return (
                  <div 
                    key={i} 
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#f8fafc' }}>
                        Tramo V{i + 1} ➔ V{nextIdx + 1} ({dist} m)
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: \`\${dirColors[dir]}22\`,
                        color: dirColors[dir],
                        border: \`1px solid \${dirColors[dir]}66\`
                      }}>
                        🧭 Hacia el {dir}
                      </span>
                    </div>

                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={\`Colindante del tramo V\${i + 1}-V\${nextIdx + 1} (ej: Juan Pérez / Calle pública)\`}
                      value={v.colindante || ''}
                      onChange={(e) => handleColindanteChange(i, e.target.value)}
                      disabled={isReadOnly}
                      style={{ height: '38px', fontSize: '12px' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {\/* 4. LINDEROS *\/}`;

if (regexToReplace.test(code)) {
  code = code.replace(regexToReplace, correctCards);
  fs.writeFileSync(formPath, code, 'utf8');
  console.log('Successfully repaired Card 2 and Card 3 in PredioFormMobile.jsx!');
} else {
  console.error('Regex did not match!');
}
