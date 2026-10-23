const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function testOrientation() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const cases = [
    { name: 'case1_a4_landscape', css: 'size: A4 landscape; margin: 0;' },
    { name: 'case2_297_210', css: 'size: 297mm 210mm; margin: 0;' },
    { name: 'case3_landscape', css: 'size: landscape; margin: 0;' }
  ];

  for (const c of cases) {
    const page = await browser.newPage();
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { ${c.css} }
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #eee; }
          .sheet {
            width: 297mm;
            height: 209mm;
            box-sizing: border-box;
            border: 5mm solid red;
            background: yellow;
          }
        </style>
      </head>
      <body>
        <div class="sheet">TEST ${c.name}</div>
      </body>
      </html>
    `);

    const pdfPath = `scratch/${c.name}.pdf`;
    await page.pdf({
      path: pdfPath,
      preferCSSPageSize: true,
      printBackground: true
    });
    await page.close();
  }

  await browser.close();
}

testOrientation();
