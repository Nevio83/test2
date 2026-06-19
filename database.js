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
  `CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON receipts(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON order_tracking(order_id)`
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

// ── Operationen (gleiches Interface wie zuvor) ───────────────
const dbOperations = {
  createOrder: async (o) => {
    const sql = `INSERT INTO orders (
      order_id, receipt_number, customer_email, customer_name, customer_phone,
      shipping_address, billing_address, payment_method, subtotal,
      shipping_cost, tax_amount, total_amount, currency, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`;
    const r = await pool.query(sql, [
      o.order_id, o.receipt_number, o.customer_email, o.customer_name, o.customer_phone,
      o.shipping_address, o.billing_address, o.payment_method, o.subtotal,
      o.shipping_cost, o.tax_amount, o.total_amount, o.currency, o.notes
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
  }
};

module.exports = { db: pool, dbOperations };
