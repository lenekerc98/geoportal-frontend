import os

backend_dir = r"c:\LNCZ\proyecto-catastro-2026\backend"

# 1. Patch users.py
users_path = os.path.join(backend_dir, "app", "routers", "users.py")
with open(users_path, "r", encoding="utf-8") as f:
    users_code = f.read()

offline_support = """async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if token and str(token).startswith("offline_"):
        class OfflineBrigadistaUser:
            id_usuario = None
            id = None
            username = "operador_offline"
            nombre = "Operador de Campo (Brigadista)"
            id_empresa = 2
            id_proyecto = 3
            role = "brigadista"
            rol = type('Rol', (), {'nombre': 'brigadista', 'permisos': {'crear_predio': True, 'ver_predio': True}})()
            activo = True
            is_brigadista = True
            operador_temporal_id = None
        return OfflineBrigadistaUser()
"""

if "OfflineBrigadistaUser" not in users_code:
    users_code = users_code.replace(
        "async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):",
        offline_support
    )
    with open(users_path, "w", encoding="utf-8") as f:
        f.write(users_code)
    print("Patched users.py with offline token support")
else:
    print("users.py already has OfflineBrigadistaUser")

# 2. Patch gis.py to add GET /posesionarios
gis_path = os.path.join(backend_dir, "app", "routers", "gis.py")
with open(gis_path, "r", encoding="utf-8") as f:
    gis_code = f.read()

new_posesionarios_endpoint = """@router.get("/posesionarios")
async def listar_posesionarios(
    empresa_id: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: Any = Depends(get_current_user)
):
    \"\"\"
    Listar posesionarios para caché y autocompletado en la aplicación móvil y geoportal.
    \"\"\"
    target_emp_id = empresa_id or getattr(current_user, 'id_empresa', 2)
    sql = "SELECT id, cedula, nombre FROM catastro.posesionario WHERE 1=1"
    params = {}
    if target_emp_id:
        sql += " AND (empresa_id = :emp_id OR empresa_id IS NULL)"
        params["emp_id"] = target_emp_id
    if q and q.strip():
        sql += " AND (cedula ILIKE :q OR nombre ILIKE :q)"
        params["q"] = f"%{q.strip()}%"
    sql += " ORDER BY nombre ASC LIMIT 2000"
    
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(r) for r in rows]

@router.get("/posesionarios/buscar/{cedula}")"""

if "@router.get(\"/posesionarios\")" not in gis_code:
    gis_code = gis_code.replace(
        "@router.get(\"/posesionarios/buscar/{cedula}\", response_model=schemas.Posesionario)",
        new_posesionarios_endpoint
    )
    with open(gis_path, "w", encoding="utf-8") as f:
        f.write(gis_code)
    print("Patched gis.py with GET /posesionarios endpoint")
else:
    print("gis.py already has GET /posesionarios")
