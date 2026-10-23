const puppeteer = require('puppeteer-core');

async function debugLayout() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/reporte/planimetrico/codigo/0?batch=true&from=1&to=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__BATCH_READY__ === true, { timeout: 60000 });

  const info = await page.evaluate(() => {
    const el = document.querySelector('.print-page');
    const r = el ? el.getBoundingClientRect() : null;
    const cs = el ? window.getComputedStyle(el) : null;
    const parent = el ? el.parentElement : null;
    const pr = parent ? parent.getBoundingClientRect() : null;
    const pcs = parent ? window.getComputedStyle(parent) : null;
    return {
      elRect: r ? { width: r.width, height: r.height, top: r.top, left: r.left } : null,
      elStyle: cs ? { width: cs.width, height: cs.height, padding: cs.padding, zoom: cs.zoom } : null,
      parentTag: parent ? parent.className : null,
      parentRect: pr ? { width: pr.width, height: pr.height } : null,
      parentStyle: pcs ? { width: pcs.width, height: pcs.height, zoom: pcs.zoom } : null,
      windowSize: { innerWidth: window.innerWidth, innerHeight: window.innerHeight }
    };
  });

  console.log('DEBUG INFO:', JSON.stringify(info, null, 2));
  await browser.close();
}

debugLayout();
