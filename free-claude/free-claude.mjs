#!/usr/bin/env node
// free-claude.mjs – schickt eine Aufgabe an FreeLLMAPI (lokal), Modelle nach ranking.json.
// Aufruf:  node free-claude.mjs "Aufgabe" [--code | --smart | --fast | --free] [--n 6]
//          --code = beste Modelle fürs Programmieren (nur mit Tool-Unterstützung)
//          echo "Aufgabe" | node free-claude.mjs
// Key:     Umgebungsvariable FREELLMAPI_KEY oder Datei ~/.free-claude-key (NICHT ins Repo legen).
// URL:     FREELLMAPI_URL (Standard http://127.0.0.1:31415/v1, Port der Desktop-App)
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const url = (process.env.FREELLMAPI_URL || 'http://127.0.0.1:31415/v1').replace(/\/$/, '');
const keyFile = join(homedir(), '.free-claude-key');
const key = process.env.FREELLMAPI_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : '');
if (!key) { console.error('FEHLER: kein Key. FREELLMAPI_KEY setzen oder ' + keyFile + ' anlegen.'); process.exit(2); }

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const ni = args.indexOf('--n');
const n = (ni >= 0 && Number(args[ni + 1])) || 6;
const axis = flag('--code') ? 'code' : flag('--smart') ? 'smart' : flag('--fast') ? 'speed' : flag('--free') ? 'free' : 'score';
let prompt = args.filter((a, i) => !['--smart', '--fast', '--free', '--code', '--n'].includes(a) && !(ni >= 0 && i === ni + 1)).join(' ').trim();
if (!prompt && !process.stdin.isTTY) prompt = readFileSync(0, 'utf8').trim();
if (!prompt) { console.error('FEHLER: keine Aufgabe übergeben.'); process.exit(2); }

const ranking = JSON.parse(readFileSync(join(dir, 'ranking.json'), 'utf8'));
// Reihenfolge: nach gewählter Achse, bei Gleichstand nach Gesamtwertung; Modelle mit Gesamtwert < 0.45 fliegen raus.
const chain = ranking.chain
  .filter((m) => (axis === 'code' ? m.tools && m.code >= 0.5 : m.score >= 0.45))
  .sort((a, b) => b[axis] - a[axis] || b.score - a.score)
  .slice(0, n)
  .map((m) => m.model);
chain.push('auto'); // letzter Rückfall: Router entscheidet selbst

const fehler = [];
let erledigt = false;
for (const model of chain) {
  try {
    const r = await fetch(url + '/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(Number(process.env.FREE_TIMEOUT_MS) || 25000),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json().catch(() => ({}));
    const text = (j.choices?.[0]?.message?.content || '').trim();
    if (r.ok && text) {
      console.log(`[${model} via ${r.headers.get('x-routed-via') || '?'}]\n${text}`);
      erledigt = true;
      break; // kein process.exit(): hartes Beenden löst unter Windows/Node einen libuv-Fehler aus
    }
    fehler.push(`${model} HTTP ${r.status}${r.ok ? ' ohne Text' : ''}`);
  } catch (e) {
    fehler.push(`${model} ${String(e.message || e).slice(0, 60)}`);
  }
}
if (!erledigt) {
  console.error('FEHLER: ' + fehler.join(' | '));
  process.exitCode = 1;
}
