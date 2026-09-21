# -*- coding: utf-8 -*-
from osgeo import ogr
import re

shp_path = r"C:\Users\leneker\Downloads\shape_urdaneta\exporte_neil_corregido.shp"
ds = ogr.Open(shp_path)
lyr = ds.GetLayer(0)

non_person_samples = []
total_with_name = 0

for feat in lyr:
    nom = feat.GetField('NOMBRE_PRO')
    if nom and nom != 'SIN ASIGNAR':
        total_with_name += 1
        # Check if contains numbers, or is an area or infra word
        if re.search(r'\d', nom) or re.search(r'\b(AREA|SUPERFICIE|HAS?|M2|MT2|CUADRA|CDR|LOTE|SOLAR|MANZANA|ESTERO|RIO|VIA|CAMINO)\b', nom, re.I) or len(nom.split()) < 2:
            non_person_samples.append((feat.GetField('OBJECTID'), nom))

print(f"Total with name: {total_with_name}")
print(f"Found non-person or suspicious: {len(non_person_samples)}")
for fid, n in non_person_samples[:30]:
    print(f"  OID {fid}: {repr(n)}")
