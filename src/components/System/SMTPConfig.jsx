import React, { useState, useEffect } from 'react';
import { Mail, Save, Server, KeyRound, AtSign, Users } from 'lucide-react';
import { API_URL } from '../../services/api';
import { showSuccess, showError } from '../../utils/swal';

export default function SMTPConfig() {
  const [config, setConfig] = useState({
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    alert_email_to: '',
    is_active: true
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/configuracion/smtp`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({
          ...data,
          smtp_password: '' // No mostramos la contraseña real que viene del back (estará vacía de todas formas)
        });
      }
    } catch (error) {
      console.error("No se pudo cargar la configuración SMTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.smtp_server || !config.smtp_user || !config.alert_email_to) {
      showError("Faltan campos obligatorios");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('catastro_token');
      const res = await fetch(`${API_URL}/api/configuracion/smtp`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        showSuccess('Configuración SMTP guardada exitosamente');
        // Limpiamos el campo de contraseña para que no se reenvíe accidentalmente
        setConfig(prev => ({ ...prev, smtp_password: '' }));
      } else {
        const err = await res.json();
        showError(err.detail || 'Error al guardar');
      }
    } catch (error) {
      showError('Error de conexión con el servidor');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div style={{ padding: '20px' }}>Cargando configuración...</div>;

  return (
    <div style={{ background: 'var(--bg-panel)', padding: '25px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Mail size={20} color="var(--primary)" /> Configuración de Alertas por Correo
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.9rem' }}>
        Configura el servidor SMTP para que el sistema envíe notificaciones automáticas al administrador cuando ocurran errores críticos (Ej: Fallos en base de datos).
      </p>

      <div style={{ maxWidth: '600px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Server size={14}/> Servidor SMTP
            </label>
            <input 
              type="text" 
              value={config.smtp_server}
              onChange={(e) => setConfig({...config, smtp_server: e.target.value})}
              placeholder="Ej: smtp.gmail.com"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Puerto</label>
            <input 
              type="number" 
              value={config.smtp_port}
              onChange={(e) => setConfig({...config, smtp_port: parseInt(e.target.value) || 587})}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AtSign size={14}/> Correo Remitente (Usuario)
            </label>
            <input 
              type="email" 
              value={config.smtp_user}
              onChange={(e) => setConfig({...config, smtp_user: e.target.value})}
              placeholder="correo_que_envia@gmail.com"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <KeyRound size={14}/> Contraseña de App
            </label>
            <input 
              type="password" 
              value={config.smtp_password}
              onChange={(e) => setConfig({...config, smtp_password: e.target.value})}
              placeholder="Ingresa nueva contraseña para actualizar"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-lighter)', color: 'var(--text-main)' }}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
              Déjalo en blanco si no deseas cambiar la contraseña actual.
            </small>
          </div>
        </div>

        <div style={{ marginBottom: '25px', padding: '15px', background: 'var(--bg-lighter)', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users size={14}/> Destinatarios de las Alertas
          </label>
          <input 
            type="text" 
            value={config.alert_email_to}
            onChange={(e) => setConfig({...config, alert_email_to: e.target.value})}
            placeholder="admin@dominio.com, soporte@dominio.com"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px', display: 'block' }}>
            Puedes ingresar múltiples correos separándolos por comas (,). Estos correos recibirán los reportes de error 500 y emergencias.
          </small>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Configuración SMTP'}
          </button>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
            <input 
              type="checkbox" 
              checked={config.is_active}
              onChange={(e) => setConfig({...config, is_active: e.target.checked})}
              style={{ width: '16px', height: '16px' }}
            />
            Activar envío automático de alertas
          </label>
        </div>
      </div>
    </div>
  );
}
