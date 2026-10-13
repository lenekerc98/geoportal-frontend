import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    layers = db.execute(text("""
        SELECT capa_cad, tipo_geometria, count(*) 
        FROM catastro.capas_cad_cartas 
        GROUP BY capa_cad, tipo_geometria 
        ORDER BY count(*) DESC;
    """)).fetchall()
    print("CAD Layers and counts:")
    for l in layers:
        print(f"  {l[0]} ({l[1]}): {l[2]}")
finally:
    db.close()
