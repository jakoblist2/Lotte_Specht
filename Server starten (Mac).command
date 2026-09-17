#!/bin/bash
cd "$(dirname "$0")"
PORT=8766
URL="http://127.0.0.1:$PORT/studio.html"

echo "Lotte Specht e.V. — lokale Vorschau wird gestartet …"
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 wurde auf diesem Computer nicht gefunden."
  echo "Bitte einmalig von https://www.python.org/downloads/ installieren"
  echo "und diese Datei danach noch einmal starten."
  echo ""
  read -n 1 -s -r -p "Taste drücken zum Schließen …"
  exit 1
fi

if ! python3 -c "import PIL" >/dev/null 2>&1; then
  echo "Richte Bild-Upload ein (einmalig, kann etwas dauern) …"
  python3 -m pip install --quiet --user Pillow >/dev/null 2>&1
  if ! python3 -c "import PIL" >/dev/null 2>&1; then
    echo "Hinweis: Bild-Upload konnte nicht automatisch eingerichtet werden."
    echo "Die Website funktioniert trotzdem — nur neue Bilder hochladen geht dann noch nicht."
  fi
fi

SERVER_PID=""
if curl -s -o /dev/null -m 1 "http://127.0.0.1:$PORT/api/session"; then
  echo "Der Server läuft bereits."
else
  echo "Starte Server …"
  LOTTE_CMS_OPEN=1 python3 server/cms.py --port "$PORT" &
  SERVER_PID=$!
  UP=0
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.5
    if curl -s -o /dev/null -m 1 "http://127.0.0.1:$PORT/api/session"; then UP=1; break; fi
  done
  if [ "$UP" != "1" ]; then
    echo ""
    echo "Der Server konnte nicht gestartet werden (vielleicht läuft schon etwas auf Port $PORT?)."
    read -n 1 -s -r -p "Taste drücken zum Schließen …"
    exit 1
  fi
fi

echo "Öffne den Login-Bereich im Browser …"
open "$URL"

echo ""
echo "Fertig! Ihr seid direkt drin, ohne Passwort — das ist nur die lokale Testversion."
echo "Zum Beenden: dieses Fenster einfach schließen."

if [ -n "$SERVER_PID" ]; then
  wait "$SERVER_PID" 2>/dev/null
else
  echo "(Der Server lief schon vorher — schließt stattdessen jenes Fenster, um ihn zu beenden.)"
  sleep 3
fi
