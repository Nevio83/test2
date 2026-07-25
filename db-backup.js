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

// Geschaeftskritische Tabellen: Bestellungen, Retouren, Bewertungen, Newsletter,
// Audit-Log. Bewusst OHNE die grossen Analytics-Tabellen (page_views, search_events,
// user_consent_events) -> die sind reproduzierbar/unkritisch und wuerden den Export
// unnoetig aufblaehen.
const BACKUP_TABLES = [
  'orders', 'order_items', 'receipts', 'order_tracking',
  'return_requests', 'product_reviews', 'newsletter_subscribers',
  'abandoned_carts', 'admin_audit_log'
];

async function exportBackupJson() {
  const tables = {};
  const counts = {};
  for (const t of BACKUP_TABLES) {
    const r = await db.query(`SELECT * FROM ${t} ORDER BY id ASC`);
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

module.exports = { runDatabaseBackup };
