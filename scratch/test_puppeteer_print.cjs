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
      width: 1400,
      height: 900
    }
  });

  const page = await browser.newPage();
  
  const token = 'test';
  // Get valid token from local backend
  const res = await fetch('http://127.0.0.1:8000/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=lcedeno&password=lenekerc98'
  });
  const data = await res.json();
  const authToken = data.access_token;

  const url = `https://localhost:5173/reporte/planimetrico/codigo/0?batch=true&from=1&to=1&token=${authToken}`;
  console.log('Navigating to:', url);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for print-page elements to be present
  await page.waitForSelector('.print-page', { timeout: 30000 });
  // Wait a few seconds for Leaflet maps to finish drawing
  await new Promise(r => setTimeout(r, 4000));

  const outputPath = path.resolve('scratch', 'test_puppeteer_a4.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  console.log('Saved PDF to:', outputPath);
  await browser.close();
})();
