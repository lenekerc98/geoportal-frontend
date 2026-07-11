import React, { useState, useEffect } from 'react';
import { login } from '../../services/authService';
import { Map, Lock, User, Loader2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('catastro_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (Date.now() < payload.exp * 1000) {
          window.location.href = '/geoportal';
        } else {
          localStorage.removeItem('catastro_token');
        }
      } catch (e) {
        localStorage.removeItem('catastro_token');
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await login(username, password);
      localStorage.setItem('catastro_token', data.access_token);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '420px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)', width: '100px', height: '100px', background: 'var(--primary-glow)', borderRadius: '50%', filter: 'blur(40px)', zIndex: -1 }}></div>

        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <div style={{ display: 'inline-block', padding: '15px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%', marginBottom: '15px', animation: 'pulse-glow 2s infinite' }}>
            <Map size={42} color="var(--accent-color)" />
          </div>
          <h1 className="title" style={{ fontSize: '28px' }}>Catastro 2026</h1>
          <p className="subtitle">Acceso Seguro al Geoportal</p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>Usuario</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-dynamic"
                placeholder="Ej. admin"
                style={{ paddingLeft: '42px' }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '35px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dynamic"
                placeholder="••••••••"
                style={{ paddingLeft: '42px' }}
                required
              />
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Si no cuenta con una contraseña, por favor contactese con el administrador del sistema</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-dynamic"
            style={{ width: '100%', height: '48px' }}
          >
            {loading ? <Loader2 className="spin" size={20} /> : 'INGRESAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
