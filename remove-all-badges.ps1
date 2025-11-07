# Remove all badge lines from JavaScript in HTML files

$produkteFolder = "c:\Users\nevio\Documents\vscode\GitHub\test2\produkte"
$files = Get-ChildItem -Path $produkteFolder -Filter "produkt-*.html"

$changedCount = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # Entferne die drei Badge-Zeilen
    # Zeile 1: Am beliebtesten
    $content = $content -replace "\s*\$\{i===1 \? '<span class=`"bundle-badge popular`">Am beliebtesten</span>' : ''\}\s*\r?\n", ""
    
    # Zeile 2: Meiste Ersparnis
    $content = $content -replace "\s*\$\{i===2 \? '<span class=`"bundle-badge savings`">Meiste Ersparnis</span>' : ''\}\s*\r?\n", ""
    
    # Zeile 3: EXTRA % RABATT
    $content = $content -replace "\s*\$\{i>0 \? ``<span class=`"bundle-label`">EXTRA \$\{i===1\?'15':i===2\?'20':'0'\}% RABATT</span>`` : ''\}\s*\r?\n", ""
    
    # Save if changed
    if ($content -ne $originalContent) {
        Write-Host "Changing: $($file.Name)" -ForegroundColor Yellow
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
        $changedCount++
    }
}

Write-Host "`nTotal files changed: $changedCount" -ForegroundColor Green
