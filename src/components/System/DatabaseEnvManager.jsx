import React, { useState, useEffect } from 'react';
import { Database, Server, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRightLeft, Layers, Info, Trash2 } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';
import Swal from 'sweetalert2';
import MassivePurgeModal from './MassivePurgeModal';

export default function DatabaseEnvManager() {
  const [currentEnv, setCurrentEnv] = useState(localStorage.getItem('catastro_db_env') || 'prod');
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);

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

    const handlePurged = () => fetchDbInfo();
    window.addEventListener('catastro_data_purged', handlePurged);
    return () => window.removeEventListener('catastro_data_purged', handlePurged);
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
      sessionStorage.setItem('catastro_params_tab', 'database');
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

  const handleSyncDatabase = async (direction) => {
    const isTestToProd = direction === 'test_to_prod';

    if (isTestToProd) {
      const { value: confirmText } = await Swal.fire({
        title: '⚠️ ¿Sincronizar Prueba hacia Producción?',
        html: `
          <div style="text-align: left; font-size: 0.9rem;">
            <p><strong>¡ATENCIÓN! Acción Crítica de Alto Impacto:</strong></p>
            <p>Esta acción sobreescribirá la base oficial de <strong>PRODUCCIÓN (catastro-db)</strong> (actualmente con <b>${prodData.predios} predios</b>) con todos los datos, predios y geometrías ensayados en la base de <strong>PRUEBAS (catastro-db-test)</strong> (actualmente con <b>${testData.predios} predios</b>).</p>
            <p style="color: #dc2626; font-weight: bold;">Todos los operadores y técnicos municipales verán reflejados estos datos en producción oficial.</p>
            <p style="margin-top: 10px;">Para confirmar esta operación, escribe <b>CONFIRMAR</b> en el siguiente campo:</p>
          </div>
        `,
        input: 'text',
        inputPlaceholder: 'Escribe CONFIRMAR para continuar',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '🚀 Sí, sincronizar Prueba ➔ Producción',
        cancelButtonText: 'Cancelar',
        preConfirm: (inputVal) => {
          if ((inputVal || '').trim().toUpperCase() !== 'CONFIRMAR') {
            Swal.showValidationMessage('Debes escribir CONFIRMAR exactamente para proceder.');
            return false;
          }
          return true;
        }
      });

      if (!confirmText) return;
    } else {
      const result = await Swal.fire({
        title: '¿Sincronizar Producción hacia Prueba?',
        html: `
          <div style="text-align: left; font-size: 0.9rem;">
            <p>Esta acción sobreescribirá la base de <strong>PRUEBAS (catastro-db-test)</strong> con una copia idéntica de la base oficial de <strong>PRODUCCIÓN (catastro-db)</strong> (actualmente con <b>${prodData.predios} predios</b>).</p>
            <p style="color: #d97706;">Los ensayos o pruebas previas que no se hayan promovido serán reemplazados.</p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '🔄 Sí, sincronizar Producción ➔ Prueba',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;
    }

    setSyncing(direction);

    Swal.fire({
      title: 'Sincronizando Base de Datos...',
      html: `
        <div style="font-size: 0.9rem; color: #475569; text-align: center;">
          <p style="margin-bottom: 8px;">Transfiriendo esquemas, predios, geometrías, vértices y linderos en AWS RDS...</p>
          <small style="color: #94a3b8;">Esto puede tomar aproximadamente 1 minuto por el volumen cartográfico. Por favor, no cierres esta ventana.</small>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/system/database-clone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          direction,
          confirmacion: isTestToProd ? 'SINCRONIZAR_A_PRODUCCION' : null
        })
      });

      const data = await res.json();
      if (res.ok) {
        await Swal.fire({
          title: 'Sincronización Exitosa',
          html: `
            <div style="text-align: left; font-size: 0.9rem;">
              <p>${data.message || 'Bases de datos sincronizadas con éxito.'}</p>
              <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 8px;">
                <div><b>Producción (catastro-db):</b> ${data.predios_prod} predios</div>
                <div><b>Pruebas (catastro-db-test):</b> ${data.predios_test} predios</div>
              </div>
            </div>
          `,
          icon: 'success'
        });
        fetchDbInfo();
      } else {
        showError(data.detail || 'Error al sincronizar las bases de datos');
      }
    } catch (e) {
      showError('Error de red o tiempo de espera al sincronizar las bases de datos');
    } finally {
      setSyncing(false);
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

      {/* Sección Sincronización Bidireccional */}
      <div style={{
        background: 'var(--bg-lighter)',
        borderRadius: '10px',
        padding: '20px',
        border: '1px solid var(--card-border)',
        marginBottom: '15px'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRightLeft size={18} color="var(--primary)" /> Sincronización entre Ambientes (AWS RDS)
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Permite transferir y homologar datos, predios y geometrías entre el ambiente de Producción oficial (<code>catastro-db</code>) y el ambiente de Pruebas (<code>catastro-db-test</code>).
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Opción 1: Producción -> Prueba */}
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--card-border)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <RefreshCw size={16} color="#d97706" />
                <strong style={{ fontSize: '0.9rem', color: '#d97706' }}>Producción ➔ Prueba (Refrescar)</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Copia la base oficial hacia la de pruebas (reemplaza los datos actuales de prueba con los <b>{prodData.predios} predios</b> de producción).
              </p>
            </div>

            <button
              onClick={() => handleSyncDatabase('prod_to_test')}
              disabled={Boolean(syncing)}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#d97706',
                cursor: syncing ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={14} className={syncing === 'prod_to_test' ? 'spin' : ''} />
              {syncing === 'prod_to_test' ? 'Sincronizando...' : 'Sincronizar Producción ➔ Prueba'}
            </button>
          </div>

          {/* Opción 2: Prueba -> Producción */}
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Database size={16} color="#10b981" />
                <strong style={{ fontSize: '0.9rem', color: '#10b981' }}>Prueba ➔ Producción (Promover)</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Promueve y copia los <b>{testData.predios} predios</b> ensayados en pruebas hacia la base oficial de producción (reemplaza la producción actual con la prueba).
              </p>
            </div>

            <button
              onClick={() => handleSyncDatabase('test_to_prod')}
              disabled={Boolean(syncing)}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                cursor: syncing ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Database size={14} className={syncing === 'test_to_prod' ? 'spin' : ''} />
              {syncing === 'test_to_prod' ? 'Promoviendo a Producción...' : 'Sincronizar Prueba ➔ Producción'}
            </button>
          </div>
        </div>
      </div>

      {/* Sección Limpieza Masiva / Purga */}
      <div style={{
        marginTop: '15px',
        background: 'rgba(239, 68, 68, 0.05)',
        borderRadius: '8px',
        padding: '18px 20px',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
            <Trash2 size={16} /> Limpieza Masiva de Predios y Posesionarios
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Permite vaciar de forma selectiva o total los predios, geometrías y posesionarios en la base de datos activa (<strong>{currentEnv === 'test' ? 'catastro-db-test' : 'catastro-db'}</strong>).
          </p>
        </div>

        <button
          onClick={() => setShowPurgeModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '6px',
            border: '1px solid #ef4444',
            background: '#ef4444',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
          }}
        >
          <Trash2 size={16} /> Abrir Limpieza Masiva
        </button>
      </div>

      {/* Host AWS info */}
      <div style={{ marginTop: '15px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Instancia AWS RDS: <code>{dbInfo?.host || 'catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com'}</code>
      </div>

      <MassivePurgeModal
        isOpen={showPurgeModal}
        onClose={() => setShowPurgeModal(false)}
        onPurged={() => fetchDbInfo()}
      />
    </div>
  );
}
