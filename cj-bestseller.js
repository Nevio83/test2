/**
 * cj-bestseller.js — sucht die gefragtesten CJ-Produkte, die im deutschen
 * CJ-Lager liegen, als Grundlage fuer neue Shop-Produkte.
 *
 * Zwei Quellen, beide ueber product/listV2 mit countryCode=DE:
 *   1. die meistgelisteten Produkte im DE-Lager (orderBy=1 = listedNum:
 *      wie viele CJ-Haendler das Produkt in ihren Shop uebernommen haben.
 *      Verkaufszahlen gibt CJ ueber die API nicht heraus, das ist der beste
 *      Beliebtheitswert, den es gibt)
 *   2. gezielte Suchen nach Produktarten, die laut Trendrecherche gerade
 *      gefragt sind (Liste SUCHEN), je die meistgelisteten Treffer
 *
 * Fuer die besten Kandidaten danach: Varianten, Bilder und Beschreibung
 * (product/query), echter Bestand je Land (stock/queryByVid) und der echte
 * Versandpreis DE -> DE (freightCalculate).
 *
 * Nur lesend, bestellt nichts. Ergebnis: "Claude outputs/cj-bestseller.json",
 * wird nach jedem Produkt gespeichert (ein Abbruch verliert also nichts).
 * Aufruf: node cj-bestseller.js   (ca. 10 Minuten, CJ erlaubt 1 Anfrage/s)
 * Optional: BESTSELLER_SEITEN=10 BESTSELLER_JE_SUCHE=3 BESTSELLER_KANDIDATEN=120
 *
 * Nachtrag: node cj-bestseller.js --nachtrag
 *   CJs Suche verknuepft die Woerter mit ODER ("sunset lamp" findet jede
 *   Lampe). Der Nachtrag sucht deshalb nach Relevanz (orderBy=0) und behaelt
 *   nur Treffer, deren Name ALLE Woerter enthaelt, plus die Produkt-IDs aus
 *   "Claude outputs/nachtrag-pids.txt" (eine pro Zeile, # = Kommentar).
 *   Ergebnis: "Claude outputs/cj-bestseller-nachtrag.json" (ca. 5 Minuten).
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { frage, zahl } = require('./cj-preischeck');

const LAND = 'DE';
const SEITEN = Number(process.env.BESTSELLER_SEITEN || 10);
const JE_SUCHE = Number(process.env.BESTSELLER_JE_SUCHE || 3);
const KANDIDATEN = Number(process.env.BESTSELLER_KANDIDATEN || 120);
const MAX_SUCHEN = Number(process.env.BESTSELLER_MAX_SUCHEN || 999);
const AUSGABE = process.env.BESTSELLER_AUSGABE || path.join(__dirname, 'Claude outputs', 'cj-bestseller.json');

// Suchbegriff (englisch, so sucht CJ) -> Shop-Kategorie. Begriffe aus der
// Trendrecherche Nov 2026 (copyfy Q4- und November-Listen, TikTok DE,
// AliExpress-EU-Lichtdaten) plus Ersatz fuer die bei CJ ausgelaufenen Produkte.
const SUCHEN = [
  ['sunset lamp', 'Beleuchtung'],
  ['galaxy projector', 'Beleuchtung'],
  ['moon lamp', 'Beleuchtung'],
  ['motion sensor night light', 'Beleuchtung'],
  ['under cabinet light', 'Beleuchtung'],
  ['led strip lights', 'Beleuchtung'],
  ['solar string lights', 'Beleuchtung'],
  ['fairy lights', 'Beleuchtung'],
  ['christmas lights', 'Beleuchtung'],
  ['neck reading light', 'Beleuchtung'],
  ['rechargeable table lamp', 'Beleuchtung'],
  ['book nook', 'Beleuchtung'],
  ['led candles', 'Beleuchtung'],
  ['electric salt pepper grinder', 'Haushalt und Küche'],
  ['milk frother', 'Haushalt und Küche'],
  ['meat thermometer', 'Haushalt und Küche'],
  ['vegetable chopper', 'Haushalt und Küche'],
  ['electric wine opener', 'Haushalt und Küche'],
  ['oil sprayer', 'Haushalt und Küche'],
  ['vacuum sealer', 'Haushalt und Küche'],
  ['electric lunch box', 'Haushalt und Küche'],
  ['electric spin scrubber', 'Haushalt und Küche'],
  ['kitchen scale', 'Haushalt und Küche'],
  ['cable organizer', 'Haushalt und Küche'],
  ['handheld vacuum cleaner', 'Haushalt und Küche'],
  ['electric heated blanket', 'Körperpflege/Wellness'],
  ['neck heating pad', 'Körperpflege/Wellness'],
  ['scalp massager', 'Körperpflege/Wellness'],
  ['hand massager', 'Körperpflege/Wellness'],
  ['neck massager', 'Körperpflege/Wellness'],
  ['massage gun', 'Körperpflege/Wellness'],
  ['acupressure mat', 'Körperpflege/Wellness'],
  ['bluetooth sleep mask', 'Körperpflege/Wellness'],
  ['humidifier', 'Körperpflege/Wellness'],
  ['facial steamer', 'Körperpflege/Wellness'],
  ['hair straightener brush', 'Körperpflege/Wellness'],
  ['led makeup mirror', 'Körperpflege/Wellness'],
  ['electric precision screwdriver', 'Technik/Gadgets'],
  ['phone gimbal', 'Technik/Gadgets'],
  ['wireless charging station', 'Technik/Gadgets'],
  ['tire inflator', 'Technik/Gadgets'],
  ['ring light', 'Technik/Gadgets'],
  ['dash cam', 'Technik/Gadgets'],
  ['bluetooth speaker', 'Technik/Gadgets'],
  ['car vacuum cleaner', 'Technik/Gadgets'],
];

// Passt nicht zum Sortiment (Technik, Haushalt/Kueche, Licht, Wellness) oder ist
// rechtlich heikel: Kleidungsgroessen, Spielzeug-CE, Kosmetik zum Auftragen,
// Lebensmittel, Medizinprodukte, Akkupacks/Powerbanks (Batterierecht, Gefahrgut).
const AUSSCHLUSS = new RegExp([
  '\\b(cloth(es|ing)?|dress(es)?|t-?shirts?|shirts?|hoodies?|sweaters?|pants|trousers|jeans|skirts?|coats?|jackets?|vests?|socks?|underwear|bra|lingerie|bikinis?|swim\\w*|shoes?|boots?|sneakers?|sandals?|slippers?|hats?|caps?|gloves?|scarf|scarves|beanies?|leggings?)\\b',
  'wig|hair extension|jewel|necklace|earring|\\brings?\\b(?! ?light)|bracelet|watch band|handbag|shoulder bag|tote bag|crossbody|backpack|purse|wallet',
  '\\btoys?\\b|\\bkids?\\b|children|baby|infant|\\bpets?\\b|\\bdogs?\\b|\\bcats?\\b|puppy|kitten|aquarium',
  'snack|candy|chocolate|supplement|vitamin|\\btea\\b|coffee bean|lipstick|eyeshadow|mascara|eyelash|perfume|serum|lotion|face cream|body cream|nail polish|nail gel|tattoo',
  'medical|medicine|therapy|blood pressure|oximeter|glucose|hearing aid|\\bems\\b|posture corrector|pain relief',
  'power ?bank|portable charger|external battery|battery pack|jump starter|weapon|pistol|rifle|airsoft|\\bknife|knives|dagger|\\badult\\b|\\bsex|vape|e-cig|cigarette|drone',
  'ornament|wreath|garland|artificial (flower|plant|tree)|christmas tree|garden tool|wheelbarrow|lawn',
].join('|'), 'i');

function preise(x) {
  const n = String(x == null ? '' : x).match(/\d+(?:\.\d+)?/g);
  return n ? n.map(Number).filter(Number.isFinite) : [];
}

function kurz(p, quelle) {
  const pr = preise(p.sellPrice);
  return {
    pid: String(p.id || p.pid || ''),
    name: p.nameEn || p.productNameEn || p.productName || '',
    sku: p.sku || p.productSku || null,
    bild: p.bigImage || p.productImage || null,
    kategorieCj: [p.oneCategoryName, p.twoCategoryName, p.threeCategoryName].filter(Boolean).join(' > ') || p.categoryName || null,
    ekUsd: pr.length ? Math.min(...pr) : null,
    ekUsdBis: pr.length ? Math.max(...pr) : null,
    listedNum: zahl(p.listedNum),
    lagerDeListe: zahl(p.warehouseInventoryNum),
    ce: p.hasCECertification ?? null,
    verifiziertesLager: p.verifiedWarehouse ?? null,
    lieferzeitCj: p.deliveryCycle || null,
    lieferant: p.supplierName || null,
    erstellt: p.createAt || p.createTime || null,
    quellen: [quelle],
  };
}

function passt(p) {
  if (!p.pid || !p.name) return false;
  if (AUSSCHLUSS.test(`${p.name} ${p.kategorieCj || ''}`)) return false;
  return p.ekUsd != null && p.ekUsd >= 2 && p.ekUsd <= 60;
}

async function liste(api, params) {
  const d = await frage(api, '/api2.0/v1/product/listV2?' + new URLSearchParams(params));
  const inhalt = (d && Array.isArray(d.content)) ? d.content : [];
  return {
    gesamt: zahl(d && d.totalRecords),
    liste: inhalt.flatMap((c) => (c && Array.isArray(c.productList)) ? c.productList : []),
  };
}

function bilderAus(d) {
  let b = d && (d.productImageSet || d.productImage);
  if (typeof b === 'string') {
    try { b = b.trim().startsWith('[') ? JSON.parse(b) : [b]; } catch { b = [b]; }
  }
  return (Array.isArray(b) ? b : []).filter((x) => typeof x === 'string' && x.startsWith('http')).slice(0, 10);
}

function versandOption(o) {
  const aus = { name: o.logisticName || null, tage: o.logisticAging || null };
  for (const [k, v] of Object.entries(o)) {
    if (/fee|price|tax|cost/i.test(k) && (typeof v === 'number' || typeof v === 'string')) aus[k] = v;
  }
  const gesamt = zahl(o.totalPostageFee);
  aus.preisUsd = gesamt && gesamt > 0 ? gesamt : zahl(o.logisticPrice);
  return aus;
}

/** Alle Woerter des Suchbegriffs (ab 3 Buchstaben, Plural-s egal) stehen im Namen. */
function trifft(name, wort) {
  const n = String(name || '').toLowerCase();
  return wort.toLowerCase().split(/\s+/).filter((t) => t.length >= 3)
    .every((t) => n.includes(t.length > 3 ? t.replace(/s$/, '') : t));
}

/** Varianten, Bilder, Beschreibung, Bestand und Versand DE -> DE fuer ein Produkt. */
async function pruefe(api, k) {
  const e = { ...k, varianten: null, lager: [], versand: null, hinweise: [] };
  try {
    const d = await frage(api, '/api2.0/v1/product/query?' + new URLSearchParams({ pid: k.pid }));
    if (!e.name) e.name = (d && (d.productNameEn || d.productName)) || '';
    if (e.ekUsd == null) { const pr = preise(d && d.sellPrice); e.ekUsd = pr.length ? Math.min(...pr) : null; e.ekUsdBis = pr.length ? Math.max(...pr) : null; }
    if (e.listedNum == null && d && d.listedNum != null) e.listedNum = zahl(d.listedNum);
    if (!e.kategorieCj && d && d.categoryName) e.kategorieCj = d.categoryName;
    const v = (d && Array.isArray(d.variants)) ? d.variants : [];
    e.varianten = v.slice(0, 30).map((x) => ({
      vid: String(x.vid), sku: x.variantSku, key: x.variantKey || x.variantNameEn || '',
      ekUsd: zahl(x.variantSellPrice), gewichtG: zahl(x.variantWeight), bild: x.variantImage || null,
    }));
    e.anzahlVarianten = v.length;
    e.bilder = bilderAus(d);
    e.gewichtG = preise(d && d.productWeight)[0] ?? null;
    e.packGewichtG = preise(d && d.packingWeight)[0] ?? null;
    e.material = (d && (d.materialNameEn || d.materialName)) || null;
    e.beschreibung = String((d && d.description) || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
    const guenstigste = e.varianten.filter((x) => x.ekUsd != null).sort((a, b) => a.ekUsd - b.ekUsd)[0] || e.varianten[0];
    if (guenstigste) {
      try {
        const lager = await frage(api, '/api2.0/v1/product/stock/queryByVid?' + new URLSearchParams({ vid: guenstigste.vid }));
        e.lager = (Array.isArray(lager) ? lager : []).map((l) => ({ land: l.countryCode || null, bestand: zahl(l.totalInventoryNum ?? l.storageNum ?? l.cjInventoryNum) }));
      } catch (err) { e.hinweise.push(`Lager: ${err.message}`); }
      try {
        const f = await frage(api, '/api2.0/v1/logistic/freightCalculate', 'POST', {
          startCountryCode: LAND, endCountryCode: LAND, products: [{ vid: guenstigste.vid, quantity: 1 }],
        });
        const optionen = (Array.isArray(f) ? f : []).filter((o) => o && o.logisticName).map(versandOption)
          .filter((o) => o.preisUsd != null).sort((a, b) => a.preisUsd - b.preisUsd);
        e.versand = { vid: guenstigste.vid, guenstigster: optionen[0] || null, optionen: optionen.slice(0, 5) };
      } catch (err) { e.hinweise.push(`Versand: ${err.message}`); }
    }
    e.status = 'ok';
  } catch (err) { e.status = 'fehler'; e.hinweise.push(err.message); }
  return e;
}

async function nachtrag(api) {
  if (!api) { const CJ = require('./cj-dropshipping-api'); api = new CJ(); }
  const ausgabe = process.env.BESTSELLER_AUSGABE || path.join(__dirname, 'Claude outputs', 'cj-bestseller-nachtrag.json');
  const pidDatei = process.env.BESTSELLER_PID_DATEI || path.join(__dirname, 'Claude outputs', 'nachtrag-pids.txt');
  const ergebnis = { stand: new Date().toISOString(), land: LAND, modus: 'nachtrag', suchen: {}, hinweise: [], kandidaten: [] };
  fs.mkdirSync(path.dirname(ausgabe), { recursive: true });
  const speichern = () => fs.writeFileSync(ausgabe, JSON.stringify(ergebnis, null, 2));

  const pids = fs.existsSync(pidDatei)
    ? fs.readFileSync(pidDatei, 'utf8').split(/\r?\n/).map((z) => z.replace(/#.*/, '').trim()).filter(Boolean)
    : [];
  const auswahl = new Map(pids.map((pid) => [pid, { pid, name: '', ekUsd: null, listedNum: null, quellen: ['nachtrag'] }]));
  console.log(`${pids.length} Produkt-IDs aus ${path.basename(pidDatei)}`);

  for (const [wort, kategorie] of SUCHEN.slice(0, MAX_SUCHEN)) {
    let r;
    try { r = await liste(api, { keyWord: wort, page: 1, size: 20, countryCode: LAND, orderBy: 0 }); }
    catch (err) { ergebnis.hinweise.push(`Suche "${wort}": ${err.message}`); continue; }
    const genau = r.liste.map((roh) => kurz(roh, `genau:${wort}`)).filter((p) => p.pid && trifft(p.name, wort) && passt(p))
      .sort((a, b) => (b.listedNum || 0) - (a.listedNum || 0));
    ergebnis.suchen[wort] = { kategorie, treffer: r.gesamt, genau: genau.length, top: genau.slice(0, 5).map((p) => ({ pid: p.pid, name: p.name.slice(0, 80), listedNum: p.listedNum, ekUsd: p.ekUsd })) };
    for (const p of genau.slice(0, 2)) {
      const alt = auswahl.get(p.pid);
      if (alt) { alt.quellen.push(...p.quellen); continue; }
      p.shopKategorie = kategorie;
      auswahl.set(p.pid, p);
    }
    console.log(`Suche "${wort}": ${r.liste.length} Treffer, ${genau.length} genau passend`);
  }
  speichern();

  const liste2 = [...auswahl.values()].slice(0, KANDIDATEN);
  console.log(`\n${liste2.length} Produkte werden genauer geprueft …`);
  for (const [i, k] of liste2.entries()) {
    process.stdout.write(`[${i + 1}/${liste2.length}] ${(k.name || k.pid).slice(0, 60)} … `);
    const e = await pruefe(api, k);
    ergebnis.kandidaten.push(e);
    console.log(e.status);
    speichern();
  }
  console.log(`\nFertig. Ergebnis: ${path.relative(process.cwd(), ausgabe)}`);
  return ergebnis;
}

async function main(api) {
  if (!api) { const CJ = require('./cj-dropshipping-api'); api = new CJ(); }
  const ergebnis = { stand: new Date().toISOString(), land: LAND, gesamtImLager: null, suchen: {}, hinweise: [], kandidaten: [] };
  fs.mkdirSync(path.dirname(AUSGABE), { recursive: true });
  const speichern = () => fs.writeFileSync(AUSGABE, JSON.stringify(ergebnis, null, 2));

  const alle = new Map();
  const merken = (roh, quelle) => {
    const p = kurz(roh, quelle);
    if (!p.pid) return null;
    const alt = alle.get(p.pid);
    if (alt) { if (!alt.quellen.includes(quelle)) alt.quellen.push(quelle); return alt; }
    alle.set(p.pid, p);
    return p;
  };

  // 1. Meistgelistete Produkte im DE-Lager
  const top = [];
  for (let seite = 1; seite <= SEITEN; seite++) {
    let r;
    try { r = await liste(api, { page: seite, size: 100, countryCode: LAND, orderBy: 1, sort: 'desc' }); }
    catch (err) { ergebnis.hinweise.push(`Topliste Seite ${seite}: ${err.message}`); break; }
    if (ergebnis.gesamtImLager == null) ergebnis.gesamtImLager = r.gesamt;
    for (const roh of r.liste) { const p = merken(roh, 'topliste'); if (p) top.push(p); }
    console.log(`Topliste Seite ${seite}: ${r.liste.length} Produkte (im DE-Lager laut CJ: ${r.gesamt})`);
    if (r.liste.length < 100) break;
  }

  // 2. Gezielte Suchen nach gefragten Produktarten
  const ausSuchen = [];
  for (const [wort, kategorie] of SUCHEN.slice(0, MAX_SUCHEN)) {
    let r;
    try { r = await liste(api, { keyWord: wort, page: 1, size: 20, countryCode: LAND, orderBy: 1, sort: 'desc' }); }
    catch (err) { ergebnis.hinweise.push(`Suche "${wort}": ${err.message}`); continue; }
    const treffer = r.liste.map((roh) => merken(roh, `suche:${wort}`)).filter(Boolean);
    const gute = treffer.filter(passt).sort((a, b) => (b.listedNum || 0) - (a.listedNum || 0));
    ergebnis.suchen[wort] = { kategorie, treffer: r.gesamt, passend: gute.length, top: gute.slice(0, 5).map((p) => ({ pid: p.pid, name: p.name.slice(0, 80), listedNum: p.listedNum, ekUsd: p.ekUsd })) };
    for (const p of gute.slice(0, JE_SUCHE)) { p.shopKategorie = p.shopKategorie || kategorie; ausSuchen.push(p); }
    console.log(`Suche "${wort}": ${r.liste.length} Treffer, ${gute.length} passend`);
  }
  ergebnis.anzahlGesichtet = alle.size;
  ergebnis.alle = [...alle.values()].map(({ pid, name, ekUsd, listedNum, kategorieCj, quellen }) => ({ pid, name, ekUsd, listedNum, kategorieCj, quellen }));
  speichern();

  // Auswahl: Suchtreffer zuerst (Nachfrage belegt), dann die Topliste
  const auswahl = [];
  const drin = new Set();
  for (const p of [...ausSuchen, ...top.filter(passt).sort((a, b) => (b.listedNum || 0) - (a.listedNum || 0))]) {
    if (auswahl.length >= KANDIDATEN) break;
    if (drin.has(p.pid)) continue;
    drin.add(p.pid);
    auswahl.push(p);
  }
  console.log(`\n${alle.size} Produkte gesichtet, ${auswahl.length} Kandidaten werden genauer geprueft …`);

  for (const [i, k] of auswahl.entries()) {
    process.stdout.write(`[${i + 1}/${auswahl.length}] ${k.name.slice(0, 60)} … `);
    const e = await pruefe(api, k);
    ergebnis.kandidaten.push(e);
    console.log(e.status);
    speichern();
  }
  console.log(`\nFertig. Ergebnis: ${path.relative(process.cwd(), AUSGABE)}`);
  return ergebnis;
}

module.exports = { main, nachtrag, pruefe, kurz, passt, trifft, preise, AUSSCHLUSS, SUCHEN };

if (require.main === module) {
  (process.argv.includes('--nachtrag') ? nachtrag() : main())
    .catch((err) => { console.error('Abbruch:', err.message); process.exit(1); });
}
