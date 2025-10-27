# Ersetze Marktplatz durch Maios in allen Produktseiten
$files = Get-ChildItem -Path "produkte" -Filter "produkt-*.html"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $content = $content -replace 'Marktplatz', 'Maios'
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Updated: $($file.Name)"
}

# Ersetze in Info-Seiten
$infoFiles = Get-ChildItem -Path "infos" -Filter "*.html"
foreach ($file in $infoFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $content = $content -replace 'Marktplatz', 'Maios'
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Updated: $($file.Name)"
}

Write-Host "Fertig! Alle Dateien wurden aktualisiert."
