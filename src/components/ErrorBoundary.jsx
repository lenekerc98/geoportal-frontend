import React from 'react';
import { API_URL } from '../services/api';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    try {
      const userStr = localStorage.getItem('catastro_user');
      let userDesc = 'Usuario no autenticado';
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          userDesc = `${u.username || u.nombre || u.email || 'Usuario'} (ID: ${u.id || 'N/A'})`;
        } catch(e) {}
      }
      fetch(`${API_URL}/api/system/report-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `${error?.stack || error?.message || String(error)}\n\nComponent Stack:\n${errorInfo?.componentStack || ''}`,
          user: userDesc,
          url: window.location.href
        })
      }).catch(() => {});
    } catch(e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', margin: '20px', borderRadius: '8px' }}>
          <h2>Algo salió mal en esta pantalla.</h2>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Ver detalles del error</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button 
            onClick={() => window.location.href = '/geoportal'} 
            style={{ marginTop: '15px', padding: '8px 16px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Volver al Geoportal
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
