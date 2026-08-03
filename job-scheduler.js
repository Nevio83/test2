/**
 * job-scheduler.js — zeitgesteuerte Ablaeufe, die einen Neustart ueberleben.
 *
 * DAS PROBLEM (am 02.08. nachgemessen)
 * Bisher stand jeder Ablauf auf einem eigenen setInterval im laufenden
 * Prozess, und nirgends wurde festgehalten, wann er zuletzt lief. Bei jedem
 * Neustart begann der Wecker von vorn. In den letzten 30 Tagen gab es 60
 * Commits — jeder davon startet den Dienst neu, also rund zweimal taeglich.
 * Ein Ablauf mit Tagesabstand kam damit selten bis zum Ausloesen, einer mit
 * Wochenabstand praktisch nie. Betroffen waren genau die Ablaeufe, die still
 * im Hintergrund schuetzen sollen: Datenbank-Sicherung, der Abgleich
 * "bezahlt aber keine Bestellung", der Lagerbestand beim Lieferanten und die
 * Einkaufspreis-Ueberwachung.
 *
 * DIE LOESUNG
 * Nicht "alle 24 Stunden ab jetzt", sondern "faellig, wenn seit dem letzten
 * Lauf 24 Stunden vergangen sind". Der letzte Lauf steht in der Datenbank
 * (Tabelle job_runs), also uebersteht er jeden Neustart. Ein kurzer Takt
 * (Vorgabe: alle 5 Minuten) sieht nach, was faellig ist.
 *
 * Damit ist der Neustart kein Zaehler-Reset mehr, sondern hoechstens eine
 * Verzoegerung um einen Takt.
 *
 * OHNE DATENBANK
 * Faellt DATABASE_URL weg, gibt es nichts zu merken. Dann arbeitet der Planer
 * mit Zeitpunkten im Speicher weiter — also wie vorher. Das ist bewusst kein
 * Fehlerfall: der Shop soll auch ohne Datenbank starten (genau das prueft der
 * Prueflauf in der CI).
 *
 * NICHT GLEICHZEITIG
 * Ob ein Ablauf faellig ist UND das Belegen des Laufs passieren in EINER
 * Datenbank-Anweisung (siehe dbOperations.claimJobRun). Zwei Instanzen oder
 * zwei Ticks koennen denselben Lauf daher nicht doppelt starten.
 */

const TAKT_MS = 5 * 60 * 1000;

/**
 * @param {object} deps
 * @param {object} deps.dbOperations  Datenbank-Zugriff (claimJobRun, markJobError)
 * @param {boolean} deps.hatDatenbank  false -> Zeitpunkte nur im Speicher
 * @param {function} [deps.melde]      Protokoll-Ausgabe (fuer Tests ersetzbar)
 */
function createScheduler({ dbOperations, hatDatenbank, melde = console.log, taktMs = TAKT_MS }) {
  const ablaeufe = [];
  const imSpeicher = new Map();   // Rueckfall ohne Datenbank
  let timer = null;
  let laeuftGerade = false;

  /**
   * @param {string} name        Schluessel in job_runs, stabil halten
   * @param {number} abstandMs   gewuenschter Abstand zwischen zwei Laeufen
   * @param {function} fn        der Ablauf selbst (darf werfen)
   */
  function registriere(name, abstandMs, fn) {
    ablaeufe.push({ name, abstandSek: Math.round(abstandMs / 1000), fn });
  }

  /** Ist der Ablauf faellig — und wenn ja, gleich belegen. */
  async function uebernehmen(ablauf) {
    if (!hatDatenbank) {
      const zuletzt = imSpeicher.get(ablauf.name) || 0;
      // Erster Aufruf: wie mit Datenbank NICHT sofort starten, sondern den
      // Abstand abwarten. Sonst rennen beim Start alle gleichzeitig los.
      if (!zuletzt) { imSpeicher.set(ablauf.name, Date.now()); return false; }
      if (Date.now() - zuletzt < ablauf.abstandSek * 1000) return false;
      imSpeicher.set(ablauf.name, Date.now());
      return true;
    }
    try {
      const r = await dbOperations.claimJobRun(ablauf.name, ablauf.abstandSek);
      return r.uebernommen;
    } catch (e) {
      // Datenbank kurz weg? Dann diesen Takt auslassen statt blind zu starten —
      // ohne Beleg wuesste niemand, ob der Lauf schon einmal lief.
      melde(`⚠️ Ablauf "${ablauf.name}": Faelligkeit nicht pruefbar — ${e.message}`);
      return false;
    }
  }

  async function tick() {
    if (laeuftGerade) return;   // ein langsamer Ablauf darf sich nicht stapeln
    laeuftGerade = true;
    try {
      for (const ablauf of ablaeufe) {
        let dran = false;
        try { dran = await uebernehmen(ablauf); } catch (e) { dran = false; }
        if (!dran) continue;

        melde(`⏱️ Ablauf "${ablauf.name}" ist fällig — starte`);
        try {
          await ablauf.fn();
          melde(`✅ Ablauf "${ablauf.name}" fertig`);
        } catch (e) {
          melde(`❌ Ablauf "${ablauf.name}" fehlgeschlagen: ${e && e.message}`);
          if (hatDatenbank) {
            try { await dbOperations.markJobError(ablauf.name, e && e.message); } catch (e2) { /* egal */ }
          }
        }
      }
    } finally {
      laeuftGerade = false;
    }
  }

  function start() {
    if (!ablaeufe.length) {
      melde('⏱️ Keine zeitgesteuerten Abläufe aktiv');
      return;
    }
    const namen = ablaeufe.map((a) => `${a.name} (${Math.round(a.abstandSek / 3600)}h)`).join(', ');
    melde(`⏱️ Planer aktiv, Takt ${taktMs / 60000} Min — ${ablaeufe.length} Abläufe: ${namen}`);
    melde(hatDatenbank
      ? '   Letzter Lauf wird in der Datenbank festgehalten → übersteht Neustarts'
      : '   ⚠️ Ohne DATABASE_URL nur im Speicher → ein Neustart setzt die Abstände zurück');

    // Erster Takt kurz nach dem Start, damit das Hochfahren nicht wartet.
    timer = setTimeout(function schleife() {
      tick().finally(() => { timer = setTimeout(schleife, taktMs); if (timer.unref) timer.unref(); });
    }, 30 * 1000);
    if (timer.unref) timer.unref();
  }

  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  return { registriere, start, stop, tick, anzahl: () => ablaeufe.length };
}

module.exports = { createScheduler, TAKT_MS };
