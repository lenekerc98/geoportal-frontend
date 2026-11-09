import React, { useState, useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';
import { MapPin, Plus, Ruler, Target } from 'lucide-react';
import { showSuccess, showError } from '../../../../utils/swal';

export function MapContextMenu({ onAction, isFeatureMenuOpen }) {
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('closeMapContextMenu', handleClose);
    return () => window.removeEventListener('closeMapContextMenu', handleClose);
  }, []);

  useEffect(() => {
    if (isFeatureMenuOpen && contextMenu) {
      setContextMenu(null);
    }
  }, [isFeatureMenuOpen, contextMenu]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    if (contextMenu) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  useMapEvents({
    contextmenu(e) {
      // Si el clic fue en un predio o capa, o si ya hay un menú de predio, NO abrir menú general
      if (
        e.originalEvent?._featureHandled ||
        isFeatureMenuOpen ||
        (window._lastFeatureContextTime && Date.now() - window._lastFeatureContextTime < 500)
      ) {
        return;
      }
      setContextMenu({
        mouseX: e.originalEvent.clientX,
        mouseY: e.originalEvent.clientY,
        latlng: e.latlng
      });
    },
    click() {
      if (contextMenu) setContextMenu(null);
    },
    dragstart() {
      if (contextMenu) setContextMenu(null);
    }
  });

  if (!contextMenu) return null;

  return (
    <div style={{
      position: 'fixed',
      top: contextMenu.mouseY,
      left: contextMenu.mouseX,
      zIndex: 9999,
      background: 'var(--bg-panel, #ffffff)',
      border: '1.5px solid var(--card-border, #cbd5e1)',
      borderRadius: '10px',
      padding: '6px',
      minWidth: '220px',
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.2)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px'
    }}>
      <div
        onClick={(e) => { e.stopPropagation(); onAction('generate_predio_at_point', contextMenu.latlng); setContextMenu(null); }}
        style={{
          padding: '9px 12px',
          color: 'var(--text-main, #0f172a)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.88rem',
          fontWeight: 600,
          borderRadius: '7px',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg, #f1f5f9)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        title="Crear un polígono base de 20x20m en estas coordenadas exactas"
      >
        <MapPin size={17} color="#10b981" /> Generar Predio en este punto
      </div>
      <div
        onClick={(e) => { e.stopPropagation(); onAction('add_predio', contextMenu.latlng); setContextMenu(null); }}
        style={{
          padding: '9px 12px',
          color: 'var(--text-main, #0f172a)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.88rem',
          fontWeight: 600,
          borderRadius: '7px',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg, #f1f5f9)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Plus size={17} color="#059669" /> Agregar Predio Manual
      </div>
      <div
        onClick={(e) => { e.stopPropagation(); onAction('measure', contextMenu.latlng); setContextMenu(null); }}
        style={{
          padding: '9px 12px',
          color: 'var(--text-main, #0f172a)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.88rem',
          fontWeight: 600,
          borderRadius: '7px',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg, #f1f5f9)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Ruler size={17} color="#2563eb" /> Medir Distancia
      </div>
      <div style={{ borderTop: '1px solid var(--card-border, #e2e8f0)', margin: '3px 0' }}></div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(`${contextMenu.latlng.lat.toFixed(6)}, ${contextMenu.latlng.lng.toFixed(6)}`)
            .then(() => showSuccess('Coordenadas copiadas'))
            .catch(() => showError('No se pudieron copiar las coordenadas'));
          setContextMenu(null);
        }}
        style={{
          padding: '9px 12px',
          color: 'var(--text-main, #0f172a)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.88rem',
          fontWeight: 600,
          borderRadius: '7px',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg, #f1f5f9)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Target size={17} color="#d97706" /> Copiar Coordenadas
      </div>
    </div>
  );
}

export function MapInteractionHandler({ onInteraction }) {
  useMapEvents({
    click: onInteraction,
    dragstart: onInteraction,
    contextmenu: (e) => {
      if (!e.originalEvent?._featureHandled) {
        onInteraction();
      }
    },
  });
  return null;
}

