import re

filepath = "C:/LNCZ/proyecto-catastro-2026/frontend/src/components/MapViewer/PredioForm.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Import Draggable
if "import Draggable" not in content:
    content = content.replace("import React, { useState", "import React, { useState, useEffect, useRef, useContext } from 'react';\nimport Draggable from 'react-draggable';\n//")
    content = content.replace("import React, { useState, useEffect, useRef, useContext } from 'react';\n//, useEffect, useRef, useContext } from 'react';", "") # cleanup

# 2. Add state and fetch for proyectosList
proyectos_state = """  const [empresasList, setEmpresasList] = useState([]);
  const [proyectosList, setProyectosList] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(initialData?.empresa_id || activeEmpresa?.id || '');
  const [selectedProyectoId, setSelectedProyectoId] = useState(initialData?.proyecto_id || activeProyecto?.id || '');

  useEffect(() => {
    if (!activeEmpresa && !initialData) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/empresas`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setEmpresasList(data))
        .catch(console.error);
    }
  }, [activeEmpresa, initialData]);

  useEffect(() => {
    if (!activeProyecto && !initialData && selectedEmpresaId) {
      const token = localStorage.getItem('catastro_token');
      fetch(`${API_URL}/api/proyectos`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setProyectosList(data.filter(p => p.empresa_id == selectedEmpresaId)))
        .catch(console.error);
    }
  }, [activeProyecto, initialData, selectedEmpresaId]);"""

content = re.sub(
    r"  const \[empresasList.*?\];\n\n",
    proyectos_state + "\n\n",
    content,
    flags=re.DOTALL
)

# 3. Update payload
payload_old = "proyecto_id: activeProyecto ? activeProyecto.id : null,"
payload_new = "proyecto_id: activeProyecto ? activeProyecto.id : (selectedProyectoId ? parseInt(selectedProyectoId, 10) : null),"
content = content.replace(payload_old, payload_new)

# 4. Wrap with Draggable and add dropdowns
render_old = """    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    }}>
      <div className="glass-panel" style={{ padding: '30px', maxWidth: '600px', width: '90%', margin: '0 auto', border: '1px solid var(--card-border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>"""

render_new = """    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    }}>
      <Draggable handle=".drag-handle">
      <div className="glass-panel" style={{ padding: '30px', maxWidth: '600px', width: '90%', margin: '0 auto', border: '1px solid var(--card-border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="drag-handle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px', cursor: 'move' }}>"""

content = content.replace(render_old, render_new)

form_start_old = """        </div>

        <form onSubmit={handleSubmit}>"""

form_start_new = """        </div>

        {(!activeEmpresa || !activeProyecto) && !initialData && (
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
            {!activeEmpresa && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Empresa *</label>
                <select className="input-dynamic" value={selectedEmpresaId} onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedProyectoId(''); }} required>
                  <option value="">Seleccione Empresa...</option>
                  {empresasList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            )}
            {!activeProyecto && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Proyecto *</label>
                <select className="input-dynamic" value={selectedProyectoId} onChange={e => setSelectedProyectoId(e.target.value)} required disabled={!selectedEmpresaId}>
                  <option value="">Seleccione Proyecto...</option>
                  {proyectosList.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>"""

content = content.replace(form_start_old, form_start_new)

content = content.replace("</form>\n      </div>\n    </div>", "</form>\n      </div>\n      </Draggable>\n    </div>")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("PredioForm patched successfully.")
