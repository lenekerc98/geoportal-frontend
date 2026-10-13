import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal, engine
from sqlalchemy import text

db = SessionLocal()
try:
    tables = db.execute(text("""
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('usuario_proyecto', 'usuarios', 'proyecto', 'empresa');
    """)).fetchall()
    print('Tables found:', tables)

    rows = db.execute(text("SELECT * FROM seguridad.usuario_proyecto;")).fetchall()
    print('usuario_proyecto rows:', rows)

    users = db.execute(text("SELECT id_usuario, username, id_rol, id_empresa FROM seguridad.usuarios;")).fetchall()
    print('Users:', users)

    projs = db.execute(text("SELECT id, nombre FROM catastro.proyecto;")).fetchall()
    print('Proyectos:', projs)
except Exception as e:
    print('Error:', e)
finally:
    db.close()
