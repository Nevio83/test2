const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Erstelle Datenbank-Ordner falls nicht vorhanden
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Initialisiere SQLite Datenbank
const db = new sqlite3.Database(path.join(dbDir, 'orders.db'));

// Erstelle Tabellen
db.serialize(() => {
  // Bestellungen Tabelle
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bestellpositionen Tabelle
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_sku TEXT,
      product_image TEXT,
      color TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )
  `);

  // Kassenbons Tabelle
  db.run(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      receipt_number TEXT NOT NULL,
      pdf_path TEXT,
      email_sent BOOLEAN DEFAULT 0,
      email_sent_at DATETIME,
      admin_notified BOOLEAN DEFAULT 0,
      admin_notified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )
  `);

  // Bestell-Tracking Tabelle
  db.run(`
    CREATE TABLE IF NOT EXISTS order_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT,
      tracking_number TEXT,
      carrier TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )
  `);

  // Indizes für bessere Performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON receipts(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON order_tracking(order_id)`);
});

// Hilfsfunktionen für Datenbank-Operationen
const dbOperations = {
  // Neue Bestellung erstellen
  createOrder: (orderData) => {
    return new Promise((resolve, reject) => {
      const {
        order_id, receipt_number, customer_email, customer_name, customer_phone,
        shipping_address, billing_address, payment_method, subtotal,
        shipping_cost, tax_amount, total_amount, currency, notes
      } = orderData;

      const sql = `
        INSERT INTO orders (
          order_id, receipt_number, customer_email, customer_name, customer_phone,
          shipping_address, billing_address, payment_method, subtotal,
          shipping_cost, tax_amount, total_amount, currency, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [
        order_id, receipt_number, customer_email, customer_name, customer_phone,
        shipping_address, billing_address, payment_method, subtotal,
        shipping_cost, tax_amount, total_amount, currency, notes
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, order_id });
      });
    });
  },

  // Bestellpositionen hinzufügen
  addOrderItems: (order_id, items) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_sku, product_image,
          color, quantity, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let insertedCount = 0;
      items.forEach(item => {
        stmt.run(
          order_id, item.product_id, item.product_name, item.product_sku,
          item.product_image, item.color, item.quantity, item.unit_price,
          item.total_price,
          (err) => {
            if (err) {
              stmt.finalize();
              reject(err);
            } else {
              insertedCount++;
              if (insertedCount === items.length) {
                stmt.finalize();
                resolve(insertedCount);
              }
            }
          }
        );
      });
    });
  },

  // Kassenbon speichern
  saveReceipt: (receiptData) => {
    return new Promise((resolve, reject) => {
      const { receipt_id, order_id, receipt_number, pdf_path } = receiptData;

      const sql = `
        INSERT INTO receipts (receipt_id, order_id, receipt_number, pdf_path)
        VALUES (?, ?, ?, ?)
      `;

      db.run(sql, [receipt_id, order_id, receipt_number, pdf_path], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, receipt_id });
      });
    });
  },

  // Bestellung abrufen
  getOrder: (order_id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM orders WHERE order_id = ?`,
        [order_id],
        (err, order) => {
          if (err) reject(err);
          else if (!order) resolve(null);
          else {
            db.all(
              `SELECT * FROM order_items WHERE order_id = ?`,
              [order_id],
              (err, items) => {
                if (err) reject(err);
                else resolve({ ...order, items });
              }
            );
          }
        }
      );
    });
  },

  // Alle Bestellungen abrufen (mit Pagination)
  getAllOrders: (limit = 50, offset = 0) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, orders) => {
          if (err) reject(err);
          else resolve(orders);
        }
      );
    });
  },

  // Bestellstatus aktualisieren
  updateOrderStatus: (order_id, status) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?`,
        [status, order_id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  },

  // E-Mail-Status aktualisieren
  updateEmailStatus: (receipt_id, type = 'customer') => {
    return new Promise((resolve, reject) => {
      const column = type === 'admin' ? 'admin_notified' : 'email_sent';
      const timeColumn = type === 'admin' ? 'admin_notified_at' : 'email_sent_at';
      
      db.run(
        `UPDATE receipts SET ${column} = 1, ${timeColumn} = CURRENT_TIMESTAMP WHERE receipt_id = ?`,
        [receipt_id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  },

  // Tracking hinzufügen
  addTracking: (trackingData) => {
    return new Promise((resolve, reject) => {
      const { order_id, status, description, tracking_number, carrier } = trackingData;
      
      db.run(
        `INSERT INTO order_tracking (order_id, status, description, tracking_number, carrier)
         VALUES (?, ?, ?, ?, ?)`,
        [order_id, status, description, tracking_number, carrier],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  },

  // Bestellungen nach E-Mail suchen
  getOrdersByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC`,
        [email],
        (err, orders) => {
          if (err) reject(err);
          else resolve(orders);
        }
      );
    });
  },

  // Statistiken abrufen
  getStatistics: () => {
    return new Promise((resolve, reject) => {
      const queries = {
        totalOrders: `SELECT COUNT(*) as count FROM orders`,
        totalRevenue: `SELECT SUM(total_amount) as total FROM orders WHERE payment_status = 'completed'`,
        todayOrders: `SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = DATE('now')`,
        todayRevenue: `SELECT SUM(total_amount) as total FROM orders WHERE DATE(created_at) = DATE('now') AND payment_status = 'completed'`,
        pendingOrders: `SELECT COUNT(*) as count FROM orders WHERE order_status = 'processing'`
      };

      const stats = {};
      let completed = 0;
      
      Object.entries(queries).forEach(([key, sql]) => {
        db.get(sql, (err, result) => {
          if (err) reject(err);
          else {
            stats[key] = result;
            completed++;
            if (completed === Object.keys(queries).length) {
              resolve(stats);
            }
          }
        });
      });
    });
  }
};

module.exports = { db, dbOperations };
