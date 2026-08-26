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

Ohne serverseitig bestätigte Abo-Berechtigung leitet `/dashboard` zurück zur Anmeldung. In der öffentlichen Live-Demo können Nutzer reale Accounts mit minimalen Identitäts-Scopes verbinden, Content lokal erstellen und planen. Nur der tatsächliche Publish-Aufruf und die dafür nötigen Schreibrechte bleiben abonnementgeschützt.

## Produktumfang

- Kanalübergreifender Wochenkalender mit Status, Erinnerungen und Freigaben
- Dynamische Erinnerungen und Entwurfsqueue, die unmittelbar auf Kalender-, Status- und Connector-Änderungen reagieren
- Auswählbare Kalendertage, ISO-Kalenderwochen sowie direkt bearbeitbare Entwürfe und Freigaben
- Lokaler Medien-Upload mit Bild-/Video-Vorschau
- KI-Studio für Captions, Hashtags, Hooks und Content-Recycling; als lokale Tech-Demo oder im Workspace per persönlichem API-Key
- Meta-/Instagram- und TikTok-Publishing-Adapter für autorisierte Konten
- OAuth-Connectoren für Instagram, LinkedIn und TikTok mit offiziellem Provider-Login
- Organisationsverwaltung mit Administrator-/Manager-RBAC, Mitgliederverwaltung und geschütztem SMTP-Einladungsversand
- Bearbeitbares Benutzerprofil und datenbasiertes Benachrichtigungsmenü
- Progressive OAuth-Scopes: Basisverbindung in der Demo, Publishing-Freigabe erst nach Aboabschluss
- HMAC-gesicherter OAuth-State, minimale Scopes und AES-256-GCM-verschlüsselte Token-Cookies für den Testbetrieb
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
- Nodemailer für einmalige SMTP-Einladungen; eingegebene SMTP-Secrets werden nicht dauerhaft im Browser gespeichert
- Vercel für Preview-/Produktions-Deployments
- PostgreSQL als vorgesehene Produktionsdatenbank (`database/schema.sql`)

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

## Konfiguration

| Variable | Zweck | Erforderlich für Demo? |
|---|---|---:|
| `NEXT_PUBLIC_APP_URL` | Redirects und Webhook-URL | Nein |
| `MOLLIE_API_KEY` | Checkout und First Payment | Nein |
| `SUBSCRIPTION_SESSION_SECRET` | Signiert die kurzlebige Workspace-Berechtigung | Nein |
| `INTERNAL_TEST_ACCOUNTS` | Serverseitige Testkonten mit Passwort-Hash und festem Tarif | Nein |
| `META_APP_ID`, `META_APP_SECRET` | ContentDock-App bei Meta; Nutzer verbinden sich anschließend selbst | Für Instagram-Connect |
| `META_GRAPH_VERSION`, `META_GRAPH_HOST` | Explizit pinbare Instagram-Graph-Version und API-Host | Nein |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | ContentDock-App bei LinkedIn | Für LinkedIn-Connect |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | ContentDock-App bei TikTok | Für TikTok-Connect |
| `OAUTH_STATE_SECRET` | Signiert kurzlebige OAuth-Anfragen gegen Login-CSRF | Für Social Connect |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32-Byte-Base64-Key für AES-256-GCM | Für Social Connect |

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

Der Test-MVP speichert die Provider-Tokens ausschließlich in separaten, HTTP-only Cookies. Der gesamte Payload ist mit AES-256-GCM verschlüsselt; der Schlüssel bleibt serverseitig. Diese Variante ist für einen Vercel-Test und Einzelbenutzer gedacht. Vor Team-/Multi-Device-Betrieb wird derselbe Store gegen `social_connection` in PostgreSQL ausgetauscht, damit Token-Rotation, Widerruf und Audit-Logs zentral erfolgen.

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
database/schema.sql              Vorgesehenes Produktionsdatenmodell
docs/                            Architektur und Capability-Matrix
.github/workflows/ci.yml         Typecheck, Lint und Build
```

## Vom MVP zur Produktion

- Identity Provider und serverseitige Session-Validierung anbinden
- PostgreSQL-Schema migrieren, Abo-Lebenszyklus persistieren und Tenant-Isolation/RLS aktivieren
- Verschlüsselten Test-Cookie-Store der Social Connectoren durch den PostgreSQL-Store mit KMS-gestützter Schlüsselrotation ersetzen
- Objekt-Storage plus signierte Upload-URLs ergänzen
- Durable Job Queue für geplante Veröffentlichungen und Retries einführen
- OAuth Token verschlüsselt speichern und rotieren
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
