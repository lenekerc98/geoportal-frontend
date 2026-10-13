import sys, os
sys.path.append(r'c:\LNCZ\proyecto-catastro-2026\backend')

from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    cad_extent = db.execute(text("SELECT ST_AsText(ST_Transform(ST_SetSRID(ST_Extent(geom), 32717), 4326)) FROM catastro.capas_cad_cartas;")).scalar()
    print("CAD Extent WGS84:", cad_extent)

    predios_extent = db.execute(text("SELECT ST_AsText(ST_Transform(ST_SetSRID(ST_Extent(geom), 32717), 4326)) FROM catastro.predio WHERE geom IS NOT NULL;")).scalar()
    print("Predios Extent WGS84:", predios_extent)

    # Any predios inside CAD extent?
    inside = db.execute(text("""
        SELECT count(*) 
        FROM catastro.predio p
        WHERE p.geom IS NOT NULL
        AND ST_Intersects(p.geom, (SELECT ST_Extent(c.geom)::geometry FROM catastro.capas_cad_cartas c));
    """)).scalar()
    print("Predios intersecting CAD layer:", inside)

    # Let's get an intersecting predio if any
    sample = db.execute(text("""
        SELECT p.id, p.cod_catastral, ST_AsText(ST_Centroid(ST_Transform(p.geom, 4326)))
        FROM catastro.predio p
        WHERE p.geom IS NOT NULL
        AND ST_Intersects(p.geom, (SELECT ST_Extent(c.geom)::geometry FROM catastro.capas_cad_cartas c))
        LIMIT 1;
    """)).fetchone()
    print("Intersecting predio:", sample)
finally:
    db.close()
