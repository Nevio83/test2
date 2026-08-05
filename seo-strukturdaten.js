/**
 * STRUKTURDATEN FUER SUCHMASCHINEN (JSON-LD) + KANONISCHE ADRESSE
 *
 * Ausgangslage: Die 40 Produktseiten trugen zwar einen Product-Datenblock, aber
 * nur die Pflichtfelder — Name, Bild, Preis, Verfuegbarkeit. Genau die Angaben,
 * mit denen dieser Shop im Suchergebnis auffallen wuerde, fehlten:
 * kostenloser Versand, 30 Tage Rueckgabe, Lieferzeit. Google kann nur anzeigen,
 * was ausgezeichnet ist — der Shop bot also mehr, als in der Suche ankam.
 *
 * WARUM EIN GENERATOR STATT 40 HANDGRIFFE
 * Die Angaben haengen an echten Quellen: products.json (Preis, Lieferzeit,
 * Verfuegbarkeit), shipping-calculator.js (Versandkosten, Lieferlaender),
 * infos/retouren.html (Rueckgabefrist). Von Hand eingetragen wuerden sie beim
 * naechsten Preiswechsel still falsch. Erzeugt aus der Quelle koennen sie das
 * nicht — und test/seo-strukturdaten.test.js meldet, wenn Datei und Quelle
 * auseinanderlaufen.
 *
 * WAS HIER BEWUSST NICHT STEHT: Sternebewertungen. Die kaeme Google gern, aber
 * dieser Shop hat genau eine echte Bewertung. Erfundene Werte waeren ein
 * Rechtsverstoss und ein Grund fuer Google, alle Auszeichnungen der Domain zu
 * verwerfen. Die Sterne ergaenzt product-reviews.js zur Laufzeit aus der
 * Datenbank — sobald es echte gibt, ohne dass hier etwas geaendert werden muss.
 */

const fs = require('fs');
const path = require('path');
const { FLAT_SHIPPING_COSTS, LIEFERLAENDER } = require('./shipping-calculator');

const BASIS = 'https://maiosshop.com';

// Beleg: infos/retouren.html — "30 Tage Rückgaberecht nach Erhalt der Ware".
// Mehr als die gesetzlichen 14 Tage aus infos/widerruf.html, also freiwillig
// eingeraeumt. Ausgezeichnet wird die Zusage, die der Shop oeffentlich macht.
const RUECKGABE_TAGE = 30;

// Die Widerrufsbelehrung (infos/widerruf.html) enthaelt KEINE Klausel, dass der
// Kunde die Ruecksendekosten traegt. Ohne diese Belehrung traegt sie nach
// § 357 Abs. 6 BGB der Haendler — Rueckgabe ist fuer den Kunden also kostenlos.
const RUECKSENDUNG_KOSTENLOS = true;

/**
 * Welche festen Seiten in den Suchindex gehoeren — und mit welchem Gewicht.
 * Dieselbe Liste steuert drei Dinge, die vorher getrennt gepflegt wurden:
 * die Sitemap (server.js), die kanonische Adresse in der Seite und die
 * Kennzeichnung der Seiten, die NICHT indexiert werden sollen. Getrennt
 * gepflegt standen Warenkorb und Merkzettel in der Sitemap, obwohl sie fuer
 * ein Suchergebnis nichts hergeben.
 */
const FESTE_SEITEN = [
  { pfad: '/', datei: 'index.html', gewicht: '1.0', takt: 'daily' },
  { pfad: '/gutscheine.html', datei: 'gutscheine.html', gewicht: '0.5', takt: 'weekly' },
  { pfad: '/infos/kategorien.html', datei: 'infos/kategorien.html', gewicht: '0.5', takt: 'weekly' },
  { pfad: '/infos/angebote.html', datei: 'infos/angebote.html', gewicht: '0.5', takt: 'weekly' },
  { pfad: '/infos/neue-produkte.html', datei: 'infos/neue-produkte.html', gewicht: '0.5', takt: 'weekly' },
  { pfad: '/infos/mitteilungen.html', datei: 'infos/mitteilungen.html', gewicht: '0.4', takt: 'monthly' },
  { pfad: '/infos/versand.html', datei: 'infos/versand.html', gewicht: '0.4', takt: 'monthly' },
  { pfad: '/infos/retouren.html', datei: 'infos/retouren.html', gewicht: '0.4', takt: 'monthly' },
  { pfad: '/infos/kontakt.html', datei: 'infos/kontakt.html', gewicht: '0.4', takt: 'monthly' },
  { pfad: '/infos/agb.html', datei: 'infos/agb.html', gewicht: '0.3', takt: 'yearly' },
  { pfad: '/infos/datenschutz.html', datei: 'infos/datenschutz.html', gewicht: '0.3', takt: 'yearly' },
  { pfad: '/infos/impressum.html', datei: 'infos/impressum.html', gewicht: '0.3', takt: 'yearly' },
  { pfad: '/infos/widerruf.html', datei: 'infos/widerruf.html', gewicht: '0.3', takt: 'yearly' },
  { pfad: '/infos/cookies.html', datei: 'infos/cookies.html', gewicht: '0.3', takt: 'yearly' }
];

/**
 * Seiten, die es geben muss, aber nicht im Suchindex: Warenkorb und Merkzettel
 * sind fuer einen Fremden leer, Bestellbestaetigung und Sendungsverfolgung
 * gehoeren zu genau einer Bestellung. Sie bekommen "noindex, follow" — nicht
 * anzeigen, den Links darin aber ruhig folgen.
 */
const NICHT_INDEXIEREN = [
  'cart.html',
  'wishlist.html',
  'success.html',
  'tracking.html',
  'infos/datenschutz-anfrage.html'
];

/** Laender mit versandkostenfreier Lieferung (aus der echten Preistabelle). */
function gratisLaender() {
  return LIEFERLAENDER.filter((l) => FLAT_SHIPPING_COSTS[l] === 0);
}

/** Laender mit Versandkosten, gruppiert nach Betrag. */
function bezahlLaender() {
  const nachBetrag = new Map();
  for (const land of LIEFERLAENDER) {
    const kosten = FLAT_SHIPPING_COSTS[land];
    if (!kosten) continue;
    if (!nachBetrag.has(kosten)) nachBetrag.set(kosten, []);
    nachBetrag.get(kosten).push(land);
  }
  return [...nachBetrag.entries()].sort((a, b) => a[0] - b[0]);
}

/**
 * Liest "6-11 Werktage" als Zahlenpaar. Gibt null zurueck, wenn die Angabe
 * nicht eindeutig ist — dann bleibt die Lieferzeit lieber weg, statt geraten
 * zu werden. Bindestrich und Gedankenstrich kommen beide im Bestand vor.
 */
function lieferzeitAusText(text) {
  if (!text) return null;
  const m = String(text).match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = Number(m[2]);
  if (!(min > 0) || !(max >= min)) return null;
  return { min, max };
}

/**
 * Versandangaben je Produkt. Die Lieferzeit steht komplett in transitTime;
 * handlingTime bleibt weg, weil der Shop nur die Gesamtdauer zusagt und
 * "0 Tage Bearbeitung" eine Zusage waere, die niemand geprueft hat. Google
 * rechnet handlingTime + transitTime — ohne handlingTime kommt genau die
 * Spanne heraus, die auch auf der Seite steht.
 */
function versandAngaben(produkt) {
  const zeit = lieferzeitAusText(produkt && produkt.shippingTime);
  const lieferdauer = zeit ? {
    '@type': 'ShippingDeliveryTime',
    transitTime: { '@type': 'QuantitativeValue', minValue: zeit.min, maxValue: zeit.max, unitCode: 'DAY' }
  } : null;

  const eintrag = (betrag, laender) => {
    const o = {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: Number(betrag.toFixed(2)), currency: 'EUR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: laender }
    };
    if (lieferdauer) o.deliveryTime = lieferdauer;
    return o;
  };

  const angaben = [];
  const gratis = gratisLaender();
  if (gratis.length) angaben.push(eintrag(0, gratis));
  for (const [betrag, laender] of bezahlLaender()) angaben.push(eintrag(betrag, laender));
  return angaben;
}

/** Rueckgaberichtlinie, wie sie der Shop oeffentlich zusagt. */
function rueckgabeRichtlinie() {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: [...LIEFERLAENDER],
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: RUECKGABE_TAGE,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: RUECKSENDUNG_KOSTENLOS
      ? 'https://schema.org/FreeReturn'
      : 'https://schema.org/ReturnShippingFees'
  };
}

/** Datum ein Jahr nach dem Stichtag, als YYYY-MM-DD. */
function einJahrSpaeter(stichtag) {
  const d = new Date(stichtag);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** Adresse eines Produktbildes, absolut und kodiert (Ordner haben Leerzeichen). */
function bildAdresse(pfad) {
  if (!pfad) return null;
  if (/^https?:\/\//i.test(pfad)) return pfad;
  const rein = String(pfad).replace(/^\.?\//, '');
  return BASIS + '/' + rein.split('/').map(encodeURIComponent).join('/');
}

/**
 * Baut den Product-Datenblock. `preisGueltigBis` wird von aussen gesetzt, damit
 * das Ergebnis nicht vom Tagesdatum abhaengt — sonst koennte kein Test die
 * Datei gegen die Quelle pruefen.
 */
function baueProduktDaten(produkt, { preisGueltigBis, beschreibung, bilder } = {}) {
  const daten = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: produkt.name,
    image: bilder && bilder.length ? bilder : [bildAdresse(produkt.image)].filter(Boolean),
    description: beschreibung || produkt.description || produkt.name,
    sku: produkt.sku,
    brand: { '@type': 'Brand', name: 'Maios' },
    offers: {
      '@type': 'Offer',
      url: `${BASIS}/produkte/${produkt.slug}.html`,
      priceCurrency: 'EUR',
      price: Number(produkt.price).toFixed(2),
      itemCondition: 'https://schema.org/NewCondition',
      availability: produkt.inStock === false
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      hasMerchantReturnPolicy: rueckgabeRichtlinie(),
      shippingDetails: versandAngaben(produkt)
    }
  };
  if (preisGueltigBis) daten.offers.priceValidUntil = preisGueltigBis;
  return daten;
}

// ── Seiten schreiben ────────────────────────────────────────────────

const LD_MUSTER = /[ \t]*<script type="application\/ld\+json">([\s\S]*?)<\/script>\r?\n?/;
const KANONISCH_MUSTER = /[ \t]*<link rel="canonical"[^>]*>\r?\n?/;

/** Der Inhalt des vorhandenen Datenblocks, oder null. */
function vorhandeneDaten(html) {
  const m = html.match(LD_MUSTER);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

/**
 * Setzt Datenblock und kanonische Adresse in eine Seite ein. Wirft, wenn die
 * Seite nicht wie erwartet aussieht — lieber ein Abbruch als eine Seite, in der
 * die Auszeichnung stillschweigend fehlt.
 *
 * Ersetzt wird durchgaengig ueber Funktionen, nicht ueber Ersetzungstexte:
 * ein "$" in einer Produktbeschreibung wuerde sonst als Rueckverweis gelesen
 * und stillschweigend anderen Text einsetzen.
 */
function seiteAktualisieren(html, { daten, kanonisch }) {
  const treffer = html.match(LD_MUSTER);
  if (!treffer) throw new Error('kein ld+json-Block gefunden');
  if (html.split('<script type="application/ld+json">').length > 2) {
    throw new Error('mehr als ein ld+json-Block');
  }

  const zeilenende = /\r\n/.test(treffer[0]) ? '\r\n' : '\n';
  const einzug = (treffer[0].match(/^[ \t]*/) || [''])[0];
  const block = `${einzug}<script type="application/ld+json">${JSON.stringify(daten)}</script>${zeilenende}`;
  const kanonZeile = `${einzug}<link rel="canonical" href="${kanonisch}">${zeilenende}`;

  if (KANONISCH_MUSTER.test(html)) {
    return html.replace(KANONISCH_MUSTER, () => kanonZeile).replace(LD_MUSTER, () => block);
  }
  // Noch keine kanonische Zeile: direkt vor den Datenblock setzen.
  return html.replace(LD_MUSTER, () => kanonZeile + block);
}

const ROBOTS_MUSTER = /[ \t]*<meta name="robots"[^>]*>\r?\n?/;
const TITEL_MUSTER = /([ \t]*)<title>[\s\S]*?<\/title>(\r?\n)/;

/**
 * Setzt eine Zeile direkt hinter den Seitentitel — dort steht sie auf jeder
 * Seite gleich und ist von Hand wiederzufinden.
 */
function hinterTitelSetzen(html, zeileBauen, muster) {
  if (muster.test(html)) {
    const einzug = (html.match(muster)[0].match(/^[ \t]*/) || [''])[0];
    const ende = /\r\n/.test(html.match(muster)[0]) ? '\r\n' : '\n';
    return html.replace(muster, () => zeileBauen(einzug, ende));
  }
  const t = html.match(TITEL_MUSTER);
  if (!t) throw new Error('kein <title> gefunden');
  return html.replace(TITEL_MUSTER, (ganz, einzug, ende) => ganz + zeileBauen(einzug, ende));
}

/**
 * Schreibt kanonische Adresse bzw. "noindex" in die festen Seiten.
 * Produktseiten laufen ueber seitenSchreiben(), die haben zusaetzlich den
 * Datenblock.
 */
function festeSeitenSchreiben({ wurzel = __dirname, pruefen = false } = {}) {
  const bericht = { geschrieben: [], unveraendert: [], abweichend: [], fehler: [] };

  const bearbeiten = (relativ, zeileBauen, muster) => {
    const datei = path.join(wurzel, relativ);
    let html;
    try {
      html = fs.readFileSync(datei, 'utf8');
    } catch (e) {
      bericht.fehler.push(`${relativ}: Datei fehlt`);
      return;
    }
    let neu;
    try {
      neu = hinterTitelSetzen(html, zeileBauen, muster);
    } catch (e) {
      bericht.fehler.push(`${relativ}: ${e.message}`);
      return;
    }
    if (neu === html) bericht.unveraendert.push(relativ);
    else if (pruefen) bericht.abweichend.push(relativ);
    else {
      fs.writeFileSync(datei, neu, 'utf8');
      bericht.geschrieben.push(relativ);
    }
  };

  for (const seite of FESTE_SEITEN) {
    bearbeiten(
      seite.datei,
      (einzug, ende) => `${einzug}<link rel="canonical" href="${BASIS}${seite.pfad}">${ende}`,
      KANONISCH_MUSTER
    );
  }
  for (const datei of NICHT_INDEXIEREN) {
    bearbeiten(
      datei,
      (einzug, ende) => `${einzug}<meta name="robots" content="noindex, follow">${ende}`,
      ROBOTS_MUSTER
    );
  }
  return bericht;
}

/**
 * Schreibt alle Produktseiten neu. `pruefen: true` schreibt nichts, sondern
 * meldet nur die Abweichungen — so nutzt es der Test.
 */
function seitenSchreiben({
  wurzel = __dirname, stichtag = new Date(), pruefen = false, neuDatieren = false
} = {}) {
  const produkte = JSON.parse(fs.readFileSync(path.join(wurzel, 'products.json'), 'utf8'));
  const bericht = { geschrieben: [], unveraendert: [], abweichend: [], fehler: [], ohneLieferzeit: [] };

  for (const produkt of produkte) {
    const datei = path.join(wurzel, 'produkte', `${produkt.slug}.html`);
    let html;
    try {
      html = fs.readFileSync(datei, 'utf8');
    } catch (e) {
      bericht.fehler.push(`${produkt.slug}: Seite fehlt`);
      continue;
    }

    // Beschreibung und Bilder stehen bereits in der Seite und wurden dort
    // gepflegt — die werden uebernommen, nicht aus products.json ueberschrieben.
    const vorhanden = vorhandeneDaten(html);
    if (!vorhanden) {
      bericht.fehler.push(`${produkt.slug}: kein lesbarer Datenblock`);
      continue;
    }

    if (!lieferzeitAusText(produkt.shippingTime)) bericht.ohneLieferzeit.push(produkt.slug);

    // Das Gueltigkeitsdatum bleibt stehen, solange es nicht ausdruecklich neu
    // gesetzt wird: sonst haenge das Ergebnis am Tagesdatum und kein Test
    // koennte Datei und Quelle vergleichen.
    const preisGueltigBis = (!neuDatieren && vorhanden.offers && vorhanden.offers.priceValidUntil)
      || einJahrSpaeter(stichtag);

    const daten = baueProduktDaten(produkt, {
      preisGueltigBis,
      beschreibung: vorhanden.description,
      bilder: Array.isArray(vorhanden.image) ? vorhanden.image : undefined
    });

    let neu;
    try {
      neu = seiteAktualisieren(html, {
        daten,
        kanonisch: `${BASIS}/produkte/${produkt.slug}.html`
      });
    } catch (e) {
      bericht.fehler.push(`${produkt.slug}: ${e.message}`);
      continue;
    }

    if (neu === html) {
      bericht.unveraendert.push(produkt.slug);
    } else if (pruefen) {
      bericht.abweichend.push(produkt.slug);
    } else {
      fs.writeFileSync(datei, neu, 'utf8');
      bericht.geschrieben.push(produkt.slug);
    }
  }
  return bericht;
}

module.exports = {
  BASIS,
  RUECKGABE_TAGE,
  FESTE_SEITEN,
  NICHT_INDEXIEREN,
  festeSeitenSchreiben,
  lieferzeitAusText,
  vorhandeneDaten,
  versandAngaben,
  rueckgabeRichtlinie,
  gratisLaender,
  bezahlLaender,
  einJahrSpaeter,
  baueProduktDaten,
  seiteAktualisieren,
  seitenSchreiben
};

if (require.main === module) {
  const nurPruefen = process.argv.includes('--pruefen');
  const b = seitenSchreiben({
    pruefen: nurPruefen,
    neuDatieren: process.argv.includes('--neu-datieren')
  });
  const f = festeSeitenSchreiben({ pruefen: nurPruefen });
  const fehler = [...b.fehler, ...f.fehler];

  if (nurPruefen) {
    const veraltet = [...b.abweichend, ...f.abweichend];
    console.log(`🔎 geprüft: ${b.unveraendert.length + f.unveraendert.length} aktuell, ${veraltet.length} veraltet`);
    if (veraltet.length) console.log('   veraltet: ' + veraltet.join(', '));
  } else {
    console.log(`✅ Produktseiten: ${b.geschrieben.length} geschrieben, ${b.unveraendert.length} unverändert`);
    console.log(`✅ feste Seiten:  ${f.geschrieben.length} geschrieben, ${f.unveraendert.length} unverändert`);
  }
  if (b.ohneLieferzeit.length) {
    console.log('⚠️  ohne Lieferzeit in products.json: ' + b.ohneLieferzeit.join(', '));
  }
  if (fehler.length) {
    console.error('❌ ' + fehler.join('\n❌ '));
    process.exit(1);
  }
}
