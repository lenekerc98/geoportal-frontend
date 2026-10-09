import os
import psycopg2
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

# 1. Patch shapefile_service.py
path_shape = r"c:\LNCZ\proyecto-catastro-2026\backend\app\services\shapefile_service.py"
with open(path_shape, "r", encoding="utf-8") as f:
    shape_content = f.read()

old_shape_target = """    # P01: mayor Y (más al norte), y menor X en empate (más a la izquierda)
    best_idx = 0
    best_key = (-round(coords[0][1], 4), round(coords[0][0], 4))
    for idx, (x, y) in enumerate(coords):
        key = (-round(y, 4), round(x, 4))
        if key < best_key:
            best_key = key
            best_idx = idx"""

new_shape_replacement = """    # P01: Vértice Nor-Oeste (NW) de acuerdo a la norma catastral y topográfica.
    # Normalizamos en el Bounding Box: normY maximiza el Norte [0, 1] y normX minimiza el Este [0, 1].
    # Score = normY - normX (el vértice que esté más al norte de izquierda a derecha).
    min_x = min(c[0] for c in coords)
    max_x = max(c[0] for c in coords)
    min_y = min(c[1] for c in coords)
    max_y = max(c[1] for c in coords)
    span_x = (max_x - min_x) if (max_x - min_x) > 1e-6 else 1.0
    span_y = (max_y - min_y) if (max_y - min_y) > 1e-6 else 1.0

    best_idx = 0
    best_score = -float('inf')
    for idx, (x, y) in enumerate(coords):
        norm_x = (x - min_x) / span_x
        norm_y = (y - min_y) / span_y
        score = norm_y - norm_x
        if score > best_score + 1e-5:
            best_score = score
            best_idx = idx
        elif abs(score - best_score) <= 1e-5:
            cur_x, cur_y = coords[best_idx]
            if y > cur_y or (abs(y - cur_y) <= 1e-5 and x < cur_x):
                best_idx = idx"""

if old_shape_target in shape_content:
    shape_content = shape_content.replace(old_shape_target, new_shape_replacement)
    with open(path_shape, "w", encoding="utf-8") as f:
        f.write(shape_content)
    print("SUCCESS: shapefile_service.py patched!")
else:
    print("Warning: old_shape_target not found in shapefile_service.py (may already be patched)")

# 2. Patch gis.py
path_gis = r"c:\LNCZ\proyecto-catastro-2026\backend\app\routers\gis.py"
with open(path_gis, "r", encoding="utf-8") as f:
    gis_content = f.read()

old_gis_target = """    # Lógica de reordenamiento de polígono (P01 más al norte y sentido horario)
    if predio.geom_geojson and predio.geom_geojson.get("type") == "Polygon":
        coords = predio.geom_geojson.get("coordinates", [[]])[0]
        if len(coords) > 1:
            # Eliminar último punto si es igual al primero
            if coords[0] == coords[-1]:
                coords.pop()
            # Encontrar el punto más al norte (max latitud/Y)
            max_y_idx = max(range(len(coords)), key=lambda i: coords[i][1])
            new_coords = coords[max_y_idx:] + coords[:max_y_idx]
            
            # Calcular área signada para verificar sentido horario
            # (Si es > 0, es antihorario, por lo que revertimos)
            def signed_area(pts):
                pts_closed = pts + [pts[0]]
                return sum(pts_closed[i][0] * pts_closed[i+1][1] - pts_closed[i+1][0] * pts_closed[i][1] for i in range(len(pts_closed)-1)) / 2.0
                
            if signed_area(new_coords) > 0:
                # Revertir manteniendo el primero en su lugar
                new_coords = [new_coords[0]] + new_coords[1:][::-1]
                
            new_coords.append(new_coords[0]) # Cerrar
            predio.geom_geojson["coordinates"][0] = new_coords"""

new_gis_replacement = """    # Lógica de reordenamiento de polígono (P01 Nor-Oeste y sentido horario)
    if predio.geom_geojson and predio.geom_geojson.get("type") == "Polygon":
        coords = predio.geom_geojson.get("coordinates", [[]])[0]
        if len(coords) > 2:
            # Eliminar último punto si es igual al primero
            if coords[0] == coords[-1]:
                coords.pop()

            # 1. Asegurar sentido horario (área signada > 0 es antihorario)
            def signed_area(pts):
                pts_c = pts + [pts[0]]
                return sum(pts_c[i][0] * pts_c[i+1][1] - pts_c[i+1][0] * pts_c[i][1] for i in range(len(pts_c)-1)) / 2.0

            if signed_area(coords) > 0:
                coords.reverse()

            # 2. Vértice Nor-Oeste (NW): maximiza normY - normX
            min_x = min(c[0] for c in coords)
            max_x = max(c[0] for c in coords)
            min_y = min(c[1] for c in coords)
            max_y = max(c[1] for c in coords)
            span_x = (max_x - min_x) if (max_x - min_x) > 1e-6 else 1.0
            span_y = (max_y - min_y) if (max_y - min_y) > 1e-6 else 1.0

            best_idx = 0
            best_score = -float('inf')
            for idx, (x, y) in enumerate(coords):
                norm_x = (x - min_x) / span_x
                norm_y = (y - min_y) / span_y
                score = norm_y - norm_x
                if score > best_score + 1e-5:
                    best_score = score
                    best_idx = idx
                elif abs(score - best_score) <= 1e-5:
                    cur_x, cur_y = coords[best_idx]
                    if y > cur_y or (abs(y - cur_y) <= 1e-5 and x < cur_x):
                        best_idx = idx

            new_coords = coords[best_idx:] + coords[:best_idx]
            new_coords.append(new_coords[0]) # Cerrar
            predio.geom_geojson["coordinates"][0] = new_coords"""

if old_gis_target in gis_content:
    gis_content = gis_content.replace(old_gis_target, new_gis_replacement)
    with open(path_gis, "w", encoding="utf-8") as f:
        f.write(gis_content)
    print("SUCCESS: gis.py patched!")
else:
    print("Warning: old_gis_target not found in gis.py (may already be patched)")

# 3. Regenerate topology for predios 2914 and 2913
import sys
sys.path.append(r"c:\LNCZ\proyecto-catastro-2026\backend")
from app.services.shapefile_service import reconstruir_topologia_predio

DB_URL = "postgresql://postgres:L3n3k3rx98.@catastro-db.c09cqw60mwqw.us-east-1.rds.amazonaws.com:5432/catastro-db"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    for pid in [2914, 2913]:
        res = reconstruir_topologia_predio(db, pid)
        db.commit()
        print(f"Predio {pid} reconstruido exitosamente: {res}")
        
        # Consultar nuevo P01
        p01 = db.execute(text("SELECT codigo, coord_x, coord_y FROM catastro.vertice WHERE predio_id = :pid AND codigo = 'P01'"), {"pid": pid}).mappings().first()
        print(f"Nuevo P01 para predio {pid}: {dict(p01) if p01 else 'No encontrado'}")
        
        # Consultar primeros 3 vértices
        primeros = db.execute(text("SELECT codigo, coord_x, coord_y FROM catastro.vertice WHERE predio_id = :pid ORDER BY id ASC LIMIT 3"), {"pid": pid}).mappings().all()
        print(f"Primeros 3 vértices de predio {pid}: {[dict(r) for r in primeros]}")
finally:
    db.close()
