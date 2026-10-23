const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function test() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: 297mm 210mm; margin: 0; }
        html, body { margin: 0; padding: 0; width: 297mm; height: 210mm; background: red; }
        .box { width: 297mm; height: 210mm; background: blue; border: 5mm solid black; box-sizing: border-box; }
      </style>
    </head>
    <body>
      <div class="box">Hello</div>
    </body>
    </html>
  `);
  await page.pdf({
    path: 'scratch/test_box.pdf',
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await browser.close();
  console.log('Done test_box.pdf');
}
test();
