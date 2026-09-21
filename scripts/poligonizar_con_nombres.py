#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
=============================================================================
POLIGONIZADOR AUTOMÁTICO DE LÍNEAS CON EXTRACCIÓN DE TEXTO / NOMBRES
=============================================================================
Convierte shapefiles o DXF de líneas cerradas en polígonos y asocia a cada
polígono el texto (nombre/código/etiqueta) ubicado dentro de su límite.

Uso por consola:
  python poligonizar_con_nombres.py --lineas lineas.shp --textos textos.shp --salida poligonos.shp

Uso interactivo / interfaz gráfica:
  python poligonizar_con_nombres.py (o doble clic en ejecutar_poligonizador.bat)
=============================================================================
"""

import os
import sys
import argparse
import time

try:
    from osgeo import ogr, osr
    from shapely import from_wkt, to_wkt, transform, Point, Polygon, MultiPolygon
    from shapely.ops import unary_union, polygonize
    from shapely.strtree import STRtree
except ImportError as e:
    print(f"Error cargando librerías SIG: {e}")
    print("Asegúrate de ejecutar con el entorno Python de QGIS o tener GDAL y Shapely instalados.")
    sys.exit(1)


def to_2d(geometry):
    """Convierte cualquier geometría 3D a 2D para garantizar noding limpio."""
    try:
        return transform(geometry, lambda coords: coords[:, :2])
    except Exception:
        return geometry


def detectar_campo_texto(layer):
    """Detecta inteligentemente qué campo contiene los textos / nombres."""
    defn = layer.GetLayerDefn()
    n_fields = defn.GetFieldCount()
    nombres_candidatos = [
        'texto', 'text', 'nombre', 'name', 'label', 'etiqueta',
        'string', 'propietario', 'codigo', 'cod', 'predio', 'layer', 'subclasses'
    ]
    
    # 1. Búsqueda por coincidencia de nombre
    for i in range(n_fields):
        f_name = defn.GetFieldDefn(i).GetName()
        if f_name.lower() in nombres_candidatos:
            return f_name
            
    # 2. Búsqueda por tipo String con contenido no vacío
    for i in range(n_fields):
        f_defn = defn.GetFieldDefn(i)
        if f_defn.GetType() == ogr.OFTString:
            return f_defn.GetName()
            
    # 3. Fallback al primer campo
    return defn.GetFieldDefn(0).GetName() if n_fields > 0 else None


def extraer_lineas(ruta_archivo, capa_nombre=None):
    """Extrae geometrías lineales 2D desde un archivo SHP o DXF."""
    ds = ogr.Open(ruta_archivo)
    if not ds:
        raise ValueError(f"No se pudo abrir el archivo de líneas: {ruta_archivo}")
    
    if capa_nombre:
        layer = ds.GetLayerByName(capa_nombre)
    else:
        layer = ds.GetLayer(0)
        
    srs = layer.GetSpatialRef()
    lineas = []
    
    for feat in layer:
        geom = feat.GetGeometryRef()
        if not geom:
            continue
            
        geom_wkt = geom.ExportToWkt()
        shapely_geom = from_wkt(geom_wkt)
        shapely_2d = to_2d(shapely_geom)
        
        # Guardar solo elementos lineales
        if shapely_2d.geom_type in ['LineString', 'MultiLineString']:
            lineas.append(shapely_2d)
        elif shapely_2d.geom_type == 'GeometryCollection':
            for g in shapely_2d.geoms:
                if g.geom_type in ['LineString', 'MultiLineString']:
                    lineas.append(g)
                    
    print(f"  [+] Líneas extraídas: {len(lineas)}")
    return lineas, srs


def extraer_textos_puntos(ruta_archivo, campo_texto=None, capa_nombre=None):
    """Extrae puntos y sus textos desde un archivo SHP de puntos o DXF con anotaciones."""
    ds = ogr.Open(ruta_archivo)
    if not ds:
        raise ValueError(f"No se pudo abrir el archivo de textos: {ruta_archivo}")
        
    if capa_nombre:
        layer = ds.GetLayerByName(capa_nombre)
    else:
        layer = ds.GetLayer(0)
        
    if not campo_texto:
        campo_texto = detectar_campo_texto(layer)
        print(f"  [*] Campo de texto detectado automáticamente: '{campo_texto}'")
        
    puntos = []
    textos = []
    
    for feat in layer:
        geom = feat.GetGeometryRef()
        if not geom:
            continue
            
        geom_wkt = geom.ExportToWkt()
        shapely_geom = to_2d(from_wkt(geom_wkt))
        
        # Extraer valor del texto
        val = ""
        if campo_texto:
            val_raw = feat.GetField(campo_texto)
            val = str(val_raw).strip() if val_raw is not None else ""
            
        # Si la geometría es un punto
        if shapely_geom.geom_type == 'Point':
            puntos.append(shapely_geom)
            textos.append(val)
        elif shapely_geom.geom_type == 'MultiPoint':
            for pt in shapely_geom.geoms:
                puntos.append(pt)
                textos.append(val)
        elif hasattr(shapely_geom, 'centroid'):
            # En caso de que vengan como pequeñas figuras o textos con bounding box
            puntos.append(shapely_geom.centroid)
            textos.append(val)
            
    print(f"  [+] Puntos/Textos extraídos: {len(puntos)}")
    return puntos, textos


def extraer_dxf_completo(ruta_dxf):
    """Extrae tanto líneas como textos directamente de un único archivo DXF."""
    ds = ogr.Open(ruta_dxf)
    if not ds:
        raise ValueError(f"No se pudo abrir el DXF: {ruta_dxf}")
        
    layer = ds.GetLayer(0)
    srs = layer.GetSpatialRef()
    
    lineas = []
    puntos = []
    textos = []
    
    for feat in layer:
        geom = feat.GetGeometryRef()
        if not geom:
            continue
            
        geom_wkt = geom.ExportToWkt()
        shapely_2d = to_2d(from_wkt(geom_wkt))
        
        # En DXF de OGR el texto suele venir en el campo 'Text'
        texto_val = feat.GetField("Text") if feat.GetFieldIndex("Text") != -1 else ""
        if not texto_val and feat.GetFieldIndex("Layer") != -1:
            texto_val = feat.GetField("Layer")
        texto_str = str(texto_val).strip() if texto_val is not None else ""
        
        if shapely_2d.geom_type in ['LineString', 'MultiLineString']:
            lineas.append(shapely_2d)
        elif shapely_2d.geom_type == 'Point' and texto_str:
            puntos.append(shapely_2d)
            textos.append(texto_str)
            
    print(f"  [+] DXF leído: {len(lineas)} líneas y {len(puntos)} etiquetas de texto.")
    return lineas, puntos, textos, srs


def procesar_poligonizacion(ruta_lineas, ruta_textos, ruta_salida, campo_texto=None):
    """
    Ejecuta el flujo completo:
    1. Carga líneas y textos.
    2. Realiza noding y poligonización.
    3. Asocia puntos a polígonos mediante Point-in-Polygon.
    4. Guarda el nuevo Shapefile de Polígonos con su tabla de atributos.
    """
    t_inicio = time.time()
    print("=" * 65)
    print("INICIANDO PROCESO DE POLIGONIZACIÓN CON ASIGNACIÓN DE NOMBRES")
    print("=" * 65)
    
    # 1. Cargar fuentes de datos
    is_single_dxf = ruta_lineas.lower().endswith('.dxf') and (not ruta_textos or ruta_lineas == ruta_textos)
    
    if is_single_dxf:
        print(f"-> Procesando archivo único DXF: {ruta_lineas}")
        lineas, puntos, textos, srs = extraer_dxf_completo(ruta_lineas)
    else:
        print(f"-> Cargando capa de líneas: {ruta_lineas}")
        lineas, srs = extraer_lineas(ruta_lineas)
        if ruta_textos:
            print(f"-> Cargando capa de textos: {ruta_textos}")
            puntos, textos = extraer_textos_puntos(ruta_textos, campo_texto=campo_texto)
        else:
            puntos, textos = [], []
        
    if not lineas:
        raise ValueError("No se encontraron entidades lineales para poligonizar.")
        
    # 2. Noding de líneas (resolver intersecciones en vértices comunes)
    print("-> Ejecutando noding y unión de líneas...")
    lineas_unidas = unary_union(lineas)
    
    # 3. Poligonización
    print("-> Generando polígonos cerrados...")
    poligonos = list(polygonize(lineas_unidas))
    print(f"  [OK] Polígonos cerrados construidos: {len(poligonos)}")
    
    if not poligonos:
        raise ValueError("No se formó ningún polígono cerrado. Verifica que las líneas se toquen en los extremos.")
        
    # 4. Asignación espacial (Point-in-Polygon)
    print("-> Indexando puntos y asignando nombres a cada polígono...")
    tree = STRtree(puntos) if puntos else None
    
    resultados = []
    poligonos_con_nombre = 0
    
    for i, poly in enumerate(poligonos):
        # Asegurar validez geométrica
        if not poly.is_valid:
            poly = poly.buffer(0)
            
        nombre_asignado = ""
        
        if tree and puntos:
            # Buscar puntos candidatos que intersectan el envolvente
            indices_candidatos = tree.query(poly)
            
            nombres_encontrados = []
            for idx in indices_candidatos:
                pt = puntos[idx]
                # Comprobar si el punto está dentro del polígono (o toca su límite)
                if poly.contains(pt) or poly.touches(pt):
                    txt = textos[idx]
                    if txt and txt not in nombres_encontrados:
                        nombres_encontrados.append(txt)
                        
            if nombres_encontrados:
                nombre_asignado = " / ".join(nombres_encontrados)
                poligonos_con_nombre += 1
            else:
                # Si ningún punto cayó adentro pero hay puntos cerca del centroide
                c = poly.centroid
                idx_cercanos = tree.query(c.buffer(poly.length * 0.05))
                for idx in idx_cercanos:
                    if poly.distance(puntos[idx]) < 1.0: # tolerancia de 1 metro
                        txt = textos[idx]
                        if txt:
                            nombre_asignado = txt
                            poligonos_con_nombre += 1
                            break
                            
        resultados.append({
            'id': i + 1,
            'nombre': nombre_asignado,
            'area_m2': round(float(poly.area), 2),
            'perimetro_m': round(float(poly.length), 2),
            'geom': poly
        })
        
    if puntos:
        print(f"  [OK] Polígonos con texto reconocido: {poligonos_con_nombre} de {len(poligonos)}")
    
    # 5. Escribir Shapefile de Salida
    print(f"-> Creando nuevo Shapefile de polígonos: {ruta_salida}")
    driver = ogr.GetDriverByName("ESRI Shapefile")
    
    if os.path.exists(ruta_salida):
        driver.DeleteDataSource(ruta_salida)
        
    out_ds = driver.CreateDataSource(ruta_salida)
    if not out_ds:
        raise ValueError(f"No se pudo crear el archivo de salida: {ruta_salida}")
        
    layer_name = os.path.splitext(os.path.basename(ruta_salida))[0]
    out_layer = out_ds.CreateLayer(layer_name, srs, geom_type=ogr.wkbPolygon)
    
    # Definir campos
    f_id = ogr.FieldDefn("ID", ogr.OFTInteger)
    out_layer.CreateField(f_id)
    
    f_nombre = ogr.FieldDefn("NOMBRE", ogr.OFTString)
    f_nombre.SetWidth(254)
    out_layer.CreateField(f_nombre)
    
    f_area = ogr.FieldDefn("AREA_M2", ogr.OFTReal)
    f_area.SetWidth(14)
    f_area.SetPrecision(2)
    out_layer.CreateField(f_area)
    
    f_perim = ogr.FieldDefn("PERIM_M", ogr.OFTReal)
    f_perim.SetWidth(14)
    f_perim.SetPrecision(2)
    out_layer.CreateField(f_perim)
    
    layer_defn = out_layer.GetLayerDefn()
    
    for r in resultados:
        feat = ogr.Feature(layer_defn)
        feat.SetField("ID", r['id'])
        feat.SetField("NOMBRE", r['nombre'])
        feat.SetField("AREA_M2", r['area_m2'])
        feat.SetField("PERIM_M", r['perimetro_m'])
        
        # Exportar geometría a OGR
        geom_wkt = to_wkt(r['geom'])
        ogr_geom = ogr.CreateGeometryFromWkt(geom_wkt)
        feat.SetGeometry(ogr_geom)
        
        out_layer.CreateFeature(feat)
        feat = None
        
    # Guardar y cerrar
    out_ds = None
    
    # Copiar o generar archivo de proyección .prj
    if srs:
        prj_path = os.path.splitext(ruta_salida)[0] + ".prj"
        try:
            with open(prj_path, "w") as prj_file:
                prj_file.write(srs.ExportToWkt())
        except Exception as e:
            print(f"  [!] Aviso al generar .prj: {e}")
            
    duracion = round(time.time() - t_inicio, 2)
    print("=" * 65)
    print(f"PROCESO COMPLETADO CON ÉXITO EN {duracion} SEGUNDOS")
    print(f"Archivo guardado: {os.path.abspath(ruta_salida)}")
    print(f"Total Polígonos generados: {len(resultados)}")
    print("=" * 65)
    return True


def iniciar_interfaz_grafica():
    """Lanza una interfaz gráfica amigable con Tkinter."""
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox, ttk
    except ImportError:
        print("Tkinter no está disponible. Usa los argumentos de consola (--lineas, --textos, --salida).")
        return

    root = tk.Tk()
    root.title("Poligonizador Automático con Nombres - Catastro SIG")
    root.geometry("660x450")
    root.resizable(False, False)
    root.configure(bg="#f4f6f9")

    # Variables
    var_lineas = tk.StringVar()
    var_textos = tk.StringVar()
    var_salida = tk.StringVar(value=os.path.abspath("poligonos_con_nombres.shp"))
    var_campo = tk.StringVar()

    # Estilos
    style = ttk.Style()
    style.theme_use("clam")

    pad_opts = {'padx': 15, 'pady': 6}

    header_frame = tk.Frame(root, bg="#1e293b", padx=15, pady=12)
    header_frame.pack(fill="x")
    tk.Label(header_frame, text="Poligonizador de Líneas y Reconocimiento de Textos", fg="#ffffff", bg="#1e293b", font=("Segoe UI", 12, "bold")).pack(anchor="w")
    tk.Label(header_frame, text="Convierte linderos/líneas cerradas en polígonos y asocia el nombre que está adentro.", fg="#94a3b8", bg="#1e293b", font=("Segoe UI", 8)).pack(anchor="w")

    main_frame = tk.Frame(root, bg="#f4f6f9", padx=20, pady=15)
    main_frame.pack(fill="both", expand=True)

    # Selector Líneas
    tk.Label(main_frame, text="1. Shapefile o DXF de Líneas (Linderos):", font=("Segoe UI", 9, "bold"), bg="#f4f6f9").grid(row=0, column=0, sticky="w", **pad_opts)
    f1 = tk.Frame(main_frame, bg="#f4f6f9")
    f1.grid(row=1, column=0, sticky="ew", padx=15)
    tk.Entry(f1, textvariable=var_lineas, width=54, font=("Segoe UI", 9)).pack(side="left", ipady=3)
    def buscar_lineas():
        f = filedialog.askopenfilename(title="Selecciona el archivo de Líneas", filetypes=[("Archivos GIS y CAD", "*.shp *.dxf"), ("Shapefile (*.shp)", "*.shp"), ("AutoCAD DXF (*.dxf)", "*.dxf")])
        if f:
            var_lineas.set(f)
            # Sugerir salida
            base = os.path.splitext(f)[0]
            var_salida.set(base + "_poligonos.shp")
    tk.Button(f1, text="Buscar...", command=buscar_lineas, bg="#e2e8f0", font=("Segoe UI", 8)).pack(side="left", padx=5)

    # Selector Textos
    tk.Label(main_frame, text="2. Shapefile de Textos / Puntos (Nombres de cada predio):", font=("Segoe UI", 9, "bold"), bg="#f4f6f9").grid(row=2, column=0, sticky="w", **pad_opts)
    f2 = tk.Frame(main_frame, bg="#f4f6f9")
    f2.grid(row=3, column=0, sticky="ew", padx=15)
    tk.Entry(f2, textvariable=var_textos, width=54, font=("Segoe UI", 9)).pack(side="left", ipady=3)
    def buscar_textos():
        f = filedialog.askopenfilename(title="Selecciona el archivo de Textos/Puntos", filetypes=[("Archivos GIS y CAD", "*.shp *.dxf"), ("Shapefile (*.shp)", "*.shp"), ("AutoCAD DXF (*.dxf)", "*.dxf")])
        if f:
            var_textos.set(f)
    tk.Button(f2, text="Buscar...", command=buscar_textos, bg="#e2e8f0", font=("Segoe UI", 8)).pack(side="left", padx=5)
    tk.Label(main_frame, text="* Si usas un solo archivo DXF con líneas y textos juntos, deja este campo vacío.", font=("Segoe UI", 8, "italic"), fg="#64748b", bg="#f4f6f9").grid(row=4, column=0, sticky="w", padx=15)

    # Selector Salida
    tk.Label(main_frame, text="3. Guardar Polígonos Resultantes Como (.shp):", font=("Segoe UI", 9, "bold"), bg="#f4f6f9").grid(row=5, column=0, sticky="w", **pad_opts)
    f3 = tk.Frame(main_frame, bg="#f4f6f9")
    f3.grid(row=6, column=0, sticky="ew", padx=15)
    tk.Entry(f3, textvariable=var_salida, width=54, font=("Segoe UI", 9)).pack(side="left", ipady=3)
    def buscar_salida():
        f = filedialog.asksaveasfilename(title="Guardar Shapefile de Polígonos", defaultextension=".shp", filetypes=[("Shapefile (*.shp)", "*.shp")])
        if f:
            var_salida.set(f)
    tk.Button(f3, text="Guardar...", command=buscar_salida, bg="#e2e8f0", font=("Segoe UI", 8)).pack(side="left", padx=5)

    # Botón Procesar
    def ejecutar():
        lin = var_lineas.get().strip()
        txt = var_textos.get().strip()
        sal = var_salida.get().strip()
        
        if not lin:
            messagebox.showwarning("Falta información", "Debes seleccionar el archivo de líneas.")
            return
        if not sal:
            messagebox.showwarning("Falta información", "Debes indicar la ruta del archivo de salida.")
            return
            
        try:
            procesar_poligonizacion(lin, txt, sal)
            messagebox.showinfo("¡Proceso Exitoso!", f"Los polígonos fueron generados correctamente:\n\n{sal}")
        except Exception as err:
            messagebox.showerror("Error al procesar", str(err))

    btn_frame = tk.Frame(root, bg="#f4f6f9", pady=15)
    btn_frame.pack(fill="x")
    tk.Button(btn_frame, text="🚀  Procesar y Poligonizar con Nombres", command=ejecutar, bg="#0284c7", fg="#ffffff", activebackground="#0369a1", font=("Segoe UI", 10, "bold"), padx=25, pady=8, relief="flat", cursor="hand2").pack()

    root.mainloop()


def main():
    parser = argparse.ArgumentParser(description="Poligonizar líneas y asignar texto interno a cada polígono.")
    parser.add_argument("-l", "--lineas", help="Ruta al shapefile (.shp) o CAD (.dxf) con las líneas cerradas.")
    parser.add_argument("-t", "--textos", help="Ruta al shapefile de puntos/textos o DXF con los nombres.", default=None)
    parser.add_argument("-s", "--salida", help="Ruta del shapefile (.shp) de polígonos resultante.", default=None)
    parser.add_argument("-c", "--campo", help="Nombre del campo de texto (opcional, se detecta automáticamente).", default=None)
    parser.add_argument("--gui", action="store_true", help="Abrir interfaz gráfica con ventanas de diálogo.")
    
    args = parser.parse_args()
    
    if len(sys.argv) == 1 or args.gui:
        iniciar_interfaz_grafica()
    else:
        if not args.lineas:
            print("Error: Debes especificar el archivo de líneas con -l o --lineas.")
            sys.exit(1)
            
        salida = args.salida
        if not salida:
            base = os.path.splitext(args.lineas)[0]
            salida = base + "_poligonos_con_nombres.shp"
            
        procesar_poligonizacion(args.lineas, args.textos, salida, campo_texto=args.campo)


if __name__ == "__main__":
    main()
