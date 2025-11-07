# Remove bundle badges from all product HTML files - Version 2

$produkteFolder = "c:\Users\nevio\Documents\vscode\GitHub\test2\produkte"
$files = Get-ChildItem -Path $produkteFolder -Filter "produkt-*.html"

$changedCount = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # Pattern 1: Multi-line format (wie in produkt-27, 36, etc.)
    $pattern1 = '\.bundle-badge \{\s+display: inline-block;\s+padding: 0\.3rem 0\.8rem;\s+border-radius: 20px;\s+font-size: 0\.75rem;\s+font-weight: 700;\s+text-transform: uppercase;\s+letter-spacing: 1px;\s+box-shadow: 0 2px 10px rgba\(0, 0, 0, 0\.2\);\s+\}\s+\.bundle-badge\.popular \{\s+background: linear-gradient\(135deg, #f093fb 0%, #f5576c 100%\);\s+color: white;\s+\}\s+\.bundle-badge\.savings \{\s+background: linear-gradient\(135deg, #4facfe 0%, #00f2fe 100%\);\s+color: white;\s+\}'
    $replacement1 = '.bundle-badge { display: none !important; }'
    
    if ($content -match $pattern1) {
        Write-Host "Changing (format 1): $($file.Name)" -ForegroundColor Yellow
        $content = $content -replace $pattern1, $replacement1
    }
    
    # Pattern 2: Single-line format (wie in produkt-38, 47, 48, 49)
    $pattern2 = '\.bundle-badge \{ display: inline-block; padding: 0\.3rem 0\.8rem; border-radius: 20px; font-size: 0\.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 2px 10px rgba\(0, 0, 0, 0\.2\); \}\s+\.bundle-badge\.popular \{ background: linear-gradient\(135deg, #f093fb 0%, #f5576c 100%\); color: white; \}\s+\.bundle-badge\.savings \{ background: linear-gradient\(135deg, #4facfe 0%, #00f2fe 100%\); color: white; \}'
    
    if ($content -match $pattern2) {
        Write-Host "Changing (format 2): $($file.Name)" -ForegroundColor Cyan
        $content = $content -replace $pattern2, $replacement1
    }
    
    # Save if changed
    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
        $changedCount++
    }
}

Write-Host "`nTotal files changed: $changedCount" -ForegroundColor Green
Write-Host "Note: produkt-27.html and produkt-36.html were already changed manually" -ForegroundColor Gray
