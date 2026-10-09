import sys
from unittest.mock import MagicMock
# Mock osgeo if not installed in this python env
sys.modules['osgeo'] = MagicMock()
sys.modules['osgeo.gdal'] = MagicMock()
sys.modules['osgeo.osr'] = MagicMock()

sys.path.append(r"c:\LNCZ\proyecto-catastro-2026\backend")
from app.services.shapefile_service import reconstruir_topologia_predio
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

DB_URL = "postgresql://postgres:L3n3k3rx98.@catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com:5432/catastro-db"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    for pid in [2914, 2913]:
        res = reconstruir_topologia_predio(db, pid)
        db.commit()
        print(f"\n==========================================")
        print(f"Predio {pid} reconstruido exitosamente: {res}")
        
        # Consultar nuevo P01
        p01 = db.execute(text("SELECT codigo, coord_x, coord_y FROM catastro.vertice WHERE predio_id = :pid AND codigo = 'P01'"), {"pid": pid}).mappings().first()
        print(f"--> NUEVO P01 para predio {pid}: {dict(p01) if p01 else 'No encontrado'}")
        
        # Consultar primeros 5 vértices
        primeros = db.execute(text("SELECT codigo, coord_x, coord_y FROM catastro.vertice WHERE predio_id = :pid ORDER BY id ASC LIMIT 5"), {"pid": pid}).mappings().all()
        print(f"Primeros 5 vértices de predio {pid}:")
        for v in primeros:
            print(f"   {v['codigo']}: X={v['coord_x']}, Y={v['coord_y']}")
        
        # Consultar primeros 3 linderos
        linderos = db.execute(text("SELECT tramo, longitud, rumbo FROM catastro.linea_lindero WHERE predio_id = :pid ORDER BY id ASC LIMIT 3"), {"pid": pid}).mappings().all()
        print(f"Primeros 3 linderos de predio {pid}:")
        for l in linderos:
            print(f"   {l['tramo']}: Longitud={l['longitud']}m, Rumbo={l['rumbo']}")
finally:
    db.close()
print("\nTODO COMPLETADO CON ÉXITO!")
