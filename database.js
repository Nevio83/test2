/**
 * database.js — PostgreSQL (pg)
 *
 * Dauerhafte Speicherung von Bestellungen, Positionen, Belegen, Tracking.
 * Verbindung über die ENV-Variable DATABASE_URL (z.B. von Neon — kostenlos & dauerhaft).
 * Lokal: einfach dieselbe DATABASE_URL in die .env eintragen.
 *
 * Exportiert dasselbe Interface wie vorher (dbOperations + pool als `db`),
 * damit server.js unverändert weiterläuft.
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

// SSL für gehostete DBs (Neon/Supabase) nötig; lokal aus.
const isLocal = !connectionString || /localhost|127\.0\.0\.1/.test(connectionString);
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('❌ Postgres Pool-Fehler:', err.message);
});

// ── Schema-Initialisierung ───────────────────────────────────
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address TEXT,
    billing_address TEXT,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    order_status TEXT DEFAULT 'processing',
    subtotal REAL NOT NULL,
    shipping_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(order_id),
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    product_image TEXT,
    color TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    receipt_id TEXT UNIQUE NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(order_id),
    receipt_number TEXT NOT NULL,
    pdf_path TEXT,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    admin_notified BOOLEAN DEFAULT false,
    admin_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS order_tracking (
    id SERIAL PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(order_id),
    status TEXT NOT NULL,
    description TEXT,
    tracking_number TEXT,
    carrier TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    path TEXT NOT NULL,
    referrer TEXT,
    country TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  // Erweiterte Tracking-Spalten (nur befuellt bei Consent 'all'). ADD COLUMN IF NOT
  // EXISTS -> idempotent, ersetzt ein Migrationssystem fuer bestehende Installationen.
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS device TEXT`,
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS browser TEXT`,
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS os TEXT`,
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS consent_level TEXT`,
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS is_entry BOOLEAN DEFAULT false`,
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS is_returning BOOLEAN DEFAULT false`,
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS time_on_page INTEGER`,
  `ALTER TABLE page_views ADD COLUMN IF NOT EXISTS client_view_id TEXT`,
  // Geraet zur Bestellung (fuer Geraete-Conversion). Rein informativ, optional.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS device TEXT`,
  // Einwilligungs-Log fuer die DSGVO-Auswertung (jede Banner-Entscheidung).
  `CREATE TABLE IF NOT EXISTS user_consent_events (
    id SERIAL PRIMARY KEY,
    level TEXT NOT NULL,
    session_id TEXT,
    path TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  // Suchanfragen (anonyme Marktforschung): nur Begriff + Trefferzahl, keine PII.
  // Null-Treffer-Suchen = unerfuellte Nachfrage -> Produktideen.
  `CREATE TABLE IF NOT EXISTS search_events (
    id SERIAL PRIMARY KEY,
    term TEXT NOT NULL,
    results_count INTEGER,
    consent_level TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`,
  // Fortlaufende, lueckenlose Rechnungsnummern (§ 14 UStG): eine DB-Sequence
  // statt Timestamp. nextval() ist atomar -> keine Kollisionen, keine Duplikate.
  `CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1`,
  `CREATE INDEX IF NOT EXISTS idx_consent_created ON user_consent_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_search_created ON search_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_client_view ON page_views(client_view_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON receipts(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON order_tracking(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id)`
];

async function initializeDatabase() {
  if (!connectionString) {
    console.warn('⚠️  DATABASE_URL fehlt — Postgres nicht konfiguriert. Bestell-/Beleg-/Tracking-Funktionen sind deaktiviert, der Shop läuft sonst normal.');
    return;
  }
  try {
    for (const sql of SCHEMA) {
      await pool.query(sql);
    }
    console.log('✅ Datenbank initialisiert (Postgres) und Tabellen überprüft.');
  } catch (err) {
    // Nicht hart beenden — Shop/Checkout sollen weiterlaufen, auch wenn die DB hakt.
    console.error('❌ DB-Initialisierung fehlgeschlagen:', err.message);
  }
}
initializeDatabase();

// Zeitraum-Filter fuer die Dashboard-Diagramme.
// Liefert Granularitaet + Start-Ausdruck (konstante SQL-Fragmente bzw. $1 bei 'all').
//   7d / 30d -> Tagesraster, 12m -> Monatsraster.
//   'all' waehlt das Raster nach der tatsaechlichen Datenspanne:
//     <= 92 Tage -> taeglich (sieht bei jungen Shops nicht leer aus), sonst monatlich.
// `table` wird nur fuer den MIN()-Query bei 'all' gebraucht.
async function resolveSeries(range, table) {
  if (range === '7d') return { gran: 'day', start: 'CURRENT_DATE - 6', params: [] };
  if (range === '12m') {
    return { gran: 'month', start: "date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'", params: [] };
  }
  if (range === 'all') {
    const r = await pool.query(`SELECT MIN(created_at)::date AS first FROM ${table}`);
    const first = r.rows[0] && r.rows[0].first;
    if (!first) return { gran: 'day', start: 'CURRENT_DATE', params: [] }; // keine Daten
    const spanDays = Math.floor((Date.now() - new Date(first).getTime()) / 86400000);
    return spanDays <= 92
      ? { gran: 'day', start: '$1::date', params: [first] }
      : { gran: 'month', start: "date_trunc('month', $1::date)", params: [first] };
  }
  return { gran: 'day', start: 'CURRENT_DATE - 29', params: [] }; // '30d' (Default)
}

// Zeitraum-Filter (WHERE-Fragment) fuer die Produkt-Analyse. `col` ist konstant
// (kein User-Input), `range` ist validiert -> sichere Konkatenation.
function analysisRangeFilter(range, col) {
  switch (range) {
    case '7d': return `AND ${col} >= NOW() - INTERVAL '7 days'`;
    case '12m': return `AND ${col} >= NOW() - INTERVAL '1 year'`;
    case 'all': return '';
    case '30d':
    default: return `AND ${col} >= NOW() - INTERVAL '30 days'`;
  }
}

// Baut die lueckenlose Zeitreihen-Query (generate_series) fuer eine Tabelle.
// aggs = Aggregate im Subquery, metrics = Spalten der Aussenabfrage (x = Subquery-Alias).
function buildSeriesSql(gran, start, table, aggs, metrics) {
  const bucket = gran === 'month' ? "date_trunc('month', created_at)::date" : 'created_at::date';
  const group = gran === 'month' ? "date_trunc('month', created_at)" : 'created_at::date';
  const end = gran === 'month' ? "date_trunc('month', CURRENT_DATE)" : 'CURRENT_DATE';
  const step = gran === 'month' ? '1 month' : '1 day';
  const cmp = gran === 'month' ? 'created_at >=' : 'created_at::date >=';
  return `SELECT d::date AS day, ${metrics}
          FROM generate_series(${start}, ${end}, '${step}') AS d
          LEFT JOIN (
            SELECT ${bucket} AS day, ${aggs}
            FROM ${table}
            WHERE ${cmp} (${start})
            GROUP BY ${group}
          ) x ON x.day = d::date
          ORDER BY day ASC`;
}

// Slug -> Produkt-ID (aus products.json, einmal gecacht). Noetig, seit Produktseiten
// sprechende Slug-URLs haben (/produkte/<slug>.html statt produkt-NN.html).
let _slugToId = null;
function getSlugToIdMap() {
  if (_slugToId) return _slugToId;
  _slugToId = {};
  try {
    const list = require('./products.json');
    list.forEach((p) => { if (p && p.slug) _slugToId[String(p.slug).toLowerCase()] = String(p.id); });
  } catch (e) {
    console.warn('⚠️ products.json fuer Slug-Mapping nicht ladbar:', e.message);
  }
  return _slugToId;
}

// ── Operationen (gleiches Interface wie zuvor) ───────────────
const dbOperations = {
  createOrder: async (o) => {
    const sql = `INSERT INTO orders (
      order_id, receipt_number, customer_email, customer_name, customer_phone,
      shipping_address, billing_address, payment_method, subtotal,
      shipping_cost, tax_amount, total_amount, currency, notes, device
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`;
    const r = await pool.query(sql, [
      o.order_id, o.receipt_number, o.customer_email, o.customer_name, o.customer_phone,
      o.shipping_address, o.billing_address, o.payment_method, o.subtotal,
      o.shipping_cost, o.tax_amount, o.total_amount, o.currency, o.notes, o.device || null
    ]);
    return { id: r.rows[0].id, order_id: o.order_id };
  },

  addOrderItems: async (order_id, items) => {
    const sql = `INSERT INTO order_items (
      order_id, product_id, product_name, product_sku, product_image,
      color, quantity, unit_price, total_price
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
    for (const it of items) {
      await pool.query(sql, [
        order_id, String(it.product_id ?? ''), it.product_name, it.product_sku,
        it.product_image, it.color, it.quantity, it.unit_price, it.total_price
      ]);
    }
    return items.length;
  },

  // Naechste fortlaufende Rechnungsnummer (Format RE-000001, lueckenlos).
  // Wird beim Anlegen einer Bestellung genau einmal vergeben.
  getNextReceiptNumber: async () => {
    const r = await pool.query(`SELECT nextval('receipt_seq')::bigint AS n`);
    const n = r.rows[0].n;
    return 'RE-' + String(n).padStart(6, '0');
  },

  saveReceipt: async (r) => {
    const sql = `INSERT INTO receipts (receipt_id, order_id, receipt_number, pdf_path)
                 VALUES ($1,$2,$3,$4) RETURNING id`;
    const res = await pool.query(sql, [r.receipt_id, r.order_id, r.receipt_number, r.pdf_path]);
    return { id: res.rows[0].id, receipt_id: r.receipt_id };
  },

  getOrder: async (order_id) => {
    const o = await pool.query(`SELECT * FROM orders WHERE order_id = $1`, [order_id]);
    if (o.rows.length === 0) return null;
    const items = await pool.query(`SELECT * FROM order_items WHERE order_id = $1`, [order_id]);
    return { ...o.rows[0], items: items.rows };
  },

  getOrderByOrderId: (order_id) => dbOperations.getOrder(order_id),

  getAllOrders: async (limit = 50, offset = 0) => {
    const r = await pool.query(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return r.rows;
  },

  updateOrderStatus: async (order_id, status) => {
    const r = await pool.query(
      `UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2`,
      [status, order_id]
    );
    return { changes: r.rowCount };
  },

  updateEmailStatus: async (receipt_id, type = 'customer') => {
    const col = type === 'admin' ? 'admin_notified' : 'email_sent';
    const tcol = type === 'admin' ? 'admin_notified_at' : 'email_sent_at';
    const r = await pool.query(
      `UPDATE receipts SET ${col} = true, ${tcol} = CURRENT_TIMESTAMP WHERE receipt_id = $1`,
      [receipt_id]
    );
    return { changes: r.rowCount };
  },

  addTracking: async (t) => {
    const r = await pool.query(
      `INSERT INTO order_tracking (order_id, status, description, tracking_number, carrier)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [t.order_id, t.status, t.description, t.tracking_number, t.carrier]
    );
    return { id: r.rows[0].id };
  },

  getTracking: async (order_id) => {
    const r = await pool.query(
      `SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY created_at ASC`,
      [order_id]
    );
    return r.rows;
  },

  getOrdersByEmail: async (email) => {
    const r = await pool.query(
      `SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC`,
      [email]
    );
    return r.rows;
  },

  getStatistics: async () => {
    const q = (sql) => pool.query(sql).then(r => r.rows[0]);
    const [totalOrders, totalRevenue, todayOrders, todayRevenue, pendingOrders] = await Promise.all([
      q(`SELECT COUNT(*)::int AS count FROM orders`),
      q(`SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE payment_status = 'paid'`),
      q(`SELECT COUNT(*)::int AS count FROM orders WHERE created_at::date = CURRENT_DATE`),
      q(`SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE created_at::date = CURRENT_DATE AND payment_status = 'paid'`),
      q(`SELECT COUNT(*)::int AS count FROM orders WHERE order_status = 'processing'`)
    ]);
    return { totalOrders, totalRevenue, todayOrders, todayRevenue, pendingOrders };
  },

  // ── Aufrufe / Besucher-Tracking ──────────────────────────────
  addPageView: async (v) => {
    const sql = `INSERT INTO page_views
                   (path, referrer, country, user_agent, session_id,
                    consent_level, device, browser, os, is_entry, is_returning, client_view_id)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`;
    const r = await pool.query(sql, [
      v.path, v.referrer || null, v.country || null,
      v.user_agent || null, v.session_id || null,
      v.consent_level || null, v.device || null, v.browser || null, v.os || null,
      v.is_entry === true, v.is_returning === true, v.client_view_id || null
    ]);
    return { id: r.rows[0].id };
  },

  // Verweildauer (Sekunden) zu einem zuvor gesendeten View nachtragen.
  updateViewDuration: async (clientViewId, seconds) => {
    const r = await pool.query(
      `UPDATE page_views SET time_on_page = $2
       WHERE client_view_id = $1 AND time_on_page IS NULL`,
      [clientViewId, seconds]
    );
    return { changes: r.rowCount };
  },

  // Eine Banner-Entscheidung protokollieren (fuer die DSGVO-Auswertung).
  addConsentEvent: async (c) => {
    const r = await pool.query(
      `INSERT INTO user_consent_events (level, session_id, path, user_agent)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [c.level, c.session_id || null, c.path || null, c.user_agent || null]
    );
    return { id: r.rows[0].id };
  },

  // Einwilligungs-Kennzahlen: wie oft 'alle' vs. 'nur notwendige' gewaehlt wurde.
  getConsentStats: async (days = 30) => {
    const r = await pool.query(
      `SELECT level, COUNT(*)::int AS count
       FROM user_consent_events
       WHERE created_at > NOW() - ($1 || ' days')::interval
       GROUP BY level`,
      [String(days)]
    );
    let all = 0, essential = 0;
    for (const row of r.rows) {
      if (row.level === 'all') all = row.count;
      else if (row.level === 'essential') essential = row.count;
    }
    const total = all + essential;
    return { all, essential, total, acceptRate: total ? Math.round((all / total) * 100) : 0 };
  },

  // Geraeteverteilung (nur Views mit Consent 'all' liefern device).
  getDeviceBreakdown: async (days = 30) => {
    const r = await pool.query(
      `SELECT COALESCE(NULLIF(device,''),'Unbekannt') AS device,
              COUNT(*)::int AS views,
              COUNT(DISTINCT session_id)::int AS unique_views
       FROM page_views
       WHERE device IS NOT NULL
         AND created_at > NOW() - ($1 || ' days')::interval
       GROUP BY COALESCE(NULLIF(device,''),'Unbekannt')
       ORDER BY views DESC`,
      [String(days)]
    );
    return r.rows;
  },

  // Browser-Verteilung (nur Views mit Consent 'all').
  getBrowserBreakdown: async (days = 30, limit = 8) => {
    const r = await pool.query(
      `SELECT COALESCE(NULLIF(browser,''),'Unbekannt') AS browser,
              COUNT(*)::int AS views
       FROM page_views
       WHERE browser IS NOT NULL
         AND created_at > NOW() - ($1 || ' days')::interval
       GROUP BY COALESCE(NULLIF(browser,''),'Unbekannt')
       ORDER BY views DESC
       LIMIT $2`,
      [String(days), limit]
    );
    return r.rows;
  },

  // Einstiegsseiten-Funnel: ueber welche Seite Besucher einsteigen.
  getEntryPages: async (limit = 8, days = 30) => {
    const r = await pool.query(
      `SELECT path, COUNT(*)::int AS entries,
              COUNT(DISTINCT session_id)::int AS unique_entries
       FROM page_views
       WHERE is_entry = true
         AND created_at > NOW() - ($2 || ' days')::interval
       GROUP BY path
       ORDER BY entries DESC
       LIMIT $1`,
      [limit, String(days)]
    );
    return r.rows;
  },

  // Durchschnittliche Verweildauer je Seite (Sekunden).
  getTimeOnPage: async (limit = 8, days = 30) => {
    const r = await pool.query(
      `SELECT path,
              ROUND(AVG(time_on_page))::int AS avg_seconds,
              COUNT(*)::int AS samples
       FROM page_views
       WHERE time_on_page IS NOT NULL
         AND created_at > NOW() - ($2 || ' days')::interval
       GROUP BY path
       HAVING COUNT(*) >= 1
       ORDER BY avg_seconds DESC
       LIMIT $1`,
      [limit, String(days)]
    );
    return r.rows;
  },

  // Wiederkehrende vs. neue Besucher (nur aus Views mit Consent 'all' bestimmbar).
  getVisitorTypes: async (days = 30) => {
    const r = await pool.query(
      `SELECT
         COUNT(DISTINCT session_id) FILTER (WHERE is_returning = true)::int AS returning,
         COUNT(DISTINCT session_id) FILTER (WHERE is_returning = false)::int AS fresh
       FROM page_views
       WHERE consent_level = 'all'
         AND created_at > NOW() - ($1 || ' days')::interval`,
      [String(days)]
    );
    const row = r.rows[0] || { returning: 0, fresh: 0 };
    const total = (row.returning || 0) + (row.fresh || 0);
    return {
      returning: row.returning || 0,
      fresh: row.fresh || 0,
      total,
      returnRate: total ? Math.round((row.returning / total) * 100) : 0
    };
  },

  // ── Marktforschung (aggregiert, DSGVO-konform) ──────────────────────

  // Eine Suchanfrage protokollieren (anonym, nur Begriff + Trefferzahl).
  addSearchEvent: async (s) => {
    const r = await pool.query(
      `INSERT INTO search_events (term, results_count, consent_level, session_id)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [s.term, Number.isFinite(s.results_count) ? s.results_count : null,
       s.consent_level || null, s.session_id || null]
    );
    return { id: r.rows[0].id };
  },

  // Such-Insights: Top-Begriffe + Null-Treffer-Suchen (= unerfuellte Nachfrage).
  getSearchInsights: async (days = 30, limit = 15) => {
    const interval = [String(days)];
    const [totals, top, noResults] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE results_count = 0)::int AS zero
         FROM search_events WHERE created_at > NOW() - ($1 || ' days')::interval`, interval),
      pool.query(
        `SELECT lower(term) AS term, COUNT(*)::int AS searches,
                ROUND(AVG(results_count))::int AS avg_results,
                COUNT(*) FILTER (WHERE results_count = 0)::int AS zero_hits
         FROM search_events WHERE created_at > NOW() - ($1 || ' days')::interval
         GROUP BY lower(term) ORDER BY searches DESC, term ASC LIMIT $2`, [String(days), limit]),
      pool.query(
        `SELECT lower(term) AS term, COUNT(*)::int AS searches
         FROM search_events
         WHERE results_count = 0 AND created_at > NOW() - ($1 || ' days')::interval
         GROUP BY lower(term) ORDER BY searches DESC, term ASC LIMIT $2`, [String(days), limit])
    ]);
    const t = totals.rows[0] || { total: 0, zero: 0 };
    return { total: t.total, zero: t.zero, top: top.rows, noResults: noResults.rows };
  },

  // Conversion-Funnel (Sessions je Stufe). Kauf = Bestellungen im Zeitraum
  // (Bestellungen sind nicht an Sessions geknuepft -> Kaeufer = Bestellanzahl).
  getConversionFunnel: async (days = 30) => {
    const [stages, buyers] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT session_id)::int AS visitors,
                COUNT(DISTINCT session_id) FILTER (WHERE path LIKE '/produkte/%')::int AS product_viewers,
                COUNT(DISTINCT session_id) FILTER (WHERE path LIKE '%cart.html%')::int AS cart_reachers
         FROM page_views WHERE created_at > NOW() - ($1 || ' days')::interval`, [String(days)]),
      pool.query(
        `SELECT COUNT(*)::int AS buyers FROM orders
         WHERE created_at > NOW() - ($1 || ' days')::interval`, [String(days)])
    ]);
    const s = stages.rows[0] || { visitors: 0, product_viewers: 0, cart_reachers: 0 };
    return {
      visitors: s.visitors,
      productViewers: s.product_viewers,
      cartReachers: s.cart_reachers,
      buyers: (buyers.rows[0] || {}).buyers || 0
    };
  },

  // Referrer/Kanal-Auswertung: Host des Referrers (Protokoll/Pfad entfernt).
  getReferrers: async (days = 30, limit = 12) => {
    const r = await pool.query(
      `SELECT CASE
                WHEN referrer IS NULL OR referrer = '' THEN 'Direkt / kein Referrer'
                ELSE regexp_replace(regexp_replace(referrer, '^https?://', ''), '/.*$', '')
              END AS source,
              COUNT(*)::int AS views,
              COUNT(DISTINCT session_id)::int AS unique_views
       FROM page_views
       WHERE created_at > NOW() - ($1 || ' days')::interval
       GROUP BY 1 ORDER BY views DESC LIMIT $2`,
      [String(days), limit]
    );
    return r.rows;
  },

  // Zeitmuster: Aufrufe + Bestellungen je Stunde (0-23, Europe/Berlin).
  getHourlyPattern: async (days = 30) => {
    const r = await pool.query(
      `SELECT h AS hour,
              COALESCE(v.views,0)::int AS views,
              COALESCE(o.orders,0)::int AS orders
       FROM generate_series(0,23) AS h
       LEFT JOIN (
         SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS hour, COUNT(*) AS views
         FROM page_views WHERE created_at > NOW() - ($1 || ' days')::interval GROUP BY 1
       ) v ON v.hour = h
       LEFT JOIN (
         SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS hour, COUNT(*) AS orders
         FROM orders WHERE created_at > NOW() - ($1 || ' days')::interval GROUP BY 1
       ) o ON o.hour = h
       ORDER BY h`,
      [String(days)]
    );
    return r.rows;
  },

  // Tagesmuster: Aufrufe + Bestellungen je Wochentag (0=So..6=Sa, Europe/Berlin).
  getWeekdayPattern: async (days = 30) => {
    const r = await pool.query(
      `SELECT d AS dow,
              COALESCE(v.views,0)::int AS views,
              COALESCE(o.orders,0)::int AS orders
       FROM generate_series(0,6) AS d
       LEFT JOIN (
         SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS dow, COUNT(*) AS views
         FROM page_views WHERE created_at > NOW() - ($1 || ' days')::interval GROUP BY 1
       ) v ON v.dow = d
       LEFT JOIN (
         SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS dow, COUNT(*) AS orders
         FROM orders WHERE created_at > NOW() - ($1 || ' days')::interval GROUP BY 1
       ) o ON o.dow = d
       ORDER BY d`,
      [String(days)]
    );
    return r.rows;
  },

  // Ausstiegsseiten: letzte Seite je Session (wo Besucher abspringen).
  getExitPages: async (limit = 8, days = 30) => {
    const r = await pool.query(
      `SELECT path, COUNT(*)::int AS exits
       FROM (
         SELECT DISTINCT ON (session_id) session_id, path
         FROM page_views
         WHERE session_id IS NOT NULL
           AND created_at > NOW() - ($2 || ' days')::interval
         ORDER BY session_id, created_at DESC
       ) t
       GROUP BY path ORDER BY exits DESC LIMIT $1`,
      [limit, String(days)]
    );
    return r.rows;
  },

  // Geraete-Conversion: Besucher (Sessions je Geraet, nur Consent 'all') vs.
  // Kaeufer (Bestellungen je Geraet). Das Frontend bildet daraus den Anteils-Vergleich
  // (kauft z.B. Mobil unterdurchschnittlich?). Absolutwerte sind wegen Consent-Gate
  // nicht 1:1 vergleichbar -> Anteile sind die belastbare Aussage.
  getDeviceConversion: async (days = 30) => {
    const r = await pool.query(
      `SELECT d.device,
              COALESCE(v.visitors,0)::int AS visitors,
              COALESCE(b.buyers,0)::int AS buyers
       FROM (
         SELECT DISTINCT COALESCE(NULLIF(device,''),'Unbekannt') AS device FROM (
           SELECT device FROM orders
             WHERE device IS NOT NULL AND created_at > NOW() - ($1 || ' days')::interval
           UNION
           SELECT device FROM page_views
             WHERE device IS NOT NULL AND created_at > NOW() - ($1 || ' days')::interval
         ) u
       ) d
       LEFT JOIN (
         SELECT COALESCE(NULLIF(device,''),'Unbekannt') AS device, COUNT(DISTINCT session_id) AS visitors
         FROM page_views WHERE device IS NOT NULL AND created_at > NOW() - ($1 || ' days')::interval
         GROUP BY 1
       ) v ON v.device = d.device
       LEFT JOIN (
         SELECT COALESCE(NULLIF(device,''),'Unbekannt') AS device, COUNT(*) AS buyers
         FROM orders WHERE device IS NOT NULL AND created_at > NOW() - ($1 || ' days')::interval
         GROUP BY 1
       ) b ON b.device = d.device
       ORDER BY buyers DESC, visitors DESC`,
      [String(days)]
    );
    return r.rows;
  },

  // PLZ-Regionen der Kaeufer: aus den Bestelladressen (postal_code/zip), gruppiert
  // nach PLZ-Leitregion (erste 2 Ziffern) + Land. Regex statt JSON-Cast -> robust
  // gegen Alt-/Nicht-JSON-Adressen. Rein aggregiert, keine Einzeladresse.
  getPostalRegions: async (days = 30, limit = 15) => {
    const r = await pool.query(
      `SELECT country, region, COUNT(*)::int AS orders
       FROM (
         SELECT
           COALESCE(
             (regexp_match(billing_address, '"country"\\s*:\\s*"([^"]+)"'))[1],
             (regexp_match(shipping_address, '"country"\\s*:\\s*"([^"]+)"'))[1], '??'
           ) AS country,
           left(COALESCE(
             (regexp_match(billing_address, '"(?:postal_code|zip)"\\s*:\\s*"([^"]+)"'))[1],
             (regexp_match(shipping_address, '"(?:postal_code|zip)"\\s*:\\s*"([^"]+)"'))[1], ''
           ), 2) AS region
         FROM orders
         WHERE created_at > NOW() - ($1 || ' days')::interval
       ) t
       WHERE region <> ''
       GROUP BY country, region
       ORDER BY orders DESC LIMIT $2`,
      [String(days), limit]
    );
    return r.rows;
  },

  getViewStats: async () => {
    const q = (sql) => pool.query(sql).then(r => r.rows[0]);
    const [todayViews, uniqueToday, totalViews, liveNow] = await Promise.all([
      q(`SELECT COUNT(*)::int AS count FROM page_views WHERE created_at::date = CURRENT_DATE`),
      q(`SELECT COUNT(DISTINCT session_id)::int AS count FROM page_views WHERE created_at::date = CURRENT_DATE`),
      q(`SELECT COUNT(*)::int AS count FROM page_views`),
      q(`SELECT COUNT(DISTINCT session_id)::int AS count FROM page_views WHERE created_at > NOW() - INTERVAL '5 minutes'`)
    ]);
    return {
      todayViews: todayViews.count,
      uniqueToday: uniqueToday.count,
      totalViews: totalViews.count,
      liveNow: liveNow.count
    };
  },

  getTopPages: async (limit = 10, days = 30) => {
    const r = await pool.query(
      `SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT session_id)::int AS unique_views
       FROM page_views
       WHERE created_at > NOW() - ($2 || ' days')::interval
       GROUP BY path
       ORDER BY views DESC
       LIMIT $1`,
      [limit, String(days)]
    );
    return r.rows;
  },

  getTopCountries: async (limit = 10, days = 30) => {
    const r = await pool.query(
      `SELECT COALESCE(NULLIF(country, ''), 'Unbekannt') AS country,
              COUNT(*)::int AS views,
              COUNT(DISTINCT session_id)::int AS unique_views
       FROM page_views
       WHERE created_at > NOW() - ($2 || ' days')::interval
       GROUP BY COALESCE(NULLIF(country, ''), 'Unbekannt')
       ORDER BY views DESC
       LIMIT $1`,
      [limit, String(days)]
    );
    return r.rows;
  },

  getViewsTimeseries: async (range = '30d') => {
    const { gran, start, params } = await resolveSeries(range, 'page_views');
    const sql = buildSeriesSql(
      gran, start, 'page_views',
      'COUNT(*) AS views, COUNT(DISTINCT session_id) AS unique_views',
      'COALESCE(x.views,0)::int AS views, COALESCE(x.unique_views,0)::int AS unique_views'
    );
    const r = await pool.query(sql, params);
    return { granularity: gran, rows: r.rows };
  },

  // Zeitreihe fuer Bestellungen + Umsatz pro Tag (lueckenlos via generate_series).
  // orders = alle Bestellungen des Tages, revenue = Summe NUR bezahlter Bestellungen
  // (analog zu getStatistics: Gesamt-Bestellungen zaehlt alles, Umsatz nur 'paid').
  getOrdersTimeseries: async (range = '30d') => {
    const { gran, start, params } = await resolveSeries(range, 'orders');
    const sql = buildSeriesSql(
      gran, start, 'orders',
      "COUNT(*) AS orders, " +
        "COUNT(*) FILTER (WHERE order_status = 'processing') AS pending, " +
        "SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) AS revenue",
      'COALESCE(x.orders,0)::int AS orders, COALESCE(x.pending,0)::int AS pending, COALESCE(x.revenue,0)::float AS revenue'
    );
    const r = await pool.query(sql, params);
    return { granularity: gran, rows: r.rows };
  },

  // Produkt-Analyse: Verkaeufe je Produkt (aus order_items, nur bezahlte Bestellungen)
  // + Aufrufe der jeweiligen Produktseite (/produkte/produkt-<id>.html). Das Frontend
  // fuehrt beides mit products.json zusammen und bildet daraus die Bewertung.
  getProductAnalysis: async (range = '30d') => {
    const salesSql =
      `SELECT oi.product_id,
              SUM(oi.quantity)::int AS units,
              SUM(oi.total_price)::float AS revenue,
              COUNT(DISTINCT oi.order_id)::int AS orders
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE o.payment_status = 'paid' ${analysisRangeFilter(range, 'o.created_at')}
       GROUP BY oi.product_id`;
    // Aufrufe je Produktseite: Slug-URLs (/produkte/<slug>.html) UND alte
    // produkt-NN.html beruecksichtigen. Letzter Pfad-Teil = Slug bzw. produkt-NN.
    const viewsSql =
      `SELECT lower((regexp_match(path, '/produkte/([^/?#]+)\\.html'))[1]) AS slug,
              COUNT(*)::int AS views,
              COUNT(DISTINCT session_id)::int AS unique_views
       FROM page_views
       WHERE path ~ '/produkte/[^/?#]+\\.html' ${analysisRangeFilter(range, 'created_at')}
       GROUP BY 1`;
    const [sales, viewsRaw] = await Promise.all([pool.query(salesSql), pool.query(viewsSql)]);
    // Slug -> Produkt-ID aufloesen (alte produkt-NN.html direkt aus der Zahl).
    const slugToId = getSlugToIdMap();
    const byId = {};
    for (const row of viewsRaw.rows) {
      const slug = row.slug;
      if (!slug) continue;
      let id = slugToId[slug];
      if (id == null) { const m = slug.match(/^produkt-(\d+)$/); if (m) id = m[1]; }
      if (id == null) continue;
      const cur = byId[id] || { product_id: id, views: 0, unique_views: 0 };
      cur.views += row.views;
      cur.unique_views += row.unique_views;
      byId[id] = cur;
    }
    return { range, sales: sales.rows, views: Object.values(byId) };
  }
};

module.exports = { db: pool, dbOperations };
