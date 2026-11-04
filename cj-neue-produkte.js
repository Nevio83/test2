/**
 * cj-neue-produkte.js — holt fuer die neuen Shop-Produkte aus dem deutschen
 * CJ-Lager alles, was fuer die Produktseiten gebraucht wird, und laedt die
 * Bilder herunter.
 *
 * Je Produkt: Details (product/query), Bestand je Variante, Versand DE -> DE
 * und alle Produkt- und Variantenbilder. Dazu eine Suche nach Alternativen
 * fuer den Laptop-Staender (nur Treffer, die im DE-Lager liegen).
 *
 * Nur lesend, bestellt nichts. Ablage: "Claude outputs/neue-produkte/"
 * (daten.json + ein Ordner je Produkt mit den Bildern; gitignored).
 * Aufruf: node cj-neue-produkte.js   (ca. 3-5 Minuten)
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { frage, zahl } = require('./cj-preischeck');
const { kurz, passt, trifft, preise } = require('./cj-bestseller');

let sharp = null;
try { sharp = require('sharp'); } catch (_) { /* dann Originale speichern */ }

const LAND = 'DE';
const ORDNER = path.join(__dirname, 'Claude outputs', 'neue-produkte');

// Auswahl von Nevio (04.11.2026) aus der Liste der DE-Lager-Produkte
const PRODUKTE = [
  ['2045341034818355201', 'Akku-Reinigungsbürste'],
  ['2107749012068052993', 'Vakuumierer'],
  ['2048305996111384578', 'Elektrische Lunchbox'],
  ['2044606585511370753', 'Kaffee- und Gewürzmühle'],
  ['2039634149366321154', 'Hand-Dampfreiniger'],
  ['1968223869935730689', 'Elektrische Zahnbürste'],
  ['2107752716750032897', 'Massagepistole'],
  ['1998997697722175490', 'Körperfettwaage'],
  ['1955906646126264322', 'Haar- und Bartschneider'],
  ['2110273969581109249', 'CarPlay-Adapter'],
  ['2087874694086242306', 'Kfz-Handyhalter mit Laden'],
  ['2100773514514837505', 'Akku-Reifenpumpe'],
  ['2045387644160598018', '3-in-1-Ladestation'],
  ['2045394788166438913', 'Kabelloses Ladepad'],
];

// Alternativen zum Laptop-Staender: Schreibtisch-Gadgets mit mehr Wow
const ALTERNATIVEN = [
  'laptop cooling pad', 'laptop stand fan', 'rgb laptop stand', 'laptop stand',
  'monitor light bar', 'screen light bar', 'monitor stand', 'monitor riser',
  'desk lamp wireless charger', 'rgb light bar', 'phone stand desk', 'headphone stand',
];

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function laden(url, versuche = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(laden(new URL(res.headers.location, url).toString(), versuche));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const teile = [];
      res.on('data', (d) => teile.push(d));
      res.on('end', () => resolve(Buffer.concat(teile)));
    });
    req.on('timeout', () => req.destroy(new Error('Zeitueberschreitung')));
    req.on('error', reject);
  }).catch(async (err) => {
    if (versuche <= 1) throw err;
    await warte(1500);
    return laden(url, versuche - 1);
  });
}

/** Bild laden und als JPEG (max. 1200 px, weisser Hintergrund) speichern. */
async function bildSpeichern(url, ziel) {
  const roh = await laden(url);
  if (sharp) {
    await sharp(roh).rotate().flatten({ background: '#ffffff' })
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true }).toFile(ziel + '.jpg');
    return path.basename(ziel) + '.jpg';
  }
  const endung = (url.match(/\.(jpe?g|png|webp)(?:\?|$)/i) || [null, 'jpg'])[1].toLowerCase();
  fs.writeFileSync(`${ziel}.${endung}`, roh);
  return `${path.basename(ziel)}.${endung}`;
}

function bilderAus(d) {
  let b = d && (d.productImageSet || d.productImage);
  if (typeof b === 'string') {
    try { b = b.trim().startsWith('[') ? JSON.parse(b) : [b]; } catch (_) { b = [b]; }
  }
  return [...new Set((Array.isArray(b) ? b : []).filter((x) => typeof x === 'string' && x.startsWith('http')))].slice(0, 15);
}

function text(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

async function versand(api, vid) {
  const f = await frage(api, '/api2.0/v1/logistic/freightCalculate', 'POST', {
    startCountryCode: LAND, endCountryCode: LAND, products: [{ vid, quantity: 1 }],
  });
  return (Array.isArray(f) ? f : []).filter((o) => o && o.logisticName).map((o) => {
    const gesamt = zahl(o.totalPostageFee);
    return { name: o.logisticName, tage: o.logisticAging || null, preisUsd: gesamt && gesamt > 0 ? gesamt : zahl(o.logisticPrice) };
  }).filter((o) => o.preisUsd != null).sort((a, b) => a.preisUsd - b.preisUsd).slice(0, 5);
}

async function produkt(api, pid, arbeitsname, alleBilder = true) {
  const e = { pid, arbeitsname, hinweise: [] };
  const d = await frage(api, '/api2.0/v1/product/query?' + new URLSearchParams({ pid }));
  const ordner = path.join(ORDNER, pid);
  fs.mkdirSync(ordner, { recursive: true });
  fs.writeFileSync(path.join(ordner, 'cj-produkt.json'), JSON.stringify(d, null, 2));
  e.name = d.productNameEn || d.productName || '';
  e.kategorieCj = d.categoryName || null;
  e.material = d.materialNameEn || d.materialName || null;
  e.verpackung = d.packingNameEn || d.packingName || null;
  e.gewichtG = preise(d.productWeight)[0] ?? null;
  e.packGewichtG = preise(d.packingWeight)[0] ?? null;
  e.zolltarif = d.entryCode || null;
  e.zollName = d.entryNameEn || null;
  e.beschreibung = text(d.description).slice(0, 6000);
  e.bilderUrls = bilderAus(d);
  const v = Array.isArray(d.variants) ? d.variants : [];
  e.varianten = [];
  for (const x of v.slice(0, alleBilder ? 12 : 4)) {
    const va = {
      vid: String(x.vid), sku: x.variantSku, key: x.variantKey || '', name: x.variantNameEn || '',
      ekUsd: zahl(x.variantSellPrice), gewichtG: zahl(x.variantWeight), bildUrl: x.variantImage || null,
      masse: [x.variantLength, x.variantWidth, x.variantHeight].map(zahl).filter((n) => n),
    };
    try {
      const lager = await frage(api, '/api2.0/v1/product/stock/queryByVid?' + new URLSearchParams({ vid: va.vid }));
      va.lager = (Array.isArray(lager) ? lager : []).map((l) => ({ land: l.countryCode || null, bestand: zahl(l.totalInventoryNum ?? l.storageNum ?? l.cjInventoryNum) }));
    } catch (err) { e.hinweise.push(`Lager ${va.sku}: ${err.message}`); }
    e.varianten.push(va);
  }
  const erste = e.varianten.find((x) => (x.lager || []).some((l) => l.land === LAND && l.bestand > 0)) || e.varianten[0];
  if (erste) {
    try { e.versand = await versand(api, erste.vid); } catch (err) { e.hinweise.push(`Versand: ${err.message}`); }
  }
  // Bilder
  e.bilder = [];
  const urls = alleBilder ? e.bilderUrls : e.bilderUrls.slice(0, 3);
  for (const [i, url] of urls.entries()) {
    try { e.bilder.push({ datei: await bildSpeichern(url, path.join(ordner, `bild-${String(i + 1).padStart(2, '0')}`)), url }); }
    catch (err) { e.hinweise.push(`Bild ${i + 1}: ${err.message}`); }
  }
  if (alleBilder) {
    for (const va of e.varianten) {
      if (!va.bildUrl) continue;
      try { va.bild = await bildSpeichern(va.bildUrl, path.join(ordner, `variante-${String(va.sku).replace(/[^A-Za-z0-9_-]/g, '_')}`)); }
      catch (err) { e.hinweise.push(`Variantenbild ${va.sku}: ${err.message}`); }
    }
  }
  return e;
}

async function main(api) {
  if (!api) { const CJ = require('./cj-dropshipping-api'); api = new CJ(); }
  fs.mkdirSync(ORDNER, { recursive: true });
  const ziel = path.join(ORDNER, 'daten.json');
  const daten = { stand: new Date().toISOString(), sharp: !!sharp, produkte: [], alternativen: [], suchen: {}, hinweise: [] };
  const speichern = () => fs.writeFileSync(ziel, JSON.stringify(daten, null, 2));
  if (!sharp) console.log('Hinweis: sharp nicht gefunden, Bilder werden unverändert gespeichert.');

  for (const [i, [pid, name]] of PRODUKTE.entries()) {
    process.stdout.write(`[${i + 1}/${PRODUKTE.length}] ${name} … `);
    try { const e = await produkt(api, pid, name); daten.produkte.push(e); console.log(`${e.bilder.length} Bilder, ${e.varianten.length} Varianten`); }
    catch (err) { daten.hinweise.push(`${name}: ${err.message}`); console.log('Fehler: ' + err.message); }
    speichern();
  }

  // Alternativen zum Laptop-Staender
  const gefunden = new Map();
  for (const wort of ALTERNATIVEN) {
    try {
      const d = await frage(api, '/api2.0/v1/product/listV2?' + new URLSearchParams({ keyWord: wort, page: 1, size: 20, countryCode: LAND, orderBy: 0 }));
      const liste = (d && Array.isArray(d.content) ? d.content : []).flatMap((c) => (c && Array.isArray(c.productList)) ? c.productList : []);
      const genau = liste.map((roh) => kurz(roh, `suche:${wort}`)).filter((p) => p.pid && trifft(p.name, wort) && passt(p));
      daten.suchen[wort] = genau.map((p) => ({ pid: p.pid, name: p.name.slice(0, 90), listedNum: p.listedNum, ekUsd: p.ekUsd }));
      for (const p of genau) if (!gefunden.has(p.pid)) gefunden.set(p.pid, p);
      console.log(`Suche "${wort}": ${liste.length} Treffer, ${genau.length} passend`);
    } catch (err) { daten.hinweise.push(`Suche ${wort}: ${err.message}`); }
  }
  const beste = [...gefunden.values()].sort((a, b) => (b.listedNum || 0) - (a.listedNum || 0)).slice(0, 10);
  for (const [i, p] of beste.entries()) {
    process.stdout.write(`[Alternative ${i + 1}/${beste.length}] ${p.name.slice(0, 55)} … `);
    try { const e = await produkt(api, p.pid, 'Alternative Laptop-Staender', false); e.listedNum = p.listedNum; daten.alternativen.push(e); console.log('ok'); }
    catch (err) { daten.hinweise.push(`Alternative ${p.pid}: ${err.message}`); console.log('Fehler: ' + err.message); }
    speichern();
  }
  console.log(`\nFertig. Ergebnis: ${path.relative(process.cwd(), ziel)}`);
}

module.exports = { main, produkt, text };

if (require.main === module) {
  main().catch((err) => { console.error('Abbruch:', err.message); process.exit(1); });
}
