import { API_URL } from './api';

export const getPredios = async (token) => {
  const res = await fetch(`${API_URL}/api/gis/predios`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al obtener predios');
  return res.json();
};

export const getVertices = async (token) => {
  const res = await fetch(`${API_URL}/api/gis/vertices`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al obtener vértices');
  return res.json();
};

export const getLineas = async (token) => {
  const res = await fetch(`${API_URL}/api/gis/lineas`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al obtener líneas');
  return res.json();
};

export const getOrtofotosCatalog = async (token) => {
  const res = await fetch(`${API_URL}/api/catalog`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al obtener catálogo de ortofotos');
  return res.json();
};

export const deleteOrtofoto = async (filename, token) => {
  const res = await fetch(`${API_URL}/api/gis/ortofotos/${filename}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al eliminar la ortofoto');
  return res.json();
};

export const triggerCatalogacionMasiva = async (token) => {
  const res = await fetch(`${API_URL}/api/gis/ortofotos/catalogar-masivo`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al iniciar catalogación masiva');
  return res.json();
};

export const checkTaskStatus = async (taskId, token) => {
  const res = await fetch(`${API_URL}/api/gis/ortofotos/task-status/${taskId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error verificando el estado de la tarea');
  return res.json();
};

export const uploadDragAndDrop = async (file, token) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/api/gis/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Error al subir el archivo');
  }
  return res.json();
};
