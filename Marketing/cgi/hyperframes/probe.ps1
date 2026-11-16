# probe.ps1 - HyperFrames-Probe-Spot Produkt 50 (Krystall Ball) bauen und rendern.
# Start vom Repo-Stamm:  .\Marketing\cgi\hyperframes\probe.ps1
# Braucht Node >= 22 und ffmpeg. Telemetrie bleibt aus. Kein HeyGen-Konto.
param([switch]$NurRender)   # -NurRender: nur rendern, Pruefen und Standbilder ueberspringen
$ErrorActionPreference = 'Stop'
$repo   = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$cli    = Join-Path $repo '.claude\hyperframes\skills\hyperframes\scripts\plugin-cli.mjs'
$quelle = Join-Path $PSScriptRoot '_quelle\50_krystall-ball'
$proj   = Join-Path $PSScriptRoot '50_krystall-ball'
$out    = Join-Path $proj 'out'
$env:HYPERFRAMES_NO_TELEMETRY = '1'
$env:HYPERFRAMES_SKIP_SKILLS = '1'
$env:HYPERFRAMES_RENDER_DETACHED = '1'   # Windows: sonst bricht der Render ueber die Launcher-Prozesskette mit 'Canceled' ab

function HF { & node $cli @args; if ($LASTEXITCODE -ne 0) { throw "hyperframes $($args -join ' ') fehlgeschlagen ($LASTEXITCODE)" } }

Write-Host '1/6 Node und Telemetrie' -ForegroundColor Cyan
node --version
Push-Location $PSScriptRoot   # nicht im Repo-Stamm: sonst liest die CLI die Namen aus der .env
try {
    HF telemetry disable
    if (-not (Test-Path $proj)) {
        Write-Host '2/6 Projekt anlegen' -ForegroundColor Cyan
        HF init $proj --skip-skills --non-interactive --resolution portrait
    }
    Write-Host '3/6 Szenen und Bilder kopieren' -ForegroundColor Cyan
    Copy-Item "$quelle\index.html" $proj -Force
    New-Item -ItemType Directory -Force "$proj\compositions", "$proj\assets\fonts", $out | Out-Null
    Copy-Item "$quelle\compositions\*.html" "$proj\compositions" -Force
    $bilder = Join-Path $repo 'produkt bilder\Krystall Ball Nachtlampe bilder'
    @{ 'mond.jpg'='Krystall Ball Mond.jpg'; 'saturn.jpg'='Saturn.jpg'; 'segelboot.jpg'='Segelboot.jpg';
       'sternenhimmel.jpg'='Sternenhimmel.jpg'; 'schneemann.jpg'='Schneemann.jpg'; 'riesenrad.jpg'='Riesenrad.jpg';
       'wassermolch.jpg'='Wassermolch.jpg' }.GetEnumerator() | ForEach-Object {
        Copy-Item (Join-Path $bilder $_.Value) (Join-Path "$proj\assets" $_.Key) -Force }
    Copy-Item "$repo\schriften\manrope-latin.woff2", "$repo\schriften\marcellus-latin.woff2" "$proj\assets\fonts" -Force

    Push-Location $proj
    try {
        if (-not $NurRender) {
        Write-Host '4/6 Pruefen (lint, check)' -ForegroundColor Cyan
        HF lint
        HF check --json | Out-File "$out\check.json" -Encoding utf8
        Write-Host '5/6 Standbilder' -ForegroundColor Cyan
        HF snapshot --at '0,0.5,1.5,3,4.3,5.5,7,8.5,10.5'
        }
        Write-Host '6/6 Rendern (stumm)' -ForegroundColor Cyan
        HF render --quality delivery --output "$out\50_krystall-ball_hf_bild.mp4"
        if (-not (Test-Path "$out\50_krystall-ball_hf_bild.mp4")) { throw "Render ohne Datei beendet (abgebrochen?)" }
    } finally { Pop-Location }
} finally { Pop-Location }

Write-Host "Fertig: $out\50_krystall-ball_hf_bild.mp4 (Ton fehlt noch, kommt ueber spot_ton.py)" -ForegroundColor Green
Write-Host "Standbilder: $proj\.hyperframes\artifacts\snapshots\" -ForegroundColor Green
