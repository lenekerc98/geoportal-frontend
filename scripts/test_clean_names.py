# -*- coding: utf-8 -*-
from osgeo import ogr
import os
import re

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"
ds_pts = ogr.Open(os.path.join(folder, "NOMBRES.shp"))
lyr_pts = ds_pts.GetLayer(0)

def is_area_text(txt):
    t = txt.strip()
    if re.search(r'(AREA|ÁREA|SUPERFICIE|HAS|HA|CDRS|CUADRA|M2|MT2|METROS|HECTAREA)', t, re.I):
        return True
    if re.search(r'^\s*[SA]\s*=\s*\d', t, re.I):
        return True
    if re.search(r'\d+[.,]\d+\s*(?:ha|has|m2|cuadras|cdrs)\b', t, re.I):
        return True
    return False

def is_distance_or_dimension(txt):
    t = txt.strip()
    if re.match(r'^\d+([.,]\d+)?\s*m(?:ts|t)?$', t, re.I):
        return True
        
    if re.match(r'^[LD]=\s*\d+([.,]\d+)?', t, re.I):
        return True
    if re.search(r'[°\'"”]', t) and re.search(r'\d', t):
        return True
    return False

def is_number_or_vertex(txt):
    t = txt.strip()
    if re.match(r'^\d+([.,]\d+)?$', t):
        return True
    if re.match(r'^[PVpv][-.]?\d+$', t) or re.match(r'^EST[-.]?\d+$', t, re.I):
        return True
    return False

def is_date_text(txt):
    t = txt.strip()
    if re.search(r'^\d{4}[/-]\d{2}[/-]\d{2}$', t) or re.search(r'^\d{2}[/-]\d{4}$', t) or re.search(r'^\d{2}[/-]\d{2}[/-]\d{4}$', t):
        return True
    if re.search(r'\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b', t, re.I):
        return True
    return False

def is_person_name(txt):
    t = txt.strip()
    if re.search(r'\d', t):
        return False
    if is_area_text(t) or is_distance_or_dimension(t) or is_number_or_vertex(t) or is_date_text(t):
        return False
    cad_keywords = [
        r'\bAREA\b', r'\bÁREA\b', r'\bSUPERFICIE\b', r'\bACTUALIZAD[OA]\b', r'\bNOMBRE[S]?\b',
        r'\bAPROBADO\b', r'\bNO APROBADO\b', r'\bPLANIMETR[IÍ]A\b', r'\bPLANO\b', r'\bCROQUIS\b',
        r'\bLEVANTAMIENTO\b', r'\bOBSERVACI[OÓ]N\b', r'\bCUADRO\b', r'\bESCALA\b', r'\bFECHA\b',
        r'\bFIRMA\b', r'\bRESPONSABLE\b', r'\bLAMINA\b', r'\bHOJA\b', r'\bLINDERO\b', r'\bNORTE\b',
        r'\bSUR\b', r'\bESTE\b', r'\bOESTE\b', r'\bLOTE\b', r'\bMANZANA\b', r'\bSOLAR\b', r'\bPOL[IÍ]GONO\b',
        r'\bESTERO\b', r'\bRIO\b', r'\bR[IÍ]O\b', r'\bZANJA\b', r'\bQUEBRADA\b', r'\bCALLE\b',
        r'\bCALLEJ[OÓ]N\b', r'\bPASACALLE\b', r'\bCANAL\b', r'\bDRENAJE\b', r'\bPOZA\b', r'\bREPRESA\b',
        r'\bPUENTE\b', r'\bGUARDARRAYA\b', r'\bCARRETER[OA]\b', r'\bV[IÍ]A\b', r'\bS/N\b', r'\bCELULAR\b', r'\bTELF\b'
    ]
    for pat in cad_keywords:
        if re.search(pat, t, re.I):
            return False

    words = [w for w in re.split(r'\s+', t) if len(w) > 1 and w.isalpha()]
    if len(words) >= 2:
        return True
    return False

matched = []
for feat in lyr_pts:
    t = str(feat.GetField("Text") or feat.GetField("plaintext") or "").strip()
    if is_person_name(t):
        matched.append(t)

print(f"Total points: {lyr_pts.GetFeatureCount()}")
print(f"Valid person names found: {len(matched)}")
print("Sample 30 names:")
for m in matched[:30]:
    print("  ->", repr(m))
