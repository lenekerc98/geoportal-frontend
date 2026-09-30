const fs = require('fs');
const path = require('path');

const movilDir = path.resolve(__dirname, '..', 'movil');

console.log('Applying compact coordinate modal and versioning updates to movil at:', movilDir);

// ==========================================
// 1. UPDATE movil/src/components/DrawingToolbarMobile.jsx
// ==========================================
const toolbarPath = path.join(movilDir, 'src', 'components', 'DrawingToolbarMobile.jsx');
let toolbarCode = fs.readFileSync(toolbarPath, 'utf8');

const oldModalRegex = /\/\/ 3\. MODAL DE COORDENADAS[\s\S]*?\/\/ 4\. MENÚ UNIFICADO/;

const newModalCode = `// 3. MODAL DE COORDENADAS Y COLINDANTES POR VÉRTICE (COMPACTO Y ULTRA ADAPTABLE)
  const handleOpenCoordinatesAndColindantesModal = async () => {
    const { value: formValues } = await Swal.fire({
      title: '📐 Coordenadas y Colindantes',
      width: '94%',
      customClass: {
        popup: 'swal-compact-modal'
      },
      html: \`
        <div style="display:flex; flex-direction:column; gap:8px; text-align:left; font-size:12px; width:100%; box-sizing:border-box;">
          <div style="background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); border-radius:10px; padding:8px 10px; color:#bae6fd; font-size:11px; line-height:1.4;">
            Ingresa las coordenadas UTM 17S (X, Y) y el colindante de cada lado del polígono.
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <span style="font-weight:700; color:#e2e8f0; font-size:12px;">📍 Vértices y Colindantes:</span>
            <button id="swal-add-v-btn" type="button" style="background:#0284c7; color:#fff; border:none; border-radius:6px; padding:4px 8px; font-size:11px; font-weight:700; cursor:pointer;">
              + Añadir Vértice
            </button>
          </div>

          <div id="swal-vertices-list" style="display:flex; flex-direction:column; gap:8px; max-height:260px; overflow-y:auto; padding-right:2px; margin-top:2px;">
            <!-- Tarjetas de vértices generadas dinámicamente -->
          </div>
        </div>
      \`,
      showCancelButton: true,
      confirmButtonText: 'Continuar a Ficha ➔',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#334155',
      background: '#131d33',
      color: '#fff',
      didOpen: () => {
        const listContainer = document.getElementById('swal-vertices-list');
        const addBtn = document.getElementById('swal-add-v-btn');

        const createCard = (idx, total) => {
          const nextIdx = (idx % total) + 1;
          const card = document.createElement('div');
          card.className = 'swal-v-card';
          card.style.cssText = 'background:#0f172a; border:1px solid #334155; border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:6px; width:100%; box-sizing:border-box;';
          card.innerHTML = \`
            <div style="display:flex; align-items:center; gap:6px; width:100%; box-sizing:border-box;">
              <span class="swal-v-lbl" style="font-size:11px; font-weight:800; color:#38bdf8; background:rgba(56,189,248,0.15); padding:3px 6px; border-radius:6px; flex-shrink:0;">V\${idx}</span>
              <input class="swal-v-x" type="number" step="0.01" placeholder="Este (X)" style="flex:1; min-width:0; height:32px; font-size:12px; background:#090d16; color:#fff !important; border:1px solid #334155; border-radius:6px; padding:0 6px; box-sizing:border-box;">
              <input class="swal-v-y" type="number" step="0.01" placeholder="Norte (Y)" style="flex:1; min-width:0; height:32px; font-size:12px; background:#090d16; color:#fff !important; border:1px solid #334155; border-radius:6px; padding:0 6px; box-sizing:border-box;">
              <button type="button" class="swal-v-del" style="width:28px; height:32px; background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.4); border-radius:6px; color:#f43f5e; font-size:12px; font-weight:bold; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>
            <div style="display:flex; align-items:center; gap:6px; width:100%; box-sizing:border-box;">
              <span class="swal-v-tramo-lbl" style="font-size:10px; color:#94a3b8; font-weight:600; white-space:nowrap; flex-shrink:0;">Lado V\${idx}➔V\${nextIdx}:</span>
              <input class="swal-v-colindante" type="text" placeholder="Colindante (ej: Calle A / Vecino)" style="flex:1; min-width:0; height:28px; font-size:11px; background:#090d16; color:#fff !important; border:1px solid #334155; border-radius:6px; padding:0 6px; box-sizing:border-box;">
            </div>
          \`;
          card.querySelector('.swal-v-del').onclick = () => {
            card.remove();
            renumber();
          };
          return card;
        };

        const renumber = () => {
          const cards = listContainer.querySelectorAll('.swal-v-card');
          const total = cards.length;
          cards.forEach((c, i) => {
            const idx = i + 1;
            const nextIdx = (idx % total) + 1;
            const lbl = c.querySelector('.swal-v-lbl');
            const tramoLbl = c.querySelector('.swal-v-tramo-lbl');
            if (lbl) lbl.textContent = \`V\${idx}\`;
            if (tramoLbl) tramoLbl.textContent = \`Lado V\${idx}➔V\${nextIdx}:\`;
          });
        };

        // Crear 4 vértices iniciales por defecto (cuadrilátero)
        for (let i = 1; i <= 4; i++) {
          listContainer.appendChild(createCard(i, 4));
        }

        if (addBtn) {
          addBtn.onclick = () => {
            const currentTotal = listContainer.querySelectorAll('.swal-v-card').length;
            listContainer.appendChild(createCard(currentTotal + 1, currentTotal + 1));
            renumber();
            listContainer.scrollTop = listContainer.scrollHeight;
          };
        }
      },
      preConfirm: () => {
        const listContainer = document.getElementById('swal-vertices-list');
        const cards = listContainer ? listContainer.querySelectorAll('.swal-v-card') : [];
        const parsedVertices = [];

        cards.forEach((c) => {
          const xInput = c.querySelector('.swal-v-x');
          const yInput = c.querySelector('.swal-v-y');
          const colInput = c.querySelector('.swal-v-colindante');

          const vx = parseFloat(xInput?.value);
          const vy = parseFloat(yInput?.value);
          const colText = colInput?.value?.trim() || '';

          if (!isNaN(vx) && !isNaN(vy)) {
            parsedVertices.push({
              x: vx,
              y: vy,
              orden: parsedVertices.length + 1,
              colindante: colText,
              accuracy: null
            });
          }
        });

        if (parsedVertices.length < 3) {
          Swal.showValidationMessage('Ingresa al menos 3 vértices con Este (X) y Norte (Y).');
          return false;
        }

        // Mapear los colindantes de los lados a los campos cardinales (Norte, Este, Sur, Oeste)
        const norte = parsedVertices[0]?.colindante || '';
        const este = parsedVertices[1]?.colindante || '';
        const sur = parsedVertices[2]?.colindante || '';
        const oeste = parsedVertices[3]?.colindante || (parsedVertices.length > 3 ? parsedVertices[parsedVertices.length - 1]?.colindante : '');

        return {
          vertices: parsedVertices,
          norte,
          este,
          sur,
          oeste
        };
      }
    });

    if (formValues) {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const autoCode = \`130101\${pad(d.getMonth() + 1)}\${pad(d.getDate())}\${pad(d.getHours())}\${pad(d.getMinutes())}\${pad(d.getSeconds())}\`;

      let area = 0;
      let perimetro = 0;
      if (formValues.vertices.length >= 3) {
        area = Math.round(computePolygonArea(formValues.vertices) * 100) / 100;
        perimetro = Math.round(computePerimeter(formValues.vertices) * 100) / 100;
      }

      setFormPreloadData({
        codigo: autoCode,
        norte: formValues.norte,
        sur: formValues.sur,
        este: formValues.este,
        oeste: formValues.oeste,
        vertices: formValues.vertices,
        area: area,
        perimetro: perimetro,
        tipo_levantamiento: 'MANUAL_COORDENADAS'
      });

      setActiveTab('form');

      if (formValues.vertices.length >= 3) {
        Swal.fire({
          icon: 'success',
          title: 'Polígono Ingresado',
          text: \`\${formValues.vertices.length} vértices (\${area} m²). Completa los datos en la ficha.\`,
          timer: 2000,
          showConfirmButton: false,
          background: '#131d33',
          color: '#fff'
        });
      }
    }
  };

  // 4. MENÚ UNIFICADO`;

if (oldModalRegex.test(toolbarCode)) {
  toolbarCode = toolbarCode.replace(oldModalRegex, newModalCode);
  fs.writeFileSync(toolbarPath, toolbarCode, 'utf8');
  console.log('1. Updated DrawingToolbarMobile.jsx with compact vertex+colindante cards');
} else {
  console.log('1. DrawingToolbarMobile.jsx regex did not match');
}

// ==========================================
// 2. UPDATE movil/src/index.css (POPUP COMPACT FIX)
// ==========================================
const indexCssPath = path.join(movilDir, 'src', 'index.css');
let indexCss = fs.readFileSync(indexCssPath, 'utf8');

const compactCss = `
.swal-compact-modal {
  max-width: 440px !important;
  width: 95% !important;
  padding: 14px 10px !important;
  box-sizing: border-box !important;
}
`;

if (!indexCss.includes('.swal-compact-modal')) {
  indexCss += '\n' + compactCss;
  fs.writeFileSync(indexCssPath, indexCss, 'utf8');
  console.log('2. Added .swal-compact-modal to index.css');
}

console.log('DONE!');
