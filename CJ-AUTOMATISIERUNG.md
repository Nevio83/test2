# CJ Dropshipping — automatische Bestellung

Stand: 23.09.2026. Code: `cj-bestellung.js` (Aufbau und Prüfung), Aufruf im Stripe-Webhook
in `server.js`, Prüfungen in `test/cj-bestellung.test.js`.

> Diese Datei beschrieb bis zum 23.09. einen **Plan** mit Beispielcode. Genau dieser
> Beispielcode war eingebaut und konnte nie funktionieren (SKU statt Varianten-Nummer,
> verschachtelte Adresse, Versand „aus Deutschland", Notbetrieb erfand Erfolge). Aufgefallen
> ist es bei der ersten echten Bestellung. Die Einzelheiten stehen im Kopf von
> `cj-bestellung.js` und in Commit `3cdd4c5`.

---

## Ablauf

```
Kunde zahlt (Stripe Checkout)
  → Webhook checkout.session.completed
  → Bestellung in Postgres, Beleg, Mails
  → cj-bestellung.bereiteVor()
       jede Position: SKU → Varianten-Nummer (vid) bei CJ nachschlagen
       Lieferadresse vollständig?  IOSS passt?  (sonst: Warnmail, KEINE Bestellung)
       günstigster Versandweg, den CJ für genau diese Varianten anbietet
       Kosten schätzen (CJ-Preis + Versand, in USD) und mit dem Wallet vergleichen
  → cj-bestellung.bestelle()  →  createOrderV2
       Bestellnummer MAIOS-<Stripe-Zahlung> — ein wiederholter Webhook bestellt nicht doppelt
```

**Lieber gar nicht bestellen als das Falsche.** Fehlt etwas, geht keine halbe Bestellung an CJ,
sondern eine Mail mit allem, was man zum Nachbestellen von Hand braucht.

---

## Bezahlung bei CJ

CJ wird **aus dem CJ-Wallet** bezahlt. **Stripe kann CJ nicht bezahlen** — es gibt keine
Verbindung zwischen beiden. Stripe zahlt nur auf das eigene Bankkonto aus; das Wallet wird
in CJ aufgeladen, per **PayPal, Payoneer, Überweisung** (ab 2.000 USD) oder Gutschein.

| Wallet | was der Automat tut | was du bekommst |
|---|---|---|
| deckt die Bestellung **mit 30 % Puffer** | bestellt **und lässt abbuchen** (payType 2), fragt danach bei CJ nach, ob wirklich bezahlt ist | nichts — oder „💰 CJ-Wallet fast leer", wenn danach weniger als `CJ_WALLET_WARNUNG` (Standard 30 USD) übrig ist |
| reicht nicht / unbekannt — **oder CJ hat trotz Auftrag nicht abgebucht** | bestellt, **bezahlt nicht** (payType 3) | „📦 CJ-Bestellung angelegt — bitte in CJ BEZAHLEN" |
| Bestellung scheitert | bestellt nicht | „⚠️ CJ-Bestellung fehlgeschlagen — BEZAHLT, bitte von Hand bestellen" mit Adresse und Positionen |

**Warum 30 % Puffer:** Bei CJs IOSS berechnet CJ die Einfuhrumsatzsteuer zusätzlich (Deutschland
19 %, EU bis 27 %). Die kennt der Automat vorab nicht. Ohne Puffer würde er bei knappem Wallet
eine Zahlung versuchen, die nicht gedeckt ist.

**Der Versandpreis ist `totalPostageFee`, nicht `logisticPrice`.** CJs Frachtabfrage liefert beide.
Bei der ersten echten Bestellung (23.09., Mond-Lampe) stand `logisticPrice` auf 7,72 $, berechnet
hat CJ 11,22 $ — genau `totalPostageFee`. Die ganze Bestellung kostete 13,26 $
(1,71 Ware + 11,22 Versand + 0,32 Steuer + 0,01 Gebühr).

**Warum nicht „erst anlegen, dann bezahlen"?** CJs separater Bezahlaufruf (`payBalanceV2`) verlangt
eine `shipmentOrderId`, die eine einzelne Bestellung nicht hat. Andere Shops, die es so gebaut haben,
hatten Bestellungen, die angelegt und nie bezahlt wurden. payType 2 bucht in einem Schritt ab.

**Früher gab es einen „Stripe-Split an CJ"** (`setup-stripe-cj-split.js`, `CJ_STRIPE_ACCOUNT_ID`).
Der legte ein verbundenes Konto im **eigenen** Stripe-Konto an — CJ hat kein Stripe-Konto, das
Geld wäre nie bei CJ angekommen. Am 23.09. entfernt. Im Stripe-Dashboard unter *Connect* liegen
davon noch zehn nie fertig eingerichtete Konten; sie tun nichts und können gelöscht werden.

---

## IOSS (Einfuhrumsatzsteuer)

Ware aus China an Privatkunden in der EU ist einfuhrumsatzsteuerpflichtig. CJ lehnt eine
Bestellung ohne Angabe ab („Please enter a IOSS number").

| `CJ_IOSS_TYPE` | Bedeutung |
|---|---|
| `3` (**Standard**) | **CJs IOSS** — CJ führt die Steuer ab und berechnet sie dir. Nur bis 150 € Warenwert. |
| `2` | **eigene IOSS-Nummer** in `CJ_IOSS_NUMBER` — beantragt beim BZSt („Mein BOP"), monatliche Meldung |
| `1` | kein IOSS — die **Kundin** zahlt Steuer und Gebühr an der Haustür |

**Über 150 € Warenwert bestellt der Automat nicht** — dort gilt IOSS nicht, das soll ein Mensch
entscheiden. Ein Tippfehler in `CJ_IOSS_TYPE` wird gemeldet, nicht geraten.

Alle drei Werte lassen sich im Render-Dashboard ändern, ohne neu auszurollen.

---

## Wenn eine Mail kommt

- **„bitte in CJ BEZAHLEN"** → CJ → *Orders* → Bestellung bezahlen. Oder das Wallet aufladen;
  dann laufen die nächsten von selbst.
- **„fehlgeschlagen — bitte von Hand bestellen"** → der Grund steht in der Mail. Häufig: Produkt bei
  CJ aus dem Sortiment (SKU nicht mehr zu finden), Adresse unvollständig, Warenwert über 150 €.
- **„CJ-Wallet fast leer"** → aufladen, bevor die nächste Bestellung kommt.

---

## Noch nicht automatisch

- **Sendungsnummer zurückholen.** Die CJ-Bestellnummer wird vermerkt, die Sendungsnummer von CJ
  (kommt erst nach dem Versand) noch nicht abgefragt.
- **Lieferbarkeit vor dem Kauf** prüft `cj-stock-sync.js` bereits; nimmt CJ ein Produkt aus dem
  Sortiment, scheitert die Bestellung mit Warnmail.
