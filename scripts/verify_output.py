# -*- coding: utf-8 -*-
from osgeo import ogr
import os

shp_path = r"C:\Users\leneker\Downloads\shape_urdaneta\exporte_neil_corregido.shp"
ds = ogr.Open(shp_path)
lyr = ds.GetLayer(0)

print(f"Total features in exporte_neil_corregido: {lyr.GetFeatureCount()}")

# Ver features del 915 al 940 (donde terminan los de MAG e inician los poligonizados nuevos)
samples = []
for i, feat in enumerate(lyr):
    if 915 <= i <= 935:
        samples.append({
            'FID': i,
            'NOMBRE_PRO': feat.GetField('NOMBRE_PRO'),
            'NUMERO_IDE': feat.GetField('NUMERO_IDE'),
            'NUMERO_PRO': feat.GetField('NUMERO_PRO'),
            'SUPERFICIE': feat.GetField('SUPERFICIE'),
            'OBSERVACIO': feat.GetField('OBSERVACIO')
        })

for s in samples:
    print(s)
