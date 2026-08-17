/**
 * api.js — Abfragen fuer das Marketing-Dashboard.
 *
 * WARUM DIESE DATEI HIER LIEGT UND NICHT IN database.js
 *
 * database.js gehoert dem Shop. Der Marketing-Automat haengt zwar an
 * derselben Datenbank, ist aber ein eigener Teil mit eigenem Lebenszyklus —
 * und Runde 10 soll den Shop-Code so wenig wie moeglich anfassen. Deshalb
 * stehen die mkt_*-Abfragen hier, und server.js bekommt nur einen schlanken
 * Routen-Block, der sie aufruft.
 *
 * ALLE ABFRAGEN SIND LESEND, bis auf den Notaus-Schalter. Das Dashboard
 * startet keine Prozesse und rendert keine Videos — es zeigt an, was der
 * Automat tut, und kann ihn anhalten. Mehr nicht.
 *
 * OHNE DATENBANK: jede Funktion liefert eine leere Antwort statt zu werfen.
 * Der Shop startet auch ohne DATABASE_URL, und das Dashboard soll ihn nicht
 * daran hindern.
 */

const { db } = require('../database');

const hatDatenbank = !!process.env.DATABASE_URL;

/** Kleiner Helfer: Abfrage ausfuehren, bei fehlender DB leeres Ergebnis. */
async function frag(sql, params = []) {
  if (!hatDatenbank) return [];
  const r = await db.query(sql, params);
  return r.rows;
}

/**
 * Zustand aller Ablaeufe — die wichtigste Ansicht.
 * "in_sekunden" sagt, wie lange es noch bis zum naechsten Lauf dauert;
 * ohne diese Angabe kann man nicht unterscheiden zwischen "laeuft gleich"
 * und "haengt seit gestern".
 */
async function jobs() {
  return frag(
    `SELECT job, abstand_sek, letzter_lauf, naechster_lauf, laeufe,
            fehler_zaehler, letzter_fehler, letzter_fehler_at,
            requires_local, enabled, laeuft_seit, heartbeat_at,
            GREATEST(0, EXTRACT(EPOCH FROM (naechster_lauf - now()))::int) AS in_sekunden
       FROM mkt_jobs ORDER BY job`
  );
}

/** Die letzten Laeufe samt Ergebnis — zeigt, ob wirklich etwas passiert. */
async function laeufe(limit = 25) {
  return frag(
    `SELECT job, gestartet_at, beendet_at, dauer_ms, ergebnis, fehlertext, details
       FROM mkt_job_events ORDER BY gestartet_at DESC LIMIT $1`,
    [Math.min(limit, 100)]
  );
}

/**
 * Trend-Rangliste mit den Score-Bestandteilen (warum steht der oben?).
 *
 * JE THEMA EINE ZEILE. Jeder Durchlauf legt fuer dasselbe Stichwort eine
 * neue mkt_trends-Zeile an — die Historie braucht saisonalitaet(). Ohne
 * DISTINCT ON stand hier deshalb dasselbe Stichwort dreimal untereinander
 * (real gemessen: 18 Zeilen fuer 6 Stichwoerter), und die Rangliste zeigte
 * statt der besten 12 Themen nur die besten 4.
 */
async function trends(limit = 20) {
  return frag(
    `SELECT * FROM (
       SELECT DISTINCT ON (t.keyword_norm)
              t.id, t.quelle, t.keyword, t.keyword_norm, t.sprache, t.erfasst_am,
              s.score, s.bestandteile
         FROM mkt_trends t
         JOIN mkt_trend_scores s ON s.trend_id = t.id
        WHERE s.gueltig_bis IS NULL OR s.gueltig_bis > now()
        ORDER BY t.keyword_norm, s.score DESC, t.erfasst_am DESC
     ) q
     ORDER BY q.score DESC, q.erfasst_am DESC
     LIMIT $1`,
    [Math.min(limit, 100)]
  );
}

/** Warteschlange: fertige Videos und geplante Beitraege. */
async function warteschlange(limit = 25) {
  return frag(
    `SELECT p.id AS post_id, p.plattform, p.status, p.geplant_fuer, p.slot,
            p.gepostet_am, p.externe_post_id,
            v.id AS video_id, v.stil, v.dauer_sek, v.pruefergebnis, v.pfad,
            b.compliance_status, m.produkt_id
       FROM mkt_posts p
       JOIN mkt_videos v ON v.id = p.video_id
       JOIN mkt_briefs b ON b.id = v.brief_id
       JOIN mkt_matches m ON m.id = b.match_id
      ORDER BY p.geplant_fuer DESC
      LIMIT $1`,
    [Math.min(limit, 100)]
  );
}

/** Videos, die die Ausgangspruefung NICHT bestanden haben — mit Grund. */
async function verworfen(limit = 15) {
  return frag(
    `SELECT v.id, v.stil, v.pruefergebnis, v.pruefgrund, v.erstellt_am, m.produkt_id
       FROM mkt_videos v
       JOIN mkt_briefs b ON b.id = v.brief_id
       JOIN mkt_matches m ON m.id = b.match_id
      WHERE v.pruefergebnis = 'verworfen'
      ORDER BY v.erstellt_am DESC LIMIT $1`,
    [Math.min(limit, 50)]
  );
}

/** Veroeffentlichte Beitraege mit Kennzahlen und Umsatzzuordnung. */
async function ergebnisse(limit = 20) {
  return frag(
    `SELECT p.id AS post_id, p.plattform, p.slot, p.gepostet_am, v.stil,
            r.reward_vorlaeufig, r.reward_final,
            a.shop_sessions, a.bestellungen, a.umsatz, a.deckungsbeitrag,
            (SELECT views FROM mkt_metrics mm
              WHERE mm.post_id = p.id ORDER BY mm.erfasst_am DESC LIMIT 1) AS views
       FROM mkt_posts p
       JOIN mkt_videos v ON v.id = p.video_id
       LEFT JOIN mkt_rewards r ON r.post_id = p.id
       LEFT JOIN mkt_attribution a ON a.post_id = p.id
      WHERE p.status = 'gepostet'
      ORDER BY p.gepostet_am DESC LIMIT $1`,
    [Math.min(limit, 100)]
  );
}

/**
 * Lernstand je Dimension. "wert" ist der Erwartungswert des Arms
 * (alpha / (alpha+beta)) — die Zahl, nach der das System auswaehlt.
 */
async function lernstand() {
  return frag(
    `SELECT dimension, auspraegung, kontext, versuche,
            ROUND((alpha / NULLIF(alpha + beta, 0))::numeric, 3)::float AS wert,
            gesperrt_bis, aktualisiert_am
       FROM mkt_arms
      WHERE kontext = '*'
      ORDER BY dimension, wert DESC`
  );
}

/** Kosten des laufenden Monats, je Anbieter. */
async function kosten() {
  const zeilen = await frag(
    `SELECT anbieter,
            SUM(kosten_cent) FILTER (WHERE zeitpunkt >= date_trunc('day', now()))::int   AS heute_cent,
            SUM(kosten_cent) FILTER (WHERE zeitpunkt >= date_trunc('month', now()))::int AS monat_cent,
            COUNT(*) FILTER (WHERE zeitpunkt >= date_trunc('month', now()))::int         AS aufrufe
       FROM mkt_cost_ledger
      GROUP BY anbieter ORDER BY 3 DESC NULLS LAST`
  );
  const summe = zeilen.reduce(
    (a, z) => ({
      heute_cent: a.heute_cent + (z.heute_cent || 0),
      monat_cent: a.monat_cent + (z.monat_cent || 0)
    }),
    { heute_cent: 0, monat_cent: 0 }
  );
  return { je_anbieter: zeilen, ...summe };
}

/** Nachweis-Protokoll: was hat das System entschieden und warum. */
async function protokoll(limit = 40) {
  return frag(
    `SELECT id, job, entscheidung, begruendung, score, vorher, nachher, zeitpunkt
       FROM mkt_audit_log ORDER BY zeitpunkt DESC LIMIT $1`,
    [Math.min(limit, 200)]
  );
}

/** Gelernte Werte, die von der Konfigurationsdatei abweichen. */
async function overrides() {
  return frag(
    `SELECT pfad, wert, gesetzt_von, gesetzt_am
       FROM mkt_config_overrides ORDER BY gesetzt_am DESC`
  );
}

/** Zusammenfassung fuer die Kopfzeile. */
async function ueberblick() {
  if (!hatDatenbank) {
    return { datenbank: false, grund: 'DATABASE_URL fehlt' };
  }
  const [z] = await frag(
    `SELECT
       (SELECT COUNT(*) FROM mkt_jobs WHERE enabled)::int                        AS jobs_aktiv,
       (SELECT COUNT(*) FROM mkt_jobs)::int                                      AS jobs_gesamt,
       (SELECT COUNT(*) FROM mkt_trends WHERE erfasst_am > now() - interval '7 days')::int AS trends_woche,
       (SELECT COUNT(*) FROM mkt_briefs WHERE compliance_status = 'ok')::int      AS briefings_frei,
       (SELECT COUNT(*) FROM mkt_briefs WHERE compliance_status = 'blocked')::int AS briefings_gesperrt,
       (SELECT COUNT(*) FROM mkt_videos WHERE pruefergebnis = 'ok')::int          AS videos_ok,
       (SELECT COUNT(*) FROM mkt_videos WHERE pruefergebnis = 'verworfen')::int   AS videos_verworfen,
       (SELECT COUNT(*) FROM mkt_posts WHERE status = 'gepostet')::int            AS gepostet,
       (SELECT COUNT(*) FROM mkt_posts WHERE status = 'dry_run')::int             AS trockenlauf,
       (SELECT COUNT(*) FROM mkt_posts WHERE status = 'geplant')::int             AS geplant,
       (SELECT COUNT(*) FROM mkt_jobs WHERE fehler_zaehler > 0)::int              AS jobs_mit_fehler`
  );
  return { datenbank: true, ...z };
}

/**
 * Notaus-Schalter. Setzt NUR das Flag — startet und stoppt keine Prozesse.
 * Der naechste Takt liest es und haelt an. Ein Dashboard, das Prozesse
 * abschiesst, waere die gefaehrlichere Bauart: Es koennte einen Job mitten
 * im Rendern oder Posten unterbrechen.
 */
async function schalte(job, an) {
  if (!hatDatenbank) return { ok: false, grund: 'keine Datenbank' };
  const r = await db.query(
    `UPDATE mkt_jobs SET enabled = $2, fehler_zaehler = 0 WHERE job = $1 RETURNING job, enabled`,
    [job, !!an]
  );
  if (!r.rows.length) return { ok: false, grund: 'Job unbekannt' };
  await db.query(
    `INSERT INTO mkt_audit_log (job, entscheidung, begruendung, nachher)
     VALUES ($1, 'job_geschaltet', 'Schalter im Admin-Dashboard', $2)`,
    [job, JSON.stringify({ enabled: !!an })]
  );
  return { ok: true, ...r.rows[0] };
}

/** Alle Ablaeufe auf einmal an- oder abschalten. */
async function schalte_alle(an) {
  if (!hatDatenbank) return { ok: false, grund: 'keine Datenbank' };
  const r = await db.query(
    `UPDATE mkt_jobs SET enabled = $1, fehler_zaehler = 0 RETURNING job`,
    [!!an]
  );
  await db.query(
    `INSERT INTO mkt_audit_log (job, entscheidung, begruendung, nachher)
     VALUES (NULL, 'notaus', 'Sammelschalter im Admin-Dashboard', $1)`,
    [JSON.stringify({ enabled: !!an, betroffen: r.rowCount })]
  );
  return { ok: true, betroffen: r.rowCount };
}

module.exports = {
  jobs, laeufe, trends, warteschlange, verworfen, ergebnisse,
  lernstand, kosten, protokoll, overrides, ueberblick, schalte, schalte_alle
};
