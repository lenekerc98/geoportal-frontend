import { spawn } from 'child_process';

async function test() {
  const tokenResp = await fetch('http://127.0.0.1:8000/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'lcedeno', password: 'lenekerc98' })
  });
  const token = (await tokenResp.json()).access_token;
  const url = 'https://localhost:5173/reporte/planimetrico/codigo/0?batch=true&from=1&to=1&token=' + token;

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--ignore-certificate-errors',
    '--allow-insecure-localhost',
    '--remote-debugging-port=9222',
    url
  ]);

  await new Promise(r => setTimeout(r, 4000));

  try {
    const listResp = await fetch('http://127.0.0.1:9222/json');
    const tabs = await listResp.json();
    const wsUrl = tabs[0].webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);

    await new Promise(r => ws.onopen = r);

    // Emulate print media
    ws.send(JSON.stringify({
      id: 1,
      method: 'Emulation.setEmulatedMedia',
      params: { media: 'print' }
    }));

    // Wait 7s for page to render
    await new Promise(r => setTimeout(r, 7000));


    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        returnByValue: true,
        expression: `(() => {
          const elements = [
            'html',
            'body',
            '#root',
            '.report-wrapper',
            '.report-pages-container',
            '.print-page',
            '.report-border'
          ];
          const res = {};
          elements.forEach(sel => {
            const el = document.querySelector(sel);
            if (!el) { res[sel] = 'NOT FOUND'; return; }
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            res[sel] = {
              rect: { x: r.x, y: r.y, width: r.width, height: r.height },
              width: cs.width,
              height: cs.height,
              zoom: cs.zoom,
              transform: cs.transform,
              padding: cs.padding,
              margin: cs.margin,
              boxSizing: cs.boxSizing
            };
          });
          return res;
        })()`
      }
    }));

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === 2) {
        console.log('PRINT MEDIA INSPECTION:\n', JSON.stringify(data.result, null, 2));
        chrome.kill();
        process.exit(0);
      }
    };
  } catch (err) {
    console.error('Error:', err);
    chrome.kill();
    process.exit(1);
  }
}

test();
