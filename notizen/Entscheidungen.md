---
tags: [maios, entscheidungen]
---
# Entscheidungen

Neueste oben. Je Eintrag: Datum, was entschieden wurde, Link auf die Datei, in der es umgesetzt ist.
Wird von Claude nach jeder Sitzung mit einer Entscheidung ergänzt (siehe [[CLAUDE#10. Obsidian — Wissensablage (seit 16.11.2026, ersetzt Graphify)|CLAUDE §10]]).

## 2026-11-16
- **Skills aus TikTok-Sichtung eingebaut** (alle in `.claude/skills/`, Übersicht in [[SKILLS-MAIOS]]):
  `apple-design` (Grundlage für Bedienung/Bewegung, siehe [[CLAUDE-DESIGN]]), `swiftui-expert-skill`
  (nur Swift), `webapp-testing` (Shop durchklicken gegen localhost), `grossumbau` mit Superpowers
  (nur große Umbauten), `ponytail` (kleinste vollständige Code-Änderung), `marketing-psychology`
  (mit Maios-Filter), `last30days` (Trendrecherche ohne Schlüssel), Obsidian-Skills von kepano.
- **Nicht genommen:** Karpathy-Regeln, Addy Osmanis Agent Skills, Chief of Staff (doppelt zu
  Superpowers, viele Tokens), Anatomy, Teach, Chrome DevTools MCP, Obsidian-Copilot-Plugin.
- **Frei-Modus:** bei erreichtem Claude-Limit Claude Code über FreeLLMAPI starten
  (`free-claude/claude-free.cmd`, Anleitung `free-claude/ANLEITUNG.md`). Kein Abo in Drittanbieter-Gateways.
- **Neues Videoformat WW „Was wäre wenn …“** (Skill `maios-wasweare`): Frage → Szenario → Produkt als Auflösung, optional Serie Teil 1/2. Vorbild-Formel übernommen, nicht der 3D-Figuren-Look.
- **GSAP, Lenis, React Bits nicht in den Shop:** GSAP läuft schon in den Videos (HyperFrames). Lenis = Scroll-Übernahme (KI-Merkmal laut unslop), React Bits braucht React. Shop-Bewegung bleibt CSS nach `apple-design`.
- **awesome-design-md** als Ideen-Bibliothek eingebaut (Skill `design-ideen`, 84 Systeme in `.claude/design-ideen/`): nur Prinzipien, Marke bleibt Editorial Dark.
- **web-design-guidelines** (Vercel, MIT) eingebaut, Regeln lokal statt Abruf aus dem Netz. Nicht genommen: impeccable, taste-skill (doppelt zu unslop), Playwright-MCP (doppelt zu webapp-testing).
- **unslop-Audit** gemacht: Emoji-Icons auf bunten Kacheln (alle 51 Produktseiten), Lila-Glow in `styles.css`, pulsierender Punkt auf der Startseite. Umbau wartet auf Nevios Ok.
- **unslop** (heydamir, CC BY 4.0) für Design-Aufräumen eingebaut: Richtung „Editorial Dark“, erst Audit, dann umbauen ([[CLAUDE-DESIGN]]).
- **HyperFrames für TikTok-Videos** (heygen-com/hyperframes, Apache-2.0): neuer Skill `maios-hyperframes`,
  Format „HyperFrames-Spot“ in `maios-video`. Lokal, Telemetrie aus, kein HeyGen-Konto. Upstream-Skills
  gesperrt in `.claude/hyperframes/`. Probe-Spot Produkt 50 gerendert (11 s, −14,2 LUFS, 3,8 MB, Render 1:17 min auf dem Laptop). Technik läuft; erstes Layout zu klein/zu viel Leerfläche gegenüber dem Galerie-Video vom 14.11. Windows braucht `HYPERFRAMES_RENDER_DETACHED=1`. Quelle `Marketing/cgi/hyperframes/_quelle/50_krystall-ball/`, Start `probe.ps1`.
- **Weitere MCPs aus dem Video nicht genommen:** Perplexity, Firecrawl (kosten), Playwright-MCP, Chrome-MCP (doppelt).
- **Obsidian statt graphify:** graphify lief nie. Maios-Ordner ist jetzt der Vault, Einstieg [[Start]],
  Obsidian-CLI eingeschaltet und im PATH.
