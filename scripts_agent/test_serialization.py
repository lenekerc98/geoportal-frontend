import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from app.models.user import Usuario
from app.schemas.user import Usuario as UsuarioSchema

db = SessionLocal()
try:
    user = db.query(Usuario).filter(Usuario.id_usuario == 2).first()
    print("User username:", user.username)
    print("User proyectos relationship:", [p.id for p in user.proyectos])
    print("User hasattr proyectos_ids:", hasattr(user, 'proyectos_ids'))
    try:
        print("User.proyectos_ids value:", user.proyectos_ids)
    except Exception as e:
        print("Error accessing proyectos_ids:", e)

    schema_user = UsuarioSchema.model_validate(user)
    print("Schema user dump:", schema_user.model_dump())
finally:
    db.close()
