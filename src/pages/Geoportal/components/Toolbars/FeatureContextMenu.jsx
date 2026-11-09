import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Target, TableProperties, Scissors, Edit, Palette, Eye, EyeOff, FileText, DownloadCloud, Sparkles, Trash2 } from 'lucide-react';

export const getFeatureDisplayName = (f, i = 0) => {
  if (!f) return `Elemento ${i + 1}`;
  const p = f.properties || {};

  // 1. Códigos y nombres oficiales del Cantón Urdaneta
  const codP = String(p.codigo_dpa || p.cod_parroq || p.codpar || p.dpa_parroq || '').trim();
  if (codP === '120650' || codP === '50' || codP.endsWith('50')) return 'Catarama (120650)';
  if (codP === '120651' || codP === '51' || codP.endsWith('51')) return 'Ricaurte (120651)';
  if (codP === '120652' || codP === '52' || codP.endsWith('52')) return 'Pijullo (120652)';
  if (codP === '1206' || String(p.dpa_canton) === '1206' || String(p.codigo_canton) === '1206') return 'Urdaneta (1206)';

  // 2. Nombres explícitos de Parroquia o Cantón
  if (p.nombre && p.codigo_dpa) return `${p.nombre} (${p.codigo_dpa})`;
  if (p.nombre && String(p.nombre).trim()) return String(p.nombre).trim();
  const fullNom = [p.nombres, p.apellidos].filter(Boolean).map(v => String(v).trim()).join(' ').trim();
  if (fullNom) return fullNom;
  if (p.nombre_posesionario) return p.nombre_posesionario;
  if (p.propietario) return p.propietario;
  if (p.parroquia && p.codigo_dpa) return `${p.parroquia} (${p.codigo_dpa})`;
  if (p.parroquia) return p.parroquia;
  if (p.canton && p.codigo_dpa) return `${p.canton} (${p.codigo_dpa})`;
  if (p.canton) return p.canton;
  if (p.dpa_despar) return p.dpa_despar;
  if (p.dpa_descan) return p.dpa_descan;
  if (p.name) return p.name;
  if (p.etiqueta) return p.etiqueta;
  if (p.cod_catastral) return p.cod_catastral;
  if (p.cod_cat) return p.cod_cat;
  if (p.codigo) return p.codigo;
  if (p.recinto) {
    const mzPred = [p.num_manz ? `Mz ${p.num_manz}` : '', p.num_predio ? `Lote ${p.num_predio}` : ''].filter(Boolean).join(' ');
    return mzPred ? `${p.recinto} (${mzPred})` : p.recinto;
  }

  return `Elemento ${i + 1}`;
};

export default function FeatureContextMenuComponent({ context, onClose, onAction, hiddenFeatureIds = [] }) {
  const menuRef = React.useRef(null);
  const [coords, setCoords] = React.useState({
    top: context?.mouseY || 0,
    left: context?.mouseX || 0
  });

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    if (menuRef.current) {
      menuRef.current.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // Auto-posicionar dentro de la ventana (evita salirse por la derecha o por abajo)
  React.useLayoutEffect(() => {
    if (!context) return;
    const pad = 12;
    const menuEl = menuRef.current;
    const w = menuEl ? menuEl.offsetWidth : 210;
    const h = menuEl ? menuEl.offsetHeight : 380;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let targetLeft = context.mouseX;
    let targetTop = context.mouseY;

    // Si se sale por la derecha (ej. abierto desde el sidebar), colocar hacia la izquierda
    if (targetLeft + w > winW - pad) {
      targetLeft = targetLeft - w;
      if (targetLeft < pad) {
        targetLeft = Math.max(pad, winW - w - pad);
      }
    }

    // Si se sale por abajo, colocar hacia arriba
    if (targetTop + h > winH - pad) {
      targetTop = targetTop - h;
      if (targetTop < pad) {
        targetTop = Math.max(pad, winH - h - pad);
      }
    }

    // Mínimos seguros
    targetLeft = Math.max(pad, targetLeft);
    targetTop = Math.max(pad, targetTop);

    setCoords({ top: targetTop, left: targetLeft });
  }, [context?.mouseX, context?.mouseY, context]);

  if (!context) return null;
  const isPredio = context.type !== 'generico';
  const p = context.feature?.properties || {};
  const featId = context.featureId ?? p.id ?? context.feature?.id ?? p.OBJECTID ?? p.objectid ?? p.ObjectId ?? p.gid ?? p.fid ?? p.FID ?? p.cod_catastral ?? p.COD_CATASTRAL ?? p.codigo_dpa;
  const isHidden = hiddenFeatureIds.includes(featId) || false;

  let title = 'Elemento';
  if (isPredio) {
    title = `Predio: ${p.cod_catastral || p.id || 'N/A'}`;
  } else if (p.tipo_limite?.includes('Cantonal') || context.layerType?.includes('cantonal')) {
    title = `Límite Cantonal: ${p.nombre || p.canton || 'Urdaneta'}`;
  } else if (p.tipo_limite?.includes('Parroquial') || context.layerType?.includes('parroquial')) {
    title = `Límite Parroquial: ${getFeatureDisplayName(context.feature, context.featureIndex || 0)}`;
  } else {
    title = `${context.layerName || 'Elemento'}: ${getFeatureDisplayName(context.feature, context.featureIndex || 0)}`;
  }

  return (
    <>
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, pointerEvents: 'auto' }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        ref={menuRef}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Esc') {
            e.stopPropagation();
            onClose();
          }
        }}
        style={{
          outline: 'none',
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          zIndex: 9999,
          background: 'var(--bg-panel)',
          border: '1px solid var(--card-border)',
          borderRadius: '8px',
          padding: '5px 0',
          minWidth: '200px',
          maxWidth: '280px',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto'
        }}
      >
        <div style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>
          {title}
        </div>

        {/* 1. Acercar */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('zoom', context.feature); onClose(); }}
          style={{ padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Target size={15} color="#fbbf24" /> Acercar
        </div>

        {/* 2. Tabla de atributos */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (isPredio) onAction('table', context.feature);
            else onAction('table_layer', context);
            onClose();
          }}
          style={{ padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <TableProperties size={15} color="#3b82f6" /> Tabla de atributos
        </div>

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }}></div>

        {/* 3. Fraccionar polígono / lote */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('split', context.feature); onClose(); }}
          style={{ padding: '8px 14px', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: '500' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Scissors size={15} color="#f59e0b" /> Fraccionar {isPredio ? 'lote' : 'polígono'}
        </div>

        {/* 4. Editar predio / polígono */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('edit', context.feature); onClose(); }}
          style={{ padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Edit size={15} color="#3b82f6" /> Editar {isPredio ? 'predio' : 'polígono'}
        </div>

        {/* 4.1. Personalizar color y estilo del polígono */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('custom_style', context); onClose(); }}
          style={{ padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Palette size={15} color="#06b6d4" /> Personalizar color y estilo
        </div>

        {/* 5. Ocultar / Mostrar polígono */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('hide', context.feature); onClose(); }}
          style={{ padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {isHidden ? <Eye size={15} color="#10b981" /> : <EyeOff size={15} color="#94a3b8" />}
          {isHidden ? (isPredio ? 'Mostrar predio' : 'Mostrar polígono') : (isPredio ? 'Ocultar predio' : 'Ocultar polígono')}
        </div>

        {/* 6. Imprimir planimetría */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('report_linderacion', context.feature); onClose(); }}
          style={{ padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <FileText size={15} color="#8b5cf6" /> Imprimir planimetría
        </div>

        {/* 7. Exportar Shapefile */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('export', context.feature); onClose(); }}
          style={{ padding: '8px 14px', color: 'var(--success)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <DownloadCloud size={15} color="var(--success)" /> Exportar shapefile
        </div>

        {/* 8. Incorporar a predio (si no es predio base) */}
        {!isPredio && (
          <div
            onClick={(e) => { e.stopPropagation(); onAction('atlas_single', context.feature); onClose(); }}
            style={{ padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Sparkles size={15} color="#0284c7" /> Incorporar a predio (Atlas)
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }}></div>

        {/* 9. Eliminar */}
        <div
          onClick={(e) => { e.stopPropagation(); onAction('delete', context.feature); onClose(); }}
          style={{ padding: '8px 14px', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 size={15} color="var(--danger)" /> Eliminar {isPredio ? 'predio' : 'elemento'}
        </div>
      </div>
    </>
  );
}
