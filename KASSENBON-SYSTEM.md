# 📋 Kassenbon-System Dokumentation

## 🎯 Übersicht

Das Kassenbon-System ist eine vollständige Lösung für die Verwaltung von Bestellungen, Generierung von PDF-Kassenbons und automatischen E-Mail-Versand. Es integriert sich nahtlos in den bestehenden E-Commerce-Shop.

## ✅ Features

### Backend-Features
- ✅ **SQLite-Datenbank** für Bestellungen und Kassenbons
- ✅ **PDF-Generator** mit professionellem Layout
- ✅ **E-Mail-System** mit SendGrid/SMTP Fallback
- ✅ **REST API** für alle Operationen
- ✅ **Bestelltracking** mit Status-Updates
- ✅ **Statistiken** für Admin-Dashboard

### Frontend-Features
- ✅ **Automatische Kassenbon-Erstellung** beim Checkout
- ✅ **Admin-Dashboard** für Bestellverwaltung
- ✅ **Kunden-Tracking-Seite** für Bestellverfolgung
- ✅ **Download-Funktion** für PDF-Kassenbons
- ✅ **E-Mail-Benachrichtigungen** an Kunden und Admin

## 🚀 Installation

### 1. Pakete installieren
```bash
npm install
```

Die folgenden Pakete werden benötigt:
- `sqlite3` - Datenbank
- `pdfkit` - PDF-Generierung
- `uuid` - Eindeutige IDs
- `nodemailer` - E-Mail-Versand

### 2. Umgebungsvariablen konfigurieren

Bearbeite die `.env` Datei:

```env
# E-Mail Konfiguration
ADMIN_EMAIL=deine-email@gmail.com
FROM_EMAIL=noreply@deinshop.de
FROM_NAME=Dein Shop Name

# SMTP (für Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine-email@gmail.com
SMTP_PASSWORD=dein-app-passwort

# Oder SendGrid
SENDGRID_API_KEY=SG.xxxxx

# Website URL
SITE_URL=http://localhost:5000

# Firmeninformationen
COMPANY_NAME=Smart Home Shop
COMPANY_ADDRESS=Musterstraße 123
COMPANY_CITY=12345 Berlin
COMPANY_TAX_ID=DE123456789
```

### 3. Server starten
```bash
npm start
```

## 📁 Dateistruktur

```
test2/
├── database/
│   └── orders.db          # SQLite Datenbank (wird automatisch erstellt)
├── receipts/
│   └── receipt_*.pdf      # Generierte PDF-Kassenbons
├── admin/
│   ├── orders.html        # Admin-Dashboard
│   └── admin-orders.js    # Dashboard JavaScript
├── database.js            # Datenbank-Operationen
├── receipt-generator.js   # PDF-Generator
├── email-service.js       # E-Mail-Service
├── checkout-receipt.js    # Frontend-Integration
├── tracking.html          # Kunden-Tracking-Seite
└── server.js             # API-Endpunkte
```

## 🔌 API-Endpunkte

### Kassenbon erstellen
```javascript
POST /api/receipt/create
Body: {
  cart: [...],
  customer: {
    name: "Max Mustermann",
    email: "max@example.com",
    phone: "0123456789"
  },
  shipping: {
    cost: 0,
    address: {...}
  },
  payment: {
    method: "card",
    status: "pending"
  }
}
```

### Bestellung abrufen
```javascript
GET /api/receipt/order/:orderId
```

### Alle Bestellungen (Admin)
```javascript
GET /api/receipt/orders?limit=50&offset=0
```

### Status aktualisieren
```javascript
PUT /api/receipt/order/:orderId/status
Body: { status: "shipped" }
```

### Tracking hinzufügen
```javascript
POST /api/receipt/order/:orderId/tracking
Body: {
  trackingNumber: "123456",
  carrier: "DHL",
  status: "shipped"
}
```

### Statistiken
```javascript
GET /api/receipt/statistics
```

### Kassenbon erneut senden
```javascript
POST /api/receipt/resend/:orderId
Body: { email: "kunde@example.com" }
```

## 💻 Frontend-Integration

### 1. Checkout-Integration

Die Datei `checkout-receipt.js` wird automatisch in `cart.html` eingebunden:

```html
<script src="checkout-receipt.js"></script>
```

Bei jedem Checkout wird automatisch:
1. Ein Kassenbon generiert
2. In der Datenbank gespeichert
3. Per E-Mail versendet
4. Eine Erfolgsbestätigung angezeigt

### 2. Admin-Dashboard

Zugriff über: `/admin/orders.html`

Features:
- Übersicht aller Bestellungen
- Filterung nach Status
- Suche nach Bestellnummer/E-Mail
- Detailansicht jeder Bestellung
- Status-Updates
- Kassenbon erneut senden
- CSV-Export

### 3. Kunden-Tracking

Zugriff über: `/tracking.html?order=BESTELLNUMMER`

Kunden können:
- Bestellstatus verfolgen
- Kassenbon herunterladen
- Lieferfortschritt sehen
- Support kontaktieren

## 📧 E-Mail-Konfiguration

### Option 1: Gmail mit App-Passwort

1. Aktiviere 2-Faktor-Authentifizierung in Gmail
2. Erstelle App-Passwort: https://myaccount.google.com/apppasswords
3. Verwende dieses Passwort in `.env`:
```env
SMTP_USER=deine-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### Option 2: SendGrid

1. Registriere dich bei SendGrid
2. Erstelle API-Key
3. Füge in `.env` ein:
```env
SENDGRID_API_KEY=SG.xxxxx
```

## 🎨 Kassenbon-Anpassung

### Logo hinzufügen

In `receipt-generator.js`:
```javascript
this.companyInfo = {
  logo: 'path/to/logo.png',
  // ...
}
```

### Farben ändern

PDF-Farben in `receipt-generator.js` anpassen:
```javascript
doc.fillColor('#007bff'); // Deine Farbe
```

HTML-E-Mail in `generateHTMLReceipt()` anpassen.

## 🔍 Debugging

### Logs prüfen
```bash
# Server-Logs
npm start

# Datenbank prüfen
sqlite3 database/orders.db
.tables
SELECT * FROM orders;
```

### Test-E-Mail senden
```javascript
POST /api/receipt/test-email
Body: { email: "test@example.com" }
```

## 🚨 Wichtige Hinweise

1. **Datenbank-Backup**: Die SQLite-Datenbank sollte regelmäßig gesichert werden
2. **PDF-Speicher**: Alte PDFs sollten nach 30 Tagen gelöscht werden
3. **E-Mail-Limits**: SendGrid hat Limits im Free-Tier (100 E-Mails/Tag)
4. **DSGVO**: Kundendaten müssen DSGVO-konform behandelt werden

## 📊 Datenbank-Schema

### orders Tabelle
- `order_id` - Eindeutige Bestellnummer
- `receipt_number` - Kassenbon-Nummer
- `customer_email` - Kunden-E-Mail
- `customer_name` - Kundenname
- `total_amount` - Gesamtbetrag
- `order_status` - Status (pending, processing, shipped, completed)
- `created_at` - Erstellungsdatum

### order_items Tabelle
- `order_id` - Referenz zur Bestellung
- `product_id` - Produkt-ID
- `product_name` - Produktname
- `color` - Farbe (optional)
- `quantity` - Menge
- `unit_price` - Einzelpreis
- `total_price` - Gesamtpreis

### receipts Tabelle
- `receipt_id` - Eindeutige ID
- `order_id` - Referenz zur Bestellung
- `receipt_number` - Kassenbon-Nummer
- `pdf_path` - Pfad zur PDF-Datei
- `email_sent` - E-Mail gesendet (ja/nein)

## 🎯 Verwendung

### Für Kunden
1. Produkte in den Warenkorb legen
2. Zur Kasse gehen
3. Bestellformular ausfüllen
4. Bestellung abschicken
5. Kassenbon per E-Mail erhalten
6. Bestellung über Tracking-Link verfolgen

### Für Admins
1. Admin-Dashboard öffnen: `/admin/orders.html`
2. Bestellungen verwalten
3. Status aktualisieren
4. Kassenbons erneut senden
5. Statistiken einsehen

## 🆘 Fehlerbehebung

### E-Mails werden nicht gesendet
- Prüfe SMTP-Zugangsdaten in `.env`
- Stelle sicher, dass Port 587 nicht blockiert ist
- Verwende App-Passwort statt normales Passwort

### PDFs werden nicht generiert
- Prüfe ob `receipts/` Ordner existiert
- Stelle sicher, dass Schreibrechte vorhanden sind

### Datenbank-Fehler
- Lösche `database/orders.db` für Neustart
- Server neu starten

## 📝 Lizenz

Dieses Kassenbon-System ist Teil des E-Commerce-Projekts und unterliegt denselben Lizenzbedingungen.

## 🤝 Support

Bei Fragen oder Problemen:
- Öffne ein Issue auf GitHub
- Kontaktiere den Support
- Prüfe die Logs für Details

---

**Version:** 1.0.0  
**Letzte Aktualisierung:** Oktober 2024  
**Entwickelt für:** Smart Home Shop E-Commerce System
