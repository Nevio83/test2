# Re-kodiere Produkt 27 von Latin1 zu UTF-8

$file = "c:\Users\nevio\Documents\vscode\GitHub\test2\produkte\produkt-27.html"

# Lese als Latin1/Windows-1252
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)

# Speichere als UTF-8 ohne BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Produkt 27 neu kodiert von Windows-1252 zu UTF-8" -ForegroundColor Green
