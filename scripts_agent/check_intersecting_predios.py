import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text
import time

db = SessionLocal()
try:
    inside = db.execute(text("""
        SELECT count(*) 
        FROM catastro.predio p
        WHERE p.geom IS NOT NULL
        AND ST_Intersects(p.geom, (SELECT ST_SetSRID(ST_Extent(c.geom), 32717) FROM catastro.capas_cad_cartas c));
    """)).scalar()
    print("Predios intersecting CAD layer:", inside)

    sample = db.execute(text("""
        SELECT p.id, p.cod_catastral, ST_AsText(ST_Centroid(ST_Transform(p.geom, 4326))) as centroid
        FROM catastro.predio p
        WHERE p.geom IS NOT NULL
        AND ST_Intersects(p.geom, (SELECT ST_SetSRID(ST_Extent(c.geom), 32717) FROM catastro.capas_cad_cartas c))
        LIMIT 1;
    """)).fetchone()
    print("Sample intersecting predio:", sample)

    if sample:
        import re
        m = re.findall(r"[-+]?\d*\.\d+|\d+", sample.centroid)
        lng, lat = float(m[0]), float(m[1])
        pad = 0.06
        min_x, max_x = lng - pad, lng + pad
        min_y, max_y = lat - pad, lat + pad
        archivo = 'NIV-D3catarama-D1ventanas-C2puertopechiche-C4puebloviejo.dxf'
        simplify = 1.5

        where_clauses = [
            "geom IS NOT NULL",
            "nombre_archivo = :archivo",
            "ST_Intersects(geom, ST_Transform(ST_MakeEnvelope(:min_x, :min_y, :max_x, :max_y, 4326), 32717))"
        ]
        params = {"archivo": archivo, "min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y}
        where_sql = " AND ".join(where_clauses)
        geom_expr = f"ST_Transform(ST_SimplifyPreserveTopology(geom, {float(simplify)}), 4326)"

        query = f"""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', coalesce(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'id', id,
                        'geometry', ST_AsGeoJSON({geom_expr})::json,
                        'properties', json_build_object(
                            'id', id,
                            'archivo', nombre_archivo,
                            'capa_cad', capa_cad,
                            'tipo_geometria', tipo_geometria,
                            'texto', texto,
                            'color', color
                        )
                    )
                ), '[]'::json)
            )::text
            FROM catastro.capas_cad_cartas
            WHERE {where_sql};
        """
        t0 = time.time()
        res = db.execute(text(query), params).scalar()
        t1 = time.time()
        c = db.execute(text(f"SELECT count(*) FROM catastro.capas_cad_cartas WHERE {where_sql};"), params).scalar()
        print(f"Features in bbox: {c}, Size: {len(res)/1024/1024:.2f} MB, Time: {t1 - t0:.3f}s")
finally:
    db.close()
