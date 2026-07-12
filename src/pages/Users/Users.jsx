import React, { useState, useEffect } from 'react';
import { API_URL } from '../../services/api';
import { User, Plus, Edit, Trash2, ArrowLeft, Loader2, Save, X } from 'lucide-react';
import { confirmDelete, showSuccess, showError } from '../../utils/swal';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken] = useState(localStorage.getItem('catastro_token'));
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', id_rol: 1, id_empresa: '' });
  const [editingId, setEditingId] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    if (!authToken) {
      window.location.href = '/';
      return;
    }
    fetchUsers();
  }, [authToken]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
      
      // Parse token para el rol
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      const role = payload.role || '';
      setUserRole(role.toLowerCase());
      
      // Si es superadmin, obtener empresas
      if (role.toLowerCase() === 'superadmin') {
        const empRes = await fetch(`${API_URL}/api/empresas`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (empRes.ok) {
          setEmpresas(await empRes.json());
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isUpdating = isEditing && editingId;
    const url = isUpdating ? `${API_URL}/api/users/${editingId}` : `${API_URL}/api/users`;
    const method = isUpdating ? 'PUT' : 'POST';

    const payload = { ...formData };
    if (isUpdating && !payload.password) delete payload.password; // Don't send empty password on update
    if (payload.id_empresa === '') payload.id_empresa = null;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setIsEditing(false);
        setIsCreating(false);
        setFormData({ username: '', password: '', id_rol: 1, id_empresa: '' });
        setEditingId(null);
        showSuccess('Guardado', 'El usuario fue guardado correctamente');
        fetchUsers();
      } else {
        const err = await res.json();
        showError('Error', err.detail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id, username) => {
    const isConfirmed = await confirmDelete(`¿Estás seguro de eliminar a ${username}?`);
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showSuccess('Eliminado', 'El usuario ha sido eliminado');
        fetchUsers();
      } else {
        const err = await res.json();
        showError('Error', err.detail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ padding: '30px', minHeight: '100vh', position: 'relative', color: 'var(--text-color)' }}>
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: 'var(--primary-glow)', borderRadius: '50%', filter: 'blur(80px)', zIndex: -1 }}></div>

      <header className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', padding: '20px' }}>
        <div>
          <h1 className="title" style={{ margin: 0, fontSize: '24px' }}>Gestión de Usuarios</h1>
          <p className="subtitle" style={{ margin: 0 }}>Administra el acceso al Geoportal y a QGIS</p>
        </div>
        {!isEditing && !isCreating && (
          <button 
            onClick={() => { setIsCreating(true); setFormData({ username: '', password: '', id_rol: 1, id_empresa: '' }); }}
            className="btn-dynamic"
          >
            <Plus size={18} /> Nuevo Usuario
          </button>
        )}
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
          <Loader2 className="spin" size={40} color="var(--accent-color)" />
        </div>
      ) : isCreating || isEditing ? (
        <div className="glass-panel" style={{ padding: '30px', maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ marginTop: 0, marginBottom: '25px', color: 'var(--accent-color)' }}>{isCreating ? 'Crear Usuario' : 'Editar Usuario'}</h2>
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Nombre de Usuario (Login)</label>
              <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required className="input-dynamic" />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Contraseña {isEditing && '(Dejar en blanco para mantener actual)'}</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={isCreating} className="input-dynamic" />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>ID de Rol (1=Superadmin, 2=Admin, 3=Usuario)</label>
              <input type="number" value={formData.id_rol} onChange={e => setFormData({...formData, id_rol: parseInt(e.target.value)})} required className="input-dynamic" />
            </div>
            {userRole === 'superadmin' && (
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Empresa (Opcional, dejar vacío para Superadmin)</label>
                <select 
                  value={formData.id_empresa || ''} 
                  onChange={e => setFormData({...formData, id_empresa: e.target.value ? parseInt(e.target.value) : ''})}
                  className="input-dynamic"
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="">Ninguna / Todas</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre} (RUC: {emp.ruc})</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setIsCreating(false); setIsEditing(false); }} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px' }}>
                <X size={18} /> Cancelar
              </button>
              <button type="submit" className="btn-dynamic">
                <Save size={18} /> {isCreating ? 'Guardar' : 'Actualizar'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto', padding: '1px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid var(--card-border)', color: 'var(--accent-color)' }}>ID</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid var(--card-border)', color: 'var(--accent-color)' }}>Usuario</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid var(--card-border)', color: 'var(--accent-color)' }}>Rol</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid var(--card-border)', color: 'var(--accent-color)' }}>Estado</th>
                <th style={{ padding: '15px 20px', borderBottom: '1px solid var(--card-border)', textAlign: 'right', color: 'var(--accent-color)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id_usuario} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding: '15px 20px', color: 'var(--text-muted)' }}>{u.id_usuario}</td>
                  <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{u.username}</td>
                  <td style={{ padding: '15px 20px' }}>{u.id_rol}</td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: u.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: u.activo ? 'var(--success)' : 'var(--danger)', border: `1px solid ${u.activo ? 'var(--success)' : 'var(--danger)'}` }}>
                      {u.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                    <button onClick={() => { setFormData({ username: u.username, password: '', id_rol: u.id_rol, id_empresa: u.id_empresa || '' }); setEditingId(u.id_usuario); setIsEditing(true); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '6px', marginRight: '10px' }} title="Editar">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(u.id_usuario, u.username)} style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }} title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
