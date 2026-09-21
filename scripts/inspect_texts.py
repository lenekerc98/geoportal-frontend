# -*- coding: utf-8 -*-
from osgeo import ogr
import os

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"

# 1. MAG
ds_mag = ogr.Open(os.path.join(folder, "POLIGONO_APROBADOS_MAG.shp"))
lyr_mag = ds_mag.GetLayer(0)
defn = lyr_mag.GetLayerDefn()
cols = [defn.GetFieldDefn(i).GetName() for i in range(defn.GetFieldCount())]
print("COLS:", cols)
for i, feat in enumerate(lyr_mag):
    if i < 3:
        print("MAG ROW", i, {c: feat.GetField(c) for c in ['OBJECTID', 'NOMBRE_PRO', 'NUMERO_IDE', 'NUMERO_PRO', 'SUPERFICIE'] if c in cols})

# 2. PUNTOS DE TEXTO
ds_pts = ogr.Open(os.path.join(folder, "NOMBRES.shp"))
lyr_pts = ds_pts.GetLayer(0)
defn_pts = lyr_pts.GetLayerDefn()
cols_pts = [defn_pts.GetFieldDefn(i).GetName() for i in range(defn_pts.GetFieldCount())]
print("PTS COLS:", cols_pts)

texts = []
for i, feat in enumerate(lyr_pts):
    t = str(feat.GetField("Text") or feat.GetField("plaintext") or "").strip()
    if t:
        texts.append(t)

print(f"TOTAL TEXTS: {len(texts)}")
print("SAMPLE 40 TEXTS:")
for t in texts[:50]:
    print("  ->", repr(t))
