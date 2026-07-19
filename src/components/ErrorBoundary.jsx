import React from 'react';

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
