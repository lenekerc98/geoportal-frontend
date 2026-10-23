const puppeteer = require('puppeteer-core');

async function testBrowserDefaultPrint() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const testCases = [
    { name: 'test_current', css: '@page { size: 297mm 210mm; size: A4 landscape; margin: 0; }' },
    { name: 'test_size_landscape', css: '@page { size: landscape; margin: 0; }' },
    { name: 'test_a4_landscape_only', css: '@page { size: A4 landscape; margin: 0; }' },
    { name: 'test_297_210_only', css: '@page { size: 297mm 210mm; margin: 0; }' },
    { name: 'test_both_landscape', css: '@page { size: landscape; size: 297mm 210mm; margin: 0; }' }
  ];

  for (const tc of testCases) {
    const page = await browser.newPage();
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${tc.css}
          html, body { margin: 0; padding: 0; }
          .sheet {
            width: 297mm;
            height: 209mm;
            background: #e2e8f0;
            border: 2mm solid #000;
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div class="sheet">TEST: ${tc.name}</div>
      </body>
      </html>
    `);

    // Call pdf WITHOUT specifying landscape: true, exactly as window.print() does!
    const pdfPath = `scratch/${tc.name}.pdf`;
    await page.pdf({
      path: pdfPath,
      printBackground: true
      // No format, no landscape passed - relies 100% on CSS @page!
    });
    await page.close();
  }

  await browser.close();
  console.log('Generated all test cases without options.');
}

testBrowserDefaultPrint();
