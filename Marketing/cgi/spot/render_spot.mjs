// Maios Motion-Spot rendern – ohne Zusatzpakete: Node (eingebautes fetch/WebSocket) + installiertes Chrome + ffmpeg.
//
//   node Marketing/cgi/spot/render_spot.mjs <cfg.json> --out x.mp4            ganzes Video (30 fps, ohne Ton)
//   node Marketing/cgi/spot/render_spot.mjs <cfg.json> --stills 0,0.5,1.5,3   nur Standbilder (still_<t>.jpg)
//   Optionen: --fps 30  --dir <ordner für Standbilder/Ereignisse>  --chrome <pfad zu chrome.exe>
//             --seite Marketing/cgi/spot/vision.html   andere Vorlage mit derselben Schnittstelle (Standard: spot.html)
//
// <cfg.json> liegt neben spot.html oder irgendwo im Repo. Nebenbei entsteht <out>.events.json
// (Klang-Ereignisse: tipp/klick/whoosh/pop/ting mit Sekunde), die spot_ton.py liest.
// Chrome läuft mit eigenem, frischem Profil (sonst entsteht still nichts, wenn Chrome offen ist).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (typeof WebSocket === 'undefined') { console.error(`Node ${process.version} hat kein eingebautes WebSocket – Node 22 oder neuer nötig (lokal: node -v).`); process.exit(1); }
const HIER = path.dirname(fileURLToPath(import.meta.url));
const STAMM = path.resolve(HIER, '../../..');   // Repo-Stamm (dort liegen "produkt bilder/")
const arg = process.argv.slice(2);
const opt = (n, d) => { const i = arg.indexOf('--' + n); return i >= 0 ? arg[i + 1] : d; };
const cfg = arg[0];
if (!cfg || cfg.startsWith('--')) { console.error('Aufruf: node render_spot.mjs <cfg.json> --out x.mp4 | --stills 0,1.5'); process.exit(1); }
const FPS = +opt('fps', 30);
const OUT = opt('out', null), STILLS = opt('stills', null);
const DIR = opt('dir', OUT ? path.dirname(path.resolve(OUT)) : path.resolve('.'));
const CHROME = opt('chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p)));
if (!CHROME) { console.error('Kein Chrome/Edge gefunden, --chrome <pfad> angeben'); process.exit(1); }

// --- kleiner Server, nur lesend, nur 127.0.0.1, nur innerhalb des Repo-Stamms ---
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, s) => {
  const p = path.resolve(STAMM, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(STAMM) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'Content-Type': TYP[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(s);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const PORT = srv.address().port;

// --- Chrome headless mit eigenem Profil ---
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'maios-spot-'));
const DBG = 9300 + Math.floor(Math.random() * 500);
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profil}`, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1920',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
const ende = (code) => { try { ch.kill(); } catch {} srv.close(); setTimeout(() => { try { fs.rmSync(profil, { recursive: true, force: true }); } catch {} process.exit(code); }, 400); };

let ziel;
for (let i = 0; i < 60 && !ziel; i++) {
  await new Promise(r => setTimeout(r, 250));
  try { ziel = (await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!ziel) { console.error('Chrome antwortet nicht'); ende(1); await new Promise(() => {}); }
const ws = new WebSocket(ziel.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let nr = 0; const wart = new Map();
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && wart.has(d.id)) { wart.get(d.id)(d); wart.delete(d.id); } });
const cdp = (method, params = {}) => new Promise((res, rej) => { const id = ++nr; wart.set(id, d => d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result)); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'JS-Fehler'); return r.result.value; };

try {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
  const rel = path.relative(STAMM, path.resolve(cfg)).split(path.sep).join('/');
  const vorlage = path.relative(STAMM, path.resolve(STAMM, opt('seite', 'Marketing/cgi/spot/spot.html'))).split(path.sep).join('/');
  const seite = `http://127.0.0.1:${PORT}/${vorlage}?cfg=${encodeURIComponent('/' + rel)}`;
  await cdp('Page.navigate', { url: seite });
  let ok = false;
  for (let i = 0; i < 240 && !ok; i++) { await new Promise(r => setTimeout(r, 250)); ok = await js('window.__ready===true').catch(() => false);
    const f = await js('window.__fehler||null').catch(() => null); if (f) throw new Error(f); }
  if (!ok) throw new Error('Seite wird nicht fertig (Bilder/Schriften?)');
  const dauer = await js('window.__dauer');
  const shot = async () => Buffer.from((await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 93, captureBeyondViewport: false })).data, 'base64');

  if (STILLS) {
    fs.mkdirSync(DIR, { recursive: true });
    for (const t of STILLS.split(',').map(Number)) { await js(`window.__frame(${t})`); const f = path.join(DIR, `still_${t.toFixed(2)}.jpg`); fs.writeFileSync(f, await shot()); console.log(f); }
  } else {
    if (!OUT) throw new Error('--out oder --stills angeben');
    fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
    fs.writeFileSync(OUT.replace(/\.mp4$/, '') + '.events.json', JSON.stringify({ dauer, events: await js('window.__events') }, null, 1));
    const n = Math.round(dauer * FPS);
    const ff = spawn('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await js(`window.__frame(${(i / FPS).toFixed(5)})`);
      const b = await shot(); if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 30 === 0) process.stdout.write(`Bild ${i}/${n}  ${((Date.now() - t0) / 1000 / (i + 1)).toFixed(2)} s/Bild\n`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log(`fertig: ${OUT}  ${n} Bilder, ${dauer.toFixed(2)} s, ${((Date.now() - t0) / 1000).toFixed(0)} s Rechenzeit`);
  }
  ende(0);
} catch (e) { console.error('FEHLER', e.message); ende(1); }
