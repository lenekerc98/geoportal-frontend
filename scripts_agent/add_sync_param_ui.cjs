const fs = require('fs');
const path = require('path');

const sysParamsPath = path.join(__dirname, '..', 'src', 'pages', 'System', 'SystemParams.jsx');
let content = fs.readFileSync(sysParamsPath, 'utf8');

const marker = '</select>\r\n                <small style={{ display: \'block\', marginTop: \'5px\', color: \'var(--text-muted)\' }}>\r\n                  Si seleccionas "Manual", aparecerá un campo de fecha opcional al subir un Shapefile.\r\n                </small>\r\n              </div>';
const markerLF = '</select>\n                <small style={{ display: \'block\', marginTop: \'5px\', color: \'var(--text-muted)\' }}>\n                  Si seleccionas "Manual", aparecerá un campo de fecha opcional al subir un Shapefile.\n                </small>\n              </div>';

const blockToInsert = `

              {/* Parámetro Oficial: Modo de Carga / Subida del Aplicativo Móvil */}
              <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--bg-lighter)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--primary)' }}>
                  <Smartphone size={18} /> Modo de Carga / Subida del Aplicativo Móvil
                </label>
                <select 
                  value={empresaConfig.modo_subida_movil}
                  onChange={(e) => setEmpresaConfig({...empresaConfig, modo_subida_movil: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)', fontWeight: '600' }}
                >
                  <option value="manual">Modo Manual / Diferido (Offline en Teléfono ➔ Subida por Lotes)</option>
                  <option value="automatica">Modo Automático / En Línea (Sube directamente al servidor al guardar)</option>
                </select>
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {empresaConfig.modo_subida_movil === 'manual' ? (
                    <span>
                      📦 <b>Modo Recomendado para Campo:</b> Los predios levantados se guardan primero en la memoria interna del teléfono (sin necesidad de cobertura o internet). Al regresar a la oficina con Wi-Fi, el brigadista abre la pestaña <b>Sincronización</b> y pulsa <b>"Sincronizar Todo Ahora"</b>.
                    </span>
                  ) : (
                    <span>
                      ⚡ <b>Modo Directo en Tiempo Real:</b> Cada vez que el brigadista presiona <b>"Guardar"</b> en la ficha del predio en el teléfono, el aplicativo realiza la subida inmediata por internet a la base de datos central de esta empresa.
                    </span>
                  )}
                </div>
              </div>`;

if (content.includes(marker)) {
  content = content.replace(marker, marker + blockToInsert);
  fs.writeFileSync(sysParamsPath, content, 'utf8');
  console.log('✓ Successfully added modo_subida_movil UI to SystemParams.jsx (CRLF)');
} else if (content.includes(markerLF)) {
  content = content.replace(markerLF, markerLF + blockToInsert);
  fs.writeFileSync(sysParamsPath, content, 'utf8');
  console.log('✓ Successfully added modo_subida_movil UI to SystemParams.jsx (LF)');
} else {
  console.error('Marker not found in SystemParams.jsx');
}

// ALSO: Check movil SettingsMobile.jsx to add the surveyor syncMode selector
const movilSettingsPath = path.join(__dirname, '..', '..', 'movil', 'src', 'pages', 'SettingsTab', 'SettingsMobile.jsx');
if (fs.existsSync(movilSettingsPath)) {
  let movilContent = fs.readFileSync(movilSettingsPath, 'utf8');
  if (!movilContent.includes('Modo de Carga de Predios (Sincronización)')) {
    const insertAfter = '<div className="form-card-title">\r\n          <Server size={16} /> Servidor Backend\r\n        </div>';
    const insertAfterLF = '<div className="form-card-title">\n          <Server size={16} /> Servidor Backend\n        </div>';
    
    const syncCard = `
      {/* MODO DE SUBIDA DE PREDIOS */}
      <div className="form-card" style={{ border: '1.5px solid #0284c7' }}>
        <div className="form-card-title" style={{ color: '#0284c7' }}>
          <Smartphone size={16} /> Modo de Carga de Predios (Sincronización)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select
            className="form-input"
            value={syncMode}
            onChange={(e) => switchSyncMode(e.target.value)}
            style={{ fontWeight: '700', fontSize: '13px', height: '42px' }}
          >
            <option value="manual">📦 Manual / Offline (Guarda en teléfono, sube en Sincronización)</option>
            <option value="automatica">⚡ Automática / En Línea (Sube directo a la base de datos al guardar)</option>
          </select>
          <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
            {syncMode === 'manual' 
              ? 'Ideal para campo sin cobertura. Los predios se guardan offline en el teléfono y los subes al tener Wi-Fi.'
              : 'Los predios se envían inmediatamente al servidor de Catastro al momento de presionar Guardar.'}
          </div>
        </div>
      </div>
`;
    if (movilContent.includes(insertAfter)) {
      movilContent = movilContent.replace(insertAfter, syncCard + insertAfter);
      fs.writeFileSync(movilSettingsPath, movilContent, 'utf8');
      console.log('✓ Added syncMode selector to movil SettingsMobile.jsx (CRLF)');
    } else if (movilContent.includes(insertAfterLF)) {
      movilContent = movilContent.replace(insertAfterLF, syncCard + insertAfterLF);
      fs.writeFileSync(movilSettingsPath, movilContent, 'utf8');
      console.log('✓ Added syncMode selector to movil SettingsMobile.jsx (LF)');
    }
  }
}
