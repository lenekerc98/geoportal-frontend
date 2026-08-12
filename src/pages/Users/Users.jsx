import React, { useState, useEffect } from 'react';
import { API_URL } from '../../services/api';
import { User, Plus, Edit, Trash2, ArrowLeft, Loader2, Save, X, Shield, Lock, CheckCircle, Sliders } from 'lucide-react';
import { confirmDelete, showSuccess, showError } from '../../utils/swal';

export default function Users() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'roles'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken] = useState(localStorage.getItem('catastro_token'));
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', id_rol: 1, id_empresa: '', nombres: '', apellidos: '', cedula: '', correo: '' });
  const [editingId, setEditingId] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [userRole, setUserRole] = useState('');
  
  // State for Roles Permissions Matrix
  const [editingRolePermissions, setEditingRolePermissions] = useState({});
  const [savingRole, setSavingRole] = useState(null);

  const availablePermissions = [
    { key: 'geoportal', label: 'Visor Geoportal / Mapa Interactivo', desc: 'Permite acceder al geoportal y navegar los mapas.' },
    { key: 'edicion_predios', label: 'Creación y Edición de Predios / Linderos', desc: 'Permite dibujar predios, editar vértices y linderos.' },
    { key: 'gestion_datos', label: 'Gestión de Datos (Ortofoto, Shapefile, DB)', desc: 'Permite subir ortofotos, cargar shapefiles y descargar la base de datos.' },
    { key: 'catastro_4d', label: 'Catastro Histórico (4D)', desc: 'Permite consultar el mapa en fechas pasadas.' },
    { key: 'gestion_usuarios', label: 'Gestión de Usuarios y Roles', desc: 'Permite administrar cuentas de usuarios y sus permisos.' },
    { key: 'gestion_empresas', label: 'Gestión de Empresas y Proyectos', desc: 'Permite administrar los GADs, empresas y proyectos.' },
    { key: 'qgis_sync', label: 'Sincronización con QGIS Desktop', desc: 'Permite la conexión e interacción mediante plugin de QGIS.' }
  ];

  useEffect(() => {
    if (!authToken) {
      window.location.href = '/';
      return;
    }
    fetchData();
  }, [authToken]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const fetchedUsers = await res.json();
        fetchedUsers.sort((a, b) => a.id_usuario - b.id_usuario);
        setUsers(fetchedUsers);
      }
      
      // 2. Fetch Roles
      const rolesRes = await fetch(`${API_URL}/api/roles`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
        // Initialize permissions map
        const permMap = {};
        rolesData.forEach(r => {
          permMap[r.id_rol] = r.permisos || {};
        });
        setEditingRolePermissions(permMap);
      }

      // Parse token para el rol del usuario actual
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      const role = payload.role || '';
      setUserRole(role.toLowerCase());
      
      // Si es superadmin, obtener empresas
      if (role.toLowerCase() === 'superadministrador' || role.toLowerCase() === 'superadmin') {
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

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const isUpdating = isEditing && editingId;
    const url = isUpdating ? `${API_URL}/api/users/${editingId}` : `${API_URL}/api/users`;
    const method = isUpdating ? 'PUT' : 'POST';

    const payload = { ...formData };
    if (isUpdating && !payload.password) delete payload.password;
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
        setFormData({ username: '', password: '', id_rol: roles[0]?.id_rol || 1, id_empresa: '', nombres: '', apellidos: '', cedula: '', correo: '' });
        setEditingId(null);
        showSuccess('Guardado', 'El usuario fue guardado correctamente');
        fetchData();
      } else {
        const err = await res.json();
        showError('Error', err.detail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (id, username) => {
    const isConfirmed = await confirmDelete(`¿Estás seguro de eliminar a ${username}?`);
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showSuccess('Eliminado', 'El usuario ha sido eliminado');
        fetchData();
      } else {
        const err = await res.json();
        showError('Error', err.detail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePermissionToggle = (roleId, permKey) => {
    setEditingRolePermissions(prev => {
      const rolePerms = { ...(prev[roleId] || {}) };
      rolePerms[permKey] = !rolePerms[permKey];
      return { ...prev, [roleId]: rolePerms };
    });
  };

  const handleSaveRolePermissions = async (roleId) => {
    setSavingRole(roleId);
    try {
      const res = await fetch(`${API_URL}/api/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permisos: editingRolePermissions[roleId]
        })
      });
      if (res.ok) {
        showSuccess('Permisos Actualizados', 'Los accesos del rol han sido guardados exitosamente');
        fetchData();
      } else {
        const err = await res.json();
        showError('Error', err.detail);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRole(null);
    }
  };

  const getRoleBadge = (user) => {
    const roleObj = user.rol || roles.find(r => r.id_rol === user.id_rol);
    const roleName = (roleObj?.nombre || `Rol ${user.id_rol}`).toLowerCase();

    if (roleName.includes('superadmin')) {
      return (
        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
          Superadministrador
        </span>
      );
    } else if (roleName.includes('admin')) {
      return (
        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
          Administrador
        </span>
      );
    } else {
      return (
        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
          {roleObj?.nombre || 'Usuario General'}
        </span>
      );
    }
  };

  return (
    <div style={{ padding: '30px', minHeight: '100vh', position: 'relative', color: 'var(--text-color)' }}>
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: 'var(--primary-glow)', borderRadius: '50%', filter: 'blur(80px)', zIndex: -1 }}></div>

      <header className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', padding: '20px', gap: '15px' }}>
        <div style={{ minWidth: '250px', flex: '1 1 auto' }}>
          <h1 className="title" style={{ margin: 0, fontSize: '24px' }}>Gestión de Usuarios y Accesos</h1>
          <p className="subtitle" style={{ margin: '4px 0 0 0' }}>Administra el acceso al Geoportal, roles y permisos de seguridad</p>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Tab Switcher */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--bg-main)', 
            padding: '5px', 
            borderRadius: '12px', 
            border: '1px solid var(--card-border)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
          }}>
            <button
              onClick={() => setActiveTab('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                backgroundColor: activeTab === 'users' ? 'var(--accent-color)' : 'transparent',
                color: activeTab === 'users' ? '#ffffff' : 'var(--text-main)',
                boxShadow: activeTab === 'users' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none'
              }}
            >
              <User size={16} /> Usuarios
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                backgroundColor: activeTab === 'roles' ? 'var(--accent-color)' : 'transparent',
                color: activeTab === 'roles' ? '#ffffff' : 'var(--text-main)',
                boxShadow: activeTab === 'roles' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none'
              }}
            >
              <Shield size={16} /> Matriz de Permisos
            </button>
          </div>

          {activeTab === 'users' && !isEditing && !isCreating && (
            <button 
              onClick={() => { setIsCreating(true); setFormData({ username: '', password: '', id_rol: roles[0]?.id_rol || 1, id_empresa: '', nombres: '', apellidos: '', cedula: '', correo: '' }); }}
              className="btn-dynamic"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              <Plus size={18} /> Nuevo Usuario
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
          <Loader2 className="spin" size={40} color="var(--accent-color)" />
        </div>
      ) : activeTab === 'users' ? (
        isCreating || isEditing ? (
          <div className="glass-panel" style={{ padding: '30px', maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '25px', color: 'var(--accent-color)' }}>{isCreating ? 'Crear Usuario' : 'Editar Usuario'}</h2>
            <form onSubmit={handleSaveUser}>
              <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 calc(50% - 15px)', minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Nombres</label>
                  <input type="text" value={formData.nombres || ''} onChange={e => setFormData({...formData, nombres: e.target.value})} className="input-dynamic" />
                </div>
                <div style={{ flex: '1 1 calc(50% - 15px)', minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Apellidos</label>
                  <input type="text" value={formData.apellidos || ''} onChange={e => setFormData({...formData, apellidos: e.target.value})} className="input-dynamic" />
                </div>
              </div>
              <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 calc(50% - 15px)', minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Cédula</label>
                  <input type="text" value={formData.cedula || ''} onChange={e => setFormData({...formData, cedula: e.target.value})} className="input-dynamic" />
                </div>
                <div style={{ flex: '1 1 calc(50% - 15px)', minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Correo Electrónico</label>
                  <input type="email" value={formData.correo || ''} onChange={e => setFormData({...formData, correo: e.target.value})} className="input-dynamic" />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Nombre de Usuario (Login)</label>
                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required className="input-dynamic" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Contraseña {isEditing && '(Dejar en blanco para mantener actual)'}</label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={isCreating} className="input-dynamic" />
              </div>
              
              {/* Dropdown de Selección de Rol */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Rol de Usuario</label>
                <select 
                  value={formData.id_rol} 
                  onChange={e => setFormData({...formData, id_rol: parseInt(e.target.value)})}
                  className="input-dynamic"
                  style={{ width: '100%', padding: '10px' }}
                  required
                >
                  {roles
                    .filter(r => (userRole === 'superadmin' || userRole === 'superadministrador') ? true : r.nombre !== 'superadmin')
                    .map(r => (
                    <option key={r.id_rol} value={r.id_rol}>
                      {r.nombre === 'superadmin' ? 'Superadministrador' : r.nombre === 'admin' ? 'Administrador' : r.nombre} ({r.descripcion || 'Sin descripción'})
                    </option>
                  ))}
                </select>
              </div>

              {(userRole === 'superadministrador' || userRole === 'superadmin') && (
                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Empresa / GAD (Opcional)</label>
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
                <button type="button" onClick={() => { setIsCreating(false); setIsEditing(false); }} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px' }}>
                  <X size={20} /> Cancelar
                </button>
                <button type="submit" className="btn-dynamic">
                  <Save size={18} /> {isCreating ? 'Guardar' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="table-container glass-panel" style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Nombres Completos</th>
                  <th>Cédula</th>
                  <th>Correo</th>
                  <th>Rol / Perfil</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id_usuario}>
                    <td data-label="ID" style={{ color: 'var(--text-muted)' }}>{u.id_usuario}</td>
                    <td data-label="Usuario" style={{ fontWeight: '600' }}>{u.username}</td>
                    <td data-label="Nombres Completos">{u.nombres_completos || '-'}</td>
                    <td data-label="Cédula">{u.cedula || '-'}</td>
                    <td data-label="Correo">{u.correo || '-'}</td>
                    <td data-label="Rol / Perfil">{getRoleBadge(u)}</td>
                    <td data-label="Estado">
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: u.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: u.activo ? 'var(--success)' : 'var(--danger)', border: `1px solid ${u.activo ? 'var(--success)' : 'var(--danger)'}` }}>
                        {u.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td data-label="Acciones" style={{ textAlign: 'right' }}>
                      <button onClick={() => { setFormData({ username: u.username, password: '', id_rol: u.id_rol, id_empresa: u.id_empresa || '', nombres: u.nombres || '', apellidos: u.apellidos || '', cedula: u.cedula || '', correo: u.correo || '' }); setEditingId(u.id_usuario); setIsEditing(true); }} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', cursor: 'pointer', padding: '8px', borderRadius: '6px', marginRight: '10px' }} title="Editar">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDeleteUser(u.id_usuario, u.username)} style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px', borderRadius: '6px' }} title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Tab de Matriz de Permisos por Rol */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {roles.map(r => {
            const rolePerms = editingRolePermissions[r.id_rol] || {};
            const isSaving = savingRole === r.id_rol;

            return (
              <div key={r.id_rol} className="glass-panel" style={{ padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Shield size={22} color="var(--accent-color)" />
                      <h3 style={{ margin: 0, textTransform: 'capitalize' }}>
                        {r.nombre === 'superadmin' ? 'Superadministrador' : r.nombre === 'admin' ? 'Administrador' : r.nombre}
                      </h3>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {r.id_rol}</span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    {r.descripcion || 'Definición de accesos para este perfil de usuario.'}
                  </p>

                  <hr style={{ borderColor: 'var(--card-border)', marginBottom: '20px' }} />

                  <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: 'var(--accent-color)' }}>Permisos de Herramientas:</h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {availablePermissions.map(p => {
                      const isChecked = !!rolePerms[p.key];
                      return (
                        <label 
                          key={p.key} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: '12px', 
                            padding: '10px', 
                            borderRadius: '8px', 
                            backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                            border: `1px solid ${isChecked ? 'rgba(59, 130, 246, 0.2)' : 'transparent'}`,
                            cursor: 'pointer' 
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handlePermissionToggle(r.id_rol, p.key)}
                            style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                          />
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '600', display: 'block', color: 'var(--text-main)' }}>
                              {p.label}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {p.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => handleSaveRolePermissions(r.id_rol)}
                  disabled={isSaving}
                  className="btn-dynamic"
                  style={{ marginTop: '25px', width: '100%', justifyContent: 'center' }}
                >
                  {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                  {isSaving ? 'Guardando...' : 'Guardar Permisos del Rol'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
