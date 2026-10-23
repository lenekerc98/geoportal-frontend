import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

async function test() {
  const tokenResp = await fetch('http://127.0.0.1:8000/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'lcedeno', password: 'lenekerc98' })
  });
  const token = (await tokenResp.json()).access_token;
  const url = 'https://localhost:5173/reporte/planimetrico/codigo/0?batch=true&from=1&to=50&token=' + token;

  const tmpDir = path.join(os.tmpdir(), 'chrome_dbg_' + Date.now());

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--ignore-certificate-errors',
    '--allow-insecure-localhost',
    '--user-data-dir=' + tmpDir,
    '--remote-debugging-port=9333',
    url
  ]);

  await new Promise(r => setTimeout(r, 6000));

  try {
    const listResp = await fetch('http://127.0.0.1:9333/json');
    const tabs = await listResp.json();
    console.log('Opened tabs:', tabs.map(t => t.url));
    const targetTab = tabs.find(t => t.url.includes('reporte/planimetrico')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    await new Promise(r => ws.onopen = r);

    // Emulate print media
    ws.send(JSON.stringify({
      id: 1,
      method: 'Emulation.setEmulatedMedia',
      params: { media: 'print' }
    }));

    // Wait 12s for 50 predios to load
    await new Promise(r => setTimeout(r, 12000));

    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        returnByValue: true,
        expression: `(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const container = document.querySelector('.report-pages-container');
          const allEls = Array.from(document.querySelectorAll('*'));
          
          const overflowing = [];
          allEls.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 1130 || r.right > 1130) {
              overflowing.push({
                tag: el.tagName,
                class: el.className,
                id: el.id,
                rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), right: Math.round(r.right) },
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth
              });
            }
          });

          return {
            doc: { scrollWidth: docEl.scrollWidth, clientWidth: docEl.clientWidth, offsetWidth: docEl.offsetWidth },
            body: { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, offsetWidth: body.offsetWidth },
            container: container ? { scrollWidth: container.scrollWidth, clientWidth: container.clientWidth } : null,
            overflowingCount: overflowing.length,
            overflowingSamples: overflowing.slice(0, 15)
          };
        })()`
      }
    }));

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === 2) {
        const val = data.result?.result?.value || data.result?.value;
        console.log('OVERFLOW ANALYSIS RESULT:\n', JSON.stringify(val, null, 2));
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
