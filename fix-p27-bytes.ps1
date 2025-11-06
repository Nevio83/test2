# Fixe Produkt 27 - Byte-Level Fix

$file = "c:\Users\nevio\Documents\vscode\GitHub\test2\produkte\produkt-27.html"

# Lese die Datei als Bytes
$bytes = [System.IO.File]::ReadAllBytes($file)

# Konvertiere zu String mit ISO-8859-1 (Latin1)
$content = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetString($bytes)

# Jetzt sollten die Zeichen lesbar sein und wir können sie ersetzen
$content = $content -replace 'fÃƒÂ¯Ã‚Â¿Ã‚Â½r', 'für'
$content = $content -replace 'AtmosphÃƒÂ¯Ã‚Â¿Ã‚Â½re', 'Atmosphäre'
$content = $content -replace 'KÃƒÂ¯Ã‚Â¿Ã‚Â½rperpflege', 'Körperpflege'
$content = $content -replace 'VerfÃƒÂ¯Ã‚Â¿Ã‚Â½gbarkeit', 'Verfügbarkeit'
$content = $content -replace 'RÃƒÂ¯Ã‚Â¿Ã‚Â½ckgaberecht', 'Rückgaberecht'
$content = $content -replace 'hinzufÃƒÂ¯Ã‚Â¿Ã‚Â½gen', 'hinzufügen'
$content = $content -replace 'WÃƒÂ¯Ã‚Â¿Ã‚Â½hle', 'Wähle'
$content = $content -replace 'ErhÃƒÂ¯Ã‚Â¿Ã‚Â½he', 'Erhöhe'
$content = $content -replace 'VerzÃƒÂ¯Ã‚Â¿Ã‚Â½gerung', 'Verzögerung'
$content = $content -replace 'ÃƒÂ¯Ã‚Â¿Ã‚Â½hnliche', 'Ähnliche'
$content = $content -replace 'kÃƒÂ¯Ã‚Â¿Ã‚Â½nnten', 'könnten'
$content = $content -replace 'FunktionalitÃƒÂ¯Ã‚Â¿Ã‚Â½t', 'Funktionalität'

# Speichere als UTF-8 ohne BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Produkt 27 Umlaute gefixt!" -ForegroundColor Green
