# -*- coding: utf-8 -*-
"""
Genera el documento complementario listo para copiar y pegar:
'SECCION_10_APP_MOVIL_PARA_AGREGAR_AL_MANUAL.docx'
Diseñado con tipografía Times New Roman para coincidir al 100% con
el formato de 'MANUAL TECNICO - GEOPORTAL-V1-BORRADOR.doc'.
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, hex_color):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_margins(cell, top=80, bottom=80, left=100, right=100):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(f'<w:tcBorders {nsdecls("w")}/>')
    borders = {'top': top, 'bottom': bottom, 'left': left, 'right': right}
    for b_name, b_val in borders.items():
        if b_val:
            val = b_val.get('val', 'single')
            sz = b_val.get('sz', '4')
            color = b_val.get('color', 'CCCCCC')
            b_elm = parse_xml(f'<w:{b_name} {nsdecls("w")} w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>')
            tcBorders.append(b_elm)
        else:
            b_elm = parse_xml(f'<w:{b_name} {nsdecls("w")} w:val="none"/>')
            tcBorders.append(b_elm)
    tcPr.append(tcBorders)

def format_table(table, col_widths, headers, rows_data):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr_cells = table.rows[0].cells
    for i, h_text in enumerate(headers):
        hdr_cells[i].text = h_text
        set_cell_background(hdr_cells[i], "1E3A8A")
        set_cell_margins(hdr_cells[i], top=100, bottom=100, left=100, right=100)
        set_cell_borders(hdr_cells[i], bottom={'val': 'single', 'sz': '8', 'color': '0F172A'})
        p = hdr_cells[i].paragraphs[0]
        for r in p.runs:
            r.bold = True
            r.font.name = "Times New Roman"
            r.font.size = Pt(10)
            r.font.color.rgb = RGBColor(255, 255, 255)
            
    for r_idx, row_values in enumerate(rows_data):
        row = table.rows[r_idx + 1]
        bg_col = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        for c_idx, val in enumerate(row_values):
            cell = row.cells[c_idx]
            cell.text = str(val)
            set_cell_background(cell, bg_col)
            set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
            set_cell_borders(cell, bottom={'val': 'single', 'sz': '4', 'color': 'E2E8F0'},
                                   top={'val': 'single', 'sz': '4', 'color': 'E2E8F0'})
            p = cell.paragraphs[0]
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(30, 41, 59)
                
    for row in table.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = Inches(width)

def build_seccion_10(output_paths):
    doc = docx.Document()
    
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Encabezado guía
    p_lead = doc.add_paragraph()
    p_lead.paragraph_format.space_after = Pt(4)
    r_lead = p_lead.add_run("ANEXO / CAPÍTULO PARA INTEGRAR AL MANUAL TÉCNICO EXISTENTE:")
    r_lead.bold = True
    r_lead.font.name = "Times New Roman"
    r_lead.font.size = Pt(10)
    r_lead.font.color.rgb = RGBColor(100, 116, 139)

    # TÍTULO DEL CAPÍTULO 10
    p_h1 = doc.add_paragraph()
    p_h1.paragraph_format.space_before = Pt(8)
    p_h1.paragraph_format.space_after = Pt(6)
    r_h1 = p_h1.add_run("10. Módulo de Campo y Aplicativo Móvil Nativo Android (CatastroMovil2026.apk)")
    r_h1.bold = True
    r_h1.font.name = "Times New Roman"
    r_h1.font.size = Pt(14)
    r_h1.font.color.rgb = RGBColor(30, 58, 138)

    p_intro = doc.add_paragraph(
        "El módulo de campo del Geoportal Catastral 2026 está constituido por la aplicación móvil nativa "
        "Catastro Móvil ECC (distribuida oficialmente como CatastroMovil2026.apk en la ruta C:\\LNCZ\\proyecto-catastro-2026\\movil\\CatastroMovil2026.apk). "
        "Desarrollada sobre la arquitectura Capacitor 8.5.2 + React 19.2 + Vite 8.1, la aplicación ha sido diseñada bajo el paradigma "
        "Offline-First estricto, permitiendo a técnicos municipales y brigadistas topográficas levantar predios urbanos y rurales "
        "en sectores sin cobertura de telefonía celular o en condiciones climáticas agrestes, garantizando almacenamiento local "
        "indestructible (Cero Pérdida) y sincronización fluida y transparente con el backend PostgreSQL/PostGIS al retornar a conectividad."
    )
    p_intro.paragraph_format.line_spacing = 1.15
    p_intro.paragraph_format.space_after = Pt(8)
    for r in p_intro.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(11)

    # 10.1 FICHA TÉCNICA Y RUNTIME
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.1 Ficha Técnica y Runtime del Aplicativo Móvil")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    t_specs = doc.add_table(rows=8, cols=3)
    format_table(
        t_specs,
        col_widths=[1.7, 1.8, 3.0],
        headers=["Componente / Parámetro", "Valor Oficial", "Descripción y Rol en el Sistema"],
        rows_data=[
            ("Nombre Oficial APK", "Catastro Móvil ECC 2026 (CatastroMovil2026.apk)", "Binario de distribución nativa para tabletas y smartphones Android."),
            ("Identificador de Paquete", "com.gad.catastromovil.ecc", "Identificador único de aplicación (App ID) en Android OS."),
            ("Versión y Código", "v4.7.6 | versionCode: 46", "Compilación de producción sincronizada con la base de datos central 2026."),
            ("Soporte de Plataforma", "minSdkVersion: 24 | targetSdkVersion: 34", "Compatible desde Android 7.0 (Nougat) hasta Android 14+."),
            ("Runtime y Shell", "Capacitor 8.5.2 + Android Gradle", "Puente nativo para acceso a hardware: antena GPS precisa, cámara y almacenamiento."),
            ("Cartografía Móvil", "Leaflet 1.9.4 & React-Leaflet 5.0", "Despliegue de capas Google Satelital Híbrido, Esri World Imagery y OSM."),
            ("Motor Geodésico", "Proj4.js 2.20", "Conversión bidireccional instantánea entre EPSG:4326 y EPSG:32717 (UTM 17S Ecuador).")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 10.2 PERSISTENCIA LOCAL OFFLINE-FIRST
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.2 Persistencia Local Offline-First y Garantía Cero Pérdida")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    p_db = doc.add_paragraph(
        "El motor de base de datos local reside en mobileDB.js y se sustenta en IndexedDB mediante la base 'catastro_movil_db' (Versión 2). "
        "Para garantizar Cero Pérdida de mediciones tras largas jornadas de caminata en zonas remotas, la función saveOfflinePredio(predio) "
        "ejecuta una doble escritura simultánea (Dual-Write): persiste el registro en IndexedDB y crea un espejo transaccional en "
        "LocalStorage (clave 'catastro_offline_predios_backup'). La base local está particionada en 4 Object Stores:"
    )
    p_db.paragraph_format.line_spacing = 1.15
    p_db.paragraph_format.space_after = Pt(6)
    for r in p_db.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(11)

    t_stores = doc.add_table(rows=5, cols=3)
    format_table(
        t_stores,
        col_widths=[1.6, 1.6, 3.3],
        headers=["Object Store", "Clave Primaria (keyPath)", "Función de Almacenamiento"],
        rows_data=[
            ("offline_predios", "offline_id (ej: off_171...) (Índices: sync_status, created_at)", "Predios levantados en campo con estado 'pending', 'syncing', 'synced' o 'error', sus vértices UTM, colindantes y fotos."),
            ("cached_predios", "id (ID numérico del servidor)", "Copia local de los predios existentes en el servidor central descargados para visualización offline en el mapa."),
            ("cached_posesionarios", "key (Índice: cedula)", "Directorio de posesionarios de la entidad para búsqueda y autocompletado en la ficha móvil en 0 milisegundos."),
            ("settings", "key (cadena de texto única)", "Parámetros del sistema: URL del backend, token JWT, UUID del dispositivo móvil y modo de sincronización.")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 10.3 MOTOR GEODÉSICO Y TOPOGRÁFICO
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.3 Motor Geodésico y Topográfico Planar en Campo (EPSG:32717)")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    p_geo = doc.add_paragraph(
        "A diferencia de visores móviles convencionales que envían las coordenadas al backend para calcular métricas, "
        "Catastro Móvil implementa en geoUtils.js los algoritmos geodésicos compilados en JavaScript:\n"
        "1. Proyección UTM 17S: La función wgs84ToUtm(lng, lat) convierte la señal GPS esferoidal (WGS 84) a coordenadas métricas planas "
        "oficiales del Ecuador (EPSG:32717) con precisión milimétrica mediante Proj4.\n"
        "2. Fórmula de Gauss (Shoelace): La función computePolygonArea(vertices) evalúa el producto cruzado de los vértices planos "
        "para determinar la superficie real en metros cuadrados (m²) y hectáreas (ha) en menos de 1 ms.\n"
        "3. Normalización Oficial NW en Sentido Horario: La función normalizeVerticesClockwiseFromNW() identifica mediante "
        "geometría computacional el vértice más al Nor-Oeste como P01 (maximizando normY - normX) y reordena los puntos subsiguientes "
        "(P02, P03... Pn) en sentido horario estricto, cumpliendo la normativa nacional de catastro.\n"
        "4. Cálculo de Acimut y Rumbo: La función calculateRumbo() traduce el azimut geodésico a notación cuadrantal topográfica (ej: N 42° 15' E)."
    )
    p_geo.paragraph_format.line_spacing = 1.15
    p_geo.paragraph_format.space_after = Pt(8)
    for r in p_geo.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(11)

    # 10.4 PROTOCOLO DE RED Y SINCRONIZACIÓN
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.4 Protocolo de Red, Endpoints y Sincronización Bidireccional")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    t_api = doc.add_table(rows=6, cols=3)
    format_table(
        t_api,
        col_widths=[1.8, 1.4, 3.3],
        headers=["Endpoint Consumido", "Método HTTP", "Operación y Tratamiento Móvil"],
        rows_data=[
            ("/api/token", "POST (Form)", "Autenticación de técnicos institucionales y emisión de JWT firmado."),
            ("/api/login-brigadista", "POST (JSON)", "Registro rápido de brigadistas temporales con Nombre, Apellido y UUID de dispositivo."),
            ("/api/gis/predios", "GET / POST", "Descarga de predios en masa y subida de nuevos polígonos vectoriales en GeoJSON."),
            ("/api/gis/predios/verificar-conflicto", "POST (JSON)", "Verificación de colisión territorial previa antes de escribir en base de datos."),
            ("/api/gis/posesionarios/buscar/{cedula}", "GET", "Consulta remota en tiempo real de posesionarios preexistentes.")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    p_conf = doc.add_paragraph(
        "Resolución Interactiva de Conflictos: Si durante la sincronización el código catastral ya existe en el servidor central, "
        "el aplicativo presenta una ventana SweetAlert2 con los datos del servidor (Área, Posesionario, Creador) y ofrece tres opciones: "
        "1) Sobreescribir el registro del servidor con el nuevo levantamiento (PUT /api/gis/predios/{id}), "
        "2) Conservar el registro del servidor y omitir la subida, o "
        "3) Asignar en el acto un nuevo código catastral y reenviar como predio nuevo."
    )
    p_conf.paragraph_format.line_spacing = 1.15
    p_conf.paragraph_format.space_after = Pt(8)
    for r in p_conf.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(11)

    # 10.5 SEGURIDAD Y LICENCIAMIENTO
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.5 Seguridad, Licenciamiento de Brigadistas y Modo Offline Extremo")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    p_sec = doc.add_paragraph(
        "Para operadores de campo contratados por temporadas, Catastro Móvil cuenta con el 'Modo Brigadista'. "
        "El operador ingresa únicamente su Nombre y Apellido sin contraseña; el sistema genera un UUID único de hardware "
        "(device_uuid) persistido en settings y vincula sus levantamientos a un operador_temporal_id en la base de datos central. "
        "Si la brigada enciende el equipo en una zona sin cobertura celular, el sistema activa automáticamente una sesión "
        "offline local ('offline_brigadista_...'), permitiendo trabajar sin restricciones y asociando automáticamente "
        "los predios levantados a la empresa y proyecto correspondiente al regresar a la oficina."
    )
    p_sec.paragraph_format.line_spacing = 1.15
    p_sec.paragraph_format.space_after = Pt(8)
    for r in p_sec.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(11)

    # 10.6 MANUAL DE OPERACIÓN EN CAMPO
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.6 Manual de Operación en Campo (Paso a Paso para Brigadistas)")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    steps = [
        "1. Instalación del APK: Copiar CatastroMovil2026.apk al dispositivo Android, habilitar 'Instalar apps desconocidas' y conceder permisos de Ubicación Precisa (GPS), Cámara y Almacenamiento.",
        "2. Preparación en Oficina: Antes de salir a campo, ingresar a la pestaña Ajustes con conexión a internet y pulsar 'Descargar Predios del Servidor'. Esto almacena en la memoria del teléfono los predios y el catálogo de posesionarios de la entidad.",
        "3. Levantamiento Perimétrico con GPS ('Modo Caminar'): En la pestaña Mapa, verificar que la barra superior marque 'GPS Fix' en verde (< 5 m de precisión). Abrir la barra de dibujo, presionar 'Caminar Perímetro', situarse en el primer vértice y pulsar '+ Capturar Vértice'. Caminar por el lindero hasta el siguiente punto y capturar P02 (mostrando la cota métrica en vivo). Recorrer el lote en sentido horario hasta retornar al punto de partida.",
        "4. Generación de Ficha: Presionar 'Finalizar y Crear Ficha'. El sistema calcula el área y perímetro, desglosa los tramos (P01 ➔ P02, P02 ➔ P03...) y solicita clave catastral, cédula del posesionario (con búsqueda instantánea en 0 ms) y colindantes.",
        "5. Emisión de Certificado Planimétrico Móvil: Desde la ficha o tocando el predio en mapa, pulsar 'Ver Reporte Planimétrico' para generar la lámina técnica con cuadrícula UTM oficial, cuadro de rumbos y distancias y código QR institucional.",
        "6. Sincronización al Servidor Central: Al regresar a oficina o contar con red Wi-Fi/4G, ir a la pestaña 'Sincronizar' y presionar 'Sincronizar Todos'."
    ]
    for st in steps:
        p_st = doc.add_paragraph(st)
        p_st.paragraph_format.line_spacing = 1.15
        p_st.paragraph_format.space_after = Pt(4)
        for r in p_st.runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(10.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # 10.7 PIPELINE DE COMPILACIÓN
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.7 Pipeline de Compilación y Generación del APK (build_apk.js)")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    p_build = doc.add_paragraph(
        "El aplicativo móvil dispone de una cadena de compilación completamente desacoplada y portable "
        "mediante el script build_apk.js (ejecutado con 'npm run build:apk' en la carpeta movil). "
        "No requiere configurar variables globales ni tener Android Studio instalado, ya que utiliza el JDK 21 "
        "y el Android SDK portable alojados en movil/tools/:\n"
        "Fase 0: Limpieza de capacitor.config.json para asegurar empaquetado 100% offline.\n"
        "Fase 1: Compilación web de producción con Vite 8 (npm run build).\n"
        "Fase 2: Sincronización de assets estáticos a la carpeta nativa (npx cap sync android).\n"
        "Fase 3: Compilación del binario nativo con Gradle (.\\gradlew.bat assembleDebug --no-daemon).\n"
        "Fase 4: Copia automática del APK a CatastroMovil2026.apk y versionado en Versiones/CatastroMovil2026_{version}.apk."
    )
    p_build.paragraph_format.line_spacing = 1.15
    p_build.paragraph_format.space_after = Pt(8)
    for r in p_build.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(10.5)

    # 10.8 GUÍA DE TROUBLESHOOTING
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(10)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("10.8 Guía de Diagnóstico y Resolución de Problemas (Troubleshooting)")
    r_h2.bold = True
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(14, 116, 144)

    t_trb = doc.add_table(rows=6, cols=3)
    format_table(
        t_trb,
        col_widths=[1.8, 1.8, 2.9],
        headers=["Incidencia Observada", "Causa Probable", "Acción de Corrección"],
        rows_data=[
            ("Precisión GPS en rojo (> 15 m)", "Follaje vegetal denso o modo de ahorro de energía.", "Salir a cielo abierto, activar 'Alta Precisión' en Ajustes de Android y desactivar el ahorro de batería."),
            ("Error HTTP 401 al subir", "Token de sesión JWT expirado.", "Se desplegará una ventana para ingresar contraseña; presionar 'Renovar y Subir' para continuar."),
            ("Lenta respuesta de conexión", "Backend en Render Cloud en estado de reposo (Cold Start).", "Esperar de 15 a 30 segundos mientras despierta el contenedor y verificar con 'Probar Conexión'."),
            ("Predio no visible en Geoportal", "Predio guardado localmente pendiente de sincronización.", "Acceder a la pestaña 'Sincronizar' en el móvil y presionar el botón de subida sobre el predio."),
            ("Extracción física sin internet", "Operación prolongada sin red celular.", "En la pestaña Sincronizar, presionar 'Exportar Backup JSON' para transferir el archivo por cable USB.")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    for p in output_paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        doc.save(p)
        print(f"Documento guardado con éxito en:\n{p}")

if __name__ == '__main__':
    downloads_path = r"C:\Users\leneker\Downloads\SECCION_10_APP_MOVIL_PARA_AGREGAR_AL_MANUAL.docx"
    informes_path = r"C:\LNCZ\proyecto-catastro-2026\informes\SECCION_10_APP_MOVIL_PARA_AGREGAR_AL_MANUAL.docx"
    build_seccion_10([downloads_path, informes_path])
