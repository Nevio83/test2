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
 *
 * DIE DATENBANK SCHLAFEN LASSEN (seit 23.09.)
 * Frueher fragte JEDER Takt fuer JEDEN Ablauf die Datenbank — zwei Abfragen
 * je Ablauf, alle fuenf Minuten, rund um die Uhr. Neon legt die
 * Rechenleistung erst nach einigen Minuten Ruhe schlafen; ein Fuenf-Minuten-
 * Takt liess nie Ruhe aufkommen. Der Keep-Alive haelt den Render-Prozess
 * zugleich dauerhaft wach, also lief die Datenbank durchgehend. Am 22.09. war
 * das monatliche Rechenkontingent aufgebraucht, und Neon verweigerte jede
 * Verbindung — Bestellungen, Belege, Admin-Panel, alles stand.
 *
 * Jetzt merkt sich der Planer, WANN ein Ablauf das naechste Mal faellig ist
 * (claimJobRun liefert die Restzeit gleich mit), und fragt die Datenbank bis
 * dahin gar nicht. Der Takt selbst bleibt — er kostet nur noch einen Blick in
 * den Speicher. Bei Tages- und Wochenlaeufen sind das wenige Abfragen am Tag
 * statt hunderte.
 *
 * Die Festigkeit gegen Neustarts bleibt erhalten: Der Merkzettel lebt nur im
 * Prozess. Nach einem Neustart ist er leer, der erste Takt fragt also einmal
 * je Ablauf nach — und die Wahrheit steht weiterhin in job_runs.
 */

const TAKT_MS = 5 * 60 * 1000;

// Nach einem Datenbankfehler so lange nicht erneut fragen. Eine tote oder
// ueberlastete Datenbank alle fuenf Minuten erneut anzuklopfen, hilft ihr
// nicht und fuellt nur das Protokoll.
const FEHLER_PAUSE_MS = 15 * 60 * 1000;

// Liefert die Datenbank keine Restzeit (aeltere Fassung, Zusatzabfrage
// gescheitert), wird nach spaetestens dieser Zeit erneut gefragt. Bewusst
// nicht der volle Abstand: Ein Wochenlauf koennte sonst nach einem Neustart
// fast eine Woche zu spaet kommen. Eine Stunde ist weit laenger als Neons
// Ruhefenster, die Datenbank kann also dazwischen schlafen.
const RUECKFALL_NACHFRAGE_MS = 60 * 60 * 1000;

/**
 * @param {object} deps
 * @param {object} deps.dbOperations  Datenbank-Zugriff (claimJobRun, markJobError)
 * @param {boolean} deps.hatDatenbank  false -> Zeitpunkte nur im Speicher
 * @param {function} [deps.melde]      Protokoll-Ausgabe (fuer Tests ersetzbar)
 * @param {function} [deps.jetzt]      Uhr in ms (fuer Tests ersetzbar). Muss
 *   dieselbe sein, gegen die auch die Faelligkeit gerechnet wird — sonst
 *   laeuft der Merkzettel auf einer anderen Zeit als die Datenbank.
 */
function createScheduler({
  dbOperations, hatDatenbank, melde = console.log, taktMs = TAKT_MS, jetzt = () => Date.now()
}) {
  const ablaeufe = [];
  const imSpeicher = new Map();   // Rueckfall ohne Datenbank
  const faelligAb = new Map();    // name -> ms; bis dahin wird die DB NICHT gefragt
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
    // Laut Merkzettel noch nicht faellig -> die Datenbank gar nicht erst
    // fragen. Das ist der ganze Punkt: Nur so kann Neon zwischen zwei
    // Laeufen schlafen.
    const bis = faelligAb.get(ablauf.name);
    if (bis !== undefined && jetzt() < bis) return false;

    try {
      const r = await dbOperations.claimJobRun(ablauf.name, ablauf.abstandSek);
      if (r && r.uebernommen) {
        faelligAb.set(ablauf.name, jetzt() + ablauf.abstandSek * 1000);
        return true;
      }
      // Nicht faellig. Mit Restzeit genau bis dahin schweigen, ohne Restzeit
      // hoechstens eine Stunde (siehe RUECKFALL_NACHFRAGE_MS).
      const rest = r && Number.isFinite(r.restSek) ? r.restSek * 1000 : null;
      faelligAb.set(ablauf.name, jetzt() + (rest !== null
        ? Math.max(0, rest)
        : Math.min(ablauf.abstandSek * 1000, RUECKFALL_NACHFRAGE_MS)));
      return false;
    } catch (e) {
      // Datenbank kurz weg? Dann diesen Takt auslassen statt blind zu starten —
      // ohne Beleg wuesste niemand, ob der Lauf schon einmal lief. Und eine
      // Weile Ruhe geben, statt sie alle fuenf Minuten erneut anzuklopfen.
      faelligAb.set(ablauf.name, jetzt() + FEHLER_PAUSE_MS);
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

module.exports = { createScheduler, TAKT_MS, FEHLER_PAUSE_MS, RUECKFALL_NACHFRAGE_MS };
