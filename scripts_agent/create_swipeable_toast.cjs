const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../movil/src/components/SwipeableToast.jsx');

const code = `import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Toast flotante compacto y ligero con soporte de deslizamiento táctil (Swipe-to-Dismiss):
 * Permite eliminar desplazando con el dedo hacia ARRIBA, IZQUIERDA o DERECHA.
 */
export default function SwipeableToast({ toast, onDismiss }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const autoDismissTimerRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    setIsDismissing(false);
    setOffset({ x: 0, y: 0 });

    const duration = toast.duration || 3800;
    autoDismissTimerRef.current = setTimeout(() => {
      triggerDismiss('up');
    }, duration);

    return () => {
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, [toast]);

  if (!toast) return null;

  const handleTouchStart = (e) => {
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Permitir deslizar hacia ARRIBA (dy < 0), IZQUIERDA (dx < 0) o DERECHA (dx > 0)
    // Limitar desplazamiento hacia abajo para no desconfigurar la vista
    setOffset({
      x: dx,
      y: Math.min(10, dy)
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const { x, y } = offset;
    const thresholdX = 55;
    const thresholdY = -35;

    if (x > thresholdX) {
      triggerDismiss('right');
    } else if (x < -thresholdX) {
      triggerDismiss('left');
    } else if (y < thresholdY) {
      triggerDismiss('up');
    } else {
      // Regresar al centro con animación suave
      setOffset({ x: 0, y: 0 });
    }
  };

  const triggerDismiss = (direction = 'up') => {
    setIsDismissing(true);
    if (direction === 'right') {
      setOffset(prev => ({ ...prev, x: 380 }));
    } else if (direction === 'left') {
      setOffset(prev => ({ ...prev, x: -380 }));
    } else {
      setOffset(prev => ({ ...prev, y: -120 }));
    }

    setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 240);
  };

  const progress = Math.min(1, (Math.abs(offset.x) + Math.max(0, -offset.y)) / 120);
  const opacity = Math.max(0, 1 - progress);

  const getIcon = () => {
    if (toast.type === 'error' || toast.type === 'warning') {
      return <AlertTriangle size={18} color="#f59e0b" />;
    }
    if (toast.type === 'info') {
      return <Info size={18} color="#0284c7" />;
    }
    return <CheckCircle2 size={18} color="#10b981" />;
  };

  const getBadgeBg = () => {
    if (toast.type === 'error' || toast.type === 'warning') return '#fef3c7';
    if (toast.type === 'info') return '#e0f2fe';
    return '#d1fae5';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        left: '12px',
        right: '12px',
        maxWidth: '430px',
        margin: '0 auto',
        zIndex: 99999,
        transform: \`translate3d(\${offset.x}px, \${offset.y}px, 0)\`,
        opacity,
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        touchAction: 'none',
        userSelect: 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: getBadgeBg(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {getIcon()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
            {toast.title}
          </div>
          {toast.message && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {toast.message}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => triggerDismiss('up')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px'
          }}
          title="Descartar"
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '3px' }}>
        <span style={{ fontSize: '9px', color: 'rgba(100, 116, 139, 0.65)', fontWeight: '600', letterSpacing: '0.2px' }}>
          Desliza ⇡ ⇠ ⇢ para descartar
        </span>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully wrote', targetPath);
