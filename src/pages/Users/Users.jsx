import React, { useState, useEffect } from 'react';
import { API_URL } from '../../services/api';
import { User, Plus, Edit, Trash2, ArrowLeft, Loader2, Save, X, Shield, Lock, CheckCircle, Sliders } from 'lucide-react';
import { confirmDelete, showSuccess, showError } from '../../utils/swal';

export default function Users() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'roles'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [proyectosList, setProyectosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken] = useState(localStorage.getItem('catastro_token'));
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', id_rol: 1, id_empresa: '',
      proyectos_ids: [], nombres: '', apellidos: '', cedula: '', correo: '' });
  const [editingId, setEditingId] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [userRole, setUserRole] = useState('');
  
  // State for Roles Permissions Matrix
  const [editingRolePermissions, setEditingRolePermissions] = useState({});
  const [savingRole, setSavingRole] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  
  // State for Role Creation Modal
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    nombre: '',
    descripcion: '',
    permisos: {}
  });
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  const availablePermissions = [
    { key: 'geoportal', label: 'Visor Geoportal / Mapa Interactivo', desc: 'Permite acceder al geoportal y navegar los mapas.' },
    { key: 'edicion_predios', label: 'Creación y Edición de Predios / Linderos', desc: 'Permite dibujar predios, editar vértices y linderos.' },
    { key: 'gestion_datos', label: 'Gestión de Datos (Ortofoto, Shapefile, DB)', desc: 'Permite subir ortofotos, cargar shapefiles y descargar la base de datos.' },
    { key: 'catastro_4d', label: 'Catastro Histórico (4D)', desc: 'Permite consultar el mapa en fechas pasadas.' },
    { key: 'cartas_topograficas', label: 'Cartas Topográficas y CAD', desc: 'Permite visualizar y gestionar cartas topográficas en el menú lateral.' },
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
      const proyRes = await fetch(`${API_URL}/api/proyectos`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (proyRes.ok) {
        const pData = await proyRes.json();
        setProyectosList(pData);
      }

        // Initialize permissions map
        const permMap = {};
        rolesData.forEach(r => {
          permMap[r.id_rol] = { ...(r.permisos || {}) };
          if (permMap[r.id_rol].cartas_topograficas === undefined) {
            permMap[r.id_rol].cartas_topograficas = true;
          }
        });
        setEditingRolePermissions(permMap);
        if (rolesData.length > 0) {
          setSelectedRoleId(prev => prev || rolesData[0].id_rol);
        }
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
        setFormData({ username: '', password: '', id_rol: roles[0]?.id_rol || 1, id_empresa: '',
      proyectos_ids: [], nombres: '', apellidos: '', cedula: '', correo: '' });
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
        window.dispatchEvent(new CustomEvent('catastro_permissions_updated'));
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

  const isSystemRole = (role) => {
    if (!role) return true;
    if ([1, 2, 3].includes(Number(role.id_rol))) return true;
    const name = (role.nombre || '').toLowerCase();
    return ['superadmin', 'superadministrador', 'admin', 'administrador', 'usuario'].includes(name);
  };

  const handleOpenCreateRole = () => {
    const defaultPerms = {};
    availablePermissions.forEach(p => {
      defaultPerms[p.key] = p.key === 'geoportal';
    });
    setRoleFormData({
      nombre: '',
      descripcion: '',
      permisos: defaultPerms
    });
    setIsCreatingRole(true);
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!roleFormData.nombre.trim()) {
      showError('Validación', 'El nombre del rol es requerido');
      return;
    }

    setIsSubmittingRole(true);
    try {
      const res = await fetch(`${API_URL}/api/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre: roleFormData.nombre.trim(),
          descripcion: roleFormData.descripcion.trim(),
          permisos: roleFormData.permisos
        })
      });

      if (res.ok) {
        const newRole = await res.json();
        showSuccess('Rol Creado', `El rol "${newRole.nombre}" ha sido creado con éxito.`);
        setIsCreatingRole(false);
        await fetchData();
        setSelectedRoleId(newRole.id_rol);
      } else {
        const err = await res.json();
        showError('Error', err.detail || 'No se pudo crear el rol');
      }
    } catch (err) {
      console.error(err);
      showError('Error', 'Ocurrió un error al crear el rol');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    const isConfirmed = await confirmDelete(`¿Estás seguro de eliminar el rol "${getRoleDisplayName(roleName)}"? Esta acción no se puede deshacer.`);
    if (!isConfirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (res.ok) {
        showSuccess('Rol Eliminado', `El rol "${roleName}" fue eliminado correctamente.`);
        await fetchData();
        setSelectedRoleId(roles[0]?.id_rol || 1);
      } else {
        const err = await res.json();
        showError('Error', err.detail || 'No se pudo eliminar el rol');
      }
    } catch (err) {
      console.error(err);
      showError('Error', 'Error al eliminar el rol');
    }
  };

  const getRoleDisplayName = (name) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower === 'superadmin') return 'Superadministrador';
    if (lower === 'admin') return 'Administrador';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const handleSelectAllPermissions = (roleId, value) => {
    setEditingRolePermissions(prev => {
      const updated = { ...(prev[roleId] || {}) };
      availablePermissions.forEach(p => {
        updated[p.key] = value;
      });
      return { ...prev, [roleId]: updated };
    });
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
          {getRoleDisplayName(roleObj?.nombre) || 'Usuario General'}
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
              onClick={() => { setIsCreating(true); setFormData({ username: '', password: '', id_rol: roles[0]?.id_rol || 1, id_empresa: '',
      proyectos_ids: [], nombres: '', apellidos: '', cedula: '', correo: '' }); }}
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

          {activeTab === 'roles' && (
            <button 
              onClick={handleOpenCreateRole}
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
              <Plus size={18} /> Nuevo Rol
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
                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required className="input-dynamic" autoComplete="off" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Contraseña {isEditing && '(Dejar en blanco para mantener actual)'}</label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={isCreating} className="input-dynamic" autoComplete="new-password" />
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
              
              {/* Project Selection for Regular Users */}
              {formData.id_rol && roles.find(r => r.id_rol === parseInt(formData.id_rol))?.nombre.toLowerCase() !== 'admin' && roles.find(r => r.id_rol === parseInt(formData.id_rol))?.nombre.toLowerCase() !== 'superadmin' && (
                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Proyectos Asignados</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', background: 'var(--bg-main)', padding: '10px', borderRadius: '5px', border: '1px solid var(--card-border)', maxHeight: '150px', overflowY: 'auto' }}>
                    {proyectosList.filter(p => !formData.id_empresa || p.empresas_ids?.includes(parseInt(formData.id_empresa))).map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.proyectos_ids?.includes(p.id)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              proyectos_ids: isChecked 
                                ? [...(prev.proyectos_ids || []), p.id] 
                                : (prev.proyectos_ids || []).filter(id => id !== p.id)
                            }));
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        {p.nombre}
                      </label>
                    ))}
                    {proyectosList.length === 0 && <span style={{ fontSize: '12px', color: 'gray' }}>No hay proyectos disponibles</span>}
                  </div>
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
        /* Tab de Matriz de Permisos por Rol (Visualización individual mediante Combo Box) */
        <div style={{ maxWidth: '920px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Barra Superior con Selector de Rol (Combo Box) */}
          <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={22} color="var(--accent-color)" />
              </div>
              <div>
                <label htmlFor="role-select" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', fontWeight: '700' }}>
                  Seleccionar Rol a Configurar:
                </label>
                <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '500' }}>
                  Administra las herramientas permitidas para cada perfil
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', maxWidth: '420px', minWidth: '220px' }}>
              <select
                id="role-select"
                value={selectedRoleId || (roles[0]?.id_rol || '')}
                onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                className="input-dynamic"
                style={{
                  flex: '1',
                  padding: '10px 14px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderColor: 'var(--accent-color)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                }}
              >
                {roles.map(r => (
                  <option key={r.id_rol} value={r.id_rol}>
                    {getRoleDisplayName(r.nombre)} (ID: {r.id_rol})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleOpenCreateRole}
                className="btn-dynamic"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  whiteSpace: 'nowrap'
                }}
                title="Crear un nuevo perfil de rol"
              >
                <Plus size={16} /> Crear Rol
              </button>
            </div>
          </div>

          {/* Tarjeta Única del Rol Seleccionado */}
          {(() => {
            const activeRole = roles.find(r => r.id_rol === Number(selectedRoleId)) || roles[0];
            if (!activeRole) return null;

            const rolePerms = editingRolePermissions[activeRole.id_rol] || {};
            const isSaving = savingRole === activeRole.id_rol;
            const activePermsCount = availablePermissions.filter(p => !!rolePerms[p.key]).length;

            return (
              <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {/* Cabecera del Rol Activo */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '15px', flexWrap: 'wrap', borderBottom: '1px solid var(--card-border)', paddingBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}>
                      <Shield size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>
                          {getRoleDisplayName(activeRole.nombre)}
                        </h3>
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', fontWeight: '700' }}>
                          ID: {activeRole.id_rol}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {activeRole.descripcion || 'Definición de accesos para este perfil de usuario.'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-main, rgba(0,0,0,0.03))', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontWeight: '600' }}>
                      <b>{activePermsCount}</b> de {availablePermissions.length} herramientas activas
                    </span>

                    {!isSystemRole(activeRole) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(activeRole.id_rol, activeRole.nombre)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '12px',
                          transition: 'all 0.2s ease'
                        }}
                        title="Eliminar este rol personalizado"
                      >
                        <Trash2 size={14} /> Eliminar Rol
                      </button>
                    )}
                  </div>
                </div>

                {/* Subcabecera y botones de acción rápida */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={16} /> Permisos de Herramientas y Módulos:
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleSelectAllPermissions(activeRole.id_rol, true)}
                      style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAllPermissions(activeRole.id_rol, false)}
                      style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                {/* Grid de Permisos (2 columnas elegantes y espaciosas) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
                  {availablePermissions.map(p => {
                    const isChecked = !!rolePerms[p.key];
                    return (
                      <label
                        key={p.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '14px',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          border: `1px solid ${isChecked ? 'rgba(59, 130, 246, 0.35)' : 'var(--card-border)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isChecked ? '0 2px 6px rgba(59, 130, 246, 0.06)' : 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handlePermissionToggle(activeRole.id_rol, p.key)}
                          style={{ marginTop: '3px', width: '17px', height: '17px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '600', display: 'block', color: isChecked ? 'var(--accent-color)' : 'var(--text-main)' }}>
                            {p.label}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '3px', display: 'block' }}>
                            {p.desc}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Botón de Guardado */}
                <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '20px', marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => handleSaveRolePermissions(activeRole.id_rol)}
                    disabled={isSaving}
                    className="btn-dynamic"
                    style={{ minWidth: '240px', justifyContent: 'center', padding: '12px 24px', fontSize: '14px', fontWeight: '600' }}
                  >
                    {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    {isSaving ? 'Guardando Permisos...' : `Guardar Permisos (${getRoleDisplayName(activeRole.nombre)})`}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal para Crear Nuevo Rol */}
      {isCreatingRole && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '28px',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--card-border)',
            background: 'var(--card-bg, #1e293b)'
          }}>
            {/* Header del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}>
                  <Shield size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '700', color: 'var(--text-main)' }}>Crear Nuevo Rol</h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>Configura los accesos y herramientas iniciales del perfil</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingRole(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', paddingRight: '4px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                  Nombre del Rol <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Catastrador, Inspector, Visualizador..."
                  value={roleFormData.nombre}
                  onChange={e => setRoleFormData({ ...roleFormData, nombre: e.target.value })}
                  className="input-dynamic"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                  Descripción del Perfil
                </label>
                <input
                  type="text"
                  placeholder="Ej: Acceso exclusivo para consulta y actualización de predios"
                  value={roleFormData.descripcion}
                  onChange={e => setRoleFormData({ ...roleFormData, descripcion: e.target.value })}
                  className="input-dynamic"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={15} /> Asignar Permisos Iniciales:
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = {};
                        availablePermissions.forEach(p => { allOn[p.key] = true; });
                        setRoleFormData(prev => ({ ...prev, permisos: allOn }));
                      }}
                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}
                    >
                      Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allOff = {};
                        availablePermissions.forEach(p => { allOff[p.key] = false; });
                        setRoleFormData(prev => ({ ...prev, permisos: allOff }));
                      }}
                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {availablePermissions.map(p => {
                    const isChecked = !!roleFormData.permisos[p.key];
                    return (
                      <label
                        key={p.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isChecked ? 'rgba(59, 130, 246, 0.35)' : 'var(--card-border)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => setRoleFormData(prev => ({
                            ...prev,
                            permisos: { ...prev.permisos, [p.key]: e.target.checked }
                          }))}
                          style={{ marginTop: '2px', accentColor: 'var(--accent-color)', width: '16px', height: '16px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '600', display: 'block', color: isChecked ? 'var(--accent-color)' : 'var(--text-main)' }}>
                            {p.label}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--card-border)', paddingTop: '16px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreatingRole(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole}
                  className="btn-dynamic"
                  style={{ padding: '9px 22px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isSubmittingRole ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                  {isSubmittingRole ? 'Creando...' : 'Crear Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
