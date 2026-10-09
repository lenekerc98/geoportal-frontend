import psycopg2

DATABASE_URL = "postgresql://postgres:L3n3k3rx98.@catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com:5432/catastro-db"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("=== CHECKING ALL TABLES FOR CONSTRUCCIONES / BLOQUES / EDIFICACIONES ===")

cur.execute("""
    SELECT table_schema, table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema IN ('catastro', 'public') 
      AND (
        column_name ILIKE '%construc%' 
        OR column_name ILIKE '%edifica%' 
        OR column_name ILIKE '%bloque%' 
        OR column_name ILIKE '%piso%' 
        OR column_name ILIKE '%mejora%'
        OR table_name ILIKE '%construc%'
        OR table_name ILIKE '%edifica%'
        OR table_name ILIKE '%bloque%'
      )
    ORDER BY table_schema, table_name, column_name;
""")

results = cur.fetchall()
if results:
    for row in results:
        print(f"Schema: {row[0]}, Table: {row[1]}, Column: {row[2]}")
else:
    print("No direct columns matching construc/edifica/bloque found.")

print("\n=== CHECKING capas_adicionales ===")
cur.execute("SELECT id, nombre_capa, tabla_db, tipo_geometria, empresa_id FROM catastro.capas_adicionales;")
for r in cur.fetchall():
    print(r)

print("\n=== CHECKING capas_cad_cartas DISTINCT LAYERS ===")
cur.execute("SELECT capa_cad, tipo_geometria, count(*) FROM catastro.capas_cad_cartas GROUP BY capa_cad, tipo_geometria ORDER BY count(*) DESC;")
for r in cur.fetchall():
    if any(k in r[0].upper() for k in ['EDIF', 'CONST', 'BLOQ', 'CASA', 'VIV', 'POLIG', 'PRED']):
        print("POTENTIAL MATCH:", r)

print("\n=== CHECKING STG AND SHAPE TABLES ===")
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'catastro' AND (table_name LIKE 'shape_%' OR table_name LIKE 'stg_%');
""")
for r in cur.fetchall():
    t = r[0]
    cur.execute(f'SELECT count(*) FROM catastro."{t}";')
    cnt = cur.fetchone()[0]
    cur.execute(f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'catastro' AND table_name = '{t}' LIMIT 15;
    """)
    cols = [c[0] for c in cur.fetchall()]
    print(f"{t} (count: {cnt}): {cols}")

cur.close()
conn.close()
