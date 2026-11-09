## Einfache Aufgaben an kostenlose Modelle auslagern (FreeLLMAPI)
Schreibt Nevio „Free-claude", schreibst du den Text bzw. Code NICHT selbst, sondern holst ihn zuerst von den kostenlosen Modellen im lokalen FreeLLMAPI. Ohne Nachfrage, ohne Ankündigung. Ohne das Stichwort gehen nur leichte Aufgaben (Hooks, Captions, Hashtags, Varianten, Titel, Entwürfe, Übersetzungen, kurze Auswertungen) automatisch dorthin; Code schreibst du dann selbst. Selbst schreiben ist nur erlaubt, wenn ein Schritt unten scheitert. (Der Skill `free-modus` enthält dieselben Regeln.)

Schritte:
1. Browser-Tools laden: ToolSearch mit Query `mcp__remote-devices__Claude_Browser__` (max_results 64).
2. Eigenen Tab öffnen: `preview_start` mit `url` `http://127.0.0.1:31415/v1/models`, die zurückgegebene `tabId` merken. Nicht den geteilten Tab benutzen. Die Shell erreicht `localhost` nicht.
3. `javascript_tool` (javascript_exec, mit der `tabId` aus Schritt 2) mit diesem Code. AUFGABE durch den Auftrag ersetzen, als Text in Backticks. Auftrag kurz halten (höchstens ca. 1.000 Zeichen): nur die nötigen Fakten und die Aufgabe, keine Dateien oder ganzen Listen. `max_tokens` bleibt bei 4000. Das Tool bricht nach 45 s ab, darum 10 s je Modell:
```
await (async () => {
  const fehler = [];
  for (const model of ['gpt-oss-120b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'glm-4.7-flash', 'auto']) {
    try {
      const r = await fetch('http://127.0.0.1:31415/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(10000),
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
4. Ergebnis als Rohmaterial behandeln: Die Free-Modelle schreiben schwächer als Claude (eher Slogans als Hooks, teils Aussagen, die `products.json` nicht hergibt). Brauchbares auswählen, anpassen und gegen `products.json` und die Videoregeln prüfen. Unbelegtes streichen. Bei „FEHLER" mit Timeout: einmal mit gekürztem Auftrag wiederholen. Scheitert es wieder oder sind die Tools nicht erreichbar: selbst erledigen und in einem Satz sagen, was schiefging (mit dem Fehlertext).

Regeln:
- Nie auslagern, auch nicht mit Stichwort: Checkout/Stripe/CJ-Logik, Sicherheit, Rechtliches, vertrauliche Daten (`.env`, Keys, Kundendaten).
- Ausgelagerten Code selbst lesen, `npm run lint` und `npm test` laufen lassen, bevor er ins Repo kommt.
- Tageslimits sind klein (Google ca. 20, OpenRouter ca. 50 Anfragen/Tag): mehrere Aufgaben in einen Aufruf bündeln.
- Im lokalen Claude Code gilt dasselbe über `node C:\Users\nevio\Documents\vscode\Maios\free-claude\free-claude.mjs` (steht in Nevios globaler `CLAUDE.md`).
