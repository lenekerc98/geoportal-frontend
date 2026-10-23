/**
 * Generador Masivo de Reportes Planimétricos en Lotes de 500
 * Proyecto Catastro Rural Cantón Urdaneta 2026
 * 
 * Formato: A4 Horizontal Estricto (297 x 210 mm) - 100% de Escala sin recortes
 * Motor: Puppeteer-Core con Google Chrome del sistema y Backend Local (127.0.0.1:8000)
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BACKEND_URL = 'http://127.0.0.1:8000';
const FRONTEND_URL = 'https://localhost:5173';
const OUTPUT_DIR = 'C:\\LNCZ\\proyecto-catastro-2026\\reportes planimetricos 500';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BATCH_SIZE = 500;

// Parse CLI args
const args = process.argv.slice(2);
let targetLote = 'all';
let customDesde = null;
let customHasta = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--lote' && args[i + 1]) {
    targetLote = args[i + 1];
    i++;
  } else if (args[i] === '--desde' && args[i + 1]) {
    customDesde = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--hasta' && args[i + 1]) {
    customHasta = parseInt(args[i + 1]);
    i++;
  }
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getAuthToken() {
  console.log(`[INFO] Conectando al backend local (${BACKEND_URL})...`);
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

async function getTotalPredios(token) {
  const res = await fetch(`${BACKEND_URL}/api/gis/codigos-catastrales`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Error al consultar catálogo de predios: HTTP ${res.status}`);
  }
  const list = await res.json();
  return list.length;
}

const { execSync } = require('child_process');

function mergePdfFiles(partPaths, finalPath) {
  const cleanParts = partPaths.map(p => `r'${p.replace(/\\/g, '/')}'`).join(', ');
  const cleanFinal = finalPath.replace(/\\/g, '/');
  const pyScript = `import pymupdf
doc = pymupdf.open()
for f in [${cleanParts}]:
    d = pymupdf.open(f)
    doc.insert_pdf(d)
    d.close()
doc.save(r'${cleanFinal}', garbage=4, deflate=True)
doc.close()
`;
  const tmpPy = path.join(OUTPUT_DIR, `merge_${Date.now()}.py`);
  fs.writeFileSync(tmpPy, pyScript, 'utf8');
  try {
    execSync(`python "${tmpPy}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tmpPy)) fs.unlinkSync(tmpPy);
  }
}

async function processLoteInSubchunks(browser, token, loteNum, fromIdx, toIdx) {
  const count = toIdx - fromIdx + 1;
  const fileName = `Lote_${String(loteNum).padStart(2, '0')}_Predios_${String(fromIdx).padStart(4, '0')}_al_${String(toIdx).padStart(4, '0')}.pdf`;
  const finalPdfPath = path.join(OUTPUT_DIR, fileName);

  if (fs.existsSync(finalPdfPath) && fs.statSync(finalPdfPath).size > 1024 * 1024) {
    const existingMb = (fs.statSync(finalPdfPath).size / (1024 * 1024)).toFixed(2);
    console.log(`\n[SKIP] LOTE ${loteNum} ya existe y es válido: ${fileName} (${existingMb} MB). Omitiendo...`);
    return true;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`[*] PROCESANDO LOTE ${loteNum}: Predios ${fromIdx} al ${toIdx} (Total: ${count} predios)`);
  console.log(`[*] Destino final: ${finalPdfPath}`);
  console.log('='.repeat(70));

  const SUBCHUNK_SIZE = 250;
  if (count <= SUBCHUNK_SIZE) {
    return await exportLote(browser, token, loteNum, fromIdx, toIdx, finalPdfPath);
  }

  // Dividir en sub-lotes para evitar saturación de memoria de Chromium
  const subchunks = [];
  for (let s = fromIdx; s <= toIdx; s += SUBCHUNK_SIZE) {
    const sTo = Math.min(s + SUBCHUNK_SIZE - 1, toIdx);
    subchunks.push({ from: s, to: sTo });
  }

  console.log(`[*] El lote contiene ${count} predios. Procesando en ${subchunks.length} partes de hasta ${SUBCHUNK_SIZE} para máxima estabilidad...`);
  const partFiles = [];

  for (let idx = 0; idx < subchunks.length; idx++) {
    const sc = subchunks[idx];
    const partPath = path.join(OUTPUT_DIR, `_temp_lote_${loteNum}_parte_${idx + 1}.pdf`);
    console.log(`\n--- [Parte ${idx + 1}/${subchunks.length}] Predios ${sc.from} al ${sc.to} ---`);
    const ok = await exportLote(browser, token, loteNum, sc.from, sc.to, partPath);
    if (!ok) {
      throw new Error(`Fallo en la generación de la parte ${idx + 1} del lote ${loteNum}`);
    }
    partFiles.push(partPath);
  }

  console.log(`\n[*] Uniendo ${partFiles.length} partes en el archivo consolidado final con PyMuPDF...`);
  mergePdfFiles(partFiles, finalPdfPath);

  // Limpiar partes temporales
  for (const pf of partFiles) {
    try { if (fs.existsSync(pf)) fs.unlinkSync(pf); } catch (_) {}
  }

  const finalMb = (fs.statSync(finalPdfPath).size / (1024 * 1024)).toFixed(2);
  console.log(`[OK] LOTE ${loteNum} CONSOLIDADO CON ÉXITO: ${finalMb} MB -> ${fileName}`);
  return true;
}

async function exportLote(browser, token, loteNum, fromIdx, toIdx, customPath = null) {
  const count = toIdx - fromIdx + 1;
  const fileName = `Lote_${String(loteNum).padStart(2, '0')}_Predios_${String(fromIdx).padStart(4, '0')}_al_${String(toIdx).padStart(4, '0')}.pdf`;
  const pdfPath = customPath || path.join(OUTPUT_DIR, fileName);

  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(120000);

  // Desactivar modal de window.print() para que no bloquee Puppeteer
  await page.evaluateOnNewDocument(() => {
    window.print = () => {};
  });

  try {
    const url = `${FRONTEND_URL}/reporte/planimetrico/codigo/0?batch=true&from=${fromIdx}&to=${toIdx}&token=${token}`;
    console.log(`[*] Navegando a la aplicación...`);
    const t0 = Date.now();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

    console.log(`[*] Esperando procesamiento y renderizado de los ${count} expedientes...`);
    await page.waitForFunction(() => window.__BATCH_READY__ === true, { timeout: 300000 });

    const totalPages = await page.evaluate(() => document.querySelectorAll('.print-page').length);
    const renderedItems = await page.evaluate(() => window.__BATCH_DATA_COUNT__ || 0);
    console.log(`[*] Total de expedientes cargados: ${renderedItems}. Láminas A4 generadas: ${totalPages}. Esperando estabilización Leaflet...`);
    
    // Pausa técnica para permitir que los lienzos Leaflet completen su renderizado
    const waitMs = Math.max(3000, Math.min(10000, count * 15));
    await new Promise(r => setTimeout(r, waitMs));

    console.log(`[*] Imprimiendo a PDF con formato exacto A4 Horizontal (297x210 mm)...`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 0,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const sizeMb = (fs.statSync(pdfPath).size / (1024 * 1024)).toFixed(2);
    console.log(`[OK] Lote ${loteNum} generado exitosamente: ${sizeMb} MB (${totalPages} páginas) en ${elapsed}s`);
    return true;
  } catch (err) {
    console.error(`[!] Error al generar Lote ${loteNum}:`, err.message);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('   GENERADOR MASIVO DE REPORTES PLANIMÉTRICOS (A4 HORIZONTAL)');
  console.log('   PROYECTO CATASTRO RURAL CANTÓN URDANETA 2026');
  console.log('='.repeat(70));

  const token = await getAuthToken();
  const totalPredios = await getTotalPredios(token);
  console.log(`[INFO] Catálogo local cargado: ${totalPredios} predios registrados.`);

  console.log(`[INFO] Iniciando navegador Chrome headless...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    protocolTimeout: 0, // Desactiva el timeout del protocolo CDP para documentos masivos
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
      '--js-flags=--max-old-space-size=4096'
    ],
    defaultViewport: {
      width: 1600,
      height: 1000
    }
  });

  try {
    if (customDesde && customHasta) {
      await processLoteInSubchunks(browser, token, 999, customDesde, customHasta);
      return;
    }

    const totalLotes = Math.ceil(totalPredios / BATCH_SIZE);
    console.log(`[INFO] Total de lotes a generar: ${totalLotes} (${BATCH_SIZE} predios por lote)\n`);

    for (let i = 1; i <= totalLotes; i++) {
      if (targetLote !== 'all' && parseInt(targetLote) !== i) {
        continue;
      }
      const fromIdx = (i - 1) * BATCH_SIZE + 1;
      const toIdx = Math.min(i * BATCH_SIZE, totalPredios);
      await processLoteInSubchunks(browser, token, i, fromIdx, toIdx);
    }

    console.log('\n[COMPLETADO] Todos los lotes han sido generados en: ' + OUTPUT_DIR);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
