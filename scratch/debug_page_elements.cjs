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

async function debugElements() {
  const token = await getAuthToken();
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--ignore-certificate-errors']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(`https://localhost:5173/reporte/planimetrico/codigo/0?batch=true&from=1&to=1&token=${token}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__BATCH_READY__ === true, { timeout: 60000 });

  const metrics = await page.evaluate(() => {
    function getInfo(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        selector,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        style: {
          width: cs.width,
          height: cs.height,
          zoom: cs.zoom,
          transform: cs.transform,
          padding: cs.padding,
          margin: cs.margin,
          boxSizing: cs.boxSizing
        }
      };
    }

    return {
      window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      root: getInfo('#root'),
      wrapper: getInfo('.report-wrapper'),
      container: getInfo('.report-pages-container'),
      page: getInfo('.print-page'),
      border: getInfo('.report-border'),
      body: getInfo('.report-body'),
      mapContainer: getInfo('.report-map-container')
    };
  });

  console.log('DOM METRICS IN BROWSER (SCREEN):');
  console.log(JSON.stringify(metrics, null, 2));

  await page.emulateMediaType('print');

  const printMetrics = await page.evaluate(() => {
    function getInfo(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        selector,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        style: {
          width: cs.width,
          height: cs.height,
          zoom: cs.zoom,
          transform: cs.transform,
          padding: cs.padding,
          margin: cs.margin,
          boxSizing: cs.boxSizing
        }
      };
    }

    return {
      window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      root: getInfo('#root'),
      wrapper: getInfo('.report-wrapper'),
      container: getInfo('.report-pages-container'),
      page: getInfo('.print-page'),
      border: getInfo('.report-border'),
      body: getInfo('.report-body')
    };
  });

  console.log('DOM METRICS UNDER PRINT MEDIA:');
  console.log(JSON.stringify(printMetrics, null, 2));

  await browser.close();
}

debugElements();
