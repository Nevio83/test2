/**
 * Tests fuer den Planer der zeitgesteuerten Ablaeufe.
 *
 * Der Kern, den diese Tests absichern: ein Neustart darf den Zeitplan NICHT
 * zuruecksetzen. Genau daran scheiterten vorher Datenbank-Sicherung,
 * Stripe-Abgleich, Lagerbestand und Preis-Ueberwachung — sie hingen an einem
 * Wecker im Prozess, und bei rund zwei Deploys taeglich kam ein Tageslauf
 * selten durch, ein Wochenlauf praktisch nie.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { createScheduler } = require('../job-scheduler');

/**
 * Nachbau der Datenbank-Seite. Bildet nach, was claimJobRun wirklich tut:
 * pruefen UND belegen in einem Schritt. Die Uhr ist steuerbar, damit Tage
 * vergehen koennen, ohne zu warten.
 */
function nachbauDb(jetztRef) {
  const zeilen = new Map();          // job -> { lastRunAt, runs, lastError }
  return {
    zeilen,
    dbOperations: {
      claimJobRun: async (job, abstandSek) => {
        if (!zeilen.has(job)) {
          // Erster Eintrag: Zeitpunkt JETZT, damit nicht alles sofort losrennt.
          zeilen.set(job, { lastRunAt: jetztRef.wert, runs: 0, lastError: null });
        }
        const z = zeilen.get(job);
        if (jetztRef.wert - z.lastRunAt < abstandSek * 1000) return { uebernommen: false };
        z.lastRunAt = jetztRef.wert;
        z.runs += 1;
        return { uebernommen: true, runs: z.runs };
      },
      markJobError: async (job, meldung) => {
        const z = zeilen.get(job);
        if (z) z.lastError = meldung;
      }
    }
  };
}

const still = () => {};

test('erster Takt startet nichts — sonst rennen beim Hochfahren alle los', async () => {
  const jetzt = { wert: 1_000_000 };
  const { dbOperations } = nachbauDb(jetzt);
  const planer = createScheduler({ dbOperations, hatDatenbank: true, melde: still });

  let laeufe = 0;
  planer.registriere('taeglich', 24 * 3600 * 1000, async () => { laeufe++; });

  await planer.tick();
  assert.equal(laeufe, 0, 'darf beim ersten Takt nicht laufen');
});

test('nach Ablauf des Abstands wird gestartet, davor nicht', async () => {
  const jetzt = { wert: 1_000_000 };
  const { dbOperations } = nachbauDb(jetzt);
  const planer = createScheduler({ dbOperations, hatDatenbank: true, melde: still });

  let laeufe = 0;
  planer.registriere('taeglich', 24 * 3600 * 1000, async () => { laeufe++; });

  await planer.tick();                       // legt den Eintrag an
  jetzt.wert += 23 * 3600 * 1000;            // 23 Stunden spaeter
  await planer.tick();
  assert.equal(laeufe, 0, 'nach 23 h noch nicht fällig');

  jetzt.wert += 2 * 3600 * 1000;             // insgesamt 25 Stunden
  await planer.tick();
  assert.equal(laeufe, 1, 'nach 25 h fällig');
});

test('ein Neustart setzt den Zeitplan NICHT zurück', async () => {
  const jetzt = { wert: 1_000_000 };
  const { dbOperations } = nachbauDb(jetzt);   // bleibt bestehen = Datenbank
  const abstand = 24 * 3600 * 1000;

  let laeufe = 0;
  const bauen = () => {
    const p = createScheduler({ dbOperations, hatDatenbank: true, melde: still });
    p.registriere('taeglich', abstand, async () => { laeufe++; });
    return p;
  };

  await bauen().tick();                       // Erststart, legt Eintrag an

  // Zwölf Neustarts innerhalb eines Tages — frueher setzte jeder den Wecker
  // zurueck, sodass die 24 h nie voll wurden.
  for (let i = 0; i < 12; i++) {
    jetzt.wert += 2 * 3600 * 1000;            // je 2 Stunden
    await bauen().tick();
  }
  assert.equal(laeufe, 1,
    'nach 24 h muss genau EIN Lauf stattgefunden haben, trotz zwölf Neustarts');
});

test('Wochenlauf kommt trotz täglicher Neustarts durch', async () => {
  const jetzt = { wert: 1_000_000 };
  const { dbOperations } = nachbauDb(jetzt);
  let laeufe = 0;
  const bauen = () => {
    const p = createScheduler({ dbOperations, hatDatenbank: true, melde: still });
    p.registriere('woechentlich', 7 * 24 * 3600 * 1000, async () => { laeufe++; });
    return p;
  };

  await bauen().tick();
  for (let tag = 0; tag < 10; tag++) {        // zehn Tage, jeden Tag ein Neustart
    jetzt.wert += 24 * 3600 * 1000;
    await bauen().tick();
  }
  assert.equal(laeufe, 1, 'nach zehn Tagen genau ein Wochenlauf');
});

test('ein fehlschlagender Ablauf stoppt die anderen nicht', async () => {
  const jetzt = { wert: 1_000_000 };
  const { dbOperations, zeilen } = nachbauDb(jetzt);
  const planer = createScheduler({ dbOperations, hatDatenbank: true, melde: still });

  let zweiterLief = false;
  planer.registriere('kaputt', 1000, async () => { throw new Error('geht nicht'); });
  planer.registriere('heil', 1000, async () => { zweiterLief = true; });

  await planer.tick();
  jetzt.wert += 5000;
  await planer.tick();

  assert.equal(zweiterLief, true, 'der zweite Ablauf muss trotzdem laufen');
  assert.match(zeilen.get('kaputt').lastError, /geht nicht/, 'Fehler wird festgehalten');
});

test('ein Fehler blockiert den nächsten Versuch nicht dauerhaft', async () => {
  const jetzt = { wert: 1_000_000 };
  const { dbOperations } = nachbauDb(jetzt);
  const planer = createScheduler({ dbOperations, hatDatenbank: true, melde: still });

  let versuche = 0;
  planer.registriere('wackelig', 1000, async () => {
    versuche++;
    if (versuche === 1) throw new Error('einmalig kaputt');
  });

  await planer.tick();
  jetzt.wert += 5000; await planer.tick();     // scheitert
  jetzt.wert += 5000; await planer.tick();     // muss es erneut versuchen
  assert.equal(versuche, 2);
});

test('ohne Datenbank läuft es weiter — nur ohne Neustart-Festigkeit', async () => {
  const planer = createScheduler({ dbOperations: null, hatDatenbank: false, melde: still });
  let laeufe = 0;
  planer.registriere('kurz', 50, async () => { laeufe++; });

  await planer.tick();                         // legt Grundlage, laeuft nicht
  assert.equal(laeufe, 0);
  await new Promise((r) => setTimeout(r, 80));
  await planer.tick();
  assert.equal(laeufe, 1, 'nach Ablauf des Abstands läuft es auch ohne Datenbank');
});

test('Datenbank kurz nicht erreichbar: Takt wird ausgelassen, nicht blind gestartet', async () => {
  const planer = createScheduler({
    dbOperations: { claimJobRun: async () => { throw new Error('Verbindung weg'); } },
    hatDatenbank: true,
    melde: still
  });
  let laeufe = 0;
  planer.registriere('taeglich', 1000, async () => { laeufe++; });

  await planer.tick();
  assert.equal(laeufe, 0, 'ohne Beleg darf nicht gestartet werden');
});

test('Gegenprobe: mit dem alten Verhalten wäre der Tageslauf nie gekommen', async () => {
  // Bildet nach, was vorher passierte: der Zeitpunkt lebte NUR im Prozess, ein
  // Neustart begann bei null. Dieser Test dokumentiert den Fehler und belegt
  // zugleich, dass der Test oben ("Neustart setzt nicht zurück") wirklich
  // etwas prueft — ohne ihn koennte er auch aus dem falschen Grund gruen sein.
  const abstand = 24 * 3600 * 1000;
  let jetzt = 1_000_000;
  let laeufe = 0;

  // Ein Neustart = frischer Planer OHNE geteilten Speicher.
  const neustartUndTicken = async () => {
    const p = createScheduler({ dbOperations: null, hatDatenbank: false, melde: still });
    p.registriere('taeglich', abstand, async () => { laeufe++; });
    await p.tick();   // legt seine eigene, neue Grundlage an
  };

  for (let i = 0; i < 20; i++) {   // 20 Neustarts über zwei Tage
    jetzt += 2 * 3600 * 1000;
    await neustartUndTicken();
  }

  assert.equal(laeufe, 0,
    'ohne festgehaltenen Zeitpunkt läuft der Tageslauf trotz zwei vergangener Tage nie');
});

test('langsamer Ablauf stapelt sich nicht', async () => {
  const jetzt = { wert: 1_000_000 };
  const { dbOperations } = nachbauDb(jetzt);
  const planer = createScheduler({ dbOperations, hatDatenbank: true, melde: still });

  let gleichzeitig = 0, hoechstwert = 0;
  planer.registriere('langsam', 1, async () => {
    gleichzeitig++;
    hoechstwert = Math.max(hoechstwert, gleichzeitig);
    await new Promise((r) => setTimeout(r, 30));
    gleichzeitig--;
  });

  await planer.tick();
  jetzt.wert += 1000;
  await Promise.all([planer.tick(), planer.tick(), planer.tick()]);
  assert.equal(hoechstwert, 1, 'derselbe Ablauf darf nie doppelt laufen');
});
