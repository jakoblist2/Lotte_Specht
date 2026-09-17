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

## Kunden-Preview auf Cloudflare (GitHub-verbunden, inkl. Login-Bereich)

Der komplette Login-Bereich (Editor, Kalender, Spielplan-/Presse-Pflege) läuft jetzt auch online — als Cloudflare-Pages-Projekt mit **Functions** (JavaScript-Port von `server/cms.py`, im `functions/`-Ordner) und einer **D1**-Datenbank statt SQLite. Vorbild und Muster: das bestehende Setup von moviadesign.studio (`functions/_lib`, `functions/api/*.js`). Weiterhin ohne echtes Login (offener Modus wie lokal) — das kommt als separater Schritt, sobald alles final ist.

**Lokal testen, bevor irgendwas online geht** (Wrangler emuliert D1 und R2 lokal, keine Cloudflare-Ressourcen nötig):

```
npm install
npm run dev
```

Öffnet unter `http://localhost:8788` — Editor, Kalender, Spielplan, Presse-Material, alles inklusive.

**Workflow für laufende Änderungen:**

1. Inhalte lokal über den Login-Bereich bearbeiten (entweder `python3 server/cms.py` weiterhin für den reinen Redaktionsbetrieb, oder `npm run dev` gegen die Cloudflare-Variante).
2. Bei neuen Dateien direkt in `dist/assets/`: `python3 server/generate_media_manifest.py` neu laufen lassen (Cloudflare kann Ordner nicht live auflisten, deshalb ein Datei-Verzeichnis).
3. `git add -A && git commit -m "..." && git push` — Cloudflare Pages deployt automatisch bei jedem Push.

**Einmalig einzurichten (braucht deinen Cloudflare-Login):**

1. D1-Datenbank anlegen, z. B. `npx wrangler d1 create lotte-specht-db`
2. R2-Bucket anlegen: `npx wrangler r2 bucket create lotte-specht-uploads`
3. Im Cloudflare-Pages-Projekt (Settings → Functions): D1-Binding `DB` → die neue Datenbank; R2-Binding `UPLOADS` → den neuen Bucket
4. Build-Einstellungen auf Build-Verzeichnis `dist` umstellen (statt `site`)

**Ohne echte Bilder-Größenanpassung:** Anders als lokal (Pillow: verkleinert, komprimiert zu WebP) speichert der Cloudflare-Upload Bilder unverändert — es gibt kein Pillow-Äquivalent in Workers. Für die Preview unkritisch, für den Livegang ggf. nachrüsten.

**Alte, reine Static-Variante** (kein Login online, nur Anschauen): `python3 server/export_static.py` exportiert die acht öffentlichen Seiten ohne Server nach `site/` — falls das für einen bestimmten Zweck mal wieder gebraucht wird, Build-Verzeichnis in Cloudflare entsprechend auf `site` zurückstellen.

## Inhaltlicher Stand

Die historische Erzählung beginnt 1930 mit der Gründung des 1. DDFC. Originaldateien mit „1933“ im Dateinamen bleiben als Produktionsreferenzen erhalten, werden auf der Website aber historisch korrekt als 1930 eingeordnet.
