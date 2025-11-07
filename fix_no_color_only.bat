@echo off
setlocal enabledelayedexpansion

set count=0

REM NUR Produkte OHNE Farbauswahl - verschiebe von 15px auf 10px
for %%f in (produkte\produkt-12.html produkte\produkt-13.html produkte\produkt-14.html produkte\produkt-15.html produkte\produkt-16.html produkte\produkt-18.html produkte\produkt-19.html produkte\produkt-20.html produkte\produkt-22.html produkte\produkt-23.html produkte\produkt-24.html produkte\produkt-25.html produkte\produkt-27.html produkte\produkt-28.html produkte\produkt-29.html produkte\produkt-31.html produkte\produkt-36.html produkte\produkt-37.html produkte\produkt-39.html produkte\produkt-41.html produkte\produkt-45.html) do (
    powershell -Command "(Get-Content '%%f' -Raw) -replace 'top: 15px !important;', 'top: 10px !important;' -replace 'right: 15px !important;', 'right: 10px !important;' | Set-Content '%%f' -NoNewline"
    echo Updated: %%f
    set /a count+=1
)

echo.
echo Fertig! %count% Dateien aktualisiert (nur ohne Farbauswahl).
