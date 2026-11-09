# Free-Ranking: FreeLLMAPI-Modelle

Stand 09.11.2026 · Quelle: Modell-Katalog aus dem Repo `tashfeenahmed/freellmapi` (97 aktive Modelle, 15 Anbieter, zusammengefasst zu 39 Modellen) · Gewichtung je 25 %.

| # | Modell | Gesamt | smart | speed | capable | free usage | Anbieter (gratis) |
|---|---|---|---|---|---|---|---|
| 1 | **gpt-oss-120b** | 72 | ███░░ | ████░ | ███░░ | ████░ | cloudflare, groq, openrouter |
| 2 | **llama-4-scout-17b-16e** | 71 | ██░░░ | ████░ | ████░ | ████░ | cloudflare, groq |
| 3 | **glm-4.6v-flash** | 71 | ███░░ | ████░ | ████░ | ███░░ | zhipu |
| 4 | **glm-4.7-flash** | 68 | ███░░ | ████░ | ███░░ | ████░ | cloudflare, zhipu |
| 5 | **gemini-3.5-flash** | 68 | █████ | ███░░ | █████ | █░░░░ | google |
| 6 | **gemini-3-flash** | 67 | █████ | ███░░ | █████ | █░░░░ | google |
| 7 | **glm-4.5-flash** | 65 | ███░░ | ████░ | ███░░ | ███░░ | zhipu |
| 8 | **llama-3.3-70b** | 65 | ██░░░ | ████░ | ███░░ | ████░ | cloudflare, groq, openrouter |
| 9 | **gemini-3.1-flash-lite** | 64 | ███░░ | ████░ | █████ | █░░░░ | google |
| 10 | **kimi-k2.6** | 61 | █████ | █░░░░ | ███░░ | ███░░ | cloudflare, openrouter |
| 11 | **qwen3-32b** | 60 | ██░░░ | ████░ | ███░░ | ███░░ | groq |
| 12 | **gpt-oss-20b** | 60 | ██░░░ | ████░ | ███░░ | ███░░ | groq, openrouter |
| 13 | **gemma-4-26b-a4b** | 59 | ███░░ | ████░ | █░░░░ | ████░ | cloudflare, google, openrouter |
| 14 | **llama-3.1-8b-instant** | 57 | ░░░░░ | ████░ | ███░░ | ████░ | groq |
| 15 | **gemma-4-31b** | 56 | ███░░ | ████░ | █░░░░ | ███░░ | google, openrouter |
| 16 | **gemini-2.5-flash-lite** | 56 | ██░░░ | ████░ | █████ | █░░░░ | google |
| 17 | **compound** | 54 | ███░░ | ████░ | █░░░░ | ██░░░ | groq |
| 18 | **gemini-2.5-flash** | 51 | ██░░░ | ███░░ | █████ | █░░░░ | google |
| 19 | **nemotron-3-super-120b-a12b** | 46 | ███░░ | █░░░░ | ████░ | █░░░░ | openrouter |
| 20 | **compound-mini** | 45 | ██░░░ | ████░ | █░░░░ | ██░░░ | groq |
| 21 | **owl-alpha** | 45 | █████ | █░░░░ | ██░░░ | █░░░░ | openrouter |
| 22 | **qwen3-next-80b-a3b** | 44 | ███░░ | █░░░░ | ███░░ | █░░░░ | openrouter |
| 23 | **nemotron-nano-12b-v2-vl** | 41 | ██░░░ | █░░░░ | ████░ | █░░░░ | openrouter |
| 24 | **qwen3-30b-a3b** | 40 | ██░░░ | ░░░░░ | ███░░ | ███░░ | cloudflare |
| 25 | **qwen3-coder** | 39 | ██░░░ | █░░░░ | ████░ | █░░░░ | openrouter |

## So wird gerechnet

- **smart** – Stufe (Frontier/Large/Medium/Small) plus Intelligenz-Rang, genau die Formel des Routers (`intelligenceComposite`), auf 0–1 normiert.
- **speed** – `speed_rank` aus dem Katalog (1 = schnellste Hardware wie Cerebras/Groq, 11 = langsam). Rang 9 ist bei vielen Anbietern nur der Standardwert, nicht gemessen. Sobald dein Router läuft, misst er die echte Geschwindigkeit selbst.
- **capable** – Tool-Aufrufe (40 %), Kontextlänge (35 %), Bildverständnis (25 %).
- **free usage** – je zur Hälfte Token-Budget pro Monat und Anfragen pro Tag, **über alle gratis Anbieter desselben Modells addiert** (gpt-oss-120b läuft gratis bei 3 Anbietern, deshalb Platz 1). Ohne Tageslimit im Katalog: Anfragen pro Minute × 480 (8 aktive Stunden), max. 5.000. OpenRouter konservativ mit 50/Tag.

## Code-Modus (`--code`)

Gewichtung: smart 40 %, capable 35 % (nur Modelle mit Tool-Unterstützung), free usage 15 %, speed 10 %.

| # | Modell | Code-Wert | Anbieter |
|---|---|---|---|
| 1 | **gemini-3.5-flash** | 83 | google |
| 2 | **gemini-3-flash** | 82 | google |
| 3 | **kimi-k2.6** | 74 | cloudflare, openrouter |
| 4 | **glm-4.6v-flash** | 72 | zhipu |
| 5 | **gemini-3.1-flash-lite** | 71 | google |
| 6 | **gpt-oss-120b** | 68 | cloudflare, groq, openrouter |
| 7 | **glm-4.7-flash** | 66 | cloudflare, zhipu |
| 8 | **llama-4-scout-17b-16e** | 64 | cloudflare, groq |
| 9 | **glm-4.5-flash** | 63 | zhipu |
| 10 | **nemotron-3-super-120b-a12b** | 58 | openrouter |

Ehrlich: Gratis-Modelle sind bei Code und Tool-Aufrufen deutlich schwächer als Claude, und der Router wechselt bei Limits mitten in der Sitzung das Modell. Für Maios-Code (Checkout, Stripe, CJ, Sicherheit) bleibt Claude zuständig.

## Gilt für diese Anbieter
- Groq, Z.ai, OpenRouter, Google, Cloudflare. Cerebras und Mistral sind raus (verlangen eine Zahlungsmethode). NVIDIA (Credits), OpenCode (Promo) und Cohere (nur nicht-kommerziell) sind bewusst nicht dabei.
- Das Ranking ist ein Schnappschuss des Repo-Katalogs vom 09.11.2026. Neue Modelle (z. B. Qwen 3.8 27B) fehlen, dein Router bewertet sie selbst.

## Hinweise
- Datenschutz: OpenRouter-Gratis darf Prompts mitlesen/loggen. Keine Kundendaten, Keys oder Rechtliches hinschicken.
- Gratis-Limits ändern sich ohne Vorwarnung. Die Zahlen sind eine Einstufung aus Katalogdaten, kein eigener Qualitätstest.
