# Exchange Rate API Setup - Live Wechselkurse

## 🌍 Übersicht

Dein Shop unterstützt jetzt **automatische Live-Wechselkurse** für internationale Kunden!

- ✅ **40+ Währungen** unterstützt
- ✅ **Automatische Umrechnung** basierend auf Kundenland
- ✅ **1-Stunden Cache** für Performance
- ✅ **Fallback-System** wenn API nicht verfügbar
- ✅ **Kostenlos** bis 1,500 Anfragen/Monat

---

## 📝 Setup-Anleitung

### Schritt 1: API Key holen (KOSTENLOS)

1. Gehe zu: **https://www.exchangerate-api.com/**
2. Klicke auf **"Get Free Key"**
3. Registriere dich mit deiner E-Mail
4. Bestätige deine E-Mail
5. Kopiere deinen **API Key**

### Schritt 2: API Key in .env eintragen

Öffne deine `.env` Datei und füge ein:

```env
EXCHANGE_RATE_API_KEY=dein_api_key_hier
```

**Beispiel:**
```env
EXCHANGE_RATE_API_KEY=abc123def456ghi789jkl012
```

### Schritt 3: Server neu starten

```bash
npm start
```

oder

```bash
node server.js
```

---

## ✅ Testen

### 1. Wechselkurse abrufen

```bash
GET http://localhost:5000/api/exchange-rates
```

**Antwort:**
```json
{
  "success": true,
  "baseCurrency": "EUR",
  "rates": {
    "USD": 1.09,
    "GBP": 0.86,
    "JPY": 163.50,
    ...
  },
  "cache": {
    "valid": true,
    "age": 120,
    "remaining": 3480
  }
}
```

### 2. Preis konvertieren

```bash
POST http://localhost:5000/api/exchange-rates/convert
Content-Type: application/json

{
  "amount": 8.99,
  "from": "EUR",
  "to": "USD"
}
```

**Antwort:**
```json
{
  "success": true,
  "original": {
    "amount": 8.99,
    "currency": "EUR"
  },
  "converted": {
    "amount": 9.80,
    "currency": "USD",
    "formatted": "$9.80"
  }
}
```

### 3. Cache-Status prüfen

```bash
GET http://localhost:5000/api/exchange-rates/cache-status
```

### 4. Cache leeren (Admin)

```bash
POST http://localhost:5000/api/exchange-rates/clear-cache
```

---

## 🎯 Wie es funktioniert

### Automatische Währungsumrechnung beim Checkout

1. **Kunde wählt Lieferland** (z.B. USA)
2. **System ermittelt Währung** (USD)
3. **Live-Wechselkurs wird abgerufen** (1 EUR = 1.09 USD)
4. **Preise werden umgerechnet:**
   - Produkt: €8.99 → **$9.80**
   - Versand: €4.99 → **$5.44**
5. **Kunde zahlt in USD** via Stripe
6. **Du erhältst EUR** (Stripe rechnet zurück)

### Cache-System

- **Wechselkurse werden 1 Stunde gecacht**
- **Reduziert API-Anfragen** auf ~720/Monat (statt 43,200)
- **Bleibt unter Free Tier** (1,500/Monat)
- **Automatische Aktualisierung** nach Ablauf

### Fallback-System

Wenn API nicht verfügbar:
- ✅ **Verwendet gespeicherte Fallback-Kurse**
- ✅ **Shop funktioniert weiter**
- ✅ **Keine Fehler für Kunden**

---

## 💰 Unterstützte Währungen

### Europa
- **EUR** - Euro (19 Länder)
- **GBP** - Britisches Pfund
- **CHF** - Schweizer Franken
- **SEK** - Schwedische Krone
- **NOK** - Norwegische Krone
- **DKK** - Dänische Krone
- **PLN** - Polnischer Złoty
- **CZK** - Tschechische Krone
- **HUF** - Ungarischer Forint
- **RON** - Rumänischer Leu

### Amerika
- **USD** - US-Dollar
- **CAD** - Kanadischer Dollar
- **BRL** - Brasilianischer Real
- **MXN** - Mexikanischer Peso

### Asien
- **JPY** - Japanischer Yen
- **CNY** - Chinesischer Yuan
- **INR** - Indische Rupie
- **KRW** - Südkoreanischer Won

### Ozeanien
- **AUD** - Australischer Dollar
- **NZD** - Neuseeländischer Dollar

### Andere
- **TRY** - Türkische Lira
- **RUB** - Russischer Rubel

---

## 📊 API Limits

### Free Tier (Kostenlos)
- ✅ **1,500 Anfragen/Monat**
- ✅ **Alle Währungen**
- ✅ **Stündliche Updates**
- ✅ **Keine Kreditkarte nötig**

### Mit Cache-System
- **~720 Anfragen/Monat** (bei 24/7 Betrieb)
- **Bleibt unter Free Tier** ✅

### Upgrade (Optional)
- **Pro Plan:** 100,000 Anfragen/Monat - $9/Monat
- **Business Plan:** 1,000,000 Anfragen/Monat - $49/Monat

---

## 🔧 Erweiterte Konfiguration

### Cache-Dauer ändern

In `exchange-rate-service.js`:

```javascript
this.cache = {
  rates: null,
  timestamp: null,
  ttl: 7200000 // 2 Stunden statt 1 Stunde
};
```

### Fallback-Kurse aktualisieren

In `exchange-rate-service.js`:

```javascript
this.fallbackRates = {
  'EUR': 1.00,
  'USD': 1.09, // Aktualisiere hier
  'GBP': 0.86,
  ...
};
```

---

## 🐛 Troubleshooting

### "Using fallback exchange rates"

**Problem:** API Key nicht konfiguriert oder ungültig

**Lösung:**
1. Prüfe `.env` Datei
2. Stelle sicher, dass `EXCHANGE_RATE_API_KEY` gesetzt ist
3. Prüfe, dass der Key korrekt ist (keine Leerzeichen)
4. Server neu starten

### "API returned error"

**Problem:** API Limit erreicht oder API down

**Lösung:**
- System verwendet automatisch Fallback-Kurse
- Prüfe API Limit auf exchangerate-api.com
- Warte bis nächster Monat oder upgrade Plan

### Cache funktioniert nicht

**Problem:** Cache wird nicht gespeichert

**Lösung:**
```bash
POST http://localhost:5000/api/exchange-rates/clear-cache
```

Dann:
```bash
GET http://localhost:5000/api/exchange-rates
```

---

## 📈 Monitoring

### Logs prüfen

Server zeigt automatisch:
```
✅ Exchange Rate Service initialized
🌐 Fetching live exchange rates from API...
✅ Live exchange rates updated successfully
📅 Last updated: 01.11.2025, 15:30:00
🔄 Next update: 01.11.2025, 16:30:00
```

### Cache-Status überwachen

```bash
GET http://localhost:5000/api/exchange-rates/cache-status
```

---

## 💡 Best Practices

1. **Verwende Cache** - Spart API-Anfragen
2. **Aktualisiere Fallback-Kurse** - Monatlich
3. **Überwache API Limit** - Auf exchangerate-api.com
4. **Teste regelmäßig** - Vor wichtigen Sales
5. **Backup-Plan** - Fallback-Kurse aktuell halten

---

## 🎉 Fertig!

Dein Shop unterstützt jetzt **automatische Live-Wechselkurse**!

**Vorteile:**
- ✅ Kunden zahlen in ihrer Währung
- ✅ Dein Profit bleibt gleich in EUR
- ✅ Internationale Expansion möglich
- ✅ Professioneller Eindruck
- ✅ Höhere Conversion-Rate

**Support:**
- Exchange Rate API: https://www.exchangerate-api.com/docs
- Stripe Multi-Currency: https://stripe.com/docs/currencies
