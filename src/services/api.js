export const API_URL = import.meta.env.VITE_API_URL || "";

export function safeDecodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const originalFetch = window.fetch;
window.fetch = async function(resource, init = {}) {
  try {
    const dbEnv = localStorage.getItem('catastro_db_env') || 'prod';
    
    // Si la llamada es a nuestra API, adjuntar el encabezado X-Database-Env
    const isApiRequest = typeof resource === 'string' && (resource.includes('/api/') || resource.startsWith('/api'));
    
    if (isApiRequest) {
      if (init.headers instanceof Headers) {
        if (!init.headers.has('X-Database-Env')) {
          init.headers.set('X-Database-Env', dbEnv);
        }
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['X-Database-Env', dbEnv]);
      } else {
        init.headers = {
          ...(init.headers || {}),
          'X-Database-Env': dbEnv
        };
      }
    }

    const response = await originalFetch.call(this, resource, init);
    if (response.status === 401) {
      const resourceStr = typeof resource === 'string' ? resource : (resource?.url || '');
      const isAuthEndpoint = resourceStr.includes('/token') || resourceStr.includes('/system/health');
      if (!isAuthEndpoint) {
        localStorage.removeItem('catastro_token');
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    return response;
  } catch (error) {
    throw error;
  }
};
