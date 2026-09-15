import React, { useState, useEffect } from 'react';
import { Database, Server, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRightLeft, Layers, Info } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';
import Swal from 'sweetalert2';

export default function DatabaseEnvManager() {
  const [currentEnv, setCurrentEnv] = useState(localStorage.getItem('catastro_db_env') || 'prod');
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchDbInfo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/system/database-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      }
    } catch (e) {
      console.error('Error fetching database info:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbInfo();
  }, [currentEnv]);

  const handleToggleEnv = async (targetEnv) => {
    if (targetEnv === currentEnv) return;

    const title = targetEnv === 'test' 
      ? '¿Cambiar a Base de Pruebas?' 
      : '¿Cambiar a Base de Producción?';
    
    const text = targetEnv === 'test'
      ? 'Tus acciones como Superadministrador se ejecutarán en "catastro-db-test" en AWS RDS. La base de producción no sufrirá cambios.'
      : 'Tus acciones se ejecutarán en la base de datos oficial "catastro-db" en AWS RDS.';

    const confirmColor = targetEnv === 'test' ? '#d97706' : '#10b981';

    const result = await Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#6b7280',
      confirmButtonText: `Sí, cambiar a ${targetEnv === 'test' ? 'Pruebas' : 'Producción'}`,
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      localStorage.setItem('catastro_db_env', targetEnv);
      setCurrentEnv(targetEnv);
      window.dispatchEvent(new Event('catastro_env_changed'));
      
      await Swal.fire({
        title: 'Entorno Actualizado',
        text: `Ahora estás trabajando en el entorno de ${targetEnv === 'test' ? 'Pruebas (catastro-db-test)' : 'Producción (catastro-db)'} en AWS RDS.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

      window.location.reload();
    }
  };

  const handleCloneProductionToTest = async () => {
    const result = await Swal.fire({
      title: '¿Sincronizar Producción hacia Prueba?',
      text: 'Esta acción sobreescribirá la base de pruebas (catastro-db-test) con una copia idéntica y actualizada de la base oficial de Producción (catastro-db). ¡Los ensayos previos en la base de prueba serán reemplazados!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, sincronizar ahora',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      setSyncing(true);
      try {
        const token = localStorage.getItem('catastro_token');
        const res = await fetch(`${API_URL}/api/system/database-clone`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          showSuccess('Base de pruebas sincronizada exitosamente con la producción actual.');
          fetchDbInfo();
        } else {
          const err = await res.json();
          showError(err.detail || 'Error al sincronizar la base de pruebas');
        }
      } catch (e) {
        showError('Error de red al sincronizar la base de datos');
      } finally {
        setSyncing(false);
      }
    }
  };

  const prodData = dbInfo?.databases?.prod || { name: 'catastro-db', status: 'ONLINE', predios: 77 };
  const testData = dbInfo?.databases?.test || { name: 'catastro-db-test', status: 'ONLINE', predios: 77 };

  return (
    <div style={{ background: 'var(--bg-panel)', padding: '25px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Server size={22} color="var(--primary)" /> Control de Ambientes en AWS RDS
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '0.9rem' }}>
            Gestiona la alternancia entre la base de datos oficial y el entorno de pruebas para ensayos y capacitaciones.
          </p>
        </div>

        <button
          onClick={fetchDbInfo}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            border: '1px solid var(--card-border)',
            background: 'var(--bg-lighter)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          {loading ? 'Actualizando...' : 'Actualizar Estado'}
        </button>
      </div>

      {/* Alerta de Seguridad Exclusividad SuperAdmin */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        padding: '14px 18px',
        marginBottom: '25px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <ShieldCheck size={24} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>
          <strong>Aislamiento y Seguridad Garantizados:</strong>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Este selector actúa <strong>exclusivamente para tu usuario Superadministrador</strong>. Los técnicos, digitadores y demás operadores municipales continuarán conectándose <strong>siempre y sin excepción</strong> a la base de Producción oficial (<code>catastro-db</code>), asegurando cero interferencias en el flujo diario.
          </p>
        </div>
      </div>

      {/* Grid de Bases de Datos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        
        {/* Tarjeta Producción */}
        <div style={{
          border: currentEnv === 'prod' ? '2px solid #10b981' : '1px solid var(--card-border)',
          borderRadius: '10px',
          padding: '20px',
          background: currentEnv === 'prod' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-lighter)',
          position: 'relative',
          transition: 'all 0.2s ease'
        }}>
          {currentEnv === 'prod' && (
            <span style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: '#10b981',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              padding: '3px 10px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={13} /> EN USO ACTIVO
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Database size={22} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Base de Producción (AWS RDS)</h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
            Base de datos principal para la gestión catastral del Cantón Urdaneta. Todos los usuarios operan sobre esta base por defecto.
          </p>

          <div style={{ background: 'var(--bg-panel)', padding: '12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '18px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nombre de Base:</span>
              <strong>{prodData.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estado AWS:</span>
              <span style={{ color: prodData.status === 'ONLINE' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                ● {prodData.status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Predios Registrados:</span>
              <strong>{prodData.predios} predios</strong>
            </div>
          </div>

          <button
            onClick={() => handleToggleEnv('prod')}
            disabled={currentEnv === 'prod'}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              background: currentEnv === 'prod' ? 'rgba(16, 185, 129, 0.2)' : '#10b981',
              color: currentEnv === 'prod' ? '#10b981' : '#ffffff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: currentEnv === 'prod' ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {currentEnv === 'prod' ? 'Base Activa Actual' : 'Cambiar a Producción'}
          </button>
        </div>

        {/* Tarjeta Base de Pruebas */}
        <div style={{
          border: currentEnv === 'test' ? '2px solid #f59e0b' : '1px solid var(--card-border)',
          borderRadius: '10px',
          padding: '20px',
          background: currentEnv === 'test' ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-lighter)',
          position: 'relative',
          transition: 'all 0.2s ease'
        }}>
          {currentEnv === 'test' && (
            <span style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: '#f59e0b',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              padding: '3px 10px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <AlertTriangle size={13} /> EN USO ACTIVO
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Database size={22} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Base de Pruebas / Sandbox (AWS RDS)</h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
            Copia aislada en AWS para ensayar fraccionamientos, cargas masivas o pruebas cartográficas sin poner en riesgo los datos oficiales.
          </p>

          <div style={{ background: 'var(--bg-panel)', padding: '12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '18px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nombre de Base:</span>
              <strong>{testData.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Estado AWS:</span>
              <span style={{ color: testData.status === 'ONLINE' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                ● {testData.status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Predios Registrados:</span>
              <strong>{testData.predios} predios</strong>
            </div>
          </div>

          <button
            onClick={() => handleToggleEnv('test')}
            disabled={currentEnv === 'test'}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              background: currentEnv === 'test' ? 'rgba(245, 158, 11, 0.2)' : '#f59e0b',
              color: currentEnv === 'test' ? '#f59e0b' : '#ffffff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: currentEnv === 'test' ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {currentEnv === 'test' ? 'Base Activa Actual' : 'Cambiar a Modo Prueba'}
          </button>
        </div>
      </div>

      {/* Sección Sincronización */}
      <div style={{
        background: 'var(--bg-lighter)',
        borderRadius: '8px',
        padding: '18px 20px',
        border: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} color="var(--primary)" /> Sincronizar Base de Pruebas con Producción
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Permite refrescar la base de pruebas en AWS RDS copiando todos los datos, predios y geometrías actuales de Producción hacia Prueba.
          </p>
        </div>

        <button
          onClick={handleCloneProductionToTest}
          disabled={syncing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '6px',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#d97706',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={16} className={syncing ? 'spin' : ''} />
          {syncing ? 'Sincronizando AWS RDS...' : 'Sincronizar Producción -> Prueba'}
        </button>
      </div>

      {/* Host AWS info */}
      <div style={{ marginTop: '15px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Instancia AWS RDS: <code>{dbInfo?.host || 'catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com'}</code>
      </div>
    </div>
  );
}
