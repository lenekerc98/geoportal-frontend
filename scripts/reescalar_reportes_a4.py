"""
Script de Reescalado y Optimización de Láminas Planimétricas a A4 Horizontal Completo (100% Cobertura)
Proyecto Catastro Rural Cantón Urdaneta 2026

Este script procesa los 23 archivos PDF generados en 'reportes planimetricos',
detecta el marco perimetral oficial de cada lámina y reescala el contenido vectorial
de forma exacta para que llene el 100% de la hoja A4 apaisada (297mm x 210mm) con
márgenes uniformes institucionales de 8mm, eliminando cualquier espacio en blanco
residual a la derecha o al pie de página.
"""

import os
import sys
import time
from pathlib import Path
import pymupdf

TARGET_DIR = r"C:\LNCZ\proyecto-catastro-2026\reportes planimetricos"

# Dimensiones A4 Landscape en puntos tipográficos (72 pt/in = 25.4 mm/in)
A4_WIDTH_PT = 841.92   # 297 mm
A4_HEIGHT_PT = 594.96  # 210 mm
MARGIN_PT = 22.68      # 8 mm

TARGET_RECT = pymupdf.Rect(MARGIN_PT, MARGIN_PT, A4_WIDTH_PT - MARGIN_PT, A4_HEIGHT_PT - MARGIN_PT)

def get_report_frame(page):
    """
    Detecta el marco institucional negro de la lámina (doble línea exterior).
    """
    drawings = page.get_drawings()
    candidates = []
    for d in drawings:
        rect = d.get('rect')
        if not rect:
            continue
        is_black = (d.get('color') == (0, 0, 0) or d.get('fill') == (0, 0, 0))
        # El marco del reporte es grande (> 350 pt de ancho y > 250 pt de alto)
        if is_black and rect.width > 350 and rect.height > 250:
            candidates.append(rect)

    if candidates:
        candidates.sort(key=lambda r: r.width * r.height, reverse=True)
        for r in candidates:
            # Descartar rectángulos que abarquen el 100% del fondo de página
            if r.width < page.rect.width - 10:
                return r
    return None

def process_pdf(pdf_path):
    filename = os.path.basename(pdf_path)
    tmp_path = pdf_path + ".tmp.pdf"
    
    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    
    new_doc = pymupdf.open()
    scaled_count = 0
    blank_count = 0
    passthrough_count = 0

    for pno in range(total_pages):
        src_page = doc[pno]
        frame = get_report_frame(src_page)
        
        new_page = new_doc.new_page(width=A4_WIDTH_PT, height=A4_HEIGHT_PT)
        
        if frame is not None:
            # Si el marco ya mide más de 785 pt (más del 98% del ancho útil), pasa directo
            if frame.width >= 785:
                new_page.show_pdf_page(new_page.rect, doc, pno)
                passthrough_count += 1
            else:
                # Reescalar marco institucional para que ocupe exactamente el TARGET_RECT
                new_page.show_pdf_page(TARGET_RECT, doc, pno, clip=frame)
                scaled_count += 1
        else:
            # Si no hay marco, verificar si tiene texto o contenido
            text = src_page.get_text().strip()
            if text:
                new_page.show_pdf_page(new_page.rect, doc, pno)
                passthrough_count += 1
            else:
                # Hoja en blanco de modo dúplex
                blank_count += 1

    doc.close()
    
    # Guardar nuevo documento optimizado
    new_doc.save(tmp_path, deflate=True, garbage=3)
    new_doc.close()
    
    # Reemplazar archivo original
    os.replace(tmp_path, pdf_path)
    
    new_size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
    print(f"[OK] {filename} | {total_pages} páginas ({scaled_count} reescaladas, {blank_count} dúplex, {passthrough_count} directas) -> {new_size_mb:.2f} MB", flush=True)
    return total_pages, scaled_count

def main():
    print("=" * 75)
    print("  OPTIMIZADOR Y REESCALADOR DE REPORTES PLANIMÉTRICOS A A4 COMPLETO")
    print(f"  Carpeta destino: {TARGET_DIR}")
    print("=" * 75)
    
    if not os.path.exists(TARGET_DIR):
        print(f"[ERROR] La carpeta {TARGET_DIR} no existe.")
        sys.exit(1)
        
    pdf_files = sorted([f for f in os.listdir(TARGET_DIR) if f.lower().endswith('.pdf') and not f.endswith('.tmp.pdf')])
    if not pdf_files:
        print("[!] No se encontraron archivos PDF en la carpeta.")
        sys.exit(0)
        
    print(f"[*] Total de archivos a procesar: {len(pdf_files)}")
    t0 = time.time()
    
    total_pages_all = 0
    total_scaled_all = 0
    
    for idx, fname in enumerate(pdf_files, 1):
        fpath = os.path.join(TARGET_DIR, fname)
        print(f"[{idx:02d}/{len(pdf_files):02d}] Procesando {fname}...", end=" ", flush=True)
        try:
            pages, scaled = process_pdf(fpath)
            total_pages_all += pages
            total_scaled_all += scaled
        except Exception as e:
            print(f"\n[ERROR] Error procesando {fname}: {e}", flush=True)
            
    elapsed = time.time() - t0
    print("\n" + "=" * 75)
    print(f"[EXITO TOTAL] {len(pdf_files)} archivos PDF procesados ({total_pages_all} páginas en total).")
    print(f"              {total_scaled_all} páginas reescaladas al 100% del área de impresión A4.")
    print(f"              Tiempo total: {elapsed:.1f} segundos.")
    print("=" * 75)

if __name__ == "__main__":
    main()
