@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Ersetze Marktplatz durch Maios in allen Produktseiten...

for %%f in (produkte\produkt-*.html) do (
    powershell -Command "(Get-Content '%%f' -Raw -Encoding UTF8) -replace 'Marktplatz', 'Maios' | Set-Content '%%f' -Encoding UTF8 -NoNewline"
    echo Updated: %%f
)

echo.
echo Fertig! Alle Produktseiten wurden aktualisiert.
pause
