const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function getAuthToken() {
  const res = await fetch('http://127.0.0.1:8000/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=lcedeno&password=lenekerc98'
  });
  const data = await res.json();
  return data.access_token;
}

async function testPdf() {
  const token = await getAuthToken();
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--ignore-certificate-errors']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.evaluateOnNewDocument(() => { window.print = () => {}; });
  await page.goto(`https://localhost:5173/reporte/planimetrico/codigo/0?batch=true&from=1&to=3&token=${token}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__BATCH_READY__ === true, { timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  await page.pdf({
    path: 'scratch/debug_single.pdf',
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();
  console.log('PDF generated: scratch/debug_single.pdf');
}

testPdf();
