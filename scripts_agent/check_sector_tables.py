import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    cols = db.execute(text("""
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'catastro' AND column_name ILIKE '%sector%'
        ORDER BY table_name;
    """)).fetchall()
    print("Tables with 'sector' in schema catastro:")
    for c in cols:
        print(f"  {c[0]}.{c[1]} ({c[2]})")
finally:
    db.close()
