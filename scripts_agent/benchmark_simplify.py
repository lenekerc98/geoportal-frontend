import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text
import time

db = SessionLocal()
try:
    sample = db.execute(text("""
        SELECT p.id, p.cod_catastral, ST_AsText(ST_Centroid(ST_Transform(p.geom, 4326))) as centroid
        FROM catastro.predio p
        WHERE p.geom IS NOT NULL
        AND ST_Intersects(p.geom, (SELECT ST_SetSRID(ST_Extent(c.geom), 32717) FROM catastro.capas_cad_cartas c))
        LIMIT 1;
    """)).fetchone()
    
    import re
    m = re.findall(r"[-+]?\d*\.\d+|\d+", sample.centroid)
    lng, lat = float(m[0]), float(m[1])
    pad = 0.06
    min_x, max_x = lng - pad, lng + pad
    min_y, max_y = lat - pad, lat + pad
    archivo = 'NIV-D3catarama-D1ventanas-C2puertopechiche-C4puebloviejo.dxf'
    where_clauses = [
        "geom IS NOT NULL",
        "nombre_archivo = :archivo",
        "ST_Intersects(geom, ST_Transform(ST_MakeEnvelope(:min_x, :min_y, :max_x, :max_y, 4326), 32717))"
    ]
    params = {"archivo": archivo, "min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y}
    where_sql = " AND ".join(where_clauses)

    # 1. Test ST_SimplifyPreserveTopology(geom, 1.5)
    q_preserve = f"""
        SELECT count(*), sum(ST_NPoints(ST_SimplifyPreserveTopology(geom, 1.5)))
        FROM catastro.capas_cad_cartas WHERE {where_sql};
    """
    t0 = time.time()
    res1 = db.execute(text(q_preserve), params).fetchone()
    t1 = time.time()
    print(f"ST_SimplifyPreserveTopology: {t1 - t0:.4f}s, points: {res1[1]}")

    # 2. Test ST_Simplify(geom, 2.0)
    q_simplify = f"""
        SELECT count(*), sum(ST_NPoints(ST_Simplify(geom, 2.0)))
        FROM catastro.capas_cad_cartas WHERE {where_sql};
    """
    t2 = time.time()
    res2 = db.execute(text(q_simplify), params).fetchone()
    t3 = time.time()
    print(f"ST_Simplify(2.0): {t3 - t2:.4f}s, points: {res2[1]}")

    # 3. Test ST_Simplify(geom, 3.0)
    q_simplify3 = f"""
        SELECT count(*), sum(ST_NPoints(ST_Simplify(geom, 3.0)))
        FROM catastro.capas_cad_cartas WHERE {where_sql};
    """
    t4 = time.time()
    res3 = db.execute(text(q_simplify3), params).fetchone()
    t5 = time.time()
    print(f"ST_Simplify(3.0): {t5 - t4:.4f}s, points: {res3[1]}")

finally:
    db.close()
