# CJ Dropshipping Versandmethoden Konfiguration

## 📦 Automatische Versandmethoden-Auswahl

Das System wählt automatisch die optimale Versandmethode basierend auf dem Zielland aus.

## 🌍 Versandmethoden nach Region

### Europa (DE, AT, CH, FR, IT, ES, NL, BE, GB, PL, SE, DK, NO, FI)
**Methode:** `CJ Packet Registered`
- ✅ Mit Tracking-Nummer
- ⏱️ Lieferzeit: 7-13 Werktage
- 💰 Kostenlos für Kunden
- 📍 Versand aus: China Warehouse

### USA
**Methode:** `CJ Packet Ordinary`
- ⏱️ Lieferzeit: 10-20 Werktage
- 💰 Versandkosten: 4,99€
- 📍 Versand aus: China Warehouse

### Rest der Welt
**Methode:** `CJ Packet Ordinary`
- ⏱️ Lieferzeit: 10-20 Werktage
- 💰 Versandkosten: 4,99€
- 📍 Versand aus: China Warehouse

## 🔧 Verfügbare CJ Versandmethoden

### Standard Methoden:
1. **CJ Packet Ordinary** - Standard ohne Tracking
2. **CJ Packet Registered** - Standard mit Tracking
3. **CJ Packet Sensitive** - Für sensible Produkte (Elektronik, Kosmetik)

### Express Methoden (optional):
4. **DHL** - Express (3-5 Tage) - Höhere Kosten
5. **UPS** - Express (3-5 Tage) - Höhere Kosten
6. **FedEx** - Express (2-4 Tage) - Höhere Kosten

## ⚙️ Konfiguration in server.js

Die Versandmethode wird automatisch in `server.js` ausgewählt:

```javascript
function getShippingMethod(country) {
  const europeanCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'GB', 'PL', 'SE', 'DK', 'NO', 'FI'];
  
  if (europeanCountries.includes(country)) {
    return "CJ Packet Registered"; // Mit Tracking für Europa
  }
  
  if (country === 'US') {
    return "CJ Packet Ordinary"; // Standard für USA
  }
  
  return "CJ Packet Ordinary"; // Standard weltweit
}
```

## 📊 Versandkosten-Übersicht

| Region | Versandkosten | Lieferzeit | Tracking |
|--------|---------------|------------|----------|
| Europa | Kostenlos | 7-13 Tage | ✅ Ja |
| USA | 4,99€ | 10-20 Tage | ❌ Nein |
| Weltweit | 4,99€ | 10-20 Tage | ❌ Nein |

## 🚀 Warehouse-Auswahl

**Standard:** China Warehouse (`fromCountryCode: "CN"`)
- ✅ Günstigere Preise
- ✅ Größere Produktauswahl
- ✅ Schnellere Verfügbarkeit

**Alternative:** USA/EU Warehouse (optional)
- Schnellere Lieferung innerhalb der Region
- Höhere Produktpreise
- Begrenzte Produktauswahl

## 📝 Bestellprozess

1. **Kunde bestellt** → System erfasst Lieferadresse
2. **Automatische Auswahl** → Versandmethode basierend auf Land
3. **CJ API Call** → Bestellung mit `logisticName` und `fromCountryCode`
4. **Tracking** → Bei "Registered" Methoden automatisch verfügbar

## 🔍 Debugging

Bestellungen zeigen die gewählte Versandmethode im Server-Log:
```
📦 Bestellung erstellt mit Versandmethode: CJ Packet Registered nach DE
```

## 📞 Support

Bei Fragen zur Versandmethoden-Konfiguration:
- CJ Dropshipping Support: https://cjdropshipping.com/support
- API Dokumentation: https://cjdropshipping.com/my.html#/apikey
