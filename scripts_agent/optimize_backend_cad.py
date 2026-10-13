import os

file_path = r'c:\LNCZ\proyecto-catastro-2026\backend\app\routers\gis.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    geom_expr = "ST_Transform(geom, 4326)"
    if simplify and float(simplify) > 0:
        geom_expr = f"ST_Transform(ST_SimplifyPreserveTopology(geom, {float(simplify)}), 4326)"'''

replacement = '''    geom_expr = "ST_Transform(geom, 4326)"
    if simplify and float(simplify) > 0:
        geom_expr = f"ST_Transform(ST_Simplify(geom, {float(simplify)}), 4326)"'''

target2 = '''        if len(_CAD_GEOJSON_CACHE) > 50:
            _CAD_GEOJSON_CACHE.clear()'''

replacement2 = '''        if len(_CAD_GEOJSON_CACHE) > 500:
            _CAD_GEOJSON_CACHE.clear()'''

if target in content:
    content = content.replace(target, replacement, 1)
    if target2 in content:
        content = content.replace(target2, replacement2, 1)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully updated gis.py with fast ST_Simplify and larger cache")
else:
    print("Target not found in gis.py")
