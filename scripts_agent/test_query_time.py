import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text
import time
import re

db = SessionLocal()
try:
    predio = db.execute(text("SELECT id, ST_AsText(ST_Centroid(ST_Transform(geom, 4326))) as centroid FROM catastro.predio WHERE geom IS NOT NULL LIMIT 1;")).fetchone()
    print("Predio:", predio)
    
    m = re.findall(r"[-+]?\d*\.\d+|\d+", predio.centroid)
    lng, lat = float(m[0]), float(m[1])
    pad = 0.06
    min_x, max_x = lng - pad, lng + pad
    min_y, max_y = lat - pad, lat + pad
    print(f"Bbox: {min_x}, {min_y}, {max_x}, {max_y}")

    archivo = 'NIV-D3catarama-D1ventanas-C2puertopechiche-C4puebloviejo.dxf'
    simplify = 1.5

    where_clauses = [
        "geom IS NOT NULL",
        "nombre_archivo = :archivo",
        "ST_Intersects(geom, ST_Transform(ST_MakeEnvelope(:min_x, :min_y, :max_x, :max_y, 4326), 32717))"
    ]
    params = {
        "archivo": archivo,
        "min_x": min_x,
        "min_y": min_y,
        "max_x": max_x,
        "max_y": max_y
    }
    geom_expr = f"ST_Transform(ST_SimplifyPreserveTopology(geom, {float(simplify)}), 4326)"
    where_sql = " AND ".join(where_clauses)

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
    print(f"Query WITH bbox returned {len(res)} chars ({len(res)/1024/1024:.2f} MB) in {t1 - t0:.3f}s")

    count_features = db.execute(text(f"SELECT count(*) FROM catastro.capas_cad_cartas WHERE {where_sql};"), params).scalar()
    print("Features count in bbox:", count_features)

    # Without bbox
    where_no_bbox = "geom IS NOT NULL AND nombre_archivo = :archivo"
    query_no_bbox = f"""
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
        WHERE {where_no_bbox};
    """
    t2 = time.time()
    res_all = db.execute(text(query_no_bbox), {"archivo": archivo}).scalar()
    t3 = time.time()
    print(f"Query WITHOUT bbox returned {len(res_all)} chars ({len(res_all)/1024/1024:.2f} MB) in {t3 - t2:.3f}s")

finally:
    db.close()
