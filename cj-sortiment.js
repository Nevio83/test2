/**
 * cj-sortiment.js — sucht im CJ-Katalog Produkte, die in einem CJ-Lager in
 * Deutschland liegen, und bereitet die Auswahl neuer Shop-Produkte vor.
 *
 * Bewertet wird mit dem, was CJ selbst liefert:
 *   listedNum  wie viele CJ-Haendler das Produkt in ihren Shop uebernommen
 *              haben — CJs eigener Beliebtheitswert
 *   sellPrice  Einkaufspreis (USD)
 *   Versand    echter guenstigster Versand vom Lager nach DE (freightCalculate)
 *   Lager      tatsaechlicher Bestand je Land (stock/queryByVid), damit
 *              "liegt in DE" nicht nur auf dem Filter beruht
 *
 * Nur lesend, bestellt nichts. Ergebnis: "Claude outputs/cj-sortiment.json".
 * Aufruf: npm run sortiment
 * Optional: SORTIMENT_LAGER=DE,PL  SORTIMENT_SEITEN=15  SORTIMENT_KANDIDATEN=80
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const CJ = require('./cj-dropshipping-api');
const { frage, versand, zahl } = require('./cj-preischeck');

const LAGER = String(process.env.SORTIMENT_LAGER || 'DE').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
const SEITEN = Number(process.env.SORTIMENT_SEITEN || 15);
const PRO_SEITE = 100;
const KANDIDATEN = Number(process.env.SORTIMENT_KANDIDATEN || 70);
const AUSGABE = path.join(__dirname, 'Claude outputs', 'cj-sortiment.json');

// Passt nicht zum Sortiment (Technik, Haushalt, Licht, Beauty/Wellness) oder
// ist rechtlich heikel (Kleidungsgroessen, Spielzeug-CE, Kosmetik, Lebensmittel).
const AUSSCHLUSS = /cloth|dress|shirt|pant|jean|skirt|coat|jacket|sock|underwear|bra\b|lingerie|bikini|swim|shoe|boot|sneaker|sandal|wig|hair extension|jewel|necklace|earring|ring\b|bracelet|watch band|bag|wallet|backpack|toy|kid|baby|pet food|food|snack|tea\b|coffee bean|supplement|medicine|cosmetic|lipstick|eyeshadow|perfume|cream|serum|tattoo|adult|sex|knife|weapon|gun|vape|e-cig|battery pack|lithium/i;

function kurz(p) {
  return {
    pid: p.pid, name: p.productNameEn || p.productName || '', sku: p.productSku || null,
    bild: p.productImage || null, kategorie: p.categoryName || null,
    ekUsd: zahl(p.sellPrice), gewichtG: zahl(p.productWeight),
    listedNum: zahl(p.listedNum), erstellt: p.createTime || null,
  };
}

async function main() {
  const api = new CJ();
  const ergebnis = { stand: new Date().toISOString(), lager: LAGER, feldnamen: null, gesamt: {}, kandidaten: [], hinweise: [] };
  fs.mkdirSync(path.dirname(AUSGABE), { recursive: true });
  const speichern = () => fs.writeFileSync(AUSGABE, JSON.stringify(ergebnis, null, 2));

  const alle = new Map();
  for (const land of LAGER) {
    for (let seite = 1; seite <= SEITEN; seite++) {
      let daten;
      try {
        daten = await frage(api, '/api2.0/v1/product/list?' + new URLSearchParams({ pageNum: seite, pageSize: PRO_SEITE, countryCode: land }));
      } catch (err) { ergebnis.hinweise.push(`Liste ${land} Seite ${seite}: ${err.message}`); break; }
      const liste = (daten && Array.isArray(daten.list)) ? daten.list : [];
      if (!ergebnis.feldnamen && liste[0]) ergebnis.feldnamen = Object.keys(liste[0]);
      ergebnis.gesamt[land] = zahl(daten && daten.total);
      for (const p of liste) if (p && p.pid && !alle.has(p.pid)) alle.set(p.pid, { ...kurz(p), lagerFilter: land });
      console.log(`Liste ${land} Seite ${seite}: ${liste.length} Produkte (gesamt laut CJ: ${ergebnis.gesamt[land]})`);
      if (liste.length < PRO_SEITE) break;
    }
  }
  ergebnis.anzahlGesichtet = alle.size;
  ergebnis.alle = [...alle.values()];
  speichern();

  const auswahl = ergebnis.alle
    .filter((p) => !AUSSCHLUSS.test(`${p.name} ${p.kategorie || ''}`))
    .filter((p) => p.ekUsd != null && p.ekUsd >= 2 && p.ekUsd <= 45)
    .filter((p) => p.gewichtG == null || p.gewichtG <= 2500)
    .sort((a, b) => (b.listedNum || 0) - (a.listedNum || 0))
    .slice(0, KANDIDATEN);
  console.log(`\n${alle.size} Produkte gesichtet, ${auswahl.length} Kandidaten werden genauer geprüft …`);

  for (const [i, k] of auswahl.entries()) {
    process.stdout.write(`[${i + 1}/${auswahl.length}] ${k.name.slice(0, 60)} … `);
    const e = { ...k, varianten: null, lager: [], versand: [], hinweise: [] };
    try {
      const d = await frage(api, '/api2.0/v1/product/query?' + new URLSearchParams({ pid: k.pid }));
      const v = (d && Array.isArray(d.variants)) ? d.variants : [];
      e.varianten = v.slice(0, 30).map((x) => ({ vid: String(x.vid), sku: x.variantSku, key: x.variantKey || '', ekUsd: zahl(x.variantSellPrice), gewichtG: zahl(x.variantWeight) }));
      e.anzahlVarianten = v.length;
      e.beschreibungKurz = String((d && d.description) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400);
      const erste = e.varianten[0];
      if (erste) {
        try {
          const lager = await frage(api, '/api2.0/v1/product/stock/queryByVid?' + new URLSearchParams({ vid: erste.vid }));
          e.lager = (Array.isArray(lager) ? lager : []).map((l) => ({ land: l.countryCode || null, bestand: zahl(l.totalInventoryNum ?? l.storageNum ?? l.cjInventoryNum) }));
        } catch (err) { e.hinweise.push(`Lager: ${err.message}`); }
        const start = [...new Set([k.lagerFilter, ...e.lager.filter((l) => (l.bestand || 0) > 0 && LAGER.includes(l.land)).map((l) => l.land)])];
        for (const von of start) {
          try { e.versand.push(await versand(api, erste.vid, von)); }
          catch (err) { e.hinweise.push(`Versand ab ${von}: ${err.message}`); }
        }
      }
      e.status = 'ok';
    } catch (err) { e.status = 'fehler'; e.hinweise.push(err.message); }
    ergebnis.kandidaten.push(e);
    console.log(e.status);
    speichern();
  }
  console.log(`\nFertig. Ergebnis: ${path.relative(process.cwd(), AUSGABE)}`);
}

main().catch((err) => { console.error('Abbruch:', err.message); process.exit(1); });
