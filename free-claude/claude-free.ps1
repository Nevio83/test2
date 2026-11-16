# claude-free.ps1 - Claude Code auf die Gratis-Modelle von FreeLLMAPI umleiten.
# Nutzen, wenn "Nutzungslimit erreicht" kommt. Normales `claude` bleibt unverändert beim Abo.
#
# Start:  .\free-claude\claude-free.ps1            (oder claude-free.cmd)
#         .\free-claude\claude-free.ps1 -c          (letzte Sitzung fortsetzen, Argumente gehen an claude)
#
# Voraussetzung: FreeLLMAPI-Desktop-App läuft (Port 31415).
# Schlüssel: Variable FREELLMAPI_KEY oder Datei $HOME\.free-claude-key. Nie ins Repo schreiben.
# Die Umgebungsvariablen gelten nur für diesen Aufruf, danach wird alles zurückgesetzt.

$ErrorActionPreference = 'Stop'
$basis = if ($env:FREELLMAPI_ORIGIN) { $env:FREELLMAPI_ORIGIN.TrimEnd('/') } else { 'http://127.0.0.1:31415' }

$key = $env:FREELLMAPI_KEY
$keyDatei = Join-Path $HOME '.free-claude-key'
if (-not $key -and (Test-Path $keyDatei)) { $key = (Get-Content $keyDatei -Raw).Trim() }
if (-not $key) {
    Write-Host 'Kein Schlüssel: FREELLMAPI_KEY setzen oder Datei .free-claude-key im Benutzerordner anlegen.' -ForegroundColor Red
    exit 1
}

try {
    Invoke-WebRequest -Uri "$basis/v1/models" -Headers @{ Authorization = "Bearer $key" } -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {
    Write-Host "FreeLLMAPI antwortet nicht unter $basis. Desktop-App starten und nochmal versuchen." -ForegroundColor Red
    exit 1
}

$regeln = @'
FREI-MODUS: Diese Sitzung läuft NICHT auf Claude, sondern auf kostenlosen Modellen über FreeLLMAPI (schwächer, kleine Tageslimits).
Erlaubt: leichte Aufgaben - Texte, Captions, Hooks, Übersetzungen, kleine Doku-Änderungen, Dateien lesen und erklären, kleine Fixes außerhalb von Kasse und Sicherheit.
Verboten: Checkout/Stripe/CJ/Gutscheine/Preise, Sicherheit (static-guard, CSP, Admin-Login, Webhooks), Rechtliches, Datenbank-Schema, Maios-Videos (Nevio 11.11.: Videos nur mit Claude), git commit, .env lesen.
Bei verbotenen Aufgaben: nichts ändern, kurz sagen, dass das warten muss, bis das Claude-Limit zurück ist.
Vor jeder Code-Änderung npm run lint und npm test. Unsicher? Lieber nichts ändern und nachfragen.
'@

$alt = @{
    ANTHROPIC_BASE_URL           = $env:ANTHROPIC_BASE_URL
    ANTHROPIC_AUTH_TOKEN         = $env:ANTHROPIC_AUTH_TOKEN
    ANTHROPIC_API_KEY            = $env:ANTHROPIC_API_KEY
    CLAUDE_CODE_AUTO_MODE_SERVER = $env:CLAUDE_CODE_AUTO_MODE_SERVER
}
try {
    $env:ANTHROPIC_BASE_URL = $basis
    $env:ANTHROPIC_AUTH_TOKEN = $key
    Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue   # würde den Start blockieren
    $env:CLAUDE_CODE_AUTO_MODE_SERVER = '0'
    Write-Host "Frei-Modus: Claude Code läuft über FreeLLMAPI ($basis). Beenden mit /exit." -ForegroundColor Green
    & claude --append-system-prompt $regeln @args
} finally {
    foreach ($n in $alt.Keys) {
        if ($null -eq $alt[$n]) { Remove-Item "Env:$n" -ErrorAction SilentlyContinue }
        else { Set-Item "Env:$n" $alt[$n] }
    }
}
