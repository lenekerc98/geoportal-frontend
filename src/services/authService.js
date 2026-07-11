import { API_URL } from './api';

export const login = async (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const response = await fetch(`${API_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Credenciales incorrectas');
  }

  return response.json();
};

export const fetchTools = async (token) => {
  const response = await fetch(`${API_URL}/api/tools`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Error al obtener herramientas');
  }
  
  return response.json();
};
