const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/components/PredioBottomSheet.jsx');

const code = `import React, { useState } from 'react';
import { useMobile } from '../context/MobileContext';
import { deleteOfflinePredio } from '../services/mobileDB';
import { extractVerticesFromPredio } from '../utils/geoUtils';
import ReportePlanimetricoModal from './ReportePlanimetricoModal';
import { MapPin, User, FileText, Trash2, Edit3, X, Cloud, CloudOff, Eye, ShieldAlert } from 'lucide-react';
import Swal from 'sweetalert2';

export default function PredioBottomSheet({ predio, onClose, onRefreshMap }) {
  const { auth, permissions, setFormPreloadData, setActiveTab, refreshOfflineCount } = useMobile();
  const [showReporte, setShowReporte] = useState(false);

  if (!predio) return null;

  const isOfflineItem = !!predio.offline_id;
  const isBrigadista = permissions?.isBrigadista ?? (auth?.isBrigadista || auth?.role === 'brigadista');
  // Brigadistas NO pueden editar ni borrar predios oficiales del servidor
  const canEdit = isOfflineItem || !isBrigadista;
  const canDelete = isOfflineItem && (!isBrigadista || isOfflineItem);

  const handleEdit = () => {
    const verts = (Array.isArray(predio.vertices) && predio.vertices.length >= 3)
      ? predio.vertices
      : extractVerticesFromPredio(predio);

    setFormPreloadData({ ...predio, vertices: verts });
    onClose();
    setActiveTab('form');
  };

  const handleViewReadOnly = () => {
    const verts = (Array.isArray(predio.vertices) && predio.vertices.length >= 3)
      ? predio.vertices
      : extractVerticesFromPredio(predio);

    setFormPreloadData({ ...predio, vertices: verts, isReadOnly: true });
    onClose();
    setActiveTab('form');
  };

  const handleDelete = async () => {
    if (!isOfflineItem) return;

    const result = await Swal.fire({
      title: '¿Eliminar predio local?',
      text: 'Este predio guardado en el teléfono será eliminado permanentemente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#334155',
      background: '#ffffff', 
      color: '#0f172a'
    });

    if (result.isConfirmed) {
      await deleteOfflinePredio(predio.offline_id);
      await refreshOfflineCount();
      if (onRefreshMap) onRefreshMap();
      onClose();
    }
  };

  const areaM2 = Number(predio.area) || 0;
  const areaHa = (areaM2 / 10000).toFixed(4);

  return (
    <>
      <div className="bottom-sheet-backdrop" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isOfflineItem ? (
                <span className="pill-badge offline" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  <CloudOff size={10} /> Local Móvil
                </span>
              ) : (
                <span className="pill-badge online" style={{ fontSize: '10px', padding: '2px 6px' }}>
                  <Cloud size={10} /> Servidor
                </span>
              )}
              <span className="mono" style={{ fontSize: '11px', color: '#64748b' }}>
                {predio.offline_id || \`ID: \${predio.id}\`}
              </span>
              {(predio.creado_por_nombre || predio.creado_por || predio.usuario) && (
                <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                  👤 Creado por: {predio.creado_por_nombre || predio.creado_por || predio.usuario}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
              {predio.codigo || predio.clave_catastral || 'Sin Clave Asignada'}
            </h2>
          </div>

          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumen de Información */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '8px 0' }}>
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Propietario / Posesionario</span>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>
              {predio.propietario || predio.posesionario || 'N/D'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Cédula / Identidad</span>
            <div className="mono" style={{ fontSize: '13px', fontWeight: 'bold', color: '#0284c7', marginTop: '2px' }}>
              {predio.cedula || 'N/D'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Área Calculada</span>
            <div className="mono" style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981', marginTop: '2px' }}>
              {areaM2.toLocaleString('es-EC', { maximumFractionDigits: 2 })} m²
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>({areaHa} ha)</span>
          </div>

          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Perímetro</span>
            <div className="mono" style={{ fontSize: '13px', fontWeight: 'bold', color: '#f59e0b', marginTop: '2px' }}>
              {(Number(predio.perimetro) || 0).toFixed(2)} m
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              {Array.isArray(predio.vertices) ? \`\${predio.vertices.length} puntos\` : ''}
            </span>
          </div>
        </div>

        {/* Linderos si existen */}
        {(predio.norte || predio.sur || predio.este || predio.oeste) && (
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
            <b style={{ color: '#0f172a' }}>Linderos Oficiales:</b>
            <div style={{ color: '#64748b', marginTop: '4px', lineHeight: '1.4' }}>
              {predio.norte && <div><b>Norte:</b> {predio.norte}</div>}
              {predio.sur && <div><b>Sur:</b> {predio.sur}</div>}
              {predio.este && <div><b>Este:</b> {predio.este}</div>}
              {predio.oeste && <div><b>Oeste:</b> {predio.oeste}</div>}
            </div>
          </div>
        )}

        {/* Botón Ver Reporte Planimétrico Oficial */}
        <button
          onClick={() => setShowReporte(true)}
          style={{
            width: '100%',
            height: '42px',
            marginTop: '8px',
            background: '#f0f9ff',
            border: '1.5px solid #0284c7',
            borderRadius: '10px',
            color: '#0284c7',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} /> 📄 Ver Reporte Planimétrico Oficial
        </button>

        {/* Acciones con control de roles */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {canEdit ? (
            <button className="btn-primary-mobile" onClick={handleEdit} style={{ height: '48px', fontSize: '14px', fontWeight: '800' }}>
              <Edit3 size={16} /> Editar / Abrir
            </button>
          ) : (
            <button 
              className="btn-secondary-mobile" 
              onClick={handleViewReadOnly} 
              style={{ 
                height: '48px', 
                fontSize: '14px', 
                fontWeight: '800',
                background: 'rgba(2, 132, 199, 0.2)', 
                border: '1.5px solid #0284c7', 
                color: '#0284c7' 
              }}
            >
              <Eye size={17} /> Ver Ficha (Solo Lectura)
            </button>
          )}

          {canDelete && (
            <button 
              className="map-fab" 
              style={{ width: '48px', height: '48px', background: '#dc2626', border: 'none' }}
              onClick={handleDelete}
              title="Eliminar de almacenamiento local"
            >
              <Trash2 size={18} color="#fff" />
            </button>
          )}
        </div>

        {!canEdit && (
          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', justifyContent: 'center' }}>
            <ShieldAlert size={12} color="#f59e0b" />
            <span>Como brigadista puedes ver este predio pero no modificarlo.</span>
          </div>
        )}
      </div>

      {/* Modal de Reporte Planimétrico Oficial */}
      {showReporte && (
        <ReportePlanimetricoModal 
          predio={predio} 
          onClose={() => setShowReporte(false)} 
        />
      )}
    </>
  );
}
`;

fs.writeFileSync(targetPath, code, 'utf8');
console.log('PredioBottomSheet.jsx updated with ReportePlanimetricoModal!');
