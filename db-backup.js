/**
 * db-backup.js — zusaetzliches Sicherheitsnetz fuer Neon-Postgres.
 *
 * Ergaenzt (ersetzt NICHT) Neons eigene Backup-/Point-in-Time-Recovery-Einstellungen
 * im Neon-Dashboard — die bitte separat pruefen. Dieser Job exportiert die
 * geschaeftskritischen Tabellen regelmaessig als komprimierte JSON-Datei per Mail,
 * unabhaengig vom Hosting-Anbieter (funktioniert auch, falls Neon je unerreichbar
 * waere). Gzip haelt den Anhang klein genug fuer normalen E-Mail-Versand.
 */

const zlib = require('zlib');
const { db } = require('./database');
const emailService = require('./resend-service');

/**
 * Was gesichert wird — und warum.
 *
 * Hier stand frueher: "bewusst OHNE die grossen Analytics-Tabellen
 * (page_views, search_events, user_consent_events) -> die sind
 * reproduzierbar/unkritisch und wuerden den Export unnoetig aufblaehen."
 * BEIDE BEGRUENDUNGEN TRUGEN NICHT:
 *
 *   Reproduzierbar ist keine davon. user_consent_events ist der NACHWEIS
 *   einer erteilten Einwilligung — Art. 7 Abs. 1 DSGVO verlangt, dass der
 *   Verantwortliche ihn erbringen kann. Ist er weg, ist er weg.
 *   page_views und search_events sind Besucher-Historie; die laesst sich
 *   nicht nachtraeglich herstellen.
 *
 *   Aufblaehen taten sie nichts: nachgemessen 504 KB fuer ALLE nicht
 *   gesicherten Tabellen zusammen — und das fast ausschliesslich leerer
 *   Tabellen-Ueberbau. Die eigentlichen Daten sind gzip-komprimiert ein
 *   Bruchteil davon.
 *
 * Ausserdem fehlten zwei Tabellen, die in der Begruendung gar nicht
 * vorkamen: privacy_requests (Auskunfts- und Loeschanfragen — ein Nachweis,
 * den man im Streitfall braucht) und stock_notifications (Menschen, denen
 * eine Nachricht versprochen wurde, sobald ein Artikel zurueck ist).
 */
const BACKUP_TABLES = [
  // Geschaeft
  'orders', 'order_items', 'receipts', 'order_tracking',
  'return_requests', 'product_reviews', 'newsletter_subscribers',
  'abandoned_carts', 'admin_audit_log',
  // Nachweise und Zusagen — nicht wiederherstellbar
  'user_consent_events', 'privacy_requests', 'stock_notifications',
  // Besucher-Historie — ebenfalls nicht wiederherstellbar
  'page_views', 'search_events'
];

/**
 * BEWUSST NICHT dabei: cj_price_watch, cj_stock_watch und job_runs.
 * Das sind Arbeitsstaende, die sich von selbst neu aufbauen — der naechste
 * Bestands- bzw. Preisabgleich fuellt sie, und job_runs bestimmt nur, wann
 * ein Zeitplan das naechste Mal faellig ist. Nichts davon ist verloren,
 * wenn es fehlt.
 */

/**
 * Sortierspalte je Tabelle ermitteln — EIN Abfrage für alle, nicht eine je
 * Tabelle. Wichtig, weil frueher hart "ORDER BY id" stand: Drei Tabellen des
 * Schemas haben gar keine id-Spalte (cj_price_watch/cj_stock_watch heissen
 * sie product_id, job_runs heisst sie job). Wer eine davon in die Liste oben
 * eintraegt, haette damit den GESAMTEN Lauf zum Absturz gebracht — und zwar
 * still: der Fehler wird unten gefangen und endet als "Backup fehlgeschlagen"
 * im Log, ohne zu sagen, welche Tabelle schuld ist.
 *
 * Ohne erkennbare Spalte wird ungesortiert gelesen (besser als abzustuerzen).
 */
async function sortierSpalten(tabellen) {
  const r = await db.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1)
        AND column_name IN ('id', 'product_id', 'job')`,
    [tabellen]
  );
  const rang = { id: 1, product_id: 2, job: 3 };
  const beste = {};
  for (const row of r.rows) {
    const bisher = beste[row.table_name];
    if (!bisher || rang[row.column_name] < rang[bisher]) beste[row.table_name] = row.column_name;
  }
  return beste;
}

async function exportBackupJson() {
  const spalten = await sortierSpalten(BACKUP_TABLES);
  const tables = {};
  const counts = {};
  for (const t of BACKUP_TABLES) {
    const spalte = spalten[t];
    const r = await db.query(`SELECT * FROM ${t}` + (spalte ? ` ORDER BY ${spalte} ASC` : ''));
    tables[t] = r.rows;
    counts[t] = r.rowCount;
  }
  return {
    generated_at: new Date().toISOString(),
    source: 'maiosshop.com',
    counts,
    tables
  };
}

/**
 * Fuehrt den Export aus, komprimiert ihn und verschickt ihn als Mail-Anhang.
 * Gibt { success, counts, sizeKb, error? } zurueck. Wirft nie — Aufrufer entscheidet,
 * wie ein Fehlschlag behandelt wird (Log, Admin-Antwort etc.).
 */
async function runDatabaseBackup() {
  try {
    const payload = await exportBackupJson();
    const json = JSON.stringify(payload);
    const gzipped = zlib.gzipSync(Buffer.from(json, 'utf8'));
    const dateStr = payload.generated_at.slice(0, 10);
    const to = process.env.DB_BACKUP_EMAIL || process.env.RECEIPT_ARCHIVE_EMAIL || 'maioscorporation@gmail.com';

    const totalRows = Object.values(payload.counts).reduce((s, n) => s + n, 0);
    const summary = Object.entries(payload.counts)
      .map(([t, n]) => `<li>${t}: ${n}</li>`).join('');

    const mail = await emailService.sendEmail({
      to,
      subject: `🗄️ Datenbank-Backup ${dateStr} — Maios Shop`,
      html: `<h2>Datenbank-Backup ${dateStr}</h2>` +
        `<p>Zusaetzliches Sicherheitsnetz neben Neons eigenen Backups. ${totalRows} Zeilen insgesamt:</p>` +
        `<ul>${summary}</ul>` +
        `<p style="color:#888;font-size:13px;">Anhang: gzip-komprimiertes JSON. Im Ernstfall mit ` +
        `<code>gunzip</code> entpacken und die Tabellen manuell zurueckspielen.</p>`,
      attachments: [{
        filename: `maios-backup-${dateStr}.json.gz`,
        content: gzipped.toString('base64')
      }]
    });

    if (!mail || !mail.success) {
      console.error('❌ DB-Backup-Mail fehlgeschlagen:', mail && mail.error);
      return { success: false, error: (mail && mail.error) || 'Mail-Versand fehlgeschlagen', counts: payload.counts };
    }

    console.log(`🗄️ DB-Backup gesendet an ${to}: ${totalRows} Zeilen, ${(gzipped.length / 1024).toFixed(1)} KB`);
    return { success: true, counts: payload.counts, sizeKb: Math.round(gzipped.length / 1024) };
  } catch (error) {
    console.error('❌ DB-Backup fehlgeschlagen:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { runDatabaseBackup, exportBackupJson, sortierSpalten, BACKUP_TABLES };
