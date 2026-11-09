# Free-claude einrichten (nur FreeLLMAPI, komplett gratis)

## 1. FreeLLMAPI installieren (einmalig, ca. 10 Min)
1. Windows-Installer (`.exe`) von https://github.com/tashfeenahmed/freellmapi/releases/latest laden und installieren. Kein Docker nötig.
2. Im Dashboard (http://localhost:3001) unter **Keys** diese Gratis-Keys eintragen. Die ersten fünf decken die Top-Plätze ab:
   Groq · Cerebras · Z.ai (Zhipu) · Mistral · OpenRouter · Google AI Studio · Cloudflare
3. Den **einheitlichen Key** (`freellmapi-…`) oben auf der Keys-Seite kopieren und in eine Datei **außerhalb des Repos** legen:
   `C:\Users\nevio\.free-claude-key` (nur der Key, eine Zeile). Das Repo `Nevio83/test2` ist öffentlich, dort darf kein Key liegen.

## 2. Testen (PowerShell, im Ordner `free-claude`)
```
node free-claude.mjs "Schreib 3 Hook-Ideen für einen Gemüseschneider, je max. 8 Wörter"
```
Die erste Zeile der Antwort zeigt, welches Modell über welchen Anbieter geantwortet hat. Optionen: `--code` (beste Modelle fürs Programmieren), `--smart` (klügstes zuerst), `--fast` (schnellstes zuerst), `--free` (größtes Gratis-Kontingent zuerst), `--n 4` (nur die ersten 4 Modelle probieren).

## 3. Trigger „Free-claude"

### a) Claude Code: in `C:\Users\nevio\.claude\CLAUDE.md` den alten OmniRoute-Abschnitt ersetzen durch:
```
## Free-claude (FreeLLMAPI)
- Schreibt Nevio „Free-claude" (irgendwo in der Nachricht), erledigt Claude alles Auslagerbare über FreeLLMAPI, auch Code:
  `node C:\Users\nevio\Documents\vscode\Maios\free-claude\free-claude.mjs "<Auftrag>"`
  (Optionen --code fürs Programmieren, --smart / --fast / --free). Claude prüft das Ergebnis, passt es an und liefert es fertig.
- Auch ohne das Stichwort gehen leichte Aufgaben (Hooks, Captions, Hashtags, Varianten, Titel, Entwürfe,
  Übersetzungen, kurze Auswertungen) automatisch dorthin, ohne Nachfrage.
- Code nur auslagern, wenn „Free-claude" dasteht (dann mit --code). Ohne Stichwort schreibt Claude Code selbst.
- Nie auslagern, auch nicht mit Stichwort: Checkout/Stripe/CJ-Logik, Sicherheit, Rechtliches, vertrauliche Daten (.env, Keys, Kundendaten).
- Ausgelagerten Code immer selbst prüfen (lesen, lint, tests), bevor er ins Repo kommt.
- Aufträge kurz halten (nur nötige Fakten, höchstens ca. 1.000 Zeichen), mehrere Aufgaben in einen Aufruf bündeln.
- Ergebnis ist Rohmaterial: gegen products.json und die Videoregeln prüfen, Unbelegtes streichen.
- Meldet das Skript FEHLER: einmal mit gekürztem Auftrag wiederholen, sonst selbst erledigen und in einem Satz sagen, was schiefging.
```

### b) Claude-Chat (Projekt „maiosshop"): im Abschnitt „Einfache Aufgaben an kostenlose Modelle auslagern" Schritt 2 und 3 ersetzen:
- Schritt 2: `preview_start` mit `url` `http://localhost:3001/v1/models` (eigener Tab, `tabId` merken).
- Schritt 3: `javascript_tool` mit diesem Code (AUFGABE ersetzen, DEIN-KEY durch den einheitlichen Key):
```
await (async () => {
  const fehler = [];
  for (const model of ['gpt-oss-120b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'glm-4.7-flash', 'auto']) {
    try {
      const r = await fetch('http://localhost:3001/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'content-type': 'application/json', authorization: 'Bearer DEIN-KEY' },
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: 'user', content: `AUFGABE` }] }) });
      const j = await r.json();
      const t = (j.choices?.[0]?.message?.content || '').trim();
      if (r.ok && t) return '[' + (r.headers.get('x-routed-via') || model) + ']\n' + t;
      fehler.push(model + ' HTTP ' + r.status);
    } catch (e) { fehler.push(model + ' ' + String(e).slice(0, 60)); }
  }
  return 'FEHLER: ' + fehler.join(' | ');
})()
```
Der Key steht dann in den Projektanweisungen. Das Gateway läuft nur lokal, trotzdem den Key nicht weitergeben.
Dazu den Satz „Nur wenn Nevio ‚Free-claude' schreibt, wird alles Auslagerbare ausgelagert; sonst nur leichte Aufgaben" ergänzen und alle OmniRoute-Verweise streichen.

## 4. Ranking aktualisieren
`ranking.json` ist ein Schnappschuss des Katalogs vom 09.11.2026. Ändern sich die Gratis-Limits, sag mir Bescheid, dann rechne ich es neu.
