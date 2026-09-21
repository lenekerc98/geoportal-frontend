# -*- coding: utf-8 -*-
from osgeo import ogr
import os
import re

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"
ds_pts = ogr.Open(os.path.join(folder, "NOMBRES.shp"))
lyr_pts = ds_pts.GetLayer(0)

def extract_cedula(txt):
    m = re.search(r'(?:C\.?C\.?|C\.?I\.?|CEDULA|IDENT(?:IFICACION)?|DOC)?\s*[:.]?\s*(\d{9,10}(?:[-]\d)?)', txt, re.I)
    if m:
        raw = m.group(1).replace('-', '')
        if len(raw) == 9 and raw.startswith(('1', '2', '0', '9')):
            raw = '0' + raw
        if len(raw) == 10:
            return raw
    m2 = re.search(r'\b(\d{10})\b', txt)
    if m2:
        return m2.group(1)
    m3 = re.search(r'\b(\d{9})[-](\d)\b', txt)
    if m3:
        return m3.group(1) + m3.group(2)
    return None

def is_area_text(txt):
    t = txt.strip()
    if re.search(r'\b(AREA|SUPERFICIE|HAS?|CDRS|CUADRAS?|M2|MT2|METROS|HECTAREAS?)\b', t, re.I):
        if re.search(r'\d', t):
            return True
    if re.search(r'^\s*[SA]\s*=\s*\d', t, re.I):
        return True
    if re.search(r'\d+[.,]\d+\s*(?:ha|has|m2|cuadras|cdrs)\b', t, re.I):
        return True
    return False

def is_number_or_cad_code(txt):
    t = txt.strip()
    if re.match(r'^\d+([.,]\d+)?$', t):
        return True
    if re.match(r'^[PVpv][-.]?\d+$', t) or re.match(r'^EST[-.]?\d+$', t, re.I):
        return True
    if re.search(r'[\d°\'"”]+', t) and re.search(r'[°\'"]', t):
        return True
    return False

def is_lindero_or_infra(txt):
    t = txt.strip()
    non_person_keywords = [
        r'\bESTERO\b', r'\bRIO\b', r'\bR[IÍ]O\b', r'\bCAMINO\b', r'\bV[IÍ]A\b', 
        r'\bCARRETER[OA]\b', r'\bGUARDARRAYA\b', r'\bZANJA\b', r'\bQUEBRADA\b', 
        r'\bCALLE\b', r'\bCALLEJ[OÓ]N\b', r'\bPASACALLE\b', r'\bCANAL\b', 
        r'\bDRENAJE\b', r'\bPOZA\b', r'\bREPRESA\b', r'\bPUENTE\b', 
        r'\bAPROBADO\b', r'\bNO APROBADO\b', r'\bLEVANTAMIENTO\b', r'\bPLANIMETR[IÍ]A\b',
        r'\bLINDERO\b', r'\bNORTE\b', r'\bSUR\b', r'\bESTE\b', r'\bOESTE\b',
        r'\bLOTE\b\s*\d*', r'\bMANZANA\b\s*\d*', r'\bSOLAR\b\s*\d*',
        r'\bSECTOR\b', r'\bRECINTO\b', r'\bPARROQUIA\b', r'\bCANTON\b',
        r'\bESC(?:ALA)?[:.]?\s*1[:]\d+', r'\bCUADRO DE DATOS\b', r'\bPOLIGONO\b'
    ]
    for pat in non_person_keywords:
        if re.search(pat, t, re.I):
            return True
    return False

def is_date_text(txt):
    t = txt.strip()
    if re.search(r'^\d{4}[/-]\d{2}[/-]\d{2}$', t) or re.search(r'^\d{2}[/-]\d{4}$', t) or re.search(r'^\d{2}[/-]\d{2}[/-]\d{4}$', t):
        return True
    if re.search(r'\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+DE?\s*20\d\d\b', t, re.I):
        return True
    return False

def is_person_name(txt):
    t = txt.strip()
    if re.search(r'\d', t):
        return False
    if len(t) < 5:
        return False
    if is_lindero_or_infra(t) or is_area_text(t) or is_date_text(t) or is_number_or_cad_code(t):
        return False
    words = [w for w in re.split(r'\s+', t) if len(w) > 1]
    if len(words) >= 2:
        return True
    return False

found_cedulas = []
found_names = []
found_areas = []
discarded_numbers = []
discarded_infras = []
unclassified = []

for feat in lyr_pts:
    t = str(feat.GetField("Text") or feat.GetField("plaintext") or "").strip()
    if not t:
        continue
    
    ced = extract_cedula(t)
    if ced:
        found_cedulas.append((t, ced))
        continue
    
    if is_area_text(t):
        found_areas.append(t)
        continue
    
    if is_number_or_cad_code(t):
        discarded_numbers.append(t)
        continue
    
    if is_lindero_or_infra(t):
        discarded_infras.append(t)
        continue
        
    if is_date_text(t):
        continue
        
    if is_person_name(t):
        found_names.append(t)
        continue
        
    unclassified.append(t)

print(f"Total points evaluated: {lyr_pts.GetFeatureCount()}")
print(f"Found Cedulas: {len(found_cedulas)} (e.g. {found_cedulas[:10]})")
print(f"Found Names: {len(found_names)} (e.g. {found_names[:10]})")
print(f"Found Areas: {len(found_areas)} (e.g. {found_areas[:10]})")
print(f"Discarded Numbers (vertices/lots): {len(discarded_numbers)} (e.g. {discarded_numbers[:10]})")
print(f"Discarded Infras / Linderos: {len(discarded_infras)} (e.g. {discarded_infras[:10]})")
print(f"Unclassified / edge cases: {len(unclassified)} (e.g. {unclassified[:20]})")
