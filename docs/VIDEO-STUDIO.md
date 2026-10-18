# Video-Studio

Das Video-Studio ist im angemeldeten Dashboard und als Formularvorschau unter `/demo?view=video-studio` erreichbar. Die Demo erzeugt keine vermeintlich fertigen Videos. Echte Aufträge verwenden die vorhandene Workspace-Identität, PostgreSQL und die geschützte Mediathek.

## Ablauf und Funktionsumfang

1. Thema (3–1000 Zeichen), optional eigenen Sprechertext (maximal 4000 Zeichen), Sprache Deutsch/Englisch, Stimme, Format und Zieldauer auswählen.
2. Persönlichen OpenAI-Key eingeben und der befristeten verschlüsselten Verarbeitung zustimmen. OpenAI berechnet Skript, Sprachausgabe und gegebenenfalls Transkription auf diesem Konto.
3. Die API speichert einen mandantengebundenen Auftrag; der separate Worker generiert Skript/Suchbegriffe, synthetische Stimme, Pexels-Clips und auf Wunsch Wortzeitstempel/Untertitel.
4. FFmpeg erstellt MP4 mit H.264/AAC in 1080×1920, 1920×1080 oder 1080×1080. Die Zieldauer 30/60/90 Sekunden steuert das Skript; vollständige Sprachausgabe bleibt erhalten, maximal 180 Sekunden. Eigene zu lange Texte werden abgelehnt, nicht stumm abgeschnitten.
5. Das Video landet transaktional in der Mediathek. Vorschau, MP4-Download mit Byte-Ranges, SRT-Datei und Pexels-Quellen bleiben auch bei späteren Veröffentlichungsfehlern verfügbar.
6. Das getrennte Veröffentlichungsformular kann auf Instagram, TikTok und YouTube posten. Dafür sind jeweils verbundene Konten, passende Rechte, explizite Angaben und eine bewusste Bestätigung erforderlich. Siehe [Publishing](PUBLISHING.md).

Die Implementierung übernimmt den untersuchten Ablauf aus MoneyPrinterTurbo. Der aktuelle Umfang enthält keine Musikbibliothek, keinen gesamten upstream Provider-Katalog und kein automatisches Crossposting ohne Vorschau. Es wurden keine fremden Musikdateien oder upstream Medien kopiert. Quellen und Lizenzhinweis stehen in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Infrastruktur

Die Next.js-App kann weiter auf Vercel laufen. Rendering benötigt zusätzlich einen dauerhaft laufenden Node-24-Worker mit FFmpeg und DejaVu-Schrift; Publishing benötigt einen zweiten Node-Worker. Bei Vercel ist außerdem der separate Mediendienst erforderlich: MP4-Dateien überschreiten das Antwortlimit der Web-Funktionen. Alle Dienste verbinden sich mit derselben PostgreSQL-Datenbank wie die App. FFmpeg-Jobs laufen nicht in Vercel-Request-Funktionen.

Für Docker Compose zuerst `.env.docker` aus dem Beispiel anlegen und Secrets unabhängig erzeugen. Setzen:

```dotenv
VIDEO_GENERATION_ENABLED=true
PEXELS_API_KEY=<Pexels-API-Key>
WORKSPACE_DATA_ENCRYPTION_KEY=<unabhängiger-32-Byte-Base64-Key>
PUBLISHING_ENABLED=true
SOCIAL_TOKEN_ENCRYPTION_KEY=<unabhängiger-32-Byte-Base64-Key>
PUBLISHING_MEDIA_SECRET=<unabhängiges-zufälliges-Secret-mindestens-32-Zeichen>
APP_URL=https://deine-domain.example
MEDIA_DELIVERY_URL=https://media.deine-domain.example
```

App und Worker müssen jeweils dieselben zu ihrem Zweck gehörenden Keys verwenden. Video-Worker erhält keinen dauerhaften Betreiber-OpenAI-Key, Publishing-Worker erhält keinen Nutzer-OpenAI-Key. `PEXELS_API_KEY` gehört nur in den Video-Worker. OAuth-App-Variablen stehen in [PUBLISHING.md](PUBLISHING.md).

```bash
docker compose --env-file .env.docker --profile video --profile publishing --profile media up -d --build
```

Migrationen laufen vor den Diensten. Bestehende Migrationen bleiben unverändert; `002_video_jobs.sql` und `003_video_publications.sql` erweitern das Schema. Worker laufen als unprivilegierte Benutzer mit schreibgeschütztem Dateisystem und begrenztem Arbeitsspeicher/CPU/temporärem Speicher. Video benötigt etwa 2 GiB RAM und 1,5 GiB temporären Platz pro Worker. Bei Vercel externe Dienste mit privater oder TLS-gesicherter Datenbankverbindung betreiben; Ports der Worker nicht öffentlich freigeben.

Der Mediendienst hört lokal auf Port 3001 (`MEDIA_PORT`). Einen HTTPS-Reverse-Proxy auf diesen Port richten und dessen öffentliche Origin als `MEDIA_DELIVERY_URL` in App und Publishing-Worker eintragen. `PUBLISHING_MEDIA_SECRET` muss in App, Publishing-Worker und Mediendienst übereinstimmen. Querystrings dieser Medienrouten nicht protokollieren. Der Webserver prüft den Workspace-Zugang und leitet zum Mediendienst weiter; dieser streamt in 256-KiB-Blöcken und unterstützt Seeking/HEAD. Private Vorschau-/Download-URLs gelten fünf Minuten, Instagram-URLs höchstens eine Stunde und nur für den verknüpften laufenden Auftrag. Ein bereits ausgegebener privater Link bleibt bis zum Ablauf gültig. Bei vollständigem Self-Hosting ist die direkte Next.js-Auslieferung ohne `MEDIA_DELIVERY_URL` weiterhin möglich; auf Vercel wird ohne Mediendienst kein neuer Videoauftrag angenommen.

Alternativ lokal: `npm ci`, `npm run db:migrate`, `npm run dev`, separat `npm run worker:video`, `npm run worker:publishing` und bei Bedarf `npm run media:serve`. Node muss die Umgebungsvariablen explizit erhalten; die Worker lesen `.env.local` nicht automatisch. Anzeigebereitschaft entsteht erst durch einen aktuellen Datenbank-Heartbeat eines konfigurierten Workers.

## Limits und Lebenszyklus

- Pro Workspace höchstens zwei aktive Videoaufträge; pro 24 Stunden Starter 5, Studio 20, Pro 50 neue Aufträge. Wiederholungen desselben UUID-Auftragsschlüssels erzeugen keine weiteren Gebühren aus einem doppelten Job.
- Ein Worker verarbeitet jeweils einen Videoauftrag. `FOR UPDATE SKIP LOCKED`, laufend erneuerte Leases und transaktionaler Abschluss verhindern doppelte Medien bei mehreren Workern.
- Key-TTL insgesamt eine Stunde, Verarbeitung maximal 15 Minuten. Terminale Zustände entfernen den Key aus dem aktiven Datensatz; eine regelmäßige Worker-Bereinigung und API-Zugriffe behandeln abgelaufene Aufträge. Bei komplett ausgeschalteter Infrastruktur läuft keine physische Bereinigung: vor Wiederaufnahme wird Ablauf geprüft. Für strengere Löschfristen externen Scheduler/DB-Retention einsetzen.
- Abbruch setzt den Job terminal, löscht den gespeicherten Key und beendet laufende Arbeit über die Lease-Prüfung. Bereits vom Provider verarbeitete Schritte können trotzdem Kosten verursacht haben.
- Keine automatischen kostenpflichtigen Wiederholungen nach Worker-Absturz. Ein neuer Auftrag erfordert eine neue bewusste Aktion und einen API-Key.
- Downloads: höchstens sechs Pexels-Clips, jeweils 64 MiB und zusammen 256 MiB; finale Datei höchstens 128 MiB. Nur geprüfte öffentliche IPv4-Ziele auf `videos.pexels.com`, HTTPS, keine Redirects. Betrieb mit ausschließlich IPv6-Pexels-Zielen wird nicht unterstützt.
- Medien liegen wie bisher in PostgreSQL. Für größere Nutzerzahlen sind Objekt-Storage, Gesamtquoten, Retention und Speicherüberwachung nötig; die neue Queue ist kein unbegrenzter Videospeicher.
- Provider- und Job-Fehler enthalten keine Rohantworten oder Schlüssel. Ein Rollenwechsel oder entzogenes Abo wird vor Veröffentlichung nochmals geprüft.

## Verifikation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Tests prüfen Provider-Verträge mit lokalen Antworten, Schlüsselverarbeitung, Eingabe-/Downloadgrenzen, Abbruch/Leases und echte FFmpeg-Ausgabe in allen drei Formaten. Ohne FFmpeg wird der Render-Integrationstest ausdrücklich übersprungen. PostgreSQL-Tests sind zusätzlich einschaltbar:

```bash
VIDEO_TEST_DATABASE_URL=postgres://… PUBLISHING_TEST_DATABASE_URL=postgres://… npm test
```

Nur eine eigene lokale Testdatenbank verwenden; die Tests legen isolierte Schemas an und entfernen diese danach. Der HTTP-Integrationstest benötigt zusätzlich den laufenden lokalen App-Server, `TEST_BASE_URL`, `TEST_DATABASE_URL` und `TEST_SESSION_SECRET`, passend zum Dummy-`SUBSCRIPTION_SESSION_SECRET` des Testservers. Er prüft Mandantentrennung, Rolle, Idempotenz, Verschlüsselung, CSRF, Quoten, Abbruch und Ablauf. Dabei werden keine echten Provider-Aufträge ausgeführt.

Vor einem Livegang bleiben echte kontrollierte Generation/Veröffentlichung, Provider-Reviews, reguläre Kundenidentität und wiederkehrende Abrechnung sowie betriebliche Speicher-/Backup-/Löschregeln erforderlich. Lokale Tests beweisen keinen erfolgreichen Live-Aufruf oder Freigabestatus bei OpenAI, Pexels, Meta, TikTok oder Google.
