# Hide bundle-label in all product HTML files

$produkteFolder = "c:\Users\nevio\Documents\vscode\GitHub\test2\produkte"
$files = Get-ChildItem -Path $produkteFolder -Filter "produkt-*.html"

$changedCount = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # Pattern 1: Multi-line format
    $pattern1 = '\.bundle-label \{\s+display: inline-block;\s+background: rgba\(255, 255, 255, 0\.25\);\s+color: #ffffff;\s+padding: 0\.4rem 1rem;\s+border-radius: 25px;\s+font-size: 0\.85rem;\s+font-weight: 700;\s+letter-spacing: 1\.5px;\s+border: 1px solid rgba\(255, 255, 255, 0\.3\);\s+backdrop-filter: blur\(10px\);\s+\}'
    $replacement = '.bundle-label { display: none !important; }'
    
    if ($content -match $pattern1) {
        Write-Host "Changing (multi-line): $($file.Name)" -ForegroundColor Yellow
        $content = $content -replace $pattern1, $replacement
    }
    
    # Pattern 2: Single-line format
    $pattern2 = '\.bundle-label \{ display: inline-block; background: rgba\(255, 255, 255, 0\.25\); color: #ffffff; padding: 0\.4rem 1rem; border-radius: 25px; font-size: 0\.85rem; font-weight: 700; letter-spacing: 1\.5px; border: 1px solid rgba\(255, 255, 255, 0\.3\); backdrop-filter: blur\(10px\); \}'
    
    if ($content -match $pattern2) {
        Write-Host "Changing (single-line): $($file.Name)" -ForegroundColor Cyan
        $content = $content -replace $pattern2, $replacement
    }
    
    # Save if changed
    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
        $changedCount++
    }
}

Write-Host "`nTotal files changed: $changedCount" -ForegroundColor Green
