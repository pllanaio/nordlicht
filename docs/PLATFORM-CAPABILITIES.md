# Plattform-Capability-Matrix

Stand: 24. August 2026. Provider-Verträge, Scopes und Review-Anforderungen können sich ändern; vor jedem Produktionsrelease werden die verlinkten Primärquellen erneut geprüft.

| Provider | MVP-Status | Produktionsfähigkeit | Harte Voraussetzung |
|---|---|---|---|
| Meta / Instagram | OAuth + Adapter vorbereitet | Bilder, Videos/Reels und weitere unterstützte Medientypen für professionelle Konten | Meta App, OAuth, Scopes, Accounttyp, App-Review und öffentlich erreichbare Medien |
| LinkedIn | OAuth für Member-Profile vorbereitet | Member Posts; Organisationsseiten nach zusätzlicher Freigabe | LinkedIn App, `w_member_social`; Organisationszugriff und Adminrolle für Seiten |
| TikTok | OAuth + Direct-Post-Adapter vorbereitet | Video/Foto direkt oder als Draft, abhängig von Scope | App-Registrierung, `video.publish`/`video.upload`, Creator-Consent, Domain-Verifikation und Audit |
| Mollie | First Payment + Webhook-Fetch | Monatliche Subscriptions | API-Key, Customer, First Payment, Mandat und idempotente Webhooks |
| Odoo 19 | JSON-2 Suchadapter | CRM-/Projekt-Sync | URL, Datenbank, API-Key und minimal berechtigter Bot-Nutzer |
| CapCut | Empfehlung/Handoff | Partnerabhängig | Belastbarer Partner- oder öffentlicher API-Vertrag |
| PhotoAI | Empfehlung/Handoff | Partnerabhängig | Belastbarer Partner- oder öffentlicher API-Vertrag |

## Meta / Instagram

Die Instagram Platform dokumentiert Content Publishing für professionelle Konten. ContentDock plant nicht „in“ Instagram, sondern hält den Job in der eigenen Queue und ruft die Publishing API zum freigegebenen Zeitpunkt auf.

Primärquellen:

- [Instagram APIs](https://developers.facebook.com/products/instagram/apis/)
- [Instagram Platform](https://developers.facebook.com/documentation/instagram-platform)
- [IG User Media Container](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media)
- [Content Publishing Limit](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit)

## TikTok

TikTok verlangt vor Direct Post eine Creator-Info-Abfrage, damit die aktuell erlaubten Privacy- und Creator-Einstellungen in der Export-UI erscheinen. Unauditierte Clients veröffentlichen nur privat. Ein Medien-URL muss von einer verifizierten Domain stammen; lokale Dateien werden über den Upload-Flow übertragen.

Primärquellen:

- [Content Posting API: Get Started](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [Direct Post Reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)
- [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)

## LinkedIn

Der MVP verbindet persönliche LinkedIn-Profile über OpenID Connect und fordert zusätzlich `w_member_social` für Beiträge im Namen des Mitglieds an. Organisationsseiten werden erst aktiviert, wenn das entsprechende LinkedIn-Produkt freigegeben ist und der angemeldete Nutzer die nötige Seitenrolle besitzt.

Primärquellen:

- [LinkedIn OAuth](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [Sign in with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)

## Mollie

Recurring Payments starten mit einem Customer und einem First Payment. `sequenceType=first` schafft nach erfolgreicher Zahlung das Mandat. Erst mit pending/valid Mandat wird eine Subscription erstellt. Mollie-Webhooks enthalten eine ID; der Server lädt den aktuellen Zustand selbst.

Primärquellen:

- [Recurring payments](https://docs.mollie.com/docs/recurring-payments)
- [Create subscription](https://docs.mollie.com/reference/create-subscription)
- [Subscriptions API](https://docs.mollie.com/reference/subscriptions-api)

## Odoo

Odoo 19 dokumentiert JSON-2 als externe API. ContentDock nutzt Bearer-API-Key und `X-Odoo-Database`; der technische Nutzer bekommt nur die erforderlichen Modellrechte.

Primärquelle: [Odoo 19 External JSON-2 API](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html)

## CapCut und PhotoAI

Öffentlich auffindbare Produkt-/Template-Seiten sind kein belastbarer Entwicklervertrag. Daher verspricht der MVP keine automatisierte Bearbeitung. Er kann passende Vorlagen empfehlen, Parameter vorbereiten und Nutzer in den jeweiligen Workflow übergeben. Eine echte Automatisierung beginnt erst mit dokumentiertem Partnerzugang, erlaubten Nutzungsbedingungen und Datenschutzprüfung.

## Audience Review

Die gewöhnlichen Creator-APIs dokumentieren keine allgemeine, sichere „Fake Follower entfernen“-Funktion. TikToks Follower-Listen-Endpunkt gehört zur Research API und ist nur für qualifizierte Forschung gedacht; er ist kein Consumer-SaaS-Entfernungsmechanismus.

ContentDock verwendet deshalb ausschließlich:

- Inaktivitätsfenster
- ungewöhnliche Follow-Bursts
- extreme Engagement-Mismatches
- sehr neues Accountalter
- manuelle Review-Entscheidung mit Erklärung und Audit-Log

Explizit ausgeschlossen sind Name, Sprache, vermutete Herkunft, Nationalität, Ethnie oder fehlendes Profilbild als automatische Entfernungskriterien.
