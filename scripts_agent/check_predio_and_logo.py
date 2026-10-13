import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # 1. Check columns in catastro.predio
    cols = db.execute(text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'catastro' AND table_name = 'predio'
        ORDER BY ordinal_position;
    """)).fetchall()
    print("Columns in catastro.predio:")
    for col in cols:
        print(f"  {col[0]} ({col[1]})")

    # 2. Check catastro.empresa
    empresas = db.execute(text("SELECT id, nombre, logo_url, bandera_url FROM catastro.empresa;")).fetchall()
    print("\nEmpresas:")
    for e in empresas:
        print(f"  ID: {e[0]}, Nombre: {e[1]}")
        print(f"    logo_url: {e[2]}")
        print(f"    bandera_url: {e[3]}")

    # 3. Check sample values of sector in catastro.predio if column exists
    has_sector = any(c[0] == 'sector' for c in cols)
    print(f"\nHas 'sector' column in predio? {has_sector}")
    if has_sector:
        sample_sectors = db.execute(text("SELECT sector, count(*) FROM catastro.predio GROUP BY sector;")).fetchall()
        print("Sample sector counts in predio:", sample_sectors)

finally:
    db.close()
