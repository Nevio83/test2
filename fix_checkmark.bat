@echo off
setlocal enabledelayedexpansion

set count=0

for %%f in (produkte\produkt-*.html) do (
    findstr /C:"bundle-card.selected::before" "%%f" >nul
    if !errorlevel! equ 0 (
        powershell -Command "(Get-Content '%%f' -Raw) -replace 'top: -10px !important;', 'top: -5px !important;' -replace 'right: -10px !important;', 'right: -5px !important;' | Set-Content '%%f' -NoNewline"
        echo Updated: %%f
        set /a count+=1
    )
)

echo.
echo Fertig! %count% Dateien aktualisiert.
