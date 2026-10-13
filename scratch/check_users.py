import psycopg2
conn=psycopg2.connect('postgresql://postgres:L3n3k3rx98.@catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com:5432/catastro-db')
cur=conn.cursor()
cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%user%' OR table_name LIKE '%usu%'")
print("TABLES:", cur.fetchall())
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='usuarios'")
print("COLS:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT username FROM catastro.usuarios LIMIT 5")
print("USERS:", cur.fetchall())
