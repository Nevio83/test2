# 🚀 Maios Shop - Deployment Checkliste

## ✅ Bereits erledigt:

- ✅ Stripe Live-Keys konfiguriert
- ✅ Multi-Währung System implementiert
- ✅ Gutschein-System funktioniert
- ✅ Resend E-Mail Service integriert
- ✅ DNS-Einträge bei IONOS hinzugefügt (Pending)
- ✅ E-Mail Template mit Logo erstellt
- ✅ Rechnung-Generator implementiert
- ✅ Express Checkout (Google Pay, Apple Pay, PayPal, Klarna)
- ✅ Domain URLs auf maiosshop.com gesetzt

## 📋 Noch zu tun:

### 1. DNS-Verifizierung abwarten (1-24h)
- [ ] Prüfe Status in Resend Dashboard: https://dashboard.resend.com/domains
- [ ] Warte bis Status "Verified" ist
- [ ] Test-E-Mail senden nach Verifizierung

### 2. Website auf maiosshop.com deployen
- [ ] Hosting-Provider wählen (z.B. IONOS, Hetzner, DigitalOcean)
- [ ] Node.js auf Server installieren
- [ ] MongoDB installieren oder Cloud-Service nutzen (MongoDB Atlas)
- [ ] Alle Dateien hochladen
- [ ] `.env` Datei auf Server kopieren (NICHT in Git!)
- [ ] `npm install` auf Server ausführen
- [ ] SSL-Zertifikat aktivieren (Let's Encrypt)
- [ ] Server starten: `node server.js` oder mit PM2: `pm2 start server.js`

### 3. Stripe Webhook aktualisieren
- [ ] Gehe zu: https://dashboard.stripe.com/webhooks
- [ ] Klicke auf deinen Webhook
- [ ] Ändere URL auf: `https://maiosshop.com/stripe-webhook`
- [ ] Speichern

### 4. Produkte hinzufügen
- [ ] Bearbeite `products.json`
- [ ] Füge echte Produkte mit Bildern hinzu
- [ ] Preise und Beschreibungen aktualisieren

### 5. Rechtliche Seiten erstellen
- [ ] Impressum erstellen
- [ ] Datenschutzerklärung erstellen
- [ ] AGB erstellen
- [ ] Widerrufsbelehrung erstellen

### 6. Testing
- [ ] Test-Bestellung durchführen
- [ ] E-Mail-Empfang testen
- [ ] Rechnung-Download testen
- [ ] Gutschein-System testen
- [ ] Mobile Ansicht testen
- [ ] Verschiedene Zahlungsmethoden testen

### 7. Optional - Verbesserungen
- [ ] Google Analytics einrichten
- [ ] Facebook Pixel einrichten
- [ ] Newsletter-System (Mailchimp)
- [ ] Live-Chat Integration
- [ ] Tracking-System für Sendungen

## 🔑 Wichtige Zugangsdaten:

### Stripe
- Dashboard: https://dashboard.stripe.com
- Live-Keys sind in `.env` gespeichert

### Resend
- Dashboard: https://dashboard.resend.com
- API Key ist in `.env` gespeichert

### IONOS
- Login: https://www.ionos.de
- Domain: maiosshop.com

### MongoDB
- Lokal: mongodb://localhost:27017/ecommerce
- Für Live: MongoDB Atlas empfohlen

## 📞 Support & Dokumentation:

- Stripe Docs: https://stripe.com/docs
- Resend Docs: https://resend.com/docs
- Node.js Docs: https://nodejs.org/docs

## 🎉 Nach Go-Live:

1. Monitoring einrichten
2. Backup-System aktivieren
3. Performance überwachen
4. Kundenfeedback sammeln
5. Regelmäßige Updates durchführen

---

**Dein Shop ist technisch fertig! Viel Erfolg! 🚀**
