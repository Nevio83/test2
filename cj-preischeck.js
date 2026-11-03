/**
 * cj-preischeck.js — holt fuer jedes CJ-Produkt aus products.json die
 * aktuellen Einkaufspreise je Variante, die Lagerorte und den guenstigsten
 * Versand nach Deutschland direkt bei CJ.
 *
 * Aendert NICHTS am Shop und bestellt nichts: nur lesende Abfragen plus
 * freightCalculate (eine reine Preisauskunft). Ergebnis landet in
 * "Claude outputs/cj-preischeck.json"; die Bewertung (Gewinn je Produkt)
 * passiert danach getrennt, damit man sie aendern kann, ohne CJ neu zu fragen.
 *
 * Aufruf: npm run preischeck   (dauert ein paar Minuten, CJ erlaubt nur
 * eine Anfrage pro Sekunde fuer das ganze Konto)
 *
 * Gezaehlt wird beim Versand totalPostageFee, nicht logisticPrice: genau das
 * hat CJ bei der ersten echten Bestellung (23.09.) berechnet, siehe
 * cj-bestellung.js versandPreis().
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const CJ = require('./cj-dropshipping-api');

const ZIEL = 'DE';
const PAUSE_MS = 1300;
const EU_LAGER = ['DE', 'NL', 'PL', 'FR', 'IT', 'ES', 'BE', 'CZ', 'AT', 'HU', 'PT', 'SE', 'DK', 'IE'];
const AUSGABE = path.join(__dirname, 'Claude outputs', 'cj-preischeck.json');

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const zahl = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };

let letzteAnfrage = 0;
async function frage(api, pfad, methode = 'GET', daten = null) {
  const seit = Date.now() - letzteAnfrage;
  if (seit < PAUSE_MS) await warte(PAUSE_MS - seit);
  letzteAnfrage = Date.now();
  const r = await api.makeRequest(pfad, methode, daten);
  // Der Notbetrieb erfindet Daten (Produkte, Versand 0 €) — fuer eine
  // Preispruefung waere das schlimmer als gar keine Antwort.
  if (!r || r.source === 'fallback') {
    const f = api.lastError ? `${api.lastError.status || ''} ${api.lastError.message || ''}`.trim() : 'keine Antwort';
    throw new Error(`CJ nicht erreichbar (${f})`);
  }
  if (r.result === false || (r.code !== undefined && Number(r.code) !== 200)) {
    throw new Error(`CJ: ${r.message || r.code}`);
  }
  return r.data;
}

function versandPreis(o) {
  const gesamt = zahl(o && o.totalPostageFee);
  if (gesamt && gesamt > 0) return gesamt;
  return zahl(o && o.logisticPrice);
}

async function versand(api, vid, von) {
  const daten = await frage(api, '/api2.0/v1/logistic/freightCalculate', 'POST', {
    startCountryCode: von, endCountryCode: ZIEL, products: [{ vid, quantity: 1 }],
  });
  const optionen = (Array.isArray(daten) ? daten : [])
    .filter((o) => o && o.logisticName && versandPreis(o) != null)
    .map((o) => ({ name: o.logisticName, preisUsd: versandPreis(o), logisticPrice: zahl(o.logisticPrice), tage: o.logisticAging || null }))
    .sort((a, b) => a.preisUsd - b.preisUsd);
  return { von, guenstigster: optionen[0] || null, optionen: optionen.slice(0, 5) };
}

async function produktZuSku(api, sku) {
  const d = await frage(api, '/api2.0/v1/product/query?' + new URLSearchParams({ variantSku: sku }));
  return d && Array.isArray(d.variants) ? d : null;
}

function variante(v, sku) {
  return {
    sku, gefunden: true, vid: String(v.vid), ekUsd: zahl(v.variantSellPrice),
    gewichtG: zahl(v.variantWeight), bezeichnung: v.variantKey || v.variantNameEn || '',
  };
}

async function pruefeProdukt(api, p) {
  const farben = Array.isArray(p.colors) ? p.colors : [];
  const skus = farben.length ? farben.map((c) => c.sku).filter(Boolean) : [p.sku];
  const e = { id: p.id, name: p.name, vk: p.price, skus, varianten: [], lager: [], versand: [], hinweise: [] };

  let prod = null;
  for (const sku of skus) {
    try { prod = await produktZuSku(api, sku); } catch (err) { e.hinweise.push(`${sku}: ${err.message}`); }
    if (prod) break;
  }
  if (!prod) { e.status = 'nicht_gefunden'; return e; }

  e.pid = prod.pid || null;
  e.cjName = prod.productNameEn || null;
  const nachSku = new Map(prod.variants.map((v) => [v.variantSku, v]));
  for (const sku of skus) {
    const v = nachSku.get(sku);
    if (v) { e.varianten.push(variante(v, sku)); continue; }
    // SKU gehoert evtl. zu einem anderen CJ-Produkt — einzeln nachschlagen.
    try {
      const anderes = await produktZuSku(api, sku);
      const w = anderes && anderes.variants.find((x) => x.variantSku === sku);
      e.varianten.push(w ? { ...variante(w, sku), anderePid: anderes.pid } : { sku, gefunden: false });
    } catch (err) {
      e.varianten.push({ sku, gefunden: false });
      e.hinweise.push(`${sku}: ${err.message}`);
    }
  }
  const gefunden = e.varianten.filter((v) => v.gefunden);
  if (!gefunden.length) { e.status = 'keine_variante'; return e; }

  try {
    const lager = await frage(api, '/api2.0/v1/product/stock/queryByVid?' + new URLSearchParams({ vid: gefunden[0].vid }));
    e.lager = (Array.isArray(lager) ? lager : []).map((l) => ({
      land: l.countryCode || null,
      gebiet: l.areaEn || null,
      bestand: zahl(l.totalInventoryNum ?? l.storageNum ?? l.cjInventoryNum),
    }));
  } catch (err) { e.hinweise.push(`Lager: ${err.message}`); }

  // Versand haengt am Gewicht: je Gewichtsgruppe eine Abfrage statt je Variante.
  const gruppen = new Map();
  for (const v of gefunden) if (!gruppen.has(String(v.gewichtG))) gruppen.set(String(v.gewichtG), v);
  const start = ['CN'];
  for (const l of e.lager) {
    if (l.land && EU_LAGER.includes(l.land) && (l.bestand || 0) > 0 && !start.includes(l.land)) start.push(l.land);
  }
  for (const v of gruppen.values()) {
    for (const von of start) {
      try { e.versand.push({ gewichtG: v.gewichtG, vid: v.vid, ...(await versand(api, v.vid, von)) }); }
      catch (err) { e.hinweise.push(`Versand ab ${von} (${v.gewichtG} g): ${err.message}`); }
    }
  }
  e.status = 'ok';
  return e;
}

async function main() {
  const daten = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));
  const liste = (Array.isArray(daten) ? daten : daten.products).filter((p) => /^CJ/i.test(String(p.sku || '')));
  const api = new CJ();
  const ergebnis = { stand: new Date().toISOString(), ziel: ZIEL, produkte: [] };
  fs.mkdirSync(path.dirname(AUSGABE), { recursive: true });
  console.log(`Prüfe ${liste.length} CJ-Produkte bei CJ (dauert ein paar Minuten) …`);
  for (const [i, p] of liste.entries()) {
    process.stdout.write(`[${i + 1}/${liste.length}] ${p.name} … `);
    let e;
    try { e = await pruefeProdukt(api, p); }
    catch (err) { e = { id: p.id, name: p.name, vk: p.price, status: 'fehler', hinweise: [err.message] }; }
    ergebnis.produkte.push(e);
    console.log(e.status);
    fs.writeFileSync(AUSGABE, JSON.stringify(ergebnis, null, 2));
  }
  const ok = ergebnis.produkte.filter((x) => x.status === 'ok').length;
  console.log(`\nFertig: ${ok}/${liste.length} vollständig geprüft. Ergebnis: ${path.relative(process.cwd(), AUSGABE)}`);
}

main().catch((err) => { console.error('Abbruch:', err.message); process.exit(1); });
