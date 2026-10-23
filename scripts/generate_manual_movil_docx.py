# -*- coding: utf-8 -*-
"""
Generador del Manual Técnico y Operativo Oficial de la Aplicación Móvil
Catastro Móvil 2026 (CatastroMovil2026.apk)
Formato corporativo Microsoft Word (.docx)
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, hex_color):
    """Establece el color de fondo de una celda."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Establece márgenes internos (padding) de celda en twips."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    """Aplica bordes personalizados a una celda."""
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

def add_callout(doc, text, title="NOTA TÉCNICA", border_color="0284C7", bg_color="F0F9FF"):
    """Crea una caja de llamada / alerta técnica corporativa."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=160, bottom=160, left=200, right=200)
    set_cell_borders(cell, left={'val': 'single', 'sz': '24', 'color': border_color})
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    r_title = p.add_run(f"[{title}] ")
    r_title.bold = True
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(10)
    r_title.font.color.rgb = RGBColor.from_string(border_color)
    
    r_text = p.add_run(text)
    r_text.font.name = "Segoe UI"
    r_text.font.size = Pt(9.5)
    r_text.font.color.rgb = RGBColor(51, 65, 85)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def format_table(table, col_widths, headers, rows_data):
    """Formatea una tabla con estilo institucional de alta legibilidad."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Encabezados
    hdr_cells = table.rows[0].cells
    for i, h_text in enumerate(headers):
        hdr_cells[i].text = h_text
        set_cell_background(hdr_cells[i], "1E3A8A")
        set_cell_margins(hdr_cells[i], top=140, bottom=140, left=140, right=140)
        set_cell_borders(hdr_cells[i], bottom={'val': 'single', 'sz': '12', 'color': '0F172A'})
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        for r in p.runs:
            r.bold = True
            r.font.name = "Segoe UI"
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(255, 255, 255)
            
    # Datos
    for r_idx, row_values in enumerate(rows_data):
        row = table.rows[r_idx + 1]
        bg_col = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        for c_idx, val in enumerate(row_values):
            cell = row.cells[c_idx]
            cell.text = str(val)
            set_cell_background(cell, bg_col)
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            set_cell_borders(cell, bottom={'val': 'single', 'sz': '4', 'color': 'E2E8F0'},
                                   top={'val': 'single', 'sz': '4', 'color': 'E2E8F0'})
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for r in p.runs:
                r.font.name = "Segoe UI"
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(30, 41, 59)
                
    # Anchos de columna
    for row in table.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = Inches(width)

def build_mobile_manual(docx_path):
    print(f"Generando manual Word en: {docx_path}")
    doc = docx.Document()
    
    # Configurar márgenes de página (2.0 cm)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        
    # --- ENCABEZADO CON LOGO Y TÍTULOS ---
    logo_path = r"C:\LNCZ\proyecto-catastro-2026\movil\logo_gad.png"
    if os.path.exists(logo_path):
        p_logo = doc.add_paragraph()
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.paragraph_format.space_after = Pt(8)
        run_logo = p_logo.add_run()
        run_logo.add_picture(logo_path, width=Inches(1.8))
        
    # Título Principal
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("MANUAL TÉCNICO Y DE OPERACIÓN DE LA APLICACIÓN MÓVIL")
    r_title.bold = True
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(20)
    r_title.font.color.rgb = RGBColor(30, 58, 138) # 1E3A8A
    
    # Subtítulo
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    r_sub = p_sub.add_run("CATASTRO MÓVIL 2026 – APLICATIVO NATIVO ANDROID (CatastroMovil2026.apk)")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = RGBColor(100, 116, 139) # 64748B
    
    # --- FICHA TÉCNICA DEL APK ---
    t0 = doc.add_table(rows=7, cols=2)
    t0.alignment = WD_TABLE_ALIGNMENT.CENTER
    ficha_data = [
        ("Nombre del Aplicativo Oficial:", "Catastro Móvil ECC 2026 (CatastroMovil2026.apk)"),
        ("Identificador de Paquete (Package ID):", "com.gad.catastromovil.ecc"),
        ("Versión de Compilación y Código:", "Versión 4.7.6 | versionCode 46 (Versión Oficial Producción)"),
        ("Nivel de Plataforma Android:", "minSdkVersion: 24 (Android 7.0+) | targetSdkVersion: 34 (Android 14) | compileSdk: 36"),
        ("Tecnologías y Runtime:", "Capacitor 8.5.2 Nativo + React 19.2 + Vite 8.1 + Leaflet 1.9 + Proj4 2.20"),
        ("Arquitectura de Almacenamiento:", "IndexedDB (idb v2) + Respaldo Espejo LocalStorage (Garantía Cero Pérdida 100% Offline)"),
        ("Sistema de Coordenadas y Datum:", "EPSG:32717 (WGS 84 / UTM Zona 17S Ecuador) <-> EPSG:4326 (WGS 84 Geográficas)")
    ]
    for idx, (label, val) in enumerate(ficha_data):
        row = t0.rows[idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.text = label
        c1.text = val
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "FFFFFF")
        set_cell_margins(c0, top=90, bottom=90, left=120, right=120)
        set_cell_margins(c1, top=90, bottom=90, left=120, right=120)
        set_cell_borders(c0, bottom={'val': 'single', 'sz': '4', 'color': 'E2E8F0'},
                             top={'val': 'single', 'sz': '4', 'color': 'E2E8F0'})
        set_cell_borders(c1, bottom={'val': 'single', 'sz': '4', 'color': 'E2E8F0'},
                             top={'val': 'single', 'sz': '4', 'color': 'E2E8F0'})
        p0, p1 = c0.paragraphs[0], c1.paragraphs[0]
        p0.runs[0].bold = True
        p0.runs[0].font.name = "Segoe UI"
        p0.runs[0].font.size = Pt(9)
        p0.runs[0].font.color.rgb = RGBColor(30, 41, 59)
        p1.runs[0].font.name = "Segoe UI"
        p1.runs[0].font.size = Pt(9)
        p1.runs[0].font.color.rgb = RGBColor(30, 41, 59)
        c0.width = Inches(2.5)
        c1.width = Inches(4.3)
        
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    
    # =========================================================================
    # SECCIÓN 1: INTRODUCCIÓN Y ALCANCE
    # =========================================================================
    h1 = doc.add_heading("1. Introducción y Alcance de Catastro Móvil 2026", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "Catastro Móvil 2026 es la solución de ingeniería de campo oficial concebida para la captura, "
        "actualización, fiscalización y levantamiento territorial georreferenciado en predios urbanos y rurales. "
        "Construida sobre el binomio de vanguardia Capacitor 8 + React 19, la aplicación opera de forma autónoma "
        "bajo el paradigma Offline-First, permitiendo a brigadas topográficas y técnicos municipales levantar predios "
        "en zonas selváticas, rurales o montañosas sin conexión celular, garantizando la persistencia local íntegra "
        "y la sincronización bidireccional inmediata al retornar a cobertura de red."
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)
        
    add_callout(
        doc,
        "El aplicativo móvil compila nativamente como archivo CatastroMovil2026.apk alojado en la ruta oficial C:\\LNCZ\\proyecto-catastro-2026\\movil\\CatastroMovil2026.apk. "
        "Dispone de empaquetado hermético con su propio JDK 21 y Android SDK independientes del sistema operativo.",
        title="UBICACIÓN Y DISTRIBUCIÓN OFICIAL",
        border_color="0284C7",
        bg_color="F0F9FF"
    )
    
    # =========================================================================
    # SECCIÓN 2: ARQUITECTURA DE SOFTWARE Y STACK TECNOLÓGICO
    # =========================================================================
    h1 = doc.add_heading("2. Arquitectura de Software y Stack Tecnológico", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "La arquitectura de Catastro Móvil está estructurada en capas desacopladas que integran servicios nativos "
        "del dispositivo Android con un motor geoespacial de alto rendimiento renderizado en WebView optimizada:"
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)

    # Tabla de Componentes Tecnológicos
    t_stack = doc.add_table(rows=8, cols=3)
    format_table(
        t_stack,
        col_widths=[1.6, 1.8, 3.4],
        headers=["Módulo / Capa", "Tecnología / Librería", "Función Crítica en la Aplicación"],
        rows_data=[
            ("Shell Nativo Android", "Capacitor 8.5.2 / Android Gradle", "Encapsula el motor web, controla ciclo de vida, puente nativo hacia hardware GPS y cámara."),
            ("Motor de Interfaz", "React 19.2 + Vite 8.1", "Renderizado reactivo ultrarrápido a 60 FPS, navegación móvil por pestañas e interactividad táctil."),
            ("Motor Cartográfico", "Leaflet 1.9.4 & React-Leaflet 5.0", "Despliegue de ortofotos satelitales, dibujo vectorial de polígonos, etiquetas métricas e interacción."),
            ("Motor Geodésico", "Proj4.js 2.20", "Conversión bidireccional instantánea entre EPSG:4326 (WGS84 Lat/Lng) y EPSG:32717 (UTM 17S Planar)."),
            ("Almacenamiento Local", "IndexedDB (idb 8.0) + LocalStorage", "Persistencia transaccional de predios levantados, catálogo de posesionarios y configuraciones."),
            ("Iconografía y UI", "Lucide React + SweetAlert2", "Diseño ergonómico para uso con una sola mano en campo bajo radiación solar intensa."),
            ("Protocolo de Red", "Fetch API + AbortController", "Control de timeouts estrictos (6s) y detección de latencia ante cold-start en la nube (Render).")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(10)
    
    # =========================================================================
    # SECCIÓN 3: ALMACENAMIENTO LOCAL Y POLÍTICA DE RESILENCIA CERO PÉRDIDA
    # =========================================================================
    h1 = doc.add_heading("3. Modelo de Datos Local y Resiliencia 'Cero Pérdida'", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "El núcleo de persistencia móvil reside en mobileDB.js y se sustenta en una base de datos IndexedDB denominada "
        "'catastro_movil_db' (Versión 2). La integridad de la información en campo es crítica: la pérdida accidental de "
        "vértices levantados tras horas de caminata bajo condiciones agrestes es inadmisible. Por ello, el sistema "
        "implementa una 'Garantía Cero Pérdida' mediante doble escritura simultánea (Dual-Write) en IndexedDB y LocalStorage."
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)

    # Tabla de Object Stores
    t_stores = doc.add_table(rows=5, cols=3)
    format_table(
        t_stores,
        col_widths=[1.8, 1.6, 3.4],
        headers=["Object Store (Tabla)", "Clave Primaria (keyPath)", "Descripción del Contenido Almacenado"],
        rows_data=[
            ("offline_predios", "offline_id (ej: off_171...) (Índices: sync_status, created_at)", "Predios levantados en campo pendientes o en proceso de sincronización con sus vértices, linderos y fotos."),
            ("cached_predios", "id (identificador numérico del servidor)", "Copia local de los predios existentes en el servidor central descargados para visualización offline en el mapa."),
            ("cached_posesionarios", "key (cédula o clave generada) (Índice: cedula)", "Directorio precargado de posesionarios de la entidad para búsqueda y autocompletado en campo en 0 milisegundos."),
            ("settings", "key (cadena de texto única)", "Parámetros globales: URL del backend, token JWT, UUID del dispositivo, modo de sincronización y proyecto activo.")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_callout(
        doc,
        "La función saveOfflinePredio(predio) ejecuta una transacción asíncrona en IndexedDB y a renglón seguido escribe "
        "el registro en la clave 'catastro_offline_predios_backup' de LocalStorage. Si el navegador o el SO reinicia el storage "
        "por presión de memoria, getOfflinePredios() fusiona automáticamente ambas fuentes garantizando la recuperación del 100% de los datos.",
        title="MECANISMO DE DOBLE ESCRITURA (DUAL-WRITE)",
        border_color="10B981",
        bg_color="F0FDF4"
    )
    
    # =========================================================================
    # SECCIÓN 4: MOTOR MATEMÁTICO, TOPOGRÁFICO Y GEODÉSICO
    # =========================================================================
    h1 = doc.add_heading("4. Motor Matemático, Geodésico y Topográfico de Campo", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "A diferencia de visores móviles convencionales que delegan los cálculos al servidor, Catastro Móvil incorpora "
        "en geoUtils.js un motor matemático compilado en JavaScript que ejecuta en el teléfono los mismos algoritmos "
        "geodésicos del Geoportal central:"
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)

    # Subsecciones de Algoritmos
    algos = [
        ("4.1. Conversión de Coordenadas (EPSG:4326 <-> EPSG:32717)",
         "Las antenas GPS de los teléfonos inteligentes entregan latitud y longitud en grados decimales (Datum WGS 84). "
         "Para cumplir con el marco cartográfico oficial del Ecuador (UTM Zona 17 Sur), la función wgs84ToUtm(lng, lat) "
         "transforma las coordenadas a metros proyectados este (X) y norte (Y) con precisión milimétrica utilizando Proj4. "
         "Esto permite que las mediciones de perímetros y áreas sean rigurosamente planas e inmunes a la distorsión esferoidal."),
        ("4.2. Cálculo de Área Planar Mediante Fórmula del Cordón (Shoelace)",
         "El cálculo de área de polígonos cerrados se realiza con computePolygonArea(vertices), aplicando la sumatoria de Gauss "
         "sobre las coordenadas UTM:\n"
         "Área = 0.5 * | ∑ (Xi * Y(i+1) - X(i+1) * Yi) |\n"
         "El algoritmo computa la superficie en metros cuadrados (m²) y hectáreas (ha) en menos de 1 milisegundo."),
        ("4.3. Algoritmo de Normalización Oficial (Vértice NW y Sentido Horario)",
         "Para acatar la normativa catastral nacional, la función normalizeVerticesClockwiseFromNW(vertices) aplica dos transformaciones:\n"
         "1. Orientación Horaria: Evalúa el signo del área con signo (Signed Area). Si es positivo (antihorario), invierte el arreglo de vértices.\n"
         "2. Identificación del Vértice Nor-Oeste (P01): Normaliza las coordenadas en la caja envolvente (Bounding Box) y "
         "evalúa el índice que maximiza (normY - normX). Dicho vértice es fijado obligatoriamente como P01, y los subsiguientes "
         "se enumeran consecutivamente (P02, P03... Pn) en sentido horario alrededor del predio."),
        ("4.4. Cálculo de Acimut y Rumbo Topográfico Cuadrantal",
         "La función calculateRumbo(dx, dy) obtiene el acimut respecto al norte de cuadrícula y lo transforma a la nomenclatura "
         "clásica de topografía ecuatoriana (NE, SE, SW, NW). Por ejemplo, un segmento de Norte a Este genera la notación: "
         "'N 42° 15' E', mostrándose tanto en la ficha móvil como en el certificado planimétrico.")
    ]
    for sub_title, sub_desc in algos:
        h2 = doc.add_heading(sub_title, level=2)
        h2.paragraph_format.space_before = Pt(10)
        h2.paragraph_format.space_after = Pt(4)
        h2.runs[0].font.name = "Segoe UI"
        h2.runs[0].font.color.rgb = RGBColor(14, 116, 144)
        
        p_desc = doc.add_paragraph(sub_desc)
        p_desc.paragraph_format.line_spacing = 1.15
        p_desc.paragraph_format.space_after = Pt(6)
        for r in p_desc.runs:
            r.font.name = "Segoe UI"
            r.font.size = Pt(9.5)
            
    # =========================================================================
    # SECCIÓN 5: ARQUITECTURA DE SEGURIDAD, AUTENTICACIÓN Y ROLES
    # =========================================================================
    h1 = doc.add_heading("5. Matriz de Seguridad, Autenticación y Roles", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "Catastro Móvil implementa un modelo de seguridad adaptativo que balancea el rigor criptográfico requerido por los "
        "administradores con la agilidad operativa necesaria para brigadistas contratados temporalmente en campo:"
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)

    # Tabla de Roles
    t_roles = doc.add_table(rows=4, cols=3)
    format_table(
        t_roles,
        col_widths=[1.5, 1.8, 3.5],
        headers=["Perfil de Usuario", "Método de Acceso", "Alcance y Permisos en el APK"],
        rows_data=[
            ("Superadmin / Administrador", "Credenciales (Usuario + Contraseña) vía JWT", "Control total: dibujo manual, edición de vértices en mapa, eliminación de predios locales y del servidor, cambio de URL del backend."),
            ("Técnico Geoportal", "Credenciales institucionales vía JWT", "Levantamiento de predios, edición de ficha catastral, descarga de cartografía, subida de predios y consulta de auditoría."),
            ("Brigadista de Campo (Operador)", "Nombre + Apellido (Licencia por Dispositivo)", "Acceso rápido sin clave. Registro automático de operador_temporal_id asociado al UUID único del móvil. Levantamiento perimétrico con GPS y subida a su proyecto asignado.")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_callout(
        doc,
        "Si un brigadista enciende el teléfono en un sector rural sin ninguna señal de internet, el sistema activa automáticamente "
        "el 'Modo Campo Offline'. Genera un token local firmado ('offline_brigadista_...'), asocia los predios al GAD Urdaneta "
        "y almacena el levantamiento en espera de la conexión, sin bloquear jamás la operación del topógrafo.",
        title="RESILIENCIA EN CONDICIONES EXTREMAS",
        border_color="F59E0B",
        bg_color="FEFCE8"
    )

    # =========================================================================
    # SECCIÓN 6: PROTOCOLO DE SINCRONIZACIÓN Y RESOLUCIÓN DE CONFLICTOS
    # =========================================================================
    h1 = doc.add_heading("6. Protocolo de Sincronización y Resolución de Conflictos", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "Al pulsar el botón 'Sincronizar Pendientes' o cuando el modo automático detecta conexión Wi-Fi/4G estable, "
        "se desencadena el siguiente flujo de conciliación territorial en el servicio api.js:"
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)

    # Pasos de sincronización numerados
    steps_sync = [
        "1. Verificación Previa de Conflicto: Antes de enviar la geometría, el móvil consulta /api/gis/predios/verificar-conflicto con la clave catastral ingresada.",
        "2. Interfaz Interactiva de Resolución: Si la clave ya existe en el servidor central (creada por otra brigada o preexistente en el Geoportal), el móvil despliega un modal SweetAlert2 con los datos del servidor (Área, Posesionario, Creador) y ofrece 3 alternativas:",
        "    • Sobreescribir: Reemplaza la geometría y datos del servidor ejecutando un PUT /api/gis/predios/{id}.",
        "    • Conservar Servidor (Omitir): Marca el predio móvil como sincronizado y preserva intacto el registro central.",
        "    • Asignar Nuevo Código: Permite editar en el acto la clave catastral y reenviar el levantamiento como un predio nuevo.",
        "3. Creación Automática de Posesionario: Si la cédula del posesionario no existe en la base central, el APK invoca primero POST /api/gis/posesionarios, obtiene el ID asignado y lo vincula al predio.",
        "4. Cierre Automático de Geometría: Si el polígono tiene 3 o más vértices pero el último punto no coincide con el primero, el móvil agrega el punto de cierre automáticamente garantizando el cumplimiento del estándar OGC GeoJSON Polygon.",
        "5. Renovación Transparente de Sesión: Si el token JWT caducó (Error HTTP 401), se solicita la clave al usuario mediante un modal emergente y se reanuda la cola de subida sin perder ningún dato."
    ]
    for step in steps_sync:
        p_step = doc.add_paragraph(step)
        p_step.paragraph_format.line_spacing = 1.15
        p_step.paragraph_format.space_after = Pt(4)
        for r in p_step.runs:
            r.font.name = "Segoe UI"
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(30, 41, 59)
            
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # =========================================================================
    # SECCIÓN 7: PIPELINE DE COMPILACIÓN DEL APK Y AMBIENTE PORTABLE
    # =========================================================================
    h1 = doc.add_heading("7. Pipeline de Compilación y Generación del APK", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "El proyecto móvil cuenta con una infraestructura de compilación completamente desacoplada y portable. "
        "No requiere instalar Android Studio ni variables de entorno globales en el sistema operativo Windows del desarrollador. "
        "Todo el pipeline se gestiona a través del script build_apk.js ubicado en C:\\LNCZ\\proyecto-catastro-2026\\movil."
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)

    # Tabla de Pasos de Compilación
    t_build = doc.add_table(rows=6, cols=3)
    format_table(
        t_build,
        col_widths=[1.5, 2.0, 3.3],
        headers=["Fase", "Comando / Script Ejecutado", "Detalle de la Operación"],
        rows_data=[
            ("0. Limpieza Config", "Lectura de capacitor.config.json", "Elimina cualquier server.url de desarrollo para forzar empaquetado 100% autónomo y offline."),
            ("1. Compilación Web", "npm run build (Vite 8)", "Minifica el código React 19, genera bundles JS/CSS optimizados y empaqueta en la carpeta dist/."),
            ("2. Sincronización", "npx cap sync android", "Copia los assets estáticos de dist/ dentro de android/app/src/main/assets/public/ y enlaza plugins."),
            ("3. Compilación Gradle", ".\\gradlew.bat assembleDebug", "Utiliza JDK 21 y Android SDK portables ubicados en movil/tools/ para compilar el bytecode Dalvik/ART."),
            ("4. Versionado", "Extracción de versionName", "Copia el APK generado como CatastroMovil2026.apk y crea una copia histórica en Versiones/CatastroMovil2026_{version}.apk.")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # =========================================================================
    # SECCIÓN 8: MANUAL DE OPERACIÓN EN CAMPO (GUÍA PASO A PASO)
    # =========================================================================
    h1 = doc.add_heading("8. Manual de Operación en Campo (Guía de Usuario)", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph(
        "Esta sección describe el protocolo operativo estandarizado para brigadistas y técnicos que realizan el levantamiento de predios con la aplicación instalada:"
    )
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    for r in p.runs:
        r.font.name = "Segoe UI"
        r.font.size = Pt(10)

    pasos_usuario = [
        ("8.1. Instalación del APK en el Dispositivo Móvil",
         "1. Copiar el archivo CatastroMovil2026.apk al almacenamiento del teléfono o enviarlo vía cable USB / WhatsApp / Google Drive.\n"
         "2. Abrir el archivo desde el explorador de archivos de Android. Si el sistema muestra la advertencia de 'Instalar apps desconocidas', conceder el permiso al explorador.\n"
         "3. Pulsar 'Instalar'. Una vez concluida la instalación, abrir la aplicación.\n"
         "4. Al primer inicio, el sistema solicitará los permisos de 'Ubicación precisa' (mientras la app esté en uso) y 'Almacenamiento/Cámara'. Aceptar todos los permisos para asegurar la captura de vértices con GPS."),
        
        ("8.2. Preparación Previa en Oficina (Antes de salir a Campo)",
         "1. En la pantalla de Login, verificar la conexión pulsando el ícono de engranaje superior o accediendo a Ajustes.\n"
         "2. Iniciar sesión con sus credenciales o como brigadista.\n"
         "3. Ingresar a la pestaña 'Ajustes' y presionar el botón 'Descargar Predios del Servidor'. Esto almacenará en la memoria del teléfono los predios preexistentes y el catálogo de personas (posesionarios).\n"
         "4. En la pestaña 'Mapa', explorar el área de trabajo para que las teselas satelitales queden cacheadas en la memoria del móvil."),
        
        ("8.3. Levantamiento Perimétrico con GPS ('Modo Caminar')",
         "1. Situarse físicamente en la primera esquina o lindero del predio (preferiblemente el vértice Nor-Oeste).\n"
         "2. En la pestaña 'Mapa', verificar que la barra superior indique 'GPS Fix' con precisión en color verde (< 5 m).\n"
         "3. Abrir la barra flotante de herramientas y presionar 'Caminar Perímetro'.\n"
         "4. Presionar el botón '+ Capturar Vértice'. El sistema registrará el punto P01 con sus coordenadas UTM, cota y precisión.\n"
         "5. Caminar a lo largo del lindero hasta la siguiente esquina y presionar nuevamente '+ Capturar Vértice' (se generará P02 con la distancia métrica del tramo en vivo).\n"
         "6. Continuar recorriendo todo el perímetro en sentido horario hasta llegar nuevamente al punto de inicio.\n"
         "7. Presionar 'Finalizar y Crear Ficha'. El móvil validará el polígono, calculará área y perímetro y abrirá automáticamente la Ficha Catastral."),

        ("8.4. Diligenciamiento de la Ficha Catastral",
         "1. Código / Clave Catastral: Ingresar el código del predio asignado por el municipio.\n"
         "2. Búsqueda de Posesionario: Digitar la cédula del propietario. El sistema buscará en 0 milisegundos en el catálogo local y autocompletará el nombre y apellidos completos.\n"
         "3. Colindantes: El formulario desglosa cada tramo (P01 ➔ P02, P02 ➔ P03...) con su orientación geográfica calculada. Ingresar el nombre del vecino o elemento colindante (ej: 'Vía Pública', 'Familia Pérez', 'Río Ojivo').\n"
         "4. Guardar Predio: Presionar 'Guardar en el Teléfono'. El predio quedará protegido con estado 'Pendiente'."),

        ("8.5. Emisión del Reporte Planimétrico en el Móvil",
         "1. En cualquier momento, abrir la ficha del predio o tocar el polígono en el mapa y presionar 'Ver Reporte Planimétrico'.\n"
         "2. El aplicativo genera una lámina topográfica con:\n"
         "    • Croquis del predio centrado con cuadrícula UTM oficial.\n"
         "    • Cuadro de Construcción con vértices P01..Pn, coordenadas X, Y, rumbos y distancias.\n"
         "    • Cuadro de Linderos oficiales (Norte, Sur, Este, Oeste).\n"
         "    • Resumen de Superficie en m² y Hectáreas.\n"
         "    • Código QR para validación institucional."),

        ("8.6. Sincronización al Servidor Central (Retorno a Oficina)",
         "1. Al tener acceso a internet (Wi-Fi o red móvil), dirigirse a la pestaña 'Sincronizar'.\n"
         "2. Se observará la lista de predios levantados con su estado (Pendiente, Sincronizado, Conflicto).\n"
         "3. Presionar 'Sincronizar Todos'. El sistema transferirá los polígonos hacia la base PostgreSQL/PostGIS central.\n"
         "4. En caso de detectarse que un código ya existía, el sistema consultará interactivamente si desea sobreescribir o renombrar el predio.")
    ]
    for sub_title, sub_desc in pasos_usuario:
        h2 = doc.add_heading(sub_title, level=2)
        h2.paragraph_format.space_before = Pt(12)
        h2.paragraph_format.space_after = Pt(4)
        h2.runs[0].font.name = "Segoe UI"
        h2.runs[0].font.color.rgb = RGBColor(14, 116, 144)
        
        p_desc = doc.add_paragraph(sub_desc)
        p_desc.paragraph_format.line_spacing = 1.15
        p_desc.paragraph_format.space_after = Pt(6)
        for r in p_desc.runs:
            r.font.name = "Segoe UI"
            r.font.size = Pt(9.5)
            
    # =========================================================================
    # SECCIÓN 9: GUÍA DE RESOLUCIÓN DE PROBLEMAS Y DIAGNÓSTICO (TROUBLESHOOTING)
    # =========================================================================
    h1 = doc.add_heading("9. Guía de Solución de Problemas (Troubleshooting)", level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    h1.runs[0].font.name = "Segoe UI"
    h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)

    t_trouble = doc.add_table(rows=6, cols=3)
    format_table(
        t_trouble,
        col_widths=[1.8, 2.0, 3.2],
        headers=["Síntoma / Incidencia", "Causa Raíz Identificada", "Solución Inmediata Recomendada"],
        rows_data=[
            ("El GPS muestra 'Sin Señal' o precisión en rojo (> 15 m)", "Dispositivo bajo techado, follaje denso o modo de ahorro de energía activo.", "Salir a cielo abierto, verificar en Ajustes de Android que la Ubicación esté en 'Alta Precisión' y desactivar el ahorro de batería."),
            ("Error al sincronizar: 'HTTP 401: Sesión Expirada'", "El token de seguridad JWT superó su tiempo de validez.", "Aparecerá una ventana solicitando su contraseña. Ingrésela y presione 'Renovar y Subir' para reanudar sin salir de la pantalla."),
            ("La pantalla se queda en 'Conectando con el Servidor...'", "El backend en Render Cloud estaba en reposo (Cold Start).", "Esperar entre 15 y 30 segundos mientras el contenedor se despierta o presionar 'Probar Conexión' en la pestaña Ajustes."),
            ("El predio levantado no aparece en el mapa del Geoportal Web", "El predio fue guardado en el teléfono pero aún no ha sido sincronizado.", "Ir a la pestaña 'Sincronizar' en el móvil y presionar la nube de subida sobre el predio para cargarlo a la base central."),
            ("Se requiere extraer los datos levantados sin usar internet", "Zona remota sin posibilidad de conexión a corto plazo.", "En la pestaña Sincronizar, presionar 'Exportar Backup JSON'. Esto genera un archivo con todos los predios y vértices para transferirlo por cable USB.")
        ]
    )
    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # --- PIE DE PÁGINA INSTITUCIONAL ---
    p_foot = doc.add_paragraph()
    p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_foot.paragraph_format.space_before = Pt(20)
    r_foot = p_foot.add_run("GEOPORTAL CATASTRAL 2026 – SISTEMA INTEGRADO DE GESTIÓN TERRITORIAL\nDOCUMENTACIÓN TÉCNICA Y MANUAL OPERATIVO DEL APLICATIVO MÓVIL ANDROID")
    r_foot.font.name = "Segoe UI"
    r_foot.font.size = Pt(8.5)
    r_foot.font.color.rgb = RGBColor(148, 163, 184)
    
    # Guardar documento
    os.makedirs(os.path.dirname(docx_path), exist_ok=True)
    doc.save(docx_path)
    print(f"Documento guardado con éxito: {docx_path}")

if __name__ == '__main__':
    target_dir = r"C:\LNCZ\proyecto-catastro-2026\informes"
    target_file = os.path.join(target_dir, "Manual_Tecnico_Catastro_Movil_2026.docx")
    build_mobile_manual(target_file)
    
    # También generar copia en la carpeta movil para comodidad directa
    movil_file = r"C:\LNCZ\proyecto-catastro-2026\movil\Manual_Tecnico_Catastro_Movil_2026.docx"
    build_mobile_manual(movil_file)
