@echo off
cd /d "%~dp0"
set PORT=8766

echo Lotte Specht e.V. - lokale Vorschau wird gestartet ...
echo.

where python >nul 2>nul
if errorlevel 1 (
  where python3 >nul 2>nul
  if errorlevel 1 (
    echo Python wurde auf diesem Computer nicht gefunden.
    echo Bitte einmalig von https://www.python.org/downloads/ installieren
    echo ^(dabei den Haken bei "Add python.exe to PATH" setzen^) und diese Datei danach noch einmal starten.
    echo.
    pause
    exit /b 1
  )
  set PY=python3
) else (
  set PY=python
)

%PY% -c "import PIL" >nul 2>nul
if errorlevel 1 (
  echo Richte Bild-Upload ein ^(einmalig, kann etwas dauern^) ...
  %PY% -m pip install --quiet --user Pillow >nul 2>nul
)

curl -s -o nul -m 1 http://127.0.0.1:%PORT%/api/session >nul 2>nul
if errorlevel 1 (
  echo Starte Server ...
  set LOTTE_CMS_OPEN=1
  start "Lotte Specht Server" cmd /k "%PY% server\cms.py --port %PORT%"
  timeout /t 3 /nobreak >nul
) else (
  echo Der Server laeuft bereits.
)

echo Oeffne den Login-Bereich im Browser ...
start http://127.0.0.1:%PORT%/studio.html

echo.
echo Fertig! Ihr seid direkt drin, ohne Passwort - das ist nur die lokale Testversion.
echo Zum Beenden: das schwarze Server-Fenster einfach schliessen.
echo.
pause
