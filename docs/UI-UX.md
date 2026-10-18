# ContentDock: UI und UX

Die Oberfläche wurde anhand der vom Auftraggeber bereitgestellten „UI/UX-Designprinzipien für digitale Produkte“ und Apples Human Interface Guidelines überarbeitet. Die HIG dienen als Gestaltungsgrundlage für die Webanwendung; dies ist weder eine native Apple-App noch eine Zertifizierung durch Apple.

## Quellen und Übersetzung auf das Web

Die folgenden Apple-Dokumente wurden am 18. Oktober 2026 über Apples öffentliche Dokumentationsdaten gelesen:

- [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles): Aufgaben priorisieren, bekannte Bedienmuster verwenden, Kontrolle und nachvollziehbare Rückmeldung geben.
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): lesbarer Text, ausreichender Kontrast, große Bedienflächen, verständliche Beschriftungen und alternative Bedienung.
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout): konsistente Hierarchie, Anpassung an den verfügbaren Raum, Schutz wichtiger Inhalte und Aktionen.
- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography): klare Textrollen und Berücksichtigung größerer Schrift.
- [Color](https://developer.apple.com/design/human-interface-guidelines/color): semantische Farben, zurückhaltender Akzent, lesbare helle und dunkle Darstellung.
- [Motion](https://developer.apple.com/design/human-interface-guidelines/motion): kurze, zweckmäßige Rückmeldung und Unterstützung reduzierter Bewegung.

## Gemeinsames Gestaltungssystem

`src/app/globals.css` definiert Farben, Oberflächen, Abstände, Ecken, Schatten und Interaktionszustände. Die Video-Komponenten verwenden dieselben Variablen. ContentDocks Korallton bleibt als Markenfarbe erhalten; der dunklere Ton in der hellen Darstellung und der hellere Ton in der dunklen Darstellung ermöglichen gut lesbare Beschriftungen. Systemschriften vermeiden zusätzliche Schriftdownloads. Schriftgrößen sind überwiegend relativ definiert; bisherige Metadaten mit 7–10 Pixeln wurden auf mindestens 12 Pixel bei Standardschriftgröße angehoben.

Die wichtigsten Textkontraste wurden rechnerisch geprüft:

| Kombination | Hell | Dunkel |
| --- | ---: | ---: |
| Haupttext auf Oberfläche | 15,37:1 | 14,36:1 |
| Sekundärtext auf Oberfläche | 5,93:1 | 8,02:1 |
| Primäre Aktion mit Beschriftung | 5,52:1 | 8,61:1 |

Diese Werte belegen die genannten Farbpaare, keine vollständige Kontrastprüfung jedes Bildes, Icons oder Zustands. Fokus verwendet einen sichtbaren Rahmen. Status enthalten verständlichen Text. Erhöhter Kontrast, erzwungene Systemfarben und reduzierte Bewegung werden berücksichtigt. Kleine dekorative Symbole erhalten keine künstlich vergrößerte Darstellung; die umgebenden Bedienflächen sind mindestens 44 Pixel hoch und reine Icon-Aktionen entsprechend breit.

## Änderungen nach Nutzeraufgabe

| Bereich | Verhalten und Gestaltung |
| --- | --- |
| Startseite | Die Hauptaufgabe „Idee → Kurzvideo → Veröffentlichung“ steht im Vordergrund. Eine eindeutig benannte Beispielvorschau zeigt das Format. Funktionen, externe Kosten und Einschränkungen stehen bei der jeweiligen Entscheidung. |
| Anmeldung und Zahlung | Dauerhafte Labels, Autofill-Angaben, Hinweise, konkrete Fehler und Ladezustände. Die Vorabversion und der erste Zugangszeitraum werden benannt; noch nicht vorhandene Kontofunktionen werden nicht als verfügbar angeboten. |
| Navigation | Aktiver Bereich erkennbar, Sprunglink zum Inhalt, gezielter Fokus bei Ansichtswechsel. Mobile Navigation als schließbarer Drawer mit Fokusführung; das Suchfeld bleibt Teil des Layouts. |
| Kalender | Desktop als Wochenraster mit chronologisch gestapelten Karten je Tag, Mobilgeräte als chronologische Tagesliste derselben Beiträge. Karten am selben Tag überlagern sich nicht. Karten öffnen den jeweiligen Beitrag über die gesamte Fläche. |
| Mediathek | Bilder, Videos, Filter und Suche verwenden dieselbe Gestaltung. Fehlende Medien erhalten einen neutralen Ersatz. Nach Upload bleibt der Arbeitskontext erhalten. |
| KI- und Video-Studio | Gruppierte Einstellungen, lesbare Formulare, klare Einwilligung, sichtbarer Fortschritt, Fehler und nächste Schritte. Die Demo benennt Beispieldaten und führt keine echte Veröffentlichung aus. |
| Direktveröffentlichung | Kanal, Sichtbarkeit und Einwilligungen werden ausdrücklich gewählt. „Hochgeladen“, „Veröffentlicht“ und ein unklarer Ausgang werden unterschieden. Wiederholungen dürfen keine doppelten Beiträge erzeugen. |
| Organisation und Profil | Rollen, Änderungen und destruktive Aktionen werden verständlich benannt. Entfernen/Löschen besitzt einen Bestätigungsdialog mit zunächst fokussierter Abbruchaktion. |
| Dialoge und Mitteilungen | Native modale Dialoge mit zugänglichem Namen. Fokus bleibt im Dialog; Escape und Schließen stellen Fokus sowie Seitenposition wieder her. Inhalt scrollt innerhalb der verfügbaren Höhe. |
| Farbschema | Helle und dunkle Darstellung verwenden semantische Farben. Der Wechsel befindet sich in der Kopfzeile und verdeckt keinen Inhalt. |
| Einladungs-E-Mail | Markenfarbe, Systemschrift und klare Hierarchie setzen sich in einer schmalen HTML-Vorlage mit vollständiger Textalternative fort. Rolle und nächster Schritt werden benannt; die Nachricht behauptet keinen bereits freigeschalteten Teamzugang. |

Die mobilen Formulare verwenden mindestens 16 Pixel große Eingabeschrift bei Standardschriftgröße. Das Layout respektiert `dvh`, sichere Bildschirmränder und explizites Zoomen. Größere Schrift darf den Inhalt umbrechen; der Viewport wird nicht gegen Vergrößerung gesperrt. Dialoge erzwingen bei kurzen Inhalten keine volle Bildschirmhöhe.

## Durchgeführte Prüfung

Mit lokalem Chromium über Playwright wurden Startseite, Anmeldung und Demo bei 1440, 390 und 320 Pixeln sowie die tatsächlichen Demoansichten Kalender, Mediathek, KI-Studio, Trends, Integrationen, Organisation und Abrechnung bei denselben Breiten geladen. Die sieben Demoansichten wurden auch mit ausdrücklich aktivierter dunkler Darstellung überprüft. Es trat kein horizontaler Dokumentüberlauf auf. Das Desktop-Wochenraster besitzt bei mittleren Breiten einen eigenen begrenzten Scrollbereich; auf Smartphones wird es durch die Tagesliste ersetzt.

Zusätzlich geprüft wurden 200 Prozent Root-Schriftgröße bei 390 Pixeln, sichtbarer Tastatur-Sprunglink, reduzierte Bewegung, Dialoggröße, gesperrter Seitenhintergrund und Rückkehr zum auslösenden Element. Die Dashboardprüfung umfasste Composer, Beitragsdetails, Profil, Medienvorschau, Mitteilungen, Abbruch einer Löschbestätigung, Tab-Fokusbegrenzung, Escape, mobilen Drawer, globale Suche, einen dreistufigen Entwurf und ein ungültiges leeres Datum. Die öffentlichen Seiten und die Videoabläufe wurden außerdem separat durch die zuständigen Implementierungen geprüft. Die Videoabläufe verwendeten dabei lokale Testantworten; daraus folgt kein Nachweis einer erfolgten Plattformveröffentlichung.

## Vor dem öffentlichen Start noch prüfen

- Echtes iPhone mit Safari: Bildschirmtastatur, Autofill, native Auswahlfelder, Querformat, Wischgesten und sichere Bildschirmränder. Browseremulation ist kein Ersatz für diese Prüfung.
- Firefox und WebKit/Safari sowie VoiceOver und NVDA mit den vollständigen produktiven Abläufen. Diese Überarbeitung liefert keine vollständige WCAG-Konformitätsaussage.
- Reale Kontoanmeldung, Zahlungsbestätigung, Videoerstellung und Plattformveröffentlichung mit den freigegebenen Diensten. Fehlende Produktfunktionen und Providerfreigaben bleiben in der jeweiligen Betriebsdokumentation aufgeführt.
- Rechtliche Pflichtinformationen, Supportzugang und transaktionale E-Mails mit den tatsächlichen Betreiberangaben. Die überarbeitete Einladungsvorlage wurde nicht durch einen echten Mailversand oder in unterschiedlichen Mailprogrammen geprüft. Fehlende Inhalte werden nicht durch wirkungslose Platzhalterlinks ersetzt.

Die Änderungen schließen bekannte Präsentations- und Bedienprobleme der bestehenden Ansichten. Die genannten offenen Geräte-, Hilfsmittel- und Produktprüfungen bleiben Teil der Freigabe für einen öffentlichen Start.
