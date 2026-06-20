# 🔄 Retouren-Automatisierung (SOP)

Konsolidierte Betriebsanleitung für Retouren/Rückerstattungen im Maios Shop.
Ersetzt die früheren Einzeldokumente `VOLLAUTOMATISCHE-RETOUREN.md` und
`VOLLAUTOMATISCH-FERTIG.md` (Letzteres betraf den Payment-Split → siehe
`CJ-AUTOMATISIERUNG.md`).

> **Aktueller Stand:** Auto-Genehmigung ist **standardmäßig AUS**. Retouren werden
> bewusst **manuell** geprüft. Die Automatik lässt sich per Umgebungsvariable
> `RETURNS_AUTO_APPROVE=true` aktivieren (Render-Dashboard).

---

## 1. Endpunkt & Ablauf

**Endpunkt:** `POST /api/return-request` (in `server.js`).
Kunde füllt das Formular auf `infos/retouren.html` aus → System validiert die Bestellung
gegen die DB → entscheidet manuell oder (falls aktiviert) automatisch.

```
Kunde beantragt Retoure (Bestellnummer, E-Mail, Grund)
    ↓
System validiert Bestellung (orders-Tabelle)
    ↓
┌─ RETURNS_AUTO_APPROVE=true  UND  Bestellung ≤ 14 Tage  UND  Grund in Auto-Liste?
│      JA  → automatisch genehmigen → Stripe-Refund → CJ-Retoure (API) → E-Mails
│      NEIN → manuelle Prüfung → E-Mail an Admin „⚠️ MANUELLE PRÜFUNG"
└─────────────────────────────────────────────────────────────────────────────
```

---

## 2. Auto-Approve-Regeln

Automatische Genehmigung **nur** wenn **alle** Bedingungen erfüllt sind:

1. `process.env.RETURNS_AUTO_APPROVE === 'true'` (Standard: nicht gesetzt = aus)
2. Bestellalter **≤ 14 Tage** (`created_at` der Bestellung)
3. Grund ist einer von:
   - `Produkt defekt`
   - `Falsche Ware erhalten`
   - `Beschädigt angekommen`

Alle anderen Fälle (älter als 14 Tage, anderer Grund, Flag aus) → **manuelle Prüfung**.

> Anpassbar in `server.js` (`autoApproveReasons`-Liste und die `if`-Bedingung im
> `/api/return-request`-Handler). Bestellalter-Grenze `orderAge <= 14` dort ändern.

---

## 3. Was bei Auto-Genehmigung automatisch passiert

| Schritt | Mechanismus |
|---|---|
| Genehmigung | Regelprüfung im Handler |
| Stripe-Refund | `stripe.refunds.create` (inkl. Rückabwicklung des CJ-Transfers) |
| CJ-Retoure | `cjAPI.createReturn(...)` via CJ-API |
| Kunden-Mail | Bestätigung „automatisch genehmigt" (Resend) |
| Admin-Mail | Info „✅ RETOURE AUTOMATISCH GENEHMIGT" (Resend) |

**Fallback:** Schlägt die CJ-API fehl, wird `autoApproved` auf manuell zurückgesetzt und
der Admin per E-Mail informiert, die CJ-Retoure manuell anzulegen.

---

## 4. Manuelle Prüfung (Standard)

1. Admin erhält E-Mail „⚠️ NEUE RETOURE-ANFRAGE – MANUELLE PRÜFUNG ERFORDERLICH".
2. Entscheidung treffen (genehmigen/ablehnen).
3. Bei Genehmigung: Refund im **Stripe-Dashboard** (`dashboard.stripe.com/refunds`).
4. Bei CJ-Ware: CJ-Retoure manuell anstoßen (siehe `CJ-AUTOMATISIERUNG.md`).
5. Kunden informieren.

---

## 5. Testen

```
1. Bestellung mit Test-Karte 4242 4242 4242 4242 aufgeben
2. infos/retouren.html öffnen
3. Bestellnummer (ORD-…) + Kunden-E-Mail eingeben
4. Grund wählen + absenden
```

- **Manuell (Standard):** Bestätigung „Wir prüfen", Admin-Mail, **kein** Auto-Refund.
- **Auto (Flag gesetzt, Grund passend, ≤14 Tage):** Sofort-Bestätigung,
  Stripe-Refund + CJ-Retoure, Admin-Mail „automatisch genehmigt".
  Konsole zeigt: `✅ Retoure wird automatisch genehmigt!` → `💳 Stripe Refund` → `📦 CJ-Retoure`.

---

## 6. Aktivieren / Deaktivieren

| Ziel | Aktion |
|---|---|
| Auto-Approve **an** | `RETURNS_AUTO_APPROVE=true` im Render-Dashboard setzen, Deploy |
| Auto-Approve **aus** (Standard) | Variable entfernen oder ≠ `true` |

> **Empfehlung:** Erst manuell betreiben, Retouren-Aufkommen beobachten, dann ggf.
> Automatik aktivieren und Gründe/Frist anpassen.

---

**Verwandt:** Payment-Split (Stripe → CJ Sub-Account) und CJ-Auto-Bestellung →
`CJ-AUTOMATISIERUNG.md`. Versandlogik → `VERSANDMETHODEN.md`.
