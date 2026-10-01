const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/components/ReportePlanimetricoModal.jsx');

const code = `import React, { useMemo } from 'react';
import { X, Printer, FileText, CheckCircle2, Compass, MapPin, User, Calendar } from 'lucide-react';
import { 
  extractVerticesFromPredio, 
  calculateLinderosAndTramos, 
  computePolygonArea, 
  computePerimeter 
} from '../utils/geoUtils';

/**
 * Modal con el Formato Oficial del Reporte Planimétrico / Informe de Linderación
 * Idéntico al formato del Geoportal y Atlas Catastral GAD Urdaneta.
 */
export default function ReportePlanimetricoModal({ predio, onClose }) {
  if (!predio) return null;

  const vertices = useMemo(() => {
    return extractVerticesFromPredio(predio);
  }, [predio]);

  const tramos = useMemo(() => {
    return calculateLinderosAndTramos(vertices);
  }, [vertices]);

  const areaM2 = useMemo(() => {
    return Number(predio.area) || computePolygonArea(vertices);
  }, [predio.area, vertices]);

  const areaHa = (areaM2 / 10000).toFixed(4);

  const perimetroM = useMemo(() => {
    return Number(predio.perimetro) || computePerimeter(vertices);
  }, [predio.perimetro, vertices]);

  // Sintetizar linderos Norte, Sur, Este, Oeste
  const linderosResumen = useMemo(() => {
    const res = { Norte: [], Sur: [], Este: [], Oeste: [] };
    tramos.forEach(t => {
      const col = (t.colindante || '').trim();
      const txt = col ? \`\${col} (\${t.distancia}m)\` : \`Tramo \${t.tramo} (\${t.distancia}m)\`;
      if (res[t.orientacion]) {
        res[t.orientacion].push(txt);
      }
    });

    return {
      norte: predio.norte || (res.Norte.length ? res.Norte.join('; ') : 'No especificado'),
      sur: predio.sur || (res.Sur.length ? res.Sur.join('; ') : 'No especificado'),
      este: predio.este || (res.Este.length ? res.Este.join('; ') : 'No especificado'),
      oeste: predio.oeste || (res.Oeste.length ? res.Oeste.join('; ') : 'No especificado')
    };
  }, [tramos, predio]);

  // Generar SVG esquemático del polígono con vértices P01..Pn
  const svgData = useMemo(() => {
    if (!vertices || vertices.length < 3) return null;
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = (maxX - minX) || 1;
    const spanY = (maxY - minY) || 1;

    const width = 280;
    const height = 180;
    const pad = 28;

    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;

    const pts = vertices.map(v => {
      // Y invertido en SVG
      const px = offsetX + (v.x - minX) * scale;
      const py = height - (offsetY + (v.y - minY) * scale);
      return { ...v, px, py };
    });

    const polygonPointsStr = pts.map(p => \`\${p.px.toFixed(1)},\${p.py.toFixed(1)}\`).join(' ');

    return { width, height, pts, polygonPointsStr };
  }, [vertices]);

  const currentDate = new Date().toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '12px 8px',
        overflowY: 'auto'
      }}
    >
      {/* Botonera Superior de Control */}
      <div 
        style={{
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          color: '#ffffff'
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={16} color="#38bdf8" /> Ficha y Reporte Planimétrico
        </span>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrint}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={14} /> Imprimir / PDF
          </button>

          <button
            onClick={onClose}
            style={{
              background: '#334155',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Contenedor Hoja de Reporte (A4 Estilo Oficial) */}
      <div 
        className="reporte-oficial-hoja"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          border: '2px solid #0f172a',
          padding: '16px 14px',
          boxSizing: 'border-box',
          color: '#0f172a',
          fontSize: '11px',
          marginBottom: '20px'
        }}
      >
        {/* Cabecera Oficial GAD Urdaneta */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '10px', gap: '10px' }}>
          <img 
            src="/logo_gad.png" 
            alt="GAD Urdaneta" 
            style={{ width: '56px', height: 'auto', objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />

          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a' }}>
              GOBIERNO AUTÓNOMO DESCENTRALIZADO MUNICIPAL DE URDANETA
            </div>
            <div style={{ fontSize: '13px', fontWeight: '900', color: '#0369a1', marginTop: '2px', textTransform: 'uppercase' }}>
              LEVANTAMIENTO PLANIMÉTRICO / INFORME DE LINDERACIÓN
            </div>
            <div style={{ fontSize: '9px', fontWeight: '600', color: '#64748b' }}>
              SISTEMA CATASTRAL GEOESPACIAL MÓVIL (ZONA 17S - WGS 84)
            </div>
          </div>
        </div>

        {/* Bloque DPA y Fecha */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid #0f172a', margin: '10px 0 6px 0', textAlign: 'center', background: '#f8fafc' }}>
          <div style={{ borderRight: '1px solid #0f172a', padding: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>PROVINCIA:</div>
            <div style={{ fontSize: '10px', fontWeight: '800' }}>LOS RÍOS</div>
          </div>
          <div style={{ borderRight: '1px solid #0f172a', padding: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>CANTÓN:</div>
            <div style={{ fontSize: '10px', fontWeight: '800' }}>URDANETA</div>
          </div>
          <div style={{ borderRight: '1px solid #0f172a', padding: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>PARROQUIA:</div>
            <div style={{ fontSize: '10px', fontWeight: '800' }}>CATARAMA</div>
          </div>
          <div style={{ padding: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>FECHA:</div>
            <div style={{ fontSize: '10px', fontWeight: '800' }}>{currentDate}</div>
          </div>
        </div>

        {/* Datos del Posesionario y Predio */}
        <div style={{ border: '1px solid #0f172a', marginBottom: '8px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #0f172a' }}>
            <div style={{ flex: 1.6, padding: '5px 8px', borderRight: '1px solid #0f172a' }}>
              <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>POSESIONARIO / PROPIETARIO:</div>
              <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                {predio.propietario || predio.posesionario || 'SIN POSESIONARIO'}
              </div>
            </div>
            <div style={{ flex: 1, padding: '5px 8px' }}>
              <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>C.C. / IDENTIFICACIÓN:</div>
              <div className="mono" style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7' }}>
                {predio.cedula || 'S/D'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', background: '#f8fafc' }}>
            <div style={{ padding: '5px 8px', borderRight: '1px solid #0f172a' }}>
              <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>CLAVE CATASTRAL:</div>
              <div className="mono" style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a' }}>
                {predio.codigo || predio.clave_catastral || 'S/D'}
              </div>
            </div>
            <div style={{ padding: '5px 8px', borderRight: '1px solid #0f172a' }}>
              <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>ÁREA:</div>
              <div className="mono" style={{ fontSize: '11px', fontWeight: '800', color: '#10b981' }}>
                {areaHa} Ha ({areaM2.toFixed(1)} m²)
              </div>
            </div>
            <div style={{ padding: '5px 8px' }}>
              <div style={{ fontSize: '8px', fontWeight: '800', color: '#475569' }}>PERÍMETRO:</div>
              <div className="mono" style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b' }}>
                {perimetroM.toFixed(2)} m
              </div>
            </div>
          </div>
        </div>

        {/* Diagrama Esquemático SVG del Predio con Vértices */}
        {svgData && (
          <div style={{ border: '1px solid #0f172a', padding: '8px', marginBottom: '8px', textAlign: 'center', background: '#f8fafc', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '0 4px' }}>
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: '#475569' }}>
                Esquema Geométrico Planimétrico
              </span>
              <span style={{ fontSize: '9px', fontWeight: '800', color: '#0284c7' }}>
                ⬆ NORTE
              </span>
            </div>

            <svg 
              viewBox={\`0 0 \${svgData.width} \${svgData.height}\`} 
              style={{ width: '100%', maxHeight: '160px', background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '4px' }}
            >
              {/* Cuadrícula sutil */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Polígono */}
              <polygon
                points={svgData.polygonPointsStr}
                fill="rgba(56, 189, 248, 0.15)"
                stroke="#0284c7"
                strokeWidth="2"
              />

              {/* Distancias en cada lado */}
              {svgData.pts.map((p, i) => {
                const next = svgData.pts[(i + 1) % svgData.pts.length];
                const mx = (p.px + next.px) / 2;
                const my = (p.py + next.py) / 2;
                const dist = tramos[i]?.distancia || '';
                return (
                  <text
                    key={\`dist-\${i}\`}
                    x={mx}
                    y={my - 3}
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="bold"
                    fill="#334155"
                  >
                    {dist ? \`\${dist}m\` : ''}
                  </text>
                );
              })}

              {/* Vértices P01, P02... */}
              {svgData.pts.map((p, i) => (
                <g key={\`v-\${i}\`}>
                  <circle cx={p.px} cy={p.py} r={i === 0 ? "5" : "4"} fill={i === 0 ? "#10b981" : "#0284c7"} stroke="#ffffff" strokeWidth="1.2" />
                  <text
                    x={p.px + 6}
                    y={p.py - 4}
                    fontSize="8.5"
                    fontWeight="bold"
                    fill={i === 0 ? "#047857" : "#0f172a"}
                  >
                    {p.codigo || \`P\${String(i + 1).padStart(2, '0')}\`}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* CUADRO TÉCNICO DE COORDENADAS PLANAS Y LINDEROS (El Cuadro Oficial Solicitado) */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ background: '#0f172a', color: '#ffffff', textAlign: 'center', fontWeight: '900', fontSize: '9px', padding: '4px', letterSpacing: '0.5px' }}>
            CUADRO DE COORDENADAS PLANAS UTM WGS-84 (ZONA 17S) Y LINDEROS
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '9px', border: '1px solid #0f172a' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', fontWeight: '800' }}>
                <th style={{ border: '1px solid #0f172a', padding: '3px 2px', width: '32px' }}>PTO</th>
                <th style={{ border: '1px solid #0f172a', padding: '3px 2px', width: '70px' }}>ESTE (X)</th>
                <th style={{ border: '1px solid #0f172a', padding: '3px 2px', width: '75px' }}>NORTE (Y)</th>
                <th style={{ border: '1px solid #0f172a', padding: '3px 2px', width: '55px' }}>TRAMO</th>
                <th style={{ border: '1px solid #0f172a', padding: '3px 2px', width: '45px' }}>DIST. (m)</th>
                <th style={{ border: '1px solid #0f172a', padding: '3px 2px', width: '48px' }}>ORIENT.</th>
                <th style={{ border: '1px solid #0f172a', padding: '3px 4px', textAlign: 'left' }}>COLINDANTE</th>
              </tr>
            </thead>
            <tbody>
              {vertices.length > 0 ? (
                vertices.map((v, i) => {
                  const t = tramos[i] || {};
                  const isNW = i === 0;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ border: '1px solid #0f172a', fontWeight: '800', color: isNW ? '#047857' : '#0f172a' }}>
                        {v.codigo || \`P\${String(i + 1).padStart(2, '0')}\`}
                      </td>
                      <td className="mono" style={{ border: '1px solid #0f172a' }}>
                        {typeof v.x === 'number' ? v.x.toFixed(2) : '-'}
                      </td>
                      <td className="mono" style={{ border: '1px solid #0f172a' }}>
                        {typeof v.y === 'number' ? v.y.toFixed(2) : '-'}
                      </td>
                      <td style={{ border: '1px solid #0f172a', fontWeight: '700', fontSize: '8.5px' }}>
                        {t.tramo || '-'}
                      </td>
                      <td className="mono" style={{ border: '1px solid #0f172a' }}>
                        {t.distancia ? \`\${t.distancia}m\` : '-'}
                      </td>
                      <td style={{ border: '1px solid #0f172a', fontSize: '8px', fontWeight: '700' }}>
                        {t.orientacion || '-'}
                      </td>
                      <td style={{ border: '1px solid #0f172a', textAlign: 'left', padding: '2px 4px', fontSize: '8.5px' }}>
                        {t.colindante || v.colindante || 'Terreno Particular'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ padding: '8px', color: '#94a3b8' }}>
                    Sin coordenadas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Resumen de Linderación Oficial */}
        <div style={{ border: '1px solid #0f172a', marginBottom: '8px', padding: '6px 8px', background: '#f8fafc', fontSize: '9px', lineHeight: '1.4' }}>
          <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '3px' }}>
            DESCRIPCIÓN DE LINDEROS:
          </div>
          <div><b>POR EL NORTE:</b> {linderosResumen.norte}</div>
          <div><b>POR EL SUR:</b> {linderosResumen.sur}</div>
          <div><b>POR EL ESTE:</b> {linderosResumen.este}</div>
          <div><b>POR EL OESTE:</b> {linderosResumen.oeste}</div>
        </div>

        {/* Firmas Oficiales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #0f172a', marginTop: '12px', minHeight: '65px', textAlign: 'center' }}>
          <div style={{ borderRight: '1px solid #0f172a', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '8px', fontWeight: '800' }}>LEVANTADO EN CAMPO POR:</div>
            <div>
              <div style={{ borderTop: '1px solid #0f172a', width: '80%', margin: '0 auto 2px auto' }}></div>
              <div style={{ fontSize: '8px', fontWeight: '800' }}>RESPONSABLE TÉCNICO</div>
            </div>
          </div>

          <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '8px', fontWeight: '800' }}>REVISADO Y APROBADO:</div>
            <div>
              <div style={{ borderTop: '1px solid #0f172a', width: '80%', margin: '0 auto 2px auto' }}></div>
              <div style={{ fontSize: '8px', fontWeight: '800' }}>GAD MUNICIPAL URDANETA</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully wrote', targetPath);
