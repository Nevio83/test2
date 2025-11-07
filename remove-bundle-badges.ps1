# Remove bundle badges from all product HTML files

$produkteFolder = "c:\Users\nevio\Documents\vscode\GitHub\test2\produkte"
$files = Get-ChildItem -Path $produkteFolder -Filter "produkt-*.html"

$oldPattern = @"
        .bundle-badge \{
            display: inline-block;
            padding: 0\.3rem 0\.8rem;
            border-radius: 20px;
            font-size: 0\.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 2px 10px rgba\(0, 0, 0, 0\.2\);
        \}

        .bundle-badge\.popular \{
            background: linear-gradient\(135deg, #f093fb 0%, #f5576c 100%\);
            color: white;
        \}

        .bundle-badge\.savings \{
            background: linear-gradient\(135deg, #4facfe 0%, #00f2fe 100%\);
            color: white;
        \}
"@

$newPattern = @"
        .bundle-badge {
            display: none !important;
        }
"@

$changedCount = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    if ($content -match [regex]::Escape($oldPattern.Trim())) {
        Write-Host "Changing: $($file.Name)" -ForegroundColor Yellow
        $content = $content -replace [regex]::Escape($oldPattern.Trim()), $newPattern.Trim()
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
        $changedCount++
    }
}

Write-Host "`nTotal files changed: $changedCount" -ForegroundColor Green
