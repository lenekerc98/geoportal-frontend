# -*- coding: utf-8 -*-
from osgeo import ogr
import os
from collections import Counter

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"
ds_mag = ogr.Open(os.path.join(folder, "POLIGONO_APROBADOS_MAG.shp"))
lyr_mag = ds_mag.GetLayer(0)

num_pro_vals = []
for feat in lyr_mag:
    v = feat.GetField("NUMERO_PRO")
    if v:
        num_pro_vals.append(str(v).strip())

print(f"Total features in MAG: {lyr_mag.GetFeatureCount()}")
print(f"Non-null NUMERO_PRO: {len(num_pro_vals)}")
print("Sample NUMERO_PRO:")
for v in num_pro_vals[:20]:
    print("  ->", repr(v))
