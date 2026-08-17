import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function ReporteLinderacion() {
  const { codigo } = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px', background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
      <button 
        onClick={() => navigate(-1)} 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--card-border)', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px' }}
      >
        <ArrowLeft size={18} /> Volver
      </button>

      <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid var(--card-border)' }}>
        <h1 style={{ color: 'var(--text-main)', borderBottom: '2px solid var(--card-border)', paddingBottom: '10px' }}>
          Reporte de Linderación
        </h1>
        <h3 style={{ color: 'var(--text-muted)' }}>
          Código Catastral: <strong style={{ color: '#8b5cf6' }}>{codigo}</strong>
        </h3>
        
        <div style={{ marginTop: '30px', padding: '40px', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px dashed #8b5cf6' }}>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
            🚧 Módulo en Construcción 🚧
          </p>
          <p style={{ color: 'var(--text-muted)' }}>
            Aquí se mostrarán los datos y el formato PDF correspondiente al reporte de linderación.
          </p>
        </div>
      </div>
    </div>
  );
}
