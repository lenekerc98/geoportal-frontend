/**
 * Generador de Reportes Planimétricos Faltantes
 * Proyecto Catastro Rural Cantón Urdaneta 2026
 * 
 * Imprime los predios nuevos que no están en "reportes planimetricos" (Lotes 01 al 23)
 * Carpeta destino: C:\LNCZ\proyecto-catastro-2026\Reportes-faltantes
 * 
 * Estrategia de estabilidad:
 * - Instancia limpia de Chrome Headless por cada lote para evitar fuga de memoria y bloqueos de Skia/CDP
 * - Detección y salto automático de lotes ya generados válidos (> 1MB)
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BACKEND_URL = 'http://127.0.0.1:8000';
const FRONTEND_URL = 'https://localhost:5173';
const OUTPUT_DIR = 'C:\\LNCZ\\proyecto-catastro-2026\\Reportes-faltantes';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BATCH_SIZE = 200;
const LAST_PRINTED_PREDIO = 4416;
const START_LOTE = 24;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getAuthToken() {
  console.log(`[INFO] Obteniendo token de autenticación en ${BACKEND_URL}...`);
  const res = await fetch(`${BACKEND_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=lcedeno&password=lenekerc98'
  });
  if (!res.ok) {
    throw new Error(`Error de autenticación local: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function getPrediosFaltantes(token) {
  const res = await fetch(`${BACKEND_URL}/api/gis/codigos-catastrales/faltantes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Error al consultar predios faltantes: HTTP ${res.status}`);
  }
  return await res.json();
}

async function launchFreshBrowser() {
  return await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    protocolTimeout: 300000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
      '--js-flags=--max-old-space-size=4096'
    ],
    defaultViewport: { width: 1600, height: 1000 }
  });
}

async function exportLoteConBrowserLimpio(token, loteNum, fromIdx, toIdx, globalFrom, globalTo) {
  const count = toIdx - fromIdx + 1;
  const fileName = `Lote_${String(loteNum).padStart(2, '0')}_Predios_${String(globalFrom).padStart(4, '0')}_al_${String(globalTo).padStart(4, '0')}.pdf`;
  const pdfPath = path.join(OUTPUT_DIR, fileName);

  if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1024 * 1024) {
    const existingMb = (fs.statSync(pdfPath).size / (1024 * 1024)).toFixed(2);
    console.log(`[SKIP] LOTE ${loteNum} ya existe y es válido: ${fileName} (${existingMb} MB). Omitiendo...`);
    return true;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`[*] INICIANDO LOTE ${loteNum}: Predios globales ${globalFrom} al ${globalTo} (${count} predios)`);
  console.log(`[*] Índices faltantes: ${fromIdx} al ${toIdx}`);
  console.log(`[*] Destino: ${pdfPath}`);
  console.log('='.repeat(70));

  console.log(`[*] Lanzando instancia limpia de Google Chrome para Lote ${loteNum}...`);
  const browser = await launchFreshBrowser();

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);
    page.setDefaultNavigationTimeout(180000);

    // Evitar llamada nativa a window.print() que bloquea puppeteer
    await page.evaluateOnNewDocument(() => {
      window.print = () => {};
    });

    const url = `${FRONTEND_URL}/reporte/planimetrico/codigo/0?batch=true&faltantes=true&from=${fromIdx}&to=${toIdx}&lote=${loteNum}&token=${token}`;
    console.log(`[*] Navegando a la lámina de reporte: ${url}`);
    const t0 = Date.now();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });

    console.log(`[*] Esperando procesamiento y renderizado de las láminas...`);
    await page.waitForFunction(
      () => window.__BATCH_READY__ === true && document.querySelectorAll('.print-page').length > 0,
      { timeout: 360000 }
    );

    const totalPages = await page.evaluate(() => document.querySelectorAll('.print-page').length);
    const renderedItems = await page.evaluate(() => window.__BATCH_DATA_COUNT__ || 0);
    console.log(`[*] Expedientes procesados: ${renderedItems}. Páginas totales en DOM: ${totalPages}.`);

    if (totalPages === 0) {
      throw new Error(`Se detectaron 0 láminas (.print-page) en el DOM.`);
    }

    // Pausa para estabilización gráfica de mapas Leaflet
    const waitMs = Math.max(3000, Math.min(8000, count * 20));
    console.log(`[*] Estabilizando mapas Leaflet (~${(waitMs/1000).toFixed(1)}s)...`);
    await new Promise(r => setTimeout(r, waitMs));

    console.log(`[*] Imprimiendo a PDF con formato A4 Horizontal...`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 300000,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const sizeMb = (fs.statSync(pdfPath).size / (1024 * 1024)).toFixed(2);
    console.log(`[OK] Lote ${loteNum} completado exitosamente: ${fileName} (${sizeMb} MB, ${totalPages} páginas) en ${elapsed}s`);
    return true;
  } catch (err) {
    console.error(`[!] Error generando Lote ${loteNum}:`, err.message);
    if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size < 100000) {
      try { fs.unlinkSync(pdfPath); } catch (_) {}
    }
    return false;
  } finally {
    try {
      await browser.close();
      console.log(`[*] Instancia de Chrome para Lote ${loteNum} cerrada correctamente.`);
    } catch (_) {}
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('   GENERADOR MASIVO DE REPORTES FALTANTES (CATASTRO URDANETA 2026)');
  console.log('   Destino: ' + OUTPUT_DIR);
  console.log('='.repeat(70));

  const token = await getAuthToken();
  const faltantes = await getPrediosFaltantes(token);
  const totalFaltantes = faltantes.length;

  console.log(`[INFO] Total de predios faltantes detectados: ${totalFaltantes}`);
  if (totalFaltantes === 0) {
    console.log('[OK] No hay predios faltantes por generar.');
    return;
  }

  const numLotes = Math.ceil(totalFaltantes / BATCH_SIZE);
  console.log(`[INFO] Total de lotes: ${numLotes} (Lotes ${START_LOTE} al ${START_LOTE + numLotes - 1})\n`);

  let runningGlobal = LAST_PRINTED_PREDIO;

  for (let i = 0; i < numLotes; i++) {
    const loteNum = START_LOTE + i;
    const fromIdx = i * BATCH_SIZE + 1;
    const toIdx = Math.min((i + 1) * BATCH_SIZE, totalFaltantes);
    const count = toIdx - fromIdx + 1;

    const globalFrom = runningGlobal + 1;
    const globalTo = runningGlobal + count;
    runningGlobal = globalTo;

    let success = false;
    for (let intento = 1; intento <= 2; intento++) {
      if (intento > 1) {
        console.log(`\n[REINTENTO] Reintentando Lote ${loteNum} (Intento ${intento})...`);
      }
      success = await exportLoteConBrowserLimpio(token, loteNum, fromIdx, toIdx, globalFrom, globalTo);
      if (success) break;
    }

    if (!success) {
      console.error(`\n[ERROR CRÍTICO] No se pudo generar el Lote ${loteNum} tras 2 intentos.`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`[COMPLETADO] Proceso de impresión finalizado.`);
  console.log(`Directorio de salida: ${OUTPUT_DIR}`);
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
