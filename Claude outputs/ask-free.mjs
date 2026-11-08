#!/usr/bin/env node
// ask-free.mjs - schickt leichte Aufgaben ueber OmniRoute an kostenlose Modelle.
// Aufruf:  node ask-free.mjs "Aufgabe" [--file pfad]... [--stdin] [--model id] [--system "text"]
// Ausgabe: nur die Antwort auf stdout (Modellname auf stderr). Exit 1 = alle Modelle gescheitert, 2 = geblockt.
// Env (optional): OMNIROUTE_URL (Standard http://localhost:20128), OMNIROUTE_KEY, OMNIROUTE_MODELS (kommagetrennt)

import { readFileSync } from 'node:fs';

const URL_BASE = (process.env.OMNIROUTE_URL || 'http://localhost:20128').replace(/\/+$/, '');
const KEY = process.env.OMNIROUTE_KEY || '';
// Reihenfolge = Fallback-Kette. Am 08.11.2026 gegen die lokale Instanz getestet (Antwort + Tool-Call ok).
const MODELS = (process.env.OMNIROUTE_MODELS || [
  'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
  'openrouter/nvidia/nemotron-3.5-super-vl:free',
  'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'openrouter/cohere/north-mini-code:free',
].join(',')).split(',').map(s => s.trim()).filter(Boolean);

const MAX_BYTES = 400_000;
const GEHEIM_DATEI = /(^|[\\/])\.env(\.|$)|\.(pem|key|pfx|p12)$|(^|[\\/])id_(rsa|ed25519)$/i;
const GEHEIM_INHALT = /(sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(STRIPE|CJ|RESEND|DATABASE|ADMIN|JWT|SESSION|ENCRYPTION)[A-Z_]*\s*=\s*\S{6,})/;

const args = process.argv.slice(2);
let aufgabe = [], files = [], model = '', system = '', useStdin = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--file') files.push(args[++i]);
  else if (a === '--model') model = args[++i];
  else if (a === '--system') system = args[++i];
  else if (a === '--stdin') useStdin = true;
  else aufgabe.push(a);
}
if (!aufgabe.length) { console.error('Aufgabe fehlt.'); process.exit(64); }

function blocken(grund) { console.error('GEBLOCKT: ' + grund + ' - nichts wurde gesendet.'); process.exit(2); }

let teile = [];
for (const f of files) {
  if (GEHEIM_DATEI.test(f)) blocken('Datei sieht nach Secrets aus: ' + f);
  let t; try { t = readFileSync(f, 'utf8'); } catch (e) { console.error('Datei nicht lesbar: ' + f); process.exit(66); }
  teile.push(`--- Datei: ${f} ---\n${t}`);
}
if (useStdin) teile.push('--- stdin ---\n' + readFileSync(0, 'utf8'));
const kontext = teile.join('\n\n');
if (Buffer.byteLength(kontext) > MAX_BYTES) blocken('Eingabe groesser als ' + MAX_BYTES + ' Bytes');
if (GEHEIM_INHALT.test(kontext) || GEHEIM_INHALT.test(aufgabe.join(' '))) blocken('Eingabe enthaelt etwas, das wie ein Key/Secret aussieht');

const prompt = (kontext ? kontext + '\n\n' : '') + 'Aufgabe: ' + aufgabe.join(' ');
const liste = model ? [model] : MODELS;
let letzterFehler = '';

for (const m of liste) {
  try {
    const res = await fetch(URL_BASE + '/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(KEY ? { authorization: 'Bearer ' + KEY } : {}),
      },
      body: JSON.stringify({
        model: m,
        max_tokens: 2000,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { letzterFehler = `${m}: HTTP ${res.status} ${(j.error && j.error.message) || ''}`.slice(0, 200); continue; }
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    if (!text) { letzterFehler = `${m}: leere Antwort`; continue; }
    console.error('[' + m + ']');
    console.log(text);
    process.exit(0);
  } catch (e) {
    letzterFehler = `${m}: ${String(e.message || e)}`.slice(0, 200);
  }
}
console.error('Alle Modelle gescheitert. Letzter Fehler: ' + letzterFehler);
process.exit(1);
