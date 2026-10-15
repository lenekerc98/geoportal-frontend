"""
Script de Automatización: Generación Masiva de Levantamientos Planimétricos en Lotes de 500
Proyecto Catastro Rural Cantón Urdaneta 2026
Formato: A4 Horizontal Estricto con Salto de Página Automático

Uso:
    python scripts/generar_reportes_masivos_500.py --lote 1
    python scripts/generar_reportes_masivos_500.py --lote all
    python scripts/generar_reportes_masivos_500.py --desde 1 --hasta 500
"""

import os
import sys
import argparse
import subprocess
import time
import requests
import json
from pathlib import Path

BACKEND_CANDIDATES = [
    "http://127.0.0.1:8000",
    "https://geoportal-backend-43s0.onrender.com"
]
FRONTEND_URL = "https://localhost:5173"
DEFAULT_OUTPUT_DIR = r"C:\LNCZ\proyecto-catastro-2026\reportes planimetricos 500"
BATCH_SIZE = 500

def find_browser():
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def get_auth_token():
    for base in BACKEND_CANDIDATES:
        try:
            resp = requests.post(
                f"{base}/api/token",
                data={"username": "lcedeno", "password": "lenekerc98"},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=12
            )
            if resp.status_code == 200:
                print(f"[INFO] Autenticado exitosamente contra: {base}")
                return resp.json().get("access_token"), base
        except Exception:
            continue
    return None, None

def get_total_predios(token, backend_url):
    try:
        resp = requests.get(
            f"{backend_url}/api/gis/predios/geometrias?solo_lista=true",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                return len(data)
    except Exception:
        pass
    return 4416

def export_lote_pdf(browser_path, lote_num, from_idx, to_idx, token, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    pdf_filename = f"Lote_{lote_num:02d}_Predios_{from_idx:04d}_al_{to_idx:04d}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)

    # Si ya fue generado previamente y tiene contenido válido (> 500KB), omitir para continuar
    if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 500000:
        size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
        print(f"[OK] Lote {lote_num} ya existe ({size_mb:.2f} MB), saltando...", flush=True)
        return True

    url = (
        f"{FRONTEND_URL}/reporte/planimetrico/codigo/0"
        f"?batch=true&from={from_idx}&to={to_idx}&token={token}"
    )

    count_predios = to_idx - from_idx + 1
    print(f"\n" + "="*70, flush=True)
    print(f"[*] PROCESANDO LOTE {lote_num}: Predios {from_idx} al {to_idx} (Total: {count_predios} predios)", flush=True)
    print(f"[*] Destino: {pdf_path}", flush=True)
    print(f"="*70, flush=True)

    # Cálculo dinámico de tiempo virtual para renderizar 500 predios con sus mapas Leaflet
    render_delay = max(45, min(480, int(count_predios * 0.90)))

    cmd = [
        browser_path,
        "--headless=new",
        "--disable-gpu",
        "--ignore-certificate-errors",
        "--allow-insecure-localhost",
        "--no-pdf-header-footer",
        f"--virtual-time-budget={render_delay * 1000}",
        f"--print-to-pdf={pdf_path}",
        url
    ]

    try:
        t0 = time.time()
        print(f"[*] Renderizando {count_predios} planos en Chrome headless (presupuesto ~{render_delay}s)...", flush=True)
        subprocess.run(cmd, timeout=render_delay + 300, check=True, capture_output=True)
        elapsed = time.time() - t0

        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 100000:
            size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
            print(f"[OK] Lote {lote_num} generado exitosamente: {size_mb:.2f} MB en {elapsed:.1f}s", flush=True)
            return True
        else:
            print(f"[!] Archivo generado incompleto para Lote {lote_num}", flush=True)
            return False
    except subprocess.TimeoutExpired:
        print(f"[!] Tiempo de espera agotado para Lote {lote_num}.", flush=True)
        return False
    except Exception as e:
        print(f"[!] Error generando PDF para lote {lote_num}: {e}", flush=True)
        return False

def main():
    parser = argparse.ArgumentParser(description="Generador Masivo de Reportes Planimétricos en Lotes de 500")
    parser.add_argument("--lote", type=str, default="all", help="Número de lote (1, 2, 3...) o 'all' para todos")
    parser.add_argument("--desde", type=int, default=None, help="Índice inicial manual de predio")
    parser.add_argument("--hasta", type=int, default=None, help="Índice final manual de predio")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Tamaño del lote (default: 500)")
    parser.add_argument("--output-dir", type=str, default=DEFAULT_OUTPUT_DIR, help="Directorio destino de los PDFs")

    args = parser.parse_args()

    browser_path = find_browser()
    if not browser_path:
        print("[ERROR] No se encontró Google Chrome ni Microsoft Edge instalado en el sistema.")
        sys.exit(1)

    print(f"[INFO] Navegador detectado: {browser_path}")
    print("[INFO] Obteniendo credenciales de acceso al geoportal...")
    token, active_backend = get_auth_token()
    if not token:
        print("[ERROR] No se pudo obtener el token de autenticación. Verifica la conexión con el backend.")
        sys.exit(1)

    total_predios = get_total_predios(token, active_backend)
    batch_size = args.batch_size
    total_lotes = max(1, (total_predios + batch_size - 1) // batch_size)

    print(f"[INFO] Total de predios en catálogo: {total_predios}")
    print(f"[INFO] Tamaño de lote: {batch_size} predios")
    print(f"[INFO] Total de lotes a generar: {total_lotes}")
    print(f"[INFO] Carpeta de salida: {args.output_dir}")

    if args.desde is not None and args.hasta is not None:
        export_lote_pdf(browser_path, 999, args.desde, args.hasta, token, args.output_dir)
        return

    if args.lote.lower() == "all":
        print(f"\n[INICIO] Generando los {total_lotes} lotes de {batch_size} predios en formato A4 Horizontal...")
        exitosos = 0
        for l_num in range(1, total_lotes + 1):
            f_idx = (l_num - 1) * batch_size + 1
            t_idx = min(total_predios, l_num * batch_size)
            ok = export_lote_pdf(browser_path, l_num, f_idx, t_idx, token, args.output_dir)
            if ok:
                exitosos += 1
            # Pausa breve entre lotes para liberar memoria del sistema
            time.sleep(2)
        print(f"\n[COMPLETADO] Proceso finalizado: {exitosos}/{total_lotes} lotes generados en: {args.output_dir}")
    else:
        try:
            target_lote = int(args.lote)
            if target_lote < 1 or target_lote > total_lotes:
                print(f"[ERROR] Número de lote inválido. Debe estar entre 1 y {total_lotes}")
                sys.exit(1)
            f_idx = (target_lote - 1) * batch_size + 1
            t_idx = min(total_predios, target_lote * batch_size)
            export_lote_pdf(browser_path, target_lote, f_idx, t_idx, token, args.output_dir)
        except ValueError:
            print("[ERROR] Valor de --lote no reconocido.")

if __name__ == "__main__":
    main()
