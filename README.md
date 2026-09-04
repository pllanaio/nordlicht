<div align="center">

# ContentDock

**Aus Content wird Kontinuität.**

Content-Planung, KI-Texte, Freigaben, Veröffentlichungen und Trend-Signale in einem fokussierten Workspace.

[Live-Demo](#live-demo) · [Lokaler Start](#lokaler-start) · [Architektur](docs/ARCHITECTURE.md) · [Plattform-Matrix](docs/PLATFORM-CAPABILITIES.md)

</div>

---

## Warum ContentDock?

ContentDock ist die Contentmanagement- und Automatisierungszentrale für Creator, Agenturen und kleine Teams. Fotos und Videos landen in einer Mediathek, werden mit KI-gestützten Captions und Hashtags verfeinert, im Kalender freigegeben und anschließend über freigegebene Plattform-APIs veröffentlicht.

Der aktuelle Stand ist ein hochwertiger, interaktiver MVP. Er demonstriert das vollständige Produkterlebnis und hält Provider-Zugriffe in austauschbaren Adaptergrenzen. Wo eine Plattform ein App-Review oder einen Partnerzugang verlangt, zeigt die Oberfläche das ehrlich an.

## Live-Demo

| Route | Inhalt |
|---|---|
| `/` | Landingpage, Produkt-Workflow, Integrationen, Signale und Pricing |
| `/demo` | Öffentliche, interaktive Live-Demo mit Account-Connect, Entwürfen und Planung |
| `/trends` | Öffentlicher Trendradar mit Quellen und plattformspezifischen Hashtag-Signalen |
| `/subscribe` | Planbezogener Mollie-Checkout mit Name und E-Mail |
| `/login` | Anmeldung für bestehende Abonnenten |
| `/dashboard` | Abonnementgeschütztes Command Center mit Kalender, Suche und Navigation |
| `/dashboard` → `Content erstellen` | Geschützter Upload-, KI-Text- und Planungs-Flow |

Ohne serverseitig bestätigte Abo-Berechtigung leitet `/dashboard` zurück zur Anmeldung. In der öffentlichen Live-Demo können Nutzer reale Accounts mit minimalen Identitäts-Scopes verbinden, Content cookiebasiert erstellen und planen. Angemeldete Workspaces speichern ihre fachlichen Daten in PostgreSQL. Nur der tatsächliche Publish-Aufruf und die dafür nötigen Schreibrechte bleiben abonnementgeschützt.

## Produktumfang

- Kanalübergreifender Wochenkalender mit Status, Erinnerungen und Freigaben
- Dynamische Erinnerungen und Entwurfsqueue, die unmittelbar auf Kalender-, Status- und Connector-Änderungen reagieren
- Auswählbare Kalendertage, ISO-Kalenderwochen sowie direkt bearbeitbare Entwürfe und Freigaben
- Medien-Upload mit Bild-/Video-Vorschau; sitzungsgebunden in der Demo und datenbankpersistiert im angemeldeten Test-Workspace
- KI-Studio für Captions, Hashtags, Hooks und Content-Recycling; als lokale Tech-Demo oder im Workspace per persönlichem API-Key
- Meta-/Instagram- und TikTok-Publishing-Adapter für autorisierte Konten
- OAuth-Connectoren für Instagram, LinkedIn und TikTok mit offiziellem Provider-Login
- Organisationsverwaltung mit Administrator-/Manager-RBAC, Mitgliederverwaltung und geschütztem SMTP-Einladungsversand
- Bearbeitbares Benutzerprofil und datenbasiertes Benachrichtigungsmenü
- Progressive OAuth-Scopes: Basisverbindung in der Demo, Publishing-Freigabe erst nach Aboabschluss
- HMAC-gesicherter OAuth-State, minimale Scopes sowie verschlüsselte Token-Cookies in der Demo und persistente Social-Verbindungen im Workspace
- Mollie First-Payment-Flow als Basis für monatliche Abonnements
- Serverseitiges Abo-Gate für Workspace und KI-Endpunkt
- Signierte, kurzlebige Berechtigung erst nach autoritativ bestätigter Mollie-Zahlung
- Öffentlich einsehbarer Trendradar mit transparenter Abgrenzung zwischen öffentlichen Rankings und Themen-Signalen
- KI-gestützte Branchen- und Zielgruppensuche im Pro-Tarif
- Faire Zielgruppenprüfung anhand von Aktivitätsmustern mit manueller Bestätigung
- Responsive Landingpage, Login und Workspace für Desktop und Mobilgeräte mit projektweitem Dark Mode

## Produktprinzipien

1. **Keine Plattform-Passwörter.** OAuth und minimale Scopes statt Credential-Sammlung.
2. **Keine Algorithmus-Versprechen.** Erklärbare Signale und Testvorschläge statt behaupteter „Erkennung“ geheimer Rankinglogik.
3. **Keine diskriminierende Follower-Selektion.** Namen, Sprache, Herkunft oder Profilfoto sind keine Entfernungskriterien. Verdachtsfälle beruhen auf transparenten Verhaltenssignalen und bleiben manuell.
4. **Keine Scheinintegrationen.** UI-Status unterscheidet zwischen konfigurierbar, Review erforderlich und reiner Übergabe.
5. **BYOK ohne dauerhafte Speicherung.** Der Demo-MVP reicht den persönlichen KI-Key nur an die jeweilige Serveranfrage weiter.

## Tech-Stack

- Next.js 16 App Router und React 19
- TypeScript im Strict Mode
- Native CSS mit extrahierten Design-Tokens
- Lucide Icons mit optimierten Paket-Imports
- Next.js Route Handler für KI, Mollie und Webhooks
- Nodemailer für SMTP-Einladungen; Zugangsdaten liegen ausschließlich serverseitig und AES-256-GCM-verschlüsselt in PostgreSQL
- Vercel oder Docker Compose für Preview-/Produktions-Deployments
- PostgreSQL mit versionierten Migrationen unter `database/migrations/`

## Lokaler Start

```bash
git clone <repository-url>
cd contentdock
cp .env.example .env.local
npm install
npm run dev
```

Danach: [http://localhost:3000](http://localhost:3000)

Qualitätschecks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Docker Compose

Der Compose-Stack startet die produktive Next.js-Standalone-Anwendung zusammen mit PostgreSQL 16. Die Datenbank ist nur im internen Compose-Netz erreichbar, wird über ein benanntes Volume persistiert und vor jedem App-Start über den einmaligen `migrate`-Service aktualisiert.

Die Next.js-Konfiguration aktiviert `output: "standalone"` nur außerhalb von Vercel. Dadurch erhält Docker weiterhin das eigenständige Server-Artefakt, während Vercel die Serverless Functions über seinen nativen Build-Prozess paketiert.

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker build app
```

Die benötigten Secrets können nach dem Build direkt im Anwendungscontainer erzeugt werden. Den Befehl für jedes Secret separat ausführen und die Ausgaben in `.env.docker` einsetzen:

```bash
docker compose --env-file .env.docker run --rm --no-deps app node scripts/generate-secret.mjs
```

Für ein internes Testkonto kann auch der scrypt-Hash im Container erzeugt werden:

```bash
docker compose --env-file .env.docker run --rm --no-deps app \
  node scripts/hash-test-password.mjs 'ein-passwort-mit-mindestens-12-zeichen'
```

Den vollständigen Hash anschließend in `INTERNAL_TEST_ACCOUNTS` einsetzen. Das JSON in `.env.docker` muss in einfachen Anführungszeichen stehen, damit Compose die `$`-Zeichen des Hashes nicht als Variablen interpretiert.

Stack starten und prüfen:

```bash
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
curl http://localhost:3000/api/health
```

Die erwartete Health-Antwort enthält `"status":"healthy"` und `"database":"contentdock"`. Die Anwendung verwendet den eingeschränkten `POSTGRES_APP_USER`; Schema-Initialisierung und administrative Diagnose laufen getrennt über `POSTGRES_USER`.

Datenbankzugriff für Diagnosezwecke:

```bash
docker compose --env-file .env.docker exec database \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Logs und reguläres Stoppen:

```bash
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker down
```

`docker compose down` behält das Datenbankvolume. `docker compose down -v` löscht dagegen die gesamte lokale Datenbank unwiderruflich. Das PostgreSQL-Entrypoint-Skript legt nur beim ersten Start die eingeschränkte App-Rolle an. Das Schema wird unabhängig davon bei jedem Start über versionierte Migrationen aktualisiert.

Für eine öffentlich erreichbare Instanz muss `APP_URL` auf die endgültige HTTPS-Domain zeigen. Vor dem Container sollte außerdem ein Reverse Proxy wie Caddy, Traefik oder nginx TLS, Request-Limits und Rate-Limiting übernehmen.

Die öffentliche Demo bleibt vom Mandantenspeicher getrennt und hält Kalender-, Organisations- und Profildaten in sitzungsgebundenen Cookies. Angemeldete Workspaces persistieren Profil, Organisation, Mitglieder/Einladungen, SMTP-Konfiguration, Kalenderinhalte, Medien und Social-Verbindungen in PostgreSQL. SMTP- und Provider-Tokens werden vor dem Schreiben mit getrennten AES-256-GCM-Schlüsseln verschlüsselt.

Vor jedem App-Start führt der einmalige `migrate`-Service noch nicht angewendete Dateien aus `database/migrations/` unter einem PostgreSQL-Advisory-Lock aus. Dateiname und SHA-256-Prüfsumme werden in `schema_migration` protokolliert; bereits ausgeführte Migrationen dürfen nachträglich nicht verändert werden.

## Konfiguration

| Variable | Zweck | Erforderlich für Demo? |
|---|---|---:|
| `APP_URL` | Serverseitige kanonische URL für Redirects und Webhooks | Für Docker/Produktion empfohlen |
| `NEXT_PUBLIC_APP_URL` | Bisherige Vercel-URL; Fallback, wenn `APP_URL` fehlt | Nein |
| `DATABASE_URL` | PostgreSQL-Verbindung außerhalb von Compose | Für Datenbankzugriff |
| `DATABASE_POOL_MAX` | Maximale Verbindungen des App-Pools, Standard `10` | Nein |
| `MOLLIE_API_KEY` | Checkout und First Payment | Nein |
| `SUBSCRIPTION_SESSION_SECRET` | Signiert die kurzlebige Workspace-Berechtigung | Nein |
| `INTERNAL_TEST_ACCOUNTS` | Serverseitige Testkonten mit Passwort-Hash und festem Tarif | Nein |
| `META_APP_ID`, `META_APP_SECRET` | ContentDock-App bei Meta; Nutzer verbinden sich anschließend selbst | Für Instagram-Connect |
| `META_GRAPH_VERSION`, `META_GRAPH_HOST` | Explizit pinbare Instagram-Graph-Version und API-Host | Nein |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | ContentDock-App bei LinkedIn | Für LinkedIn-Connect |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | ContentDock-App bei TikTok | Für TikTok-Connect |
| `OAUTH_STATE_SECRET` | Signiert kurzlebige OAuth-Anfragen gegen Login-CSRF | Für Social Connect |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32-Byte-Base64-Key für AES-256-GCM | Für Social Connect |
| `WORKSPACE_DATA_ENCRYPTION_KEY` | Separater 32-Byte-Base64-Key für gespeicherte Workspace-Secrets wie SMTP | Für persistente Organisationen |

Secrets gehören ausschließlich in lokale/Vercel-Umgebungsvariablen. Niemals Werte aus `.env.local` committen.

### Interne Testkonten ohne Mollie-Zahlung

Für Produkt- und Featuretests können Betreiber eigene Konten als bereits bezahlt simulieren. Der Tarif stammt dabei ausschließlich aus der serverseitigen Konfiguration; ein Browser, Query-Parameter oder Formular kann den Tarif nicht selbst hochstufen.

Zuerst pro Testkonto ein starkes Passwort wählen und den scrypt-Hash erzeugen:

```bash
npm run test-account:hash -- 'dein-langes-einzigartiges-testpasswort'
```

Danach in Vercel unter `Project → Settings → Environment Variables` die Variable `INTERNAL_TEST_ACCOUNTS` als Sensitive Value anlegen. Für drei getrennte Stufen sieht der Wert einzeilig so aus:

```json
[{"email":"starter-test@example.com","name":"Starter Test","passwordHash":"scrypt$SALT$HASH","plan":"starter"},{"email":"studio-test@example.com","name":"Studio Test","passwordHash":"scrypt$SALT$HASH","plan":"studio"},{"email":"pro-test@example.com","name":"Pro Test","passwordHash":"scrypt$SALT$HASH","plan":"pro"}]
```

Den kompletten Platzhalterwert `scrypt$SALT$HASH` jeweils durch die vollständige Ausgabe des Befehls ersetzen. Für jedes Konto sollte ein eigener Hash verwendet werden. Zusätzlich muss `SUBSCRIPTION_SESSION_SECRET` mit mindestens 32 zufälligen Zeichen gesetzt sein. Nach dem Speichern ein neues Deployment auslösen.

Die Anmeldung erfolgt regulär über `/login`. Nach erfolgreicher Prüfung erzeugt der Server eine signierte, 24 Stunden gültige HTTP-only-Sitzung. Im Workspace werden Tarif und Kennzeichnung `Testkonto` angezeigt. Starter sieht Teamfreigaben als Studio-Feature gesperrt; Starter und Studio können die öffentlichen Trends sehen, während die KI-gestützte Branchensuche Pro vorbehalten bleibt. Unter `Abrechnung` zeigt die Tarifmatrix den simulierten Zugriff. Abmelden und mit dem nächsten Testkonto anmelden ermöglicht den direkten Stufenvergleich. Es wird weder ein Mollie-Customer noch eine Zahlung oder Rechnung erzeugt.

### Social Connectoren

Die Integrationsansicht ist sowohl unter `/demo` als auch im produktiven `/dashboard` verfügbar. Für jeden Provider muss im jeweiligen Developer-Portal exakt folgende Callback-URL eingetragen werden:

```text
https://<deine-domain>/api/connect/instagram/callback
https://<deine-domain>/api/connect/linkedin/callback
https://<deine-domain>/api/connect/tiktok/callback
```

Demo-Verbindungen werden in separaten, HTTP-only Cookies gespeichert. Im angemeldeten Workspace schreibt derselbe Adapter den AES-256-GCM-verschlüsselten Payload in `social_connection`; dadurch bleiben Verbindungen bei Browser- und Gerätewechsel erhalten. React erhält in beiden Fällen nur Accountname, Scopes und Ablaufdatum.

Die App-Credentials identifizieren ContentDock gegenüber dem Provider und werden einmalig vom Betreiber in Vercel hinterlegt. Nutzer geben ausschließlich im offiziellen Meta-, LinkedIn- oder TikTok-Dialog ihre Zustimmung. In der Demo fordert ContentDock nur Basis-/Identitäts-Scopes an. Nach dem Aboabschluss startet „Publishing freigeben“ eine zweite Autorisierung mit den jeweiligen Schreibrechten.

## Provider-Realität

- Instagram veröffentlicht über die Content Publishing API für autorisierte professionelle Konten. Der konkrete Funktionsumfang hängt vom Accounttyp, den Scopes und dem App-Review ab.
- TikTok verlangt für Direct Post den Scope `video.publish`; nicht auditierte Clients können nur privat veröffentlichen. Die TikTok-UX muss Creator-Informationen und auswählbare Privacy-Optionen aus der API darstellen.
- Mollie-Abos brauchen zunächst einen Customer und ein First Payment mit `sequenceType=first`, damit ein Mandat entsteht. Erst danach wird die Subscription angelegt.
- Ein erfolgreicher UI-Redirect reicht nicht zur Freischaltung: ContentDock fragt den Zahlungsstatus serverseitig bei Mollie ab und setzt erst bei `paid` eine HTTP-only-Berechtigung.

Details und Primärquellen: [docs/PLATFORM-CAPABILITIES.md](docs/PLATFORM-CAPABILITIES.md).

## Verzeichnisstruktur

```text
src/app/                         Seiten und Route Handler
src/components/                  Landing-, Login- und Dashboard-Komponenten
src/lib/integrations/            Provider-Verträge und Adapter
src/lib/follower-audit.ts        Faire, erklärbare Review-Logik
public/media/                    Optimierte, eigens erzeugte Demo-Assets
database/migrations/             Versioniertes PostgreSQL-Datenmodell
scripts/migrate.mjs              Prüfsummengesicherter Migration-Runner
docs/                            Architektur und Capability-Matrix
.github/workflows/ci.yml         Typecheck, Lint und Build
```

## Vom MVP zur Produktion

- Identity Provider und serverseitige Session-Validierung anbinden
- Vollständigen Abo-Lebenszyklus persistieren und Datenbank-Tenant-Isolation/RLS zusätzlich zur Server-Autorisierung aktivieren
- KMS-gestützte Schlüsselrotation für verschlüsselte SMTP- und Provider-Tokens ergänzen
- Objekt-Storage plus signierte Upload-URLs ergänzen
- Durable Job Queue für geplante Veröffentlichungen und Retries einführen
- OAuth-Tokenrotation und Widerruf automatisieren
- Mollie-Webhooks idempotent persistieren; Subscription erst nach gültigem Mandat anlegen
- Meta-/TikTok-App-Review und öffentliche Datenschutz-/Datenlöschungsseiten abschließen
- Trendquellen, Datenlizenzierung und Nachvollziehbarkeit pro Signal vertraglich festlegen
- Audit-Log, DSGVO-Löschung, Aufbewahrungsfristen und Incident Monitoring ergänzen

## Status

Der MVP ist als Produkt- und Engineering-Fundament gedacht. Provider-Credentials sind absichtlich nicht enthalten. Ohne sie bleibt die Demo interaktiv, kann aber keine realen Social Accounts verbinden. Mediathek, Entwürfe, Planung, Trendradar und lokale KI-Tech-Demos funktionieren weiterhin. Im bezahlten Workspace benötigen KI-Anfragen immer den persönlichen API-Key; Veröffentlichung und produktiver Workspace bleiben abonnementgeschützt.

---

<div align="center">
Mehr veröffentlichen. Weniger verwalten.
</div>
