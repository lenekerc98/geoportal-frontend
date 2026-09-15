export const API_URL = import.meta.env.VITE_API_URL || "";

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
      // Token expired or invalid
      localStorage.removeItem('catastro_token');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return response;
  } catch (error) {
    throw error;
  }
};
