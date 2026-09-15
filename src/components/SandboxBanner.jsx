import React, { useState, useEffect } from 'react';
import { FlaskConical, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import Swal from 'sweetalert2';

export default function SandboxBanner() {
  const [isTestMode, setIsTestMode] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const checkEnvAndRole = () => {
    const env = localStorage.getItem('catastro_db_env') || 'prod';
    const token = localStorage.getItem('catastro_token');
    let superAdmin = false;

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = (payload.role || '').toLowerCase();
        superAdmin = role.includes('superadmin') || role.includes('superadministrador');
      } catch (e) {}
    }

    setIsSuperAdmin(superAdmin);
    setIsTestMode(superAdmin && env === 'test');
  };

  useEffect(() => {
    checkEnvAndRole();

    const handleEnvChanged = () => {
      checkEnvAndRole();
    };

    window.addEventListener('catastro_env_changed', handleEnvChanged);
    window.addEventListener('storage', handleEnvChanged);

    return () => {
      window.removeEventListener('catastro_env_changed', handleEnvChanged);
      window.removeEventListener('storage', handleEnvChanged);
    };
  }, []);

  const handleSwitchToProd = async () => {
    const result = await Swal.fire({
      title: '¿Regresar a Producción?',
      text: 'Se cambiará la conexión a la base de datos oficial (catastro-db en AWS RDS).',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, volver a Producción',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      localStorage.setItem('catastro_db_env', 'prod');
      window.dispatchEvent(new Event('catastro_env_changed'));
      window.location.reload();
    }
  };

  if (!isTestMode || !isSuperAdmin) {
    return null;
  }

  return (
    <div style={{
      background: 'linear-gradient(90deg, #d97706 0%, #b45309 100%)',
      color: '#ffffff',
      padding: '8px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '0.85rem',
      fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      zIndex: 1000,
      position: 'relative',
      borderBottom: '1px solid rgba(255,255,255,0.2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          background: 'rgba(255,255,255,0.25)',
          borderRadius: '50%',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <FlaskConical size={16} color="#ffffff" />
        </span>
        <span>
          <strong>MODO PRUEBA ACTIVO (AWS RDS):</strong> Estás conectado a <code>catastro-db-test</code>. Los cambios que realices aquí no alterarán la producción oficial.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '0.75rem',
          background: 'rgba(0,0,0,0.2)',
          padding: '3px 8px',
          borderRadius: '4px',
          letterSpacing: '0.5px'
        }}>
          EXCLUSIVO SUPERADMIN
        </span>
        <button
          onClick={handleSwitchToProd}
          style={{
            background: '#ffffff',
            color: '#b45309',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#fef3c7'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
        >
          <ArrowRightLeft size={14} /> Volver a Producción
        </button>
      </div>
    </div>
  );
}
