# -*- coding: utf-8 -*-
from osgeo import ogr
import os
import re
import shapely
from shapely.ops import polygonize, unary_union

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"
path_mag = os.path.join(folder, "POLIGONO_APROBADOS_MAG.shp")
path_lines = os.path.join(folder, "PLANIMETRIA_RURAL_URDANETA.shp")
path_pts = os.path.join(folder, "NOMBRES.shp")

def is_valid_ecuadorian_cedula(ced):
    if not (isinstance(ced, str) and len(ced) == 10 and ced.isdigit()):
        return False
    prov = int(ced[:2])
    if not (1 <= prov <= 24 or prov == 30):
        return False
    tercer = int(ced[2])
    if tercer >= 6:
        return False
    coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    suma = 0
    for i in range(9):
        val = int(ced[i]) * coeficientes[i]
        if val >= 10:
            val -= 9
        suma += val
    digito_verificador = (10 - (suma % 10)) % 10
    return digito_verificador == int(ced[9])

def extract_cedula(txt):
    t = txt.strip()
    if re.search(r'\b(CELL|CELULAR|TELF|TELEFONO|TLF)\b', t, re.I):
        return None
    if re.search(r'\bCLAVE\b', t, re.I):
        return None
        
    # Explicit CEDULA / C.C. / C.I.
    m = re.search(r'(?:C\.?C\.?|C\.?I\.?|CEDULA|IDENT(?:IFICACION)?|DOC)?\s*[:.]?\s*(\d{9,10}(?:[-]\d)?)', t, re.I)
    if m:
        raw = m.group(1).replace('-', '')
        if len(raw) == 9 and raw.startswith(('1', '2', '0', '9')):
            raw = '0' + raw
        if len(raw) == 10 and (is_valid_ecuadorian_cedula(raw) or (1 <= int(raw[:2]) <= 24)):
            return raw
            
    # Plain 10 digits
    m2 = re.search(r'\b(\d{10})\b', t)
    if m2:
        raw = m2.group(1)
        if is_valid_ecuadorian_cedula(raw) or (1 <= int(raw[:2]) <= 24 and int(raw[2]) < 6):
            return raw
            
    # 9 digits with hyphen
    m3 = re.search(r'\b(\d{9})[-](\d)\b', t)
    if m3:
        raw = m3.group(1) + m3.group(2)
        if is_valid_ecuadorian_cedula(raw) or (1 <= int(raw[:2]) <= 24):
            return raw
            
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

def is_distance_or_dimension(txt):
    t = txt.strip()
    # e.g. 30.0m, 201.10m, 12.5 m, 45°12'15", L=15.20
    if re.match(r'^\d+([.,]\d+)?\s*m(?:ts|t)?$', t, re.I):
        return True
    if re.match(r'^[LD]=\s*\d+([.,]\d+)?', t, re.I):
        return True
    if re.search(r'[°\'"”]', t) and re.search(r'\d', t):
        return True
    return False

def is_number_or_vertex(txt):
    t = txt.strip()
    # Pure numbers (e.g. 1, 2, 3, 4, 5, 6, 25, 0.45)
    if re.match(r'^\d+([.,]\d+)?$', t):
        return True
    # Vertex / station labels: P1, V1, EST-1, etc.
    if re.match(r'^[PVpv][-.]?\d+$', t) or re.match(r'^EST[-.]?\d+$', t, re.I):
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
    if len(t) < 4:
        return False
    if is_lindero_or_infra(t) or is_area_text(t) or is_date_text(t) or is_number_or_vertex(t) or is_distance_or_dimension(t):
        return False
    words = [w for w in re.split(r'\s+', t) if len(w) > 1]
    if len(words) >= 2:
        return True
    # Single word like "CEDEÑO" or "PEREZ" if uppercase letters only
    if len(words) == 1 and len(t) >= 5 and t.isupper():
        return True
    return False

# Cargar puntos
ds_pts = ogr.Open(path_pts)
lyr_pts = ds_pts.GetLayer(0)
pts_geoms = []
pts_texts = []
for feat in lyr_pts:
    g = feat.GetGeometryRef()
    t = str(feat.GetField("Text") or feat.GetField("plaintext") or "").strip()
    if g and t:
        pts_geoms.append(shapely.Point(g.GetX(), g.GetY()))
        pts_texts.append(t)

tree_pts = shapely.STRtree(pts_geoms)

# Cargar MAG
ds_mag = ogr.Open(path_mag)
lyr_mag = ds_mag.GetLayer(0)
mag_polys = []
for feat in lyr_mag:
    g = feat.GetGeometryRef()
    if g and not g.IsEmpty():
        mag_polys.append(shapely.from_wkt(g.ExportToWkt()))
tree_mag = shapely.STRtree(mag_polys)

# Cargar líneas
ds_lines = ogr.Open(path_lines)
lyr_lines = ds_lines.GetLayer(0)
line_geoms = []
for feat in lyr_lines:
    g = feat.GetGeometryRef()
    if g and not g.IsEmpty():
        line_geoms.append(shapely.from_wkt(g.ExportToWkt()))

noded = unary_union(line_geoms)
polys = list(polygonize(noded))
print(f"Total raw polys: {len(polys)}")

assigned_names = 0
assigned_cedulas = 0
assigned_areas = 0
unassigned_polys = 0

suspicious_names = []

for p in polys:
    if p.area < 15.0:
        continue
    # Duplicado MAG check
    cand = tree_mag.query(p, predicate="intersects")
    dup = False
    for idx in cand:
        mp = mag_polys[idx]
        inter = p.intersection(mp).area
        union = p.union(mp).area
        if union > 0 and (inter / union) > 0.80:
            dup = True
            break
    if dup:
        continue

    # Puntos dentro
    pt_indices = tree_pts.query(p, predicate="contains")
    texts = [pts_texts[i] for i in pt_indices]
    if not texts and p.area < 60.0:
        continue

    nombre = None
    cedula = None
    area_txt = None
    obs = []
    lote_num = None

    for t in texts:
        # Cédula
        if not cedula:
            c = extract_cedula(t)
            if c:
                cedula = c
                continue

        # Área
        if not area_txt and is_area_text(t):
            area_txt = t
            continue

        # Distancias / cotas
        if is_distance_or_dimension(t):
            continue

        # Fechas / estados
        if is_date_text(t) or re.search(r'APROBADO|NO APROBADO', t, re.I):
            obs.append(t)
            continue

        # Linderos / vías
        if is_lindero_or_infra(t):
            continue

        # Números puros (lotes / vértices)
        if is_number_or_vertex(t):
            if re.match(r'^\d+$', t) and 1 <= int(t) <= 999:
                lote_num = t
            continue

        # Nombre de persona
        if not nombre and is_person_name(t):
            nombre = t.strip()

    if nombre:
        assigned_names += 1
        # Check if suspicious (contains digits, or is an area or distance)
        if re.search(r'\d', nombre) or is_area_text(nombre) or is_distance_or_dimension(nombre) or is_number_or_vertex(nombre):
            suspicious_names.append(nombre)
    else:
        unassigned_polys += 1

    if cedula:
        assigned_cedulas += 1
    if area_txt:
        assigned_areas += 1

print("="*60)
print(f"Polígonos nuevos procesados: {assigned_names + unassigned_polys}")
print(f"✅ Con NOMBRE_PRO asignado: {assigned_names}")
print(f"✅ Con NUMERO_IDE (cédula) asignado: {assigned_cedulas}")
print(f"✅ Con área de plano identificada: {assigned_areas}")
print(f"⚪ Sin nombre (SIN ASIGNAR): {unassigned_polys}")
print(f"❌ Nombres sospechosos (con números, áreas o cotas): {len(suspicious_names)}")
if suspicious_names:
    print("Muestra de sospechosos:", suspicious_names[:10])
print("="*60)
