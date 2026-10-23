const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost'
    ],
    defaultViewport: {
      width: 1600,
      height: 1000
    }
  });

  const page = await browser.newPage();

  // Local backend auth
  const res = await fetch('http://127.0.0.1:8000/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=lcedeno&password=lenekerc98'
  });
  const data = await res.json();
  const token = data.access_token;

  const fromIdx = 1001;
  const toIdx = 1005;
  const url = `https://localhost:5173/reporte/planimetrico/codigo/0?batch=true&from=${fromIdx}&to=${toIdx}&token=${token}`;
  console.log(`[TEST] Cargando predios ${fromIdx} al ${toIdx}...`);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

  // Esperar a que React termine de procesar el lote
  console.log('[TEST] Esperando renderizado de láminas...');
  await page.waitForFunction(() => {
    const pages = document.querySelectorAll('.print-page');
    return pages.length >= 5;
  }, { timeout: 120000 });

  // Esperar 3s para que los mapas de Leaflet queden listos
  await new Promise(r => setTimeout(r, 3000));

  const pageCount = await page.evaluate(() => document.querySelectorAll('.print-page').length);
  console.log(`[TEST] Total de láminas renderizadas en DOM: ${pageCount}`);

  const outputPath = path.resolve('scratch', 'test_lote3_5predios.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  console.log(`[OK] Guardado en: ${outputPath}`);
  await browser.close();
})();
