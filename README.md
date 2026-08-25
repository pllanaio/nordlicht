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
| `/demo` | Öffentliche, schreibgeschützte Live-Demo des Command Centers |
| `/subscribe` | Planbezogener Mollie-Checkout mit Name und E-Mail |
| `/login` | Anmeldung für bestehende Abonnenten |
| `/dashboard` | Abonnementgeschütztes Command Center mit Kalender, Suche und Navigation |
| `/dashboard` → `Content erstellen` | Geschützter Upload-, KI-Text- und Planungs-Flow |

Ohne serverseitig bestätigte Abo-Berechtigung leitet `/dashboard` zurück zur Anmeldung. Die öffentliche Live-Demo zeigt das Produkterlebnis, erlaubt aber weder Content-Erstellung noch Automatisierung.

## Produktumfang

- Kanalübergreifender Wochenkalender mit Status, Erinnerungen und Freigaben
- Lokaler Medien-Upload mit Bild-/Video-Vorschau
- KI-Captions und Hashtags per persönlichem OpenAI API-Key (ephemer, nicht gespeichert)
- Meta-/Instagram- und TikTok-Publishing-Adapter für autorisierte Konten
- OAuth-Connectoren für Instagram, LinkedIn und TikTok mit offiziellem Provider-Login
- HMAC-gesicherter OAuth-State, minimale Scopes und AES-256-GCM-verschlüsselte Token-Cookies für den Testbetrieb
- Mollie First-Payment-Flow als Basis für monatliche Abonnements
- Serverseitiges Abo-Gate für Workspace und KI-Endpunkt
- Signierte, kurzlebige Berechtigung erst nach autoritativ bestätigter Mollie-Zahlung
- Odoo-19-JSON-2-Adapter für CRM-/Projekt-Synchronisation
- Kuratierte CapCut-/PhotoAI-Übergabe bis ein belastbarer Partner-API-Vertrag vorliegt
- Trendradar auf Basis eigener Performance-Daten, Zeitraum und Quelle
- Faire Zielgruppenprüfung anhand von Aktivitätsmustern mit manueller Bestätigung
- Responsive Landingpage, Login und Workspace für Desktop und Mobilgeräte

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
| `OPENAI_API_KEY` | Optionaler serverseitiger KI-Fallback | Nein |
| `META_APP_ID`, `META_APP_SECRET` | Meta OAuth/App-Review | Nein |
| `META_GRAPH_VERSION`, `META_GRAPH_HOST` | Explizit pinbare Instagram-Graph-Version und API-Host | Nein |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth und Member Posting | Nein |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | TikTok Login/Posting | Nein |
| `OAUTH_STATE_SECRET` | Signiert kurzlebige OAuth-Anfragen gegen Login-CSRF | Nein |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32-Byte-Base64-Key für AES-256-GCM | Nein |
| `ODOO_BASE_URL`, `ODOO_DATABASE`, `ODOO_API_KEY` | Odoo JSON-2 | Nein |

Secrets gehören ausschließlich in lokale/Vercel-Umgebungsvariablen. Niemals Werte aus `.env.local` committen.

### Social Connectoren

Die produktive Integrationsansicht liegt unter `/dashboard` → `Integrationen` und bleibt durch das aktive Abonnement geschützt. Für jeden Provider muss im jeweiligen Developer-Portal exakt folgende Callback-URL eingetragen werden:

```text
https://<deine-domain>/api/connect/instagram/callback
https://<deine-domain>/api/connect/linkedin/callback
https://<deine-domain>/api/connect/tiktok/callback
```

Der Test-MVP speichert die Provider-Tokens ausschließlich in separaten, HTTP-only Cookies. Der gesamte Payload ist mit AES-256-GCM verschlüsselt; der Schlüssel bleibt serverseitig. Diese Variante ist für einen Vercel-Test und Einzelbenutzer gedacht. Vor Team-/Multi-Device-Betrieb wird derselbe Store gegen `social_connection` in PostgreSQL ausgetauscht, damit Token-Rotation, Widerruf und Audit-Logs zentral erfolgen.

## Provider-Realität

- Instagram veröffentlicht über die Content Publishing API für autorisierte professionelle Konten. Der konkrete Funktionsumfang hängt vom Accounttyp, den Scopes und dem App-Review ab.
- TikTok verlangt für Direct Post den Scope `video.publish`; nicht auditierte Clients können nur privat veröffentlichen. Die TikTok-UX muss Creator-Informationen und auswählbare Privacy-Optionen aus der API darstellen.
- Mollie-Abos brauchen zunächst einen Customer und ein First Payment mit `sequenceType=first`, damit ein Mandat entsteht. Erst danach wird die Subscription angelegt.
- Ein erfolgreicher UI-Redirect reicht nicht zur Freischaltung: ContentDock fragt den Zahlungsstatus serverseitig bei Mollie ab und setzt erst bei `paid` eine HTTP-only-Berechtigung.
- Odoo 19 stellt die JSON-2-API bereit. Ein eigener Bot-Nutzer mit minimalen Rechten ist vorgesehen.
- Für CapCut-Template-Suche und PhotoAI wurde keine belastbare öffentliche Entwickler-API als Produktvertrag dokumentiert. Der MVP nutzt deshalb Empfehlungen und Handoffs, bis Partnerzugänge vereinbart sind.

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

Der MVP ist als Produkt- und Engineering-Fundament gedacht. Provider-Credentials sind absichtlich nicht enthalten. Ohne Mollie-Key und Session-Secret bleibt nur die schreibgeschützte Live-Demo zugänglich; Workspace, KI-Endpunkt, Live-Zahlungen, externe Uploads und Odoo-Sync bleiben gesperrt bzw. im Adaptermodus.

---

<div align="center">
Mehr veröffentlichen. Weniger verwalten.
</div>
