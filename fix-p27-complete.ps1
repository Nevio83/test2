# Fixe Produkt 27 komplett - Alle Umlaute

$file = "c:\Users\nevio\Documents\vscode\GitHub\test2\produkte\produkt-27.html"

# Lese die Datei
$content = Get-Content $file -Raw -Encoding UTF8

# Ersetze alle falschen Umlaute mit korrekten
$replacements = @{
    'fÃƒÂ¯Ã‚Â¿Ã‚Â½r' = 'für'
    'AtmosphÃƒÂ¯Ã‚Â¿Ã‚Â½re' = 'Atmosphäre'
    'ÃƒÂ¯Ã‚Â¿Ã‚Â½' = '€'
    'KÃƒÂ¯Ã‚Â¿Ã‚Â½rperpflege' = 'Körperpflege'
    'VerfÃƒÂ¯Ã‚Â¿Ã‚Â½gbarkeit' = 'Verfügbarkeit'
    'RÃƒÂ¯Ã‚Â¿Ã‚Â½ckgaberecht' = 'Rückgaberecht'
    'hinzufÃƒÂ¯Ã‚Â¿Ã‚Â½gen' = 'hinzufügen'
    'WÃƒÂ¯Ã‚Â¿Ã‚Â½hle' = 'Wähle'
    'ErhÃƒÂ¯Ã‚Â¿Ã‚Â½he' = 'Erhöhe'
    'VerzÃƒÂ¯Ã‚Â¿Ã‚Â½gerung' = 'Verzögerung'
    'ÃƒÂ¯Ã‚Â¿Ã‚Â½hnliche' = 'Ähnliche'
    'kÃƒÂ¯Ã‚Â¿Ã‚Â½nnten' = 'könnten'
    'FunktionalitÃƒÂ¯Ã‚Â¿Ã‚Â½t' = 'Funktionalität'
}

foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, $replacements[$key])
}

# Speichere als UTF-8 ohne BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Produkt 27 komplett gefixt!" -ForegroundColor Green
