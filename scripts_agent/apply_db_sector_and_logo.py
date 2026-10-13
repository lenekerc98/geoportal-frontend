import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # 1. Add column sector to catastro.predio if not exists
    db.execute(text("ALTER TABLE catastro.predio ADD COLUMN IF NOT EXISTS sector VARCHAR(150);"))
    db.commit()
    print("Column 'sector' added to catastro.predio successfully.")

    # 2. Update catastro.empresa logo_url for Urdaneta (id 2)
    db.execute(text("""
        UPDATE catastro.empresa 
        SET logo_url = '/uploads/empresas/logo_2_logo_urdaneta-removebg-preview.png'
        WHERE id = 2;
    """))
    db.commit()
    print("Updated empresa 2 logo_url to point to existing file logo_2_logo_urdaneta-removebg-preview.png")

    # 3. Check current value
    emp = db.execute(text("SELECT id, nombre, logo_url, bandera_url, sector FROM catastro.empresa WHERE id = 2;")).fetchone()
    print("Empresa 2 now:", emp)

    # 4. Check if any predio already has sector populated or can be populated from empresa or staging
    pred_count = db.execute(text("SELECT count(*) FROM catastro.predio WHERE sector IS NOT NULL;")).scalar()
    print(f"Predios with sector populated: {pred_count}")

finally:
    db.close()
