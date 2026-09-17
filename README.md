# Lotte Specht – Scrollfilm Website

Lokaler Arbeitsstand für die scrollgesteuerte Website „Vom Rand ins Spiel“.

## Einstieg

- `dist/index.html` – Scrollfilm und Startseite
- `dist/assets/film-sequence/` – 274 JPG-Frames für den Scrollfilm, scroll-gesteuert
- `dist/assets/intro-sequence/` – 122 JPG-Frames (24 fps, 50 % Qualität) für das Intro, ersetzt das frühere Video
- `dist/styleguide.html` – UX/UI-, Typografie-, Farb- und Motion-System
- `docs/Kling_First_Last_Frame_Prompts.md` – kompakte Produktionsübersicht

## Seiten

- Wer Lotte Specht war
- Wer wir sind
- Was wir tun
- EFC Lotte Specht
- Wo läuft's? (Spielplan Frauen-/Männer-Bundesliga und Public-Viewing-Karte)
- Presse (Pressemappe: Logos, Illustrationen, Bildmaterial zum Download, frei zugänglich)
- Mitmachen & Kontakt

## Login-Bereich

`server/cms.py` (Python 3, keine externen Abhängigkeiten außer Pillow) stellt Login, Entwürfe, Vorschau, Veröffentlichung, Versionshistorie sowie die Verwaltungsseiten Kalender, Spielplan und Presse-Material bereit. Starten mit `python3 server/cms.py`, dann `http://127.0.0.1:8766/login.html` öffnen.

„Presse-Material“ (`presse-material.html`, intern) pflegt die Inhalte der öffentlichen Seite „Presse“ (`presse.html`) — analog zu „Spielplan“ → „Wo läuft's?“. Start-Bestückung: die vier SVG-Illustrationen und zwei Logo-Dateien aus `dist/assets/presskit/` sowie drei bestehende Fotos als Platzhalter, bis echtes Bildmaterial vorliegt. Vorstand/Team-Profile sind als nächster Ausbauschritt vorgesehen, sobald die Inhalte feststehen.

Zum Entwickeln ohne Login: Server mit `LOTTE_CMS_OPEN=1 python3 server/cms.py` starten – jede Anfrage gilt dann automatisch als angemeldet. Vor dem Livegang die Variable weglassen, damit wieder das echte Login greift.

Im Editor selbst gibt es aufklappbare Kurzanleitungen („Neu hier? So funktioniert's.“ auf der Übersicht, „Wie funktioniert der Editor?“ in der Website-Bearbeitung). Selbst angelegte Seiten lassen sich über „Seite löschen“ im Editor wieder entfernen; die sechs Kernseiten sowie „Wo läuft's?“ sind davon ausgenommen.

## Weitergabe als ZIP (nur lokales Testen)

Für nicht-technische Team-Mitglieder liegen im Projektordner:

- `Server starten (Mac).command` / `Server starten (Windows).bat` – Doppelklick startet den Server automatisch im offenen Modus (`LOTTE_CMS_OPEN=1`, kein Login nötig) und öffnet den Browser direkt im Login-Bereich. Installiert bei Bedarf automatisch Pillow für den Bildupload nach.
- `LIES MICH ZUERST.txt` – kurze Anleitung für komplette Neulinge, inklusive Gatekeeper-/SmartScreen-Hinweis.

Zum Verpacken: den ganzen `scrollfilm-prototype`-Ordner zippen, dabei `.cms/` (lokale Datenbank) und `__pycache__/` ausschließen, damit jede Empfängerin mit einem sauberen Stand startet. Vor einem echten Livegang muss `LOTTE_CMS_OPEN` wieder entfernt und ein richtiges Login eingerichtet werden – die Start-Skripte sind ausdrücklich nur für die lokale Testphase gedacht.

## Lokale Vorschau

Den Ordner `dist` mit einem lokalen Webserver öffnen. Der aktuelle Arbeitsstand ist statisch und benötigt keinen Build-Schritt.

Die Startseite steuert den Scrollfilm als JPG-Sequenz über die Scrollposition, das Intro davor läuft als eigene, zeitbasierte JPG-Sequenz (keine Videodatei mehr – kein Autoplay-Risiko, kleinere Dateigröße). Die Navigation bleibt fixiert; Textkapitel werden passend zu den Filmszenen eingeblendet.

## Kunden-Preview (Cloudflare Pages via GitHub)

Cloudflare Pages hostet nur statische Dateien, keinen Python-Server. Der Login-Bereich (Editor, Kalender, Spielplan-/Presse-Pflege) läuft deshalb weiterhin nur lokal über `server/cms.py`. Für die Preview wird der aktuell veröffentlichte Stand der öffentlichen Seiten als reine Static-Site exportiert.

**Workflow:**

1. Inhalte wie gewohnt lokal über den Login-Bereich bearbeiten und veröffentlichen.
2. Export aktualisieren: `python3 server/export_static.py` — schreibt den aktuellen veröffentlichten Stand nach `site/` (git-versioniert, sicher jederzeit neu zu erzeugen).
3. `git add -A && git commit -m "Update" && git push` — Cloudflare Pages ist mit dem GitHub-Repo verbunden und deployt automatisch bei jedem Push. Build-Verzeichnis in Cloudflare: `site/`, kein Build-Command nötig (reines Static Hosting).

`site/` enthält nur die acht öffentlichen Seiten (kein Login, keine internen Verwaltungsseiten) plus statische Kopien von `/api/matches`, `/api/venues`, `/api/presskit`, damit „Wo läuft's?“ und „Presse“ auch ganz ohne Server funktionieren.

**Livegang später:** Sobald ein finaler Stand steht, in Cloudflare Pages eine eigene Domain auf dasselbe Projekt legen. Der Login-Bereich bräuchte dafür einen eigenen, dauerhaft laufenden Server (z. B. Fly.io/Render) plus ein echtes Login — das ist ein separater, späterer Schritt.

## Inhaltlicher Stand

Die historische Erzählung beginnt 1930 mit der Gründung des 1. DDFC. Originaldateien mit „1933“ im Dateinamen bleiben als Produktionsreferenzen erhalten, werden auf der Website aber historisch korrekt als 1930 eingeordnet.
