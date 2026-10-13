import psycopg2
conn=psycopg2.connect('postgresql://postgres:L3n3k3rx98.@catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com:5432/catastro-db')
cur=conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='catastro' AND table_name='empresa'")
print("COLS:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT id, nombre, logo_url FROM catastro.empresa")
print("EMPRESAS:", cur.fetchall())
