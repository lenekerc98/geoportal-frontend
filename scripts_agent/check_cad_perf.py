import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text
import time

db = SessionLocal()
try:
    # Check count in capas_cad_cartas
    count = db.execute(text("SELECT count(*) FROM catastro.capas_cad_cartas;")).scalar()
    print("Total rows in capas_cad_cartas:", count)

    # Check distinct files
    files = db.execute(text("SELECT nombre_archivo, count(*) FROM catastro.capas_cad_cartas GROUP BY nombre_archivo;")).fetchall()
    print("Files:", files)

    # Check indexes on capas_cad_cartas
    indexes = db.execute(text("""
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'capas_cad_cartas';
    """)).fetchall()
    print("Indexes on capas_cad_cartas:", indexes)

    # Test the query time for cad-layers/geojson
    if files:
        sample_file = files[0][0]
        t0 = time.time()
        # Test query without bbox
        q1 = f"""
            SELECT count(*) FROM catastro.capas_cad_cartas WHERE nombre_archivo = :archivo;
        """
        c1 = db.execute(text(q1), {"archivo": sample_file}).scalar()
        t1 = time.time()
        print(f"Count for {sample_file}: {c1} rows in {t1 - t0:.3f}s")
finally:
    db.close()
