import psycopg2

conn = psycopg2.connect('postgresql://postgres:L3n3k3rx98.@catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com:5432/catastro-db')
cur = conn.cursor()

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='seguridad' AND table_name='operador_temporal'")
cols = [r[0] for r in cur.fetchall()]
print("OPERADOR_TEMPORAL COLS:", cols)

cur.execute("SELECT COUNT(1) FROM catastro.v_predio_completo")
print("TOTAL PREDIOS EN V_PREDIO_COMPLETO:", cur.fetchone()[0])

cur.execute("SELECT empresa_id, COUNT(1) FROM catastro.v_predio_completo GROUP BY empresa_id")
print("PREDIOS POR EMPRESA:", cur.fetchall())

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='catastro' AND table_name='posesionario'")
print("POSESIONARIO COLS:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT id, nombre, cedula FROM catastro.posesionario WHERE cedula IS NOT NULL LIMIT 5")
print("MUESTRA POSESIONARIOS:", cur.fetchall())

# Test the query from gis.py
query = """
    SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(
            json_build_object(
                'type', 'Feature',
                'id', id,
                'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326))::json,
                'properties', json_build_object(
                    'cod_catastral', cod_catastral,
                    'id', id,
                    'posesionario_id', posesionario_id,
                    'empresa_id', empresa_id,
                    'area_ha', area_ha,
                    'cedula', cedula,
                    'nombre_posesionario', nombre_posesionario,
                    'estado', estado,
                    'fecha_creacion', fecha_creacion,
                    'fecha_baja', fecha_baja,
                    'predio_padre_id', predio_padre_id,
                    'proyecto_id', proyecto_id
                )
            )
        ), '[]'::json)
    )::text
    FROM catastro.v_predio_completo
    WHERE (CAST(2 AS INTEGER) IS NULL OR empresa_id = 2)
    AND (fecha_baja IS NULL OR fecha_baja > CURRENT_DATE) AND (fecha_creacion IS NULL OR fecha_creacion <= CURRENT_DATE);
"""
cur.execute(query)
res = cur.fetchone()[0]
import json
parsed = json.loads(res)
print("GEOJSON FEATURES COUNT FOR EMPRESA 2:", len(parsed.get('features', [])))

conn.close()

