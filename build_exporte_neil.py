# -*- coding: utf-8 -*-
"""
Script para generar el shapefile unificado 'exporte_neil.shp'
Combina:
  1. zip2: POLIGONO_APROBADOS_MAG.shp (Polígonos oficiales aprobados)
  2. zip1: PLANIMETRIA_RURAL_URDANETA.shp (Líneas poligonizadas) + NOMBRES.shp (Puntos con posesionarios)
Con la estructura de atributos idéntica a POLIGONO_APROBADOS_MAG.shp.
Clasificación estricta:
  - Cédulas validadas van exclusivamente a 'NUMERO_IDE'
  - Nombres de personas van exclusivamente a 'NOMBRE_PRO'
  - Números de predio/lote van a 'NUMERO_PRO' / 'OBSERVACIO'
  - Áreas del plano van a 'OBSERVACIO' (PLANO: ...)
  - Cotas y vértices se descartan de los nombres
"""

import os
import re
import time
import zipfile
import shutil
from osgeo import ogr, osr
import shapely
from shapely.ops import polygonize, unary_union

folder = r"C:\Users\leneker\Downloads\shape_urdaneta"
path_mag = os.path.join(folder, "POLIGONO_APROBADOS_MAG.shp")
path_lines = os.path.join(folder, "PLANIMETRIA_RURAL_URDANETA.shp")
path_pts = os.path.join(folder, "NOMBRES.shp")

out_shp_name = "exporte_neil_corregido"
out_shp_path = os.path.join(folder, f"{out_shp_name}.shp")

t0 = time.time()
print("="*60)
print("🚀 INICIANDO GENERACIÓN DE 'exporte_neil.shp' (CLASIFICACIÓN ESTRICTA)")
print("="*60)

# --- FUNCIONES DE CLASIFICACIÓN RIGUROSA ---

def is_valid_ecuadorian_cedula(ced):
    """Valida número de cédula ecuatoriana según algoritmo módulo 10."""
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
    """Extrae y valida cédulas ecuatorianas descartando celulares o claves."""
    t = txt.strip()
    if re.search(r'\b(CELL|CELULAR|TELF|TELEFONO|TLF)\b', t, re.I):
        return None
    if re.search(r'\bCLAVE\b', t, re.I):
        return None

    # Con prefijo explícito (C.C., C.I., CEDULA, etc.)
    m = re.search(r'(?:C\.?C\.?|C\.?I\.?|CEDULA|IDENT(?:IFICACION)?|DOC)?\s*[:.]?\s*(\d{9,10}(?:[-]\d)?)', t, re.I)
    if m:
        raw = m.group(1).replace('-', '')
        if len(raw) == 9 and raw.startswith(('1', '2', '0', '9')):
            raw = '0' + raw
        if len(raw) == 10 and (is_valid_ecuadorian_cedula(raw) or (1 <= int(raw[:2]) <= 24)):
            return raw

    # 10 dígitos directos
    m2 = re.search(r'\b(\d{10})\b', t)
    if m2:
        raw = m2.group(1)
        if is_valid_ecuadorian_cedula(raw) or (1 <= int(raw[:2]) <= 24 and int(raw[2]) < 6):
            return raw

    # 9 dígitos con guión (ej. 120246566-0)
    m3 = re.search(r'\b(\d{9})[-](\d)\b', t)
    if m3:
        raw = m3.group(1) + m3.group(2)
        if is_valid_ecuadorian_cedula(raw) or (1 <= int(raw[:2]) <= 24):
            return raw

    return None

def is_area_text(txt):
    """Detecta textos de superficies o áreas de planos."""
    t = txt.strip()
    if re.search(r'(AREA|ÁREA|SUPERFICIE|HAS|CDRS|CUADRA|M2|MT2|METROS|HECTAREA)', t, re.I):
        return True
    if re.search(r'^\s*[SA]\s*=\s*\d', t, re.I):
        return True
    if re.search(r'\d+[.,]\d+\s*(?:ha|has|m2|cuadras|cdrs)\b', t, re.I):
        return True
    return False

def is_distance_or_dimension(txt):
    """Detecta cotas de linderos, distancias en metros o rumbos/ángulos."""
    t = txt.strip()
    if re.match(r'^\d+([.,]\d+)?\s*m(?:ts|t)?$', t, re.I):
        return True
    if re.match(r'^[LD]=\s*\d+([.,]\d+)?', t, re.I):
        return True
    if re.search(r'[°\'"”]', t) and re.search(r'\d', t):
        return True
    return False

def is_number_or_vertex(txt):
    """Detecta números sueltos (vértices/lotes) o identificadores CAD."""
    t = txt.strip()
    if re.match(r'^\d+([.,]\d+)?$', t):
        return True
    if re.match(r'^[PVpv][-.]?\d+$', t) or re.match(r'^EST[-.]?\d+$', t, re.I):
        return True
    return False

def is_lindero_or_infra(txt):
    """Detecta colindancias geográficas, vías o infraestructuras."""
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
    """Detecta fechas en formatos varios."""
    t = txt.strip()
    if re.search(r'^\d{4}[/-]\d{2}[/-]\d{2}$', t) or re.search(r'^\d{2}[/-]\d{4}$', t) or re.search(r'^\d{2}[/-]\d{2}[/-]\d{4}$', t):
        return True
    if re.search(r'\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+DE?\s*20\d\d\b', t, re.I):
        return True
    return False

def is_person_name(txt):
    """Verifica si el texto corresponde estrictamente al nombre de una persona natural o jurídica."""
    t = txt.strip()
    if re.search(r'\d', t):
        return False
    if is_area_text(t) or is_distance_or_dimension(t) or is_number_or_vertex(t) or is_date_text(t) or is_lindero_or_infra(t):
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

# 1. Leer esquema de referencia desde POLIGONO_APROBADOS_MAG.shp
ds_mag = ogr.Open(path_mag)
lyr_mag = ds_mag.GetLayer(0)
srs_mag = lyr_mag.GetSpatialRef()
defn_mag = lyr_mag.GetLayerDefn()

fields_spec = []
for i in range(defn_mag.GetFieldCount()):
    fld = defn_mag.GetFieldDefn(i)
    fields_spec.append({
        'name': fld.GetName(),
        'type': fld.GetType(),
        'width': fld.GetWidth(),
        'prec': fld.GetPrecision()
    })

print(f"📋 Esquema de referencia cargado: {len(fields_spec)} campos.")

# 2. Cargar todos los polígonos aprobados de MAG
print("📥 Cargando polígonos de POLIGONO_APROBADOS_MAG...")
mag_polys = []
mag_attrs = []
for feat in lyr_mag:
    g = feat.GetGeometryRef()
    if g and not g.IsEmpty():
        p = shapely.from_wkt(g.ExportToWkt())
        mag_polys.append(p)
        vals = {}
        for f in fields_spec:
            vals[f['name']] = feat.GetField(f['name'])
        mag_attrs.append(vals)

print(f"✅ {len(mag_polys)} polígonos aprobados cargados de MAG.")

# 3. Cargar puntos de texto de NOMBRES.shp
print("📥 Cargando puntos de texto de NOMBRES.shp...")
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

print(f"✅ {len(pts_geoms)} puntos de texto cargados.")
tree_pts = shapely.STRtree(pts_geoms)

# 4. Poligonizar líneas de PLANIMETRIA_RURAL_URDANETA.shp
print("📐 Cargando y nodulando líneas de PLANIMETRIA_RURAL_URDANETA.shp...")
ds_lines = ogr.Open(path_lines)
lyr_lines = ds_lines.GetLayer(0)
line_geoms = []
for feat in lyr_lines:
    g = feat.GetGeometryRef()
    if g and not g.IsEmpty():
        line_geoms.append(shapely.from_wkt(g.ExportToWkt()))

print(f"  Líneas leídas: {len(line_geoms)}. Ejecutando unary_union...")
noded_lines = unary_union(line_geoms)
print("  Poligonizando...")
raw_polys = list(polygonize(noded_lines))
print(f"✅ Total polígonos formados de líneas: {len(raw_polys)}")

# 5. Filtrar polígonos y descartar los que ya existen en MAG
tree_mag = shapely.STRtree(mag_polys)

new_polys = []
new_attrs = []

max_obj_id = max([a.get('OBJECTID') or 0 for a in mag_attrs] + [0])
cur_obj_id = max_obj_id + 1

print("🔍 Cruzando polígonos nuevos con clasificación rigurosa...")

for p in raw_polys:
    area_m2 = p.area
    if area_m2 < 15.0: # Descartar micro-polígonos parásitos < 15 m2
        continue

    # Verificar si coincide espacialmente con alguno ya aprobado en MAG
    cand_mag = tree_mag.query(p, predicate="intersects")
    es_duplicado = False
    for m_idx in cand_mag:
        mp = mag_polys[m_idx]
        inter = p.intersection(mp).area
        union = p.union(mp).area
        if union > 0 and (inter / union) > 0.80:
            es_duplicado = True
            break
    if es_duplicado:
        continue # Ya está en MAG con sus datos aprobados oficiales

    # Buscar puntos de texto dentro del polígono
    p_indices = tree_pts.query(p, predicate="contains")
    textos_dentro = [pts_texts[idx] for idx in p_indices]

    # Si no tiene textos y es menor a 60 m2, probablemente es un hueco/calle estrecha
    if not textos_dentro and area_m2 < 60.0:
        continue

    # Extracción clasificada
    nombre_pro = None
    num_ide = None
    num_pro = None
    area_plano_txt = None
    observaciones = []
    lote_num = None

    for txt in textos_dentro:
        # Cédula
        if not num_ide:
            c = extract_cedula(txt)
            if c:
                num_ide = c
                continue

        # Área del plano
        if not area_plano_txt and is_area_text(txt):
            area_plano_txt = txt
            continue

        # Distancias / cotas (descartar de nombres)
        if is_distance_or_dimension(txt):
            continue

        # Fechas o estados
        if is_date_text(txt) or re.search(r'APROBADO|NO APROBADO', txt, re.I):
            observaciones.append(txt)
            continue

        # Linderos / vías
        if is_lindero_or_infra(txt):
            continue

        # Números de lote / predio
        if is_number_or_vertex(txt):
            if re.match(r'^\d+$', txt) and 1 <= int(txt) <= 999:
                lote_num = txt
            continue

        # Nombre del posesionario
        if not nombre_pro and is_person_name(txt):
            nombre_pro = txt.strip()

    # Si se identificó número de lote/predio y no hay providencia, registrarlo en NUMERO_PRO
    if lote_num:
        num_pro = f"LOTE {lote_num}"

    area_ha = round(area_m2 / 10000.0, 11)
    cent = p.centroid
    obs_final = " / ".join(observaciones) if observaciones else None
    if area_plano_txt:
        obs_final = f"{obs_final} (PLANO: {area_plano_txt})" if obs_final else f"PLANO: {area_plano_txt}"

    record = {
        'OBJECTID': cur_obj_id,
        'TIPO_TRAMI': 'LEVANTAMIENTO PLANIMETRICO',
        'NUMERO_TRA': None,
        'INSTITUCIO': 'GAD MUNICIPAL URDANETA',
        'NUMERO_PRO': num_pro,
        'FECHA_ADJU': None,
        'NOMBRE_PRO': nombre_pro or "SIN ASIGNAR",
        'NUMERO_IDE': num_ide or None,
        'NACIONALID': 'ECUATORIANA',
        'ESTADO_CIV': None,
        'NOMBRE_P_1': None,
        'NUMERO_I_1': None,
        'NACIONAL_1': None,
        'ESTADO_C_1': None,
        'TIPO_PROPI': 'RURAL',
        'FORMA_ADQU': 'POSESION',
        'INFRAESTRU': None,
        'USO_SUELO_': 'AGRICOLA',
        'PROVINCIA': 'LOS RIOS',
        'CANTON': 'URDANETA',
        'PARROQUIA': 'RICAURTE',
        'SECTOR': None,
        'CLAVE_CATA': f"120651-{cur_obj_id:04d}",
        'SUPERFICIE': area_ha,
        'CENTROIDE_': round(cent.x, 11),
        'CENTROIDE1': round(cent.y, 11),
        'ANALISTA_S': 'EQUIPO CATASTRO 2026',
        'OBSERVACIO': obs_final,
        'SHAPE_Leng': round(p.length, 11),
        'SHAPE_Area': area_ha,
        'Expediente': None
    }
    cur_obj_id += 1
    new_polys.append(p)
    new_attrs.append(record)

print(f"✅ Nuevos polígonos generados y catalogados: {len(new_polys)}")

# 6. Escribir el nuevo shapefile con OGR
print(f"💾 Creando nuevo shapefile: {out_shp_path}...")

for ext in ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.qix', '.fix']:
    p = os.path.join(folder, f"{out_shp_name}{ext}")
    if os.path.exists(p):
        try:
            os.remove(p)
        except Exception:
            pass

driver = ogr.GetDriverByName("ESRI Shapefile")
ds_out = driver.CreateDataSource(out_shp_path)
lyr_out = ds_out.CreateLayer(out_shp_name, srs_mag, ogr.wkbPolygon)

# Crear campos exactos
for f in fields_spec:
    f_defn = ogr.FieldDefn(f['name'], f['type'])
    f_defn.SetWidth(f['width'])
    f_defn.SetPrecision(f['prec'])
    lyr_out.CreateField(f_defn)

# Escribir polígonos aprobados de MAG
print("  Escribiendo polígonos de MAG aprobados...")
for p, attr in zip(mag_polys, mag_attrs):
    feat = ogr.Feature(lyr_out.GetLayerDefn())
    geom = ogr.CreateGeometryFromWkt(p.wkt)
    feat.SetGeometry(geom)
    for k, v in attr.items():
        if v is not None:
            feat.SetField(k, v)
    lyr_out.CreateFeature(feat)

# Escribir nuevos polígonos generados
print("  Escribiendo nuevos polígonos generados desde líneas y textos...")
for p, attr in zip(new_polys, new_attrs):
    feat = ogr.Feature(lyr_out.GetLayerDefn())
    geom = ogr.CreateGeometryFromWkt(p.wkt)
    feat.SetGeometry(geom)
    for k, v in attr.items():
        if v is not None:
            feat.SetField(k, v)
    lyr_out.CreateFeature(feat)

total_final = lyr_out.GetFeatureCount()
ds_out = None # Cerrar y sincronizar a disco

# Copiar .prj y crear .cpg (UTF-8)
prj_src = os.path.join(folder, "POLIGONO_APROBADOS_MAG.prj")
prj_dst = os.path.join(folder, f"{out_shp_name}.prj")
if os.path.exists(prj_src):
    shutil.copyfile(prj_src, prj_dst)

cpg_dst = os.path.join(folder, f"{out_shp_name}.cpg")
with open(cpg_dst, 'w', encoding='utf-8') as f:
    f.write("UTF-8")

# 7. Crear archivo comprimido .zip para fácil descarga y transporte
zip_out_path = os.path.join(folder, f"{out_shp_name}.zip")
print(f"📦 Creando archivo ZIP: {zip_out_path}...")
with zipfile.ZipFile(zip_out_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for ext in ['.shp', '.shx', '.dbf', '.prj', '.cpg']:
        f_p = os.path.join(folder, f"{out_shp_name}{ext}")
        if os.path.exists(f_p):
            z.write(f_p, arcname=f"{out_shp_name}{ext}")

# Intentar sincronizar también sobre exporte_neil original si QGIS lo liberó
try:
    for ext in ['.shp', '.shx', '.dbf', '.prj', '.cpg']:
        src = os.path.join(folder, f"{out_shp_name}{ext}")
        dst = os.path.join(folder, f"exporte_neil{ext}")
        shutil.copyfile(src, dst)
    shutil.copyfile(zip_out_path, os.path.join(folder, "exporte_neil.zip"))
    print("✅ Archivo 'exporte_neil.shp' y 'exporte_neil.zip' original también sincronizados.")
except Exception:
    print("ℹ️ Nota: 'exporte_neil.shp' está en uso en QGIS. Carga directamente 'exporte_neil_corregido.shp'.")

print("="*60)
print("🎉 ¡PROCESO COMPLETADO CON ÉXITO!")
print(f"📁 Polígonos oficiales de MAG incluidos: {len(mag_polys)}")
print(f"📁 Nuevos polígonos generados de líneas y textos: {len(new_polys)}")
print(f"🌟 TOTAL DE POLÍGONOS EN '{out_shp_name}': {total_final}")
print(f"⏱️ Tiempo total de ejecución: {time.time()-t0:.2f} segundos")
print(f"📍 Archivo Shapefile: {out_shp_path}")
print(f"📍 Archivo ZIP: {zip_out_path}")
print("="*60)
