# -*- coding: utf-8 -*-
from osgeo import ogr
import os
from collections import Counter

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"
ds_pts = ogr.Open(os.path.join(folder, "NOMBRES.shp"))
lyr_pts = ds_pts.GetLayer(0)

layer_counts = Counter()
samples_per_layer = {}

for feat in lyr_pts:
    layer_name = str(feat.GetField("Layer") or "UNKNOWN").strip()
    layer_counts[layer_name] += 1
    t = str(feat.GetField("Text") or feat.GetField("plaintext") or "").strip()
    if layer_name not in samples_per_layer:
        samples_per_layer[layer_name] = []
    if len(samples_per_layer[layer_name]) < 8 and t:
        samples_per_layer[layer_name].append(t)

print("DISTINCT LAYERS IN NOMBRES.shp:")
for l, cnt in layer_counts.most_common():
    print(f"Layer: '{l}' (count: {cnt})")
    print(f"   samples: {samples_per_layer[l]}")
