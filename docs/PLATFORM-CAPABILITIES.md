# Plattform-Capability-Matrix

Stand: 18. Oktober 2026. Die Tabelle beschreibt Implementierung und verbleibende Voraussetzungen; lokale Tests sind kein Nachweis einer Plattformfreigabe. Provider-Verträge, Scopes und Review-Anforderungen können sich ändern.

| Provider | MVP-Status | Produktionsfähigkeit | Harte Voraussetzung |
|---|---|---|---|
| Meta / Instagram | OAuth und echte Reel-Publishing-Queue implementiert | Generierte MP4 nach Vorschau und Bestätigung | Instagram Professional, Instagram-Login-Berechtigungen, App-Review und signiert erreichbare Medien |
| LinkedIn | OAuth für Member-Profile vorbereitet | Member Posts; Organisationsseiten nach zusätzlicher Freigabe | LinkedIn App, `w_member_social`; Organisationszugriff und Adminrolle für Seiten |
| TikTok | OAuth und Direct-Post-Queue für MP4 implementiert | FILE_UPLOAD mit Creator-Info, expliziter Sichtbarkeit, Inhaltsangaben und Statusprüfung | App-Registrierung, `video.publish`, Creator-Consent und TikTok-Audit; kein Remote-URL-Upload |
| YouTube | OAuth und resumierbare MP4-Uploads implementiert | Explizite Sichtbarkeit und Kinder-Zielgruppe; öffentliche Verarbeitung getrennt von Upload bestätigt | Google OAuth-App, YouTube Data API, `youtube.upload`, `youtube.readonly`, erforderliche Verifizierung/Audits |
| Mollie | First Payment, begrenzter 30-Tage-Zugang und autoritativer Webhook-Fetch | Wiederkehrende Abrechnung noch offen | API-Key; Kundenidentität, Wiederanmeldung und Subscription-Lebenszyklus vor Abo-Launch ergänzen |
| Odoo 19 | JSON-2 Suchadapter | CRM-/Projekt-Sync | URL, Datenbank, API-Key und minimal berechtigter Bot-Nutzer |
| CapCut | Empfehlung/Handoff | Partnerabhängig | Belastbarer Partner- oder öffentlicher API-Vertrag |
| PhotoAI | Empfehlung/Handoff | Partnerabhängig | Belastbarer Partner- oder öffentlicher API-Vertrag |

## Meta / Instagram

Die Instagram Platform dokumentiert Content Publishing für professionelle Konten. ContentDock veröffentlicht fertig generierte Videos nach ausdrücklicher Bestätigung über seine eigene Queue. Der Planungskalender ist noch nicht an eine zeitgesteuerte Plattformveröffentlichung angeschlossen. Einrichtung und Betriebsablauf stehen in [PUBLISHING.md](PUBLISHING.md).

Primärquellen:

- [Instagram APIs](https://developers.facebook.com/products/instagram/apis/)
- [Instagram Platform](https://developers.facebook.com/documentation/instagram-platform)
- [IG User Media Container](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media)
- [Content Publishing Limit](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit)

## TikTok

TikTok verlangt vor Direct Post eine Creator-Info-Abfrage, damit die aktuell erlaubten Privacy- und Creator-Einstellungen in der Export-UI erscheinen. Unauditierte Clients unterliegen TikToks Einschränkungen. ContentDock verwendet FILE_UPLOAD; eine verifizierte Remote-Mediendomain ist für diesen Pfad nicht erforderlich.

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

## YouTube

ContentDock lädt per resumierbarer Upload-Session hoch und prüft anschließend den Videostatus. `uploaded` bedeutet nicht zwangsläufig öffentlich sichtbar; `published` setzt bestätigte öffentliche Sichtbarkeit und abgeschlossene Verarbeitung voraus. Nicht verifizierte API-Projekte können auf private Uploads beschränkt sein. Siehe [YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert) und [PUBLISHING.md](PUBLISHING.md).

## Mollie

Recurring Payments benötigen Customer, First Payment, gültiges Mandat und einen vollständigen Subscription-Lebenszyklus. Dieser letzte Teil ist in ContentDock noch nicht implementiert. Der vorhandene erste Zahlungszeitraum ist auf 30 Tage begrenzt; Mollie-Webhooks liefern eine ID, zu der der Server den aktuellen Zustand selbst lädt. Wiederanmeldung regulärer Kunden und wiederkehrende Abbuchungen bleiben Voraussetzungen für den öffentlichen Abo-Betrieb.

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
