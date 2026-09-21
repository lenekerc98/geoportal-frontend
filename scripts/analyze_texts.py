# -*- coding: utf-8 -*-
from osgeo import ogr
import os
import re

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"
ds_pts = ogr.Open(os.path.join(folder, "NOMBRES.shp"))
lyr_pts = ds_pts.GetLayer(0)

numbers_only = []
areas = []
cedulas = []
names = []
providencias = []
dates = []
others = []

for feat in lyr_pts:
    t = str(feat.GetField("Text") or feat.GetField("plaintext") or "").strip()
    if not t:
        continue
    
    # Check if purely an integer or float number (like 1, 2, 5, 6, 25, 0.45)
    if re.match(r'^\d+([.,]\d+)?$', t):
        # Could be a cedula if 10 digits
        if len(t) == 10:
            cedulas.append(t)
        elif len(t) == 9 and t.startswith(('9', '1', '2', '0')):
            cedulas.append('0' + t)
        else:
            numbers_only.append(t)
    elif re.search(r'(?:C\.?C\.?|C\.?I\.?|CEDULA)\s*[:.]?\s*(\d{9,10})', t, re.I):
        cedulas.append(t)
    elif re.search(r'(?:ÁREA|AREA|HAS|HA|CUADRAS|M2|MT2)\b', t, re.I) or re.search(r'\d+[.,]\d+\s*(?:Ha|Has|m2|M2)', t):
        areas.append(t)
    elif re.search(r'^\d{4}[/-]\d{2}[/-]\d{2}$|^\d{2}[/-]\d{4}$|^\d{2}[/-]\d{2}[/-]\d{4}$', t):
        dates.append(t)
    elif re.search(r'^[0-9]{4}[A-Za-z][0-9]{5}$', t): # e.g. 1402R00062
        providencias.append(t)
    else:
        # Check if text looks like a person's name: mostly letters, at least 2 words, no numbers
        has_digits = bool(re.search(r'\d', t))
        words = t.split()
        if not has_digits and len(words) >= 2 and not re.search(r'\b(ESTERO|RIO|CAMINO|VIA|CARRETERO|ZANJA|QUEBRADA|CALLE|APROBADO|NORTE|SUR|ESTE|OESTE|LOTE|MANZANA|SOLAR)\b', t, re.I):
            names.append(t)
        else:
            others.append(t)

print(f"Total points: {lyr_pts.GetFeatureCount()}")
print(f"Numbers only (vertices/lots): {len(numbers_only)} -> sample: {numbers_only[:15]}")
print(f"Cedulas: {len(cedulas)} -> sample: {cedulas[:15]}")
print(f"Areas: {len(areas)} -> sample: {areas[:15]}")
print(f"Dates: {len(dates)} -> sample: {dates[:10]}")
print(f"Providencias / Trámites: {len(providencias)} -> sample: {providencias[:10]}")
print(f"Names: {len(names)} -> sample: {names[:20]}")
print(f"Others: {len(others)} -> sample: {others[:25]}")
