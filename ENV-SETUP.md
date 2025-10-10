# 🔧 Umgebungsvariablen Setup

## Schnellstart

1. **Kopieren Sie die Beispiel-Datei:**
   ```bash
   cp .env.example .env
   ```

2. **Füllen Sie die erforderlichen Werte aus** (siehe unten)

3. **Starten Sie den Server:**
   ```bash
   npm start
   ```

## 🔑 Erforderliche API-Schlüssel

### CJ Dropshipping (ERFORDERLICH)
- **Website:** https://www.cjdropshipping.com/
- **Registrierung:** Erstellen Sie ein Händlerkonto
- **API-Zugang:** Beantragen Sie API-Zugang im Dashboard
- **Benötigt:** `CJ_API_KEY`, `CJ_API_SECRET`, `CJ_ACCESS_TOKEN`

### Stripe (ERFORDERLICH für Zahlungen)
- **Website:** https://stripe.com/
- **Dashboard:** https://dashboard.stripe.com/
- **Test-Modus:** Verwenden Sie `pk_test_` und `sk_test_` Schlüssel für Entwicklung
- **Benötigt:** `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### SendGrid (ERFORDERLICH für E-Mails)
- **Website:** https://sendgrid.com/
- **Free Tier:** 100 E-Mails/Tag kostenlos
- **API-Schlüssel:** Settings → API Keys → Create API Key
- **Benötigt:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

## 🛠️ Optionale Services

### Google Analytics
```env
GA_TRACKING_ID=GA-XXXXXXXXX-X
```

### Facebook Pixel
```env
FB_PIXEL_ID=your_facebook_pixel_id
```

### Mailchimp Newsletter
```env
MAILCHIMP_API_KEY=your_api_key
MAILCHIMP_LIST_ID=your_list_id
```

## 🔐 Sicherheit

### Session Secret generieren:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### JWT Secret generieren:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Encryption Key generieren:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📦 Datenbank Setup

### MongoDB (Lokal)
```bash
# Installation (Windows)
# Laden Sie MongoDB von https://www.mongodb.com/try/download/community herunter

# Starten
mongod

# Verbindung testen
mongo
```

### MongoDB Atlas (Cloud)
1. Erstellen Sie ein kostenloses Konto bei https://www.mongodb.com/atlas
2. Erstellen Sie einen Cluster
3. Kopieren Sie die Verbindungs-URL
4. Setzen Sie `DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/dbname`

## 🚀 Deployment Variablen

### Produktion
```env
NODE_ENV=production
DEBUG=false
FORCE_HTTPS=true
CORS_ORIGIN=https://yourdomain.com
```

### Domain Konfiguration
```env
DOMAIN=yourdomain.com
SUBDOMAIN=shop
FULL_URL=https://shop.yourdomain.com
```

## 📝 Webhook URLs

Für Produktionsumgebung setzen Sie:
```env
WEBHOOK_ORDER_CREATED=https://yourdomain.com/webhooks/order-created
WEBHOOK_PAYMENT_SUCCESS=https://yourdomain.com/webhooks/payment-success
WEBHOOK_SHIPPING_UPDATE=https://yourdomain.com/webhooks/shipping-update
```

## ⚠️ Wichtige Hinweise

1. **Niemals .env in Git committen!** (bereits in .gitignore)
2. **Verwenden Sie starke, einzigartige Passwörter**
3. **Testen Sie alle API-Verbindungen vor dem Go-Live**
4. **Backup Ihrer Umgebungsvariablen erstellen**

## 🔍 Troubleshooting

### Server startet nicht
- Prüfen Sie `PORT` und `HOST` Einstellungen
- Stellen Sie sicher, dass der Port nicht bereits verwendet wird

### API-Fehler
- Überprüfen Sie API-Schlüssel und Secrets
- Prüfen Sie Netzwerkverbindung
- Schauen Sie in die Logs: `tail -f logs/app.log`

### Datenbank-Verbindung fehlgeschlagen
- Prüfen Sie `DATABASE_URL`
- Stellen Sie sicher, dass MongoDB läuft
- Überprüfen Sie Benutzername/Passwort

## 📞 Support

Bei Problemen:
1. Prüfen Sie die Logs
2. Überprüfen Sie alle Umgebungsvariablen
3. Testen Sie API-Verbindungen einzeln
4. Konsultieren Sie die Dokumentation der jeweiligen Services
