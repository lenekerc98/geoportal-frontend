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
    archivo = 'NIV-D3catarama-D1ventanas-C2puertopechiche-C4puebloviejo.dxf'

    for pad in [0.06, 0.035, 0.025]:
        min_x, max_x = lng - pad, lng + pad
        min_y, max_y = lat - pad, lat + pad
        params = {"archivo": archivo, "min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y}
        where = "geom IS NOT NULL AND nombre_archivo = :archivo AND ST_Intersects(geom, ST_Transform(ST_MakeEnvelope(:min_x, :min_y, :max_x, :max_y, 4326), 32717))"
        q = f"""
            SELECT count(*), 
                   length(json_build_object(
                       'type', 'FeatureCollection',
                       'features', coalesce(json_agg(
                           json_build_object(
                               'type', 'Feature',
                               'id', id,
                               'geometry', ST_AsGeoJSON(ST_Transform(ST_Simplify(geom, 2.5), 4326))::json,
                               'properties', json_build_object('id', id, 'capa_cad', capa_cad, 'texto', texto)
                           )
                       ), '[]'::json)
                   )::text) as json_len
            FROM catastro.capas_cad_cartas
            WHERE {where};
        """
        t0 = time.time()
        row = db.execute(text(q), params).fetchone()
        t1 = time.time()
        print(f"pad={pad}: {row[0]} features, {row[1]/1024:.1f} KB in {t1-t0:.3f}s")

finally:
    db.close()
