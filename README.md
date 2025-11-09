# 🛍️ Maios Shop - E-Commerce Platform

Ein moderner E-Commerce Shop mit Stripe Integration, Multi-Währung Support und automatischem E-Mail-Versand.

## ✨ Features

### 💳 Zahlungen
- **Stripe Checkout** mit Live-Keys
- **Express Checkout**: Google Pay, Apple Pay, PayPal, Klarna, Samsung Pay
- **Multi-Währung**: Automatische Umrechnung basierend auf Land
- **Sichere Zahlungsabwicklung**

### 🎟️ Gutschein-System
- Prozentuale und feste Rabatte
- Automatische Anwendung im Checkout
- Gutschein wird nach Bestellung gelöscht
- Verwaltung über localStorage

### 📧 E-Mail System
- **Resend API** Integration
- Professionelle HTML-Templates mit Logo
- Bestellbestätigungen an Kunden
- Admin-Benachrichtigungen
- Automatischer Versand nach erfolgreicher Zahlung

### 🧾 Rechnung-System
- Automatische PDF-Generierung
- Kassenbon mit allen Details
- E-Mail-Versand als Anhang
- Speicherung in Datenbank

### 🌍 Multi-Währung
- EUR, USD, GBP Support
- Live-Wechselkurse via ExchangeRate-API
- Automatische Erkennung basierend auf Land
- Versandkosten in korrekter Währung

### 🛒 Warenkorb
- LocalStorage Persistenz
- Echtzeit-Updates
- Produktvarianten (Farben)
- Mengenauswahl

## 🚀 Installation

### Voraussetzungen
- Node.js (v14 oder höher)
- MongoDB
- npm oder yarn

### Setup

1. **Repository klonen**
```bash
git clone https://github.com/yourusername/maios-shop.git
cd maios-shop
```

2. **Dependencies installieren**
```bash
npm install
```

3. **Umgebungsvariablen konfigurieren**
```bash
cp .env.example .env
# Bearbeite .env mit deinen API Keys
```

4. **MongoDB starten**
```bash
# Windows
mongod

# Linux/Mac
sudo systemctl start mongodb
```

5. **Server starten**
```bash
node server.js
```

6. **Browser öffnen**
```
http://localhost:3000
```

## 🔑 Konfiguration

### Stripe
1. Gehe zu https://dashboard.stripe.com
2. Kopiere deine Live-Keys
3. Füge sie in `.env` ein:
```env
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Resend (E-Mail)
1. Registriere dich bei https://resend.com
2. Erstelle einen API Key
3. Füge ihn in `.env` ein:
```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@maiosshop.com
```

### Domain
1. DNS-Einträge bei deinem Provider hinzufügen
2. Warte auf Verifizierung (1-24h)
3. Aktualisiere `.env`:
```env
SITE_URL=https://maiosshop.com
```

## 📁 Projektstruktur

```
maios-shop/
├── server.js              # Express Server
├── database.js            # MongoDB Verbindung
├── resend-service.js      # E-Mail Service
├── receipt-generator.js   # PDF-Generator
├── gutschein-system.js    # Gutschein-Logik
├── cart.js               # Warenkorb-Logik
├── products.json         # Produktdaten
├── index.html            # Startseite
├── cart.html             # Warenkorb
├── success.html          # Erfolgsseite
├── images/               # Bilder & Logo
├── receipts/             # Generierte Rechnungen
└── .env                  # Umgebungsvariablen (NICHT in Git!)
```

## 🛠️ Technologie-Stack

- **Backend**: Node.js, Express
- **Datenbank**: MongoDB
- **Zahlungen**: Stripe
- **E-Mail**: Resend
- **PDF**: PDFKit
- **Frontend**: Vanilla JavaScript, Bootstrap 5
- **Icons**: Bootstrap Icons

## 📧 E-Mail Templates

Das E-Mail-Template befindet sich in `resend-service.js` und enthält:
- Maios Logo
- Bestelldetails
- Artikel-Liste
- Lieferadresse
- Gesamtbetrag
- Professionelles Design

## 🎨 Anpassungen

### Logo ändern
1. Ersetze `images/logo.jpg`
2. Lade es auf Imgur hoch
3. Aktualisiere URL in `resend-service.js`

### Produkte hinzufügen
Bearbeite `products.json`:
```json
{
  "id": "new-product",
  "name": "Neues Produkt",
  "price": 99.99,
  "image": "path/to/image.jpg",
  "description": "Beschreibung..."
}
```

### Farben anpassen
Bearbeite die CSS-Variablen in den HTML-Dateien.

## 🐛 Troubleshooting

### E-Mails landen im Spam
- Domain noch nicht verifiziert
- Warte auf DNS-Propagation (1-24h)
- Prüfe SPF/DKIM Einträge

### Stripe Webhook funktioniert nicht
- Prüfe Webhook-URL in Stripe Dashboard
- Stelle sicher, dass Server erreichbar ist
- Prüfe Webhook Secret in `.env`

### MongoDB Verbindung fehlgeschlagen
- Stelle sicher, dass MongoDB läuft
- Prüfe Connection String in `.env`
- Firewall-Einstellungen prüfen

## 📝 Lizenz

MIT License - siehe LICENSE Datei

## 👤 Autor

**Maios Corporation**
- E-Mail: maioscorporation@gmail.com
- Website: https://maiosshop.com

## 🙏 Danksagungen

- Stripe für die Zahlungs-API
- Resend für den E-Mail-Service
- Bootstrap für das UI-Framework

---

**Viel Erfolg mit deinem Shop! 🚀**
