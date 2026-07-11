export const API_URL = import.meta.env.VITE_API_URL || "";

const originalFetch = window.fetch;
window.fetch = async function(...args) {
  try {
    const response = await originalFetch.apply(this, args);
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
