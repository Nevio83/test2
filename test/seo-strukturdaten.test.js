/**
 * Tests fuer die Strukturdaten, die Suchmaschinen auslesen.
 *
 * Das Besondere an dieser Stelle: ein Fehler ist hier UNSICHTBAR. Steht im
 * Datenblock ein falscher Preis oder eine Rueckgabefrist, die es nicht mehr
 * gibt, sieht man das im Shop nirgends — nur im Suchergebnis, Wochen spaeter,
 * und im schlimmsten Fall als Abmahnung wegen irrefuehrender Werbung.
 *
 * Deshalb pruefen diese Tests nicht, ob die Felder DA sind (das waere leicht
 * gruen zu bekommen), sondern ob sie noch zu ihrer Quelle passen: Preis und
 * Lieferzeit zu products.json, Versandkosten zu shipping-calculator.js,
 * die Rueckgabefrist zu dem, was infos/retouren.html oeffentlich zusagt.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const seo = require('../seo-strukturdaten');
const { FLAT_SHIPPING_COSTS, LIEFERLAENDER } = require('../shipping-calculator');

const produkte = JSON.parse(fs.readFileSync(path.join(WURZEL, 'products.json'), 'utf8'));

function seiteLesen(slug) {
  return fs.readFileSync(path.join(WURZEL, 'produkte', `${slug}.html`), 'utf8');
}

// ── Lieferzeit lesen ────────────────────────────────────────────────

test('Lieferzeit wird aus der Textangabe gelesen', () => {
  assert.deepEqual(seo.lieferzeitAusText('6-11 Werktage'), { min: 6, max: 11 });
  // Im Bestand kommen beide Strichzeichen vor.
  assert.deepEqual(seo.lieferzeitAusText('7–14 Werktage'), { min: 7, max: 14 });
});

test('unklare Lieferzeit wird nicht geraten', () => {
  assert.equal(seo.lieferzeitAusText(undefined), null);
  assert.equal(seo.lieferzeitAusText('schnell'), null);
  assert.equal(seo.lieferzeitAusText('0-5 Werktage'), null, 'null Tage gibt es nicht');
  assert.equal(seo.lieferzeitAusText('11-6 Werktage'), null, 'verdrehte Spanne');
});

// ── Versandangaben gegen die echte Preistabelle ─────────────────────

test('kostenlos ausgezeichnet ist nur, was laut Preistabelle kostenlos ist', () => {
  const gratis = seo.gratisLaender();
  assert.ok(gratis.length > 0);
  for (const land of gratis) {
    assert.equal(FLAT_SHIPPING_COSTS[land], 0, `${land} ist NICHT kostenlos`);
  }
  // Gegenprobe: kein Land mit Kosten darf in der Gratis-Gruppe landen.
  assert.ok(!gratis.includes('US'), 'US kostet 12 EUR und darf nicht als gratis gelten');
});

test('jedes Lieferland taucht in den Versandangaben genau einmal auf', () => {
  const angaben = seo.versandAngaben(produkte[0]);
  const genannt = angaben.flatMap((a) => a.shippingDestination.addressCountry);
  assert.deepEqual([...genannt].sort(), [...LIEFERLAENDER].sort());
  assert.equal(new Set(genannt).size, genannt.length, 'kein Land doppelt');
});

test('ohne belastbare Lieferzeit bleibt die Angabe weg statt geraten zu werden', () => {
  const angaben = seo.versandAngaben({ shippingTime: 'bald' });
  assert.ok(angaben.length > 0, 'Versandkosten stehen trotzdem drin');
  assert.ok(angaben.every((a) => !a.deliveryTime), 'keine erfundene Lieferzeit');
});

// ── Rueckgabefrist gegen die oeffentliche Zusage ────────────────────

test('ausgezeichnete Rückgabefrist entspricht der Zusage auf der Retouren-Seite', () => {
  // Das ist der eigentliche Zweck: Google und der Kunde duerfen nicht
  // Unterschiedliches lesen. Aendert jemand die Seite, faellt es hier auf.
  const seite = fs.readFileSync(path.join(WURZEL, 'infos', 'retouren.html'), 'utf8');
  const m = seite.match(/(\d+)\s*Tage\s*Rückgaberecht/);
  assert.ok(m, 'Retouren-Seite nennt keine Frist mehr — dann stimmt die Auszeichnung nicht');
  assert.equal(
    Number(m[1]), seo.RUECKGABE_TAGE,
    `Seite sagt ${m[1]} Tage, ausgezeichnet sind ${seo.RUECKGABE_TAGE}`
  );
});

test('Rückgaberichtlinie gilt für genau die Länder, in die geliefert wird', () => {
  const r = seo.rueckgabeRichtlinie();
  assert.deepEqual(r.applicableCountry, LIEFERLAENDER);
  assert.equal(r.merchantReturnDays, seo.RUECKGABE_TAGE);
});

// ── Die Dateien selbst ──────────────────────────────────────────────

test('keine Produktseite ist gegenüber ihrer Quelle veraltet', () => {
  // Kernprobe. Wird ein Preis in products.json geaendert und der Generator
  // nicht neu laufen gelassen, wirbt Google weiter mit dem alten Preis.
  const b = seo.seitenSchreiben({ wurzel: WURZEL, pruefen: true });
  assert.deepEqual(b.fehler, []);
  assert.deepEqual(
    b.abweichend, [],
    'veraltet — "node seo-strukturdaten.js" laufen lassen'
  );
  assert.equal(b.unveraendert.length, produkte.length);
});

test('jede Produktseite trägt Preis, Versand, Rückgabe und Zustand', () => {
  for (const p of produkte) {
    const daten = seo.vorhandeneDaten(seiteLesen(p.slug));
    assert.ok(daten, `${p.slug}: kein lesbarer Datenblock`);
    const o = daten.offers;
    assert.equal(o.price, Number(p.price).toFixed(2), `${p.slug}: Preis weicht ab`);
    assert.ok(o.shippingDetails.length >= 1, `${p.slug}: keine Versandangabe`);
    assert.equal(o.hasMerchantReturnPolicy.merchantReturnDays, seo.RUECKGABE_TAGE);
    assert.equal(o.itemCondition, 'https://schema.org/NewCondition');
  }
});

test('Preisgültigkeit ist nicht abgelaufen', () => {
  // Ein Datum in der Vergangenheit ist schlimmer als gar keines: Google
  // verwirft dann den Preis. Der Test schlaegt 30 Tage vorher an, damit noch
  // Zeit bleibt — Abhilfe: "node seo-strukturdaten.js --neu-datieren".
  const grenze = new Date();
  grenze.setDate(grenze.getDate() + 30);
  for (const p of produkte) {
    const bis = seo.vorhandeneDaten(seiteLesen(p.slug)).offers.priceValidUntil;
    assert.ok(bis, `${p.slug}: kein Gültigkeitsdatum`);
    assert.ok(
      new Date(bis) > grenze,
      `${p.slug}: Preisgültigkeit läuft am ${bis} ab — "node seo-strukturdaten.js --neu-datieren"`
    );
  }
});

test('jede indexierbare Seite nennt sich selbst als kanonische Adresse', () => {
  for (const s of seo.FESTE_SEITEN) {
    const html = fs.readFileSync(path.join(WURZEL, s.datei), 'utf8');
    const treffer = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
    assert.equal(treffer.length, 1, `${s.datei}: ${treffer.length} kanonische Adressen`);
    assert.equal(treffer[0][1], seo.BASIS + s.pfad, `${s.datei}: zeigt woandershin`);
  }
  for (const p of produkte) {
    const treffer = [...seiteLesen(p.slug).matchAll(/<link rel="canonical" href="([^"]+)"/g)];
    assert.equal(treffer.length, 1, `${p.slug}: ${treffer.length} kanonische Adressen`);
    assert.equal(treffer[0][1], `${seo.BASIS}/produkte/${p.slug}.html`);
  }
});

// Liest die Kurzbeschreibung aus einer Seite -- dieselbe Regel gilt fuer den
// echten Test unten UND fuer dessen Gegenprobe, damit beide garantiert
// denselben Massstab anlegen.
function beschreibungLesen(html) {
  return [...html.matchAll(/<meta name="description" content="([^"]*)">/g)];
}

test('jede feste Seite hat eine eigene Kurzbeschreibung fuer die Suche', () => {
  // Vorher hatte nur die Startseite eine eigene Beschreibung -- Google baute
  // sich fuer die anderen 13 Seiten selbst einen Text zusammen (meist der
  // erste Absatz), bei den AGB also Paragrafentext im Suchergebnis.
  for (const s of seo.FESTE_SEITEN) {
    const html = fs.readFileSync(path.join(WURZEL, s.datei), 'utf8');
    const treffer = beschreibungLesen(html);
    assert.equal(treffer.length, 1, `${s.datei}: ${treffer.length} Kurzbeschreibungen`);
    const text = treffer[0][1];
    assert.ok(text.trim().length >= 40, `${s.datei}: Beschreibung zu kurz ("${text}")`);
    assert.ok(text.length <= 160, `${s.datei}: Beschreibung zu lang (${text.length} Zeichen) -- Google schneidet ab`);
  }
});

test('GEGENPROBE: eine Seite ohne Kurzbeschreibung faellt auf', () => {
  // Baut den Zustand nach, in dem 13 der 14 Seiten tatsaechlich waren --
  // ohne diese Probe waere der Test oben wertlos: er kann nur gruen sein,
  // wenn er auch rot werden kann.
  const vorher = '<head><title>Gutscheine</title><link rel="canonical" href="x"></head>';
  assert.equal(beschreibungLesen(vorher).length, 0, 'die alte Seite hatte keine Beschreibung');

  const nachher = '<head><title>Gutscheine</title>'
    + '<meta name="description" content="Gutscheine und Rabattcodes fuer den Maios Shop.">'
    + '<link rel="canonical" href="x"></head>';
  assert.equal(beschreibungLesen(nachher).length, 1, 'die reparierte Seite muss angeschlagen werden');
});

test('Seiten ohne Suchwert sind als "nicht indexieren" gekennzeichnet', () => {
  for (const datei of seo.NICHT_INDEXIEREN) {
    const html = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
    assert.match(html, /<meta name="robots" content="noindex, follow">/, datei);
    assert.ok(!/rel="canonical"/.test(html), `${datei}: gesperrt UND kanonisch ist widersprüchlich`);
  }
});

test('keine Seite steht gleichzeitig in der Sitemap und auf der Sperrliste', () => {
  const inSitemap = new Set(seo.FESTE_SEITEN.map((s) => s.datei));
  for (const datei of seo.NICHT_INDEXIEREN) {
    assert.ok(!inSitemap.has(datei), `${datei} wird gesperrt, aber Google trotzdem angeboten`);
  }
});

// ── Gegenproben: würden diese Tests einen echten Fehler melden? ──────

test('GEGENPROBE: geänderter Preis wird als veraltet erkannt', () => {
  // Baut den echten Fall nach — jemand senkt einen Preis in products.json und
  // vergisst den Generator. Ohne diese Probe waere der Test oben wertlos:
  // er kann nur gruen sein, wenn er auch rot werden kann.
  const p = produkte[0];
  const spielwiese = fs.mkdtempSync(path.join(os.tmpdir(), 'maios-seo-'));
  fs.mkdirSync(path.join(spielwiese, 'produkte'));
  fs.copyFileSync(
    path.join(WURZEL, 'produkte', `${p.slug}.html`),
    path.join(spielwiese, 'produkte', `${p.slug}.html`)
  );

  // Erst mit unveraendertem Preis: muss ruhig bleiben.
  fs.writeFileSync(path.join(spielwiese, 'products.json'), JSON.stringify([p]), 'utf8');
  const ruhig = seo.seitenSchreiben({ wurzel: spielwiese, pruefen: true });
  assert.deepEqual(ruhig.abweichend, [], 'unveränderte Quelle darf nicht anschlagen');

  // Jetzt der Preiswechsel.
  fs.writeFileSync(
    path.join(spielwiese, 'products.json'),
    JSON.stringify([{ ...p, price: Number(p.price) + 5 }]), 'utf8'
  );
  const laut = seo.seitenSchreiben({ wurzel: spielwiese, pruefen: true });
  assert.deepEqual(laut.abweichend, [p.slug], 'Preiswechsel muss auffallen');

  fs.rmSync(spielwiese, { recursive: true, force: true });
});

test('GEGENPROBE: ein "$" in der Beschreibung zerstört die Seite nicht', () => {
  // String.replace liest "$&" im Ersatztext als Rueckverweis. Eine Beschreibung
  // wie "Spart $$ beim Strom" wuerde damit stillschweigend anderen Text
  // einsetzen. Deshalb wird durchgehend ueber Funktionen ersetzt.
  const html = seiteLesen(produkte[0].slug);
  const daten = seo.baueProduktDaten(
    { ...produkte[0], name: 'Test $& $` $\' $$' },
    { preisGueltigBis: '2099-01-01', beschreibung: 'Spart $$ — siehe $&', bilder: ['https://x/y.jpg'] }
  );
  const neu = seo.seiteAktualisieren(html, { daten, kanonisch: 'https://maiosshop.com/x' });
  const wieder = seo.vorhandeneDaten(neu);
  assert.equal(wieder.description, 'Spart $$ — siehe $&');
  assert.equal(wieder.name, 'Test $& $` $\' $$');
});

test('GEGENPROBE: eine Seite ohne Datenblock bricht ab statt still zu bleiben', () => {
  assert.throws(
    () => seo.seiteAktualisieren('<html><head><title>x</title></head></html>', {
      daten: {}, kanonisch: 'https://maiosshop.com/x'
    }),
    /ld\+json/
  );
});
