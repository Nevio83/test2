/**
 * stripe-reconcile.js — Abgleich "bezahlt, aber keine Bestellung".
 *
 * Warum: Bestellungen entstehen ausschliesslich, wenn Stripe den Webhook
 * (checkout.session.completed) erfolgreich zustellt. Klappt das dauerhaft nicht
 * — Server-Aussetzer, Datenbank kurz weg, Fehler mitten im Ablauf — hat der
 * Kunde bezahlt, aber es gibt keine Bestellung, keinen Beleg und keine
 * Weiterleitung an CJ. Bisher hat das niemand gemerkt, weil nirgends
 * gegengeprueft wurde. Das ist der teuerste denkbare Fehler: Geld eingenommen,
 * Ware nie verschickt.
 *
 * Dieser Abgleich holt die bezahlten Stripe-Sessions der letzten Tage und
 * prueft, ob es zu jeder eine Bestellung in der eigenen Datenbank gibt.
 *
 * WICHTIG — bewusst NUR lesend: es wird keine Bestellung automatisch angelegt.
 * Aus einer Stripe-Session laesst sich zwar viel rekonstruieren, aber eben
 * nicht alles (Farbe/Variante, CJ-Weiterleitung, Belegnummernkreis). Eine
 * automatisch erzeugte Halb-Bestellung waere schlimmer als eine Meldung, die
 * ein Mensch prueft. Der Abgleich meldet also — entschieden wird von Hand.
 */

const { dbOperations } = require('./database');
const emailService = require('./resend-service');

// Sessions, die juenger sind, werden ignoriert: Stripe wiederholt fehlgeschlagene
// Webhooks noch stundenlang, und ein Cold-Start auf dem Free-Plan kann den ersten
// Versuch verschlucken. Ohne diese Karenz wuerde jede frische Bestellung faelschlich
// als "verwaist" gemeldet.
const GRACE_MINUTES = 30;
const DEFAULT_DAYS = 7;

/** Liest bezahlte Checkout-Sessions eines Zeitraums (nur lesende Stripe-Aufrufe). */
async function listPaidSessions(stripe, sinceUnix) {
  const sessions = [];
  // autoPagingEach holt alle Seiten; das Limit deckelt den Speicher bei viel Traffic.
  await stripe.checkout.sessions
    .list({ created: { gte: sinceUnix }, limit: 100 })
    .autoPagingEach((s) => {
      if (s.payment_status === 'paid') sessions.push(s);
      if (sessions.length >= 1000) return false; // Abbruch-Signal von Stripe
    });
  return sessions;
}

/**
 * Fuehrt den Abgleich aus. Wirft nie — gibt immer eine Zusammenfassung zurueck.
 *
 * @param {object} stripe  initialisierte Stripe-Instanz (null -> uebersprungen)
 * @param {object} opts    { days }
 * @returns {{checked:number, matched:number, tooRecent:number, orphans:Array, skipped?:string}}
 */
async function runStripeReconcile(stripe, opts = {}) {
  const days = Number(opts.days) > 0 ? Number(opts.days) : DEFAULT_DAYS;
  const summary = { checked: 0, matched: 0, tooRecent: 0, orphans: [] };

  if (!stripe) {
    summary.skipped = 'Stripe nicht konfiguriert';
    return summary;
  }
  if (!process.env.DATABASE_URL) {
    summary.skipped = 'Keine Datenbank konfiguriert';
    return summary;
  }

  try {
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const sinceUnix = Math.floor(sinceMs / 1000);
    const graceCutoffMs = Date.now() - GRACE_MINUTES * 60 * 1000;

    const sessions = await listPaidSessions(stripe, sinceUnix);
    // Etwas Puffer nach hinten, damit eine Bestellung, die kurz nach der Zahlung
    // geschrieben wurde, sicher im Vergleichsfenster liegt.
    const knownPaymentIntents = await dbOperations.getPaymentIntentIdsSince(
      new Date(sinceMs - 24 * 60 * 60 * 1000).toISOString()
    );

    for (const s of sessions) {
      summary.checked++;

      if (s.created * 1000 > graceCutoffMs) {
        summary.tooRecent++; // Webhook darf noch unterwegs sein
        continue;
      }

      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
      if (pi && knownPaymentIntents.has(pi)) {
        summary.matched++;
        continue;
      }

      summary.orphans.push({
        sessionId: s.id,
        paymentIntent: pi || null,
        email: s.customer_details?.email || null,
        name: s.customer_details?.name || null,
        amount: (s.amount_total || 0) / 100,
        currency: (s.currency || 'eur').toUpperCase(),
        paidAt: new Date(s.created * 1000).toISOString()
      });
    }

    if (summary.orphans.length) {
      await sendOrphanAlert(summary, days);
    }
  } catch (e) {
    console.error('❌ Stripe-Abgleich fehlgeschlagen:', e.message);
    summary.error = e.message;
  }

  return summary;
}

/** Warnmail mit allen gefundenen Zahlungen ohne Bestellung. */
async function sendOrphanAlert(summary, days) {
  const to = process.env.ORDER_ALERT_EMAIL ||
    process.env.RECEIPT_ARCHIVE_EMAIL ||
    'maioscorporation@gmail.com';

  const rows = summary.orphans.map((o) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd">${o.paidAt.replace('T', ' ').slice(0, 16)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd">${o.name || '—'}<br><small>${o.email || '—'}</small></td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right"><strong>${o.amount.toFixed(2)} ${o.currency}</strong></td>
      <td style="padding:6px 10px;border:1px solid #ddd"><code>${o.paymentIntent || o.sessionId}</code></td>
    </tr>`).join('');

  await emailService.sendEmail({
    to,
    subject: `🚨 ${summary.orphans.length} Zahlung(en) ohne Bestellung`,
    html:
      `<h2>Bezahlt, aber keine Bestellung im System</h2>` +
      `<p>Beim Abgleich der letzten ${days} Tage wurden <strong>${summary.orphans.length} bezahlte Stripe-Zahlung(en)</strong> ` +
      `gefunden, zu denen es keine Bestellung in der Datenbank gibt. Diese Kunden haben bezahlt, aber ` +
      `<strong>weder Beleg noch Versand</strong> erhalten — bitte umgehend prüfen.</p>` +
      `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
      `<tr><th style="padding:6px 10px;border:1px solid #ddd">Bezahlt am</th>` +
      `<th style="padding:6px 10px;border:1px solid #ddd">Kunde</th>` +
      `<th style="padding:6px 10px;border:1px solid #ddd">Betrag</th>` +
      `<th style="padding:6px 10px;border:1px solid #ddd">Stripe-Referenz</th></tr>${rows}</table>` +
      `<p style="margin-top:16px">Geprüft: ${summary.checked} Zahlungen · zugeordnet: ${summary.matched} · ` +
      `zu frisch für eine Bewertung: ${summary.tooRecent}</p>` +
      `<p><small>Es wurde bewusst nichts automatisch nachgetragen — aus einer Stripe-Zahlung allein ` +
      `lassen sich Variante und Lieferantenbestellung nicht zuverlässig rekonstruieren.</small></p>`
  }).catch((e) => console.warn('⚠️ Alarm-Mail zum Stripe-Abgleich fehlgeschlagen:', e.message));
}

module.exports = { runStripeReconcile, listPaidSessions, GRACE_MINUTES };
