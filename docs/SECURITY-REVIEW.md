# Stand der Sicherheitsprüfung

Stand: 18. Oktober 2026. **Unvollständig; keine Freigabe für den Produktionsbetrieb.**

Der ausdrücklich gewünschte [Cloudflare Security Audit Skill](https://github.com/cloudflare/security-audit-skill/blob/main/skills/security-audit/SKILL.md) wurde auf dem unveränderten Ausgangsstand `4bd88d48bf884d76283c98daeab0da925b27b5ea` begonnen. Architekturaufnahme und Quellcodeprüfungen sind erfolgt. Die vollständige unabhängige Validierung und Abschlussprüfung konnten nicht abgeschlossen werden: Die automatische Sicherheitsprüfung der Ausführungsumgebung hat Teile des Audit-Workflows mit dem allgemeinen Grund „possible cybersecurity risk“ abgelehnt. Die abgelehnten Schritte wurden nicht erneut ausgeführt.

Unbestätigte Hinweise sind keine bestätigten Schwachstellen. Die nachfolgenden Implementierungsänderungen einschließlich Video-Studio, Publishing, Mediendienst und UI wurden nicht durch einen vollständigen abgeschlossenen Audit dieses Skills abgedeckt. Die lokalen Funktions- und Regressionstests ersetzen ihn nicht.

## Umgesetzte Schutzmaßnahmen

- Social-Connection-Antworten geben nur ausdrücklich ausgewählte öffentliche Felder zurück; OAuth-Zugangsdaten bleiben auf dem Server. Speichern und Entfernen von Verbindungen setzt aktuelle Administrator- oder Eigentümerrechte voraus.
- Rollenwechsel und Entzug einer Mitgliedschaft wirken auf die tatsächlichen Workspace-Mitgliedschaften. Schreibpfade lesen die aktuellen Rechte innerhalb ihrer Transaktion. Abgewiesene Einladungsabfragen schließen ihre Datenbanktransaktion.
- Checkout-Bestätigungen sind an den initiierenden Browser und einen zeitlich begrenzten Zustand gebunden. Der Zugriff aus einer ersten Zahlung endet nach dem ursprünglichen 30-Tage-Zeitraum. Autoritative Zahlungsdaten einschließlich Rückerstattungen werden geprüft; Webhooks aktualisieren die gebundene Zahlung.
- Videoaufträge und Veröffentlichungen sind an Workspace, Benutzer und bestehende Medien gebunden. Begrenzte Warteschlangen, geleaste Verarbeitung und idempotente Anfragen behandeln konkurrierende Aufträge. Unklare Veröffentlichungsergebnisse lösen keinen automatischen erneuten Post aus.
- Temporäre KI-Schlüssel und dauerhafte Provider-Tokens verwenden getrennte verschlüsselte Speicherpfade. Medienlinks sind kurzlebig, signiert und zweckgebunden. Die Medienauslieferung streamt begrenzte Blöcke.

Die zugehörigen Tests decken normale und abgewiesene Anfragen, Rollenwechsel, Mandantentrennung, Abbruch, konkurrierende Verarbeitung und Provider-Verträge mit lokalen Beispieldaten ab. Es wurden keine realen Plattformposts, Kundenzahlungen oder Tests gegen Produktionssysteme durchgeführt.

## Vor öffentlicher Nutzung offen

1. Die unterbrochene Prüfung in einer dafür freigegebenen Umgebung abschließen und den finalen Code erneut unabhängig prüfen.
2. Reguläre Kundenanmeldung, Wiederanmeldung und gegebenenfalls wiederkehrende Abrechnung fertigstellen. Das vorhandene interne Testkonto und eine erste Zahlung ergeben noch keinen vollständigen Kundenlebenszyklus.
3. Plattformfreigaben und kontrollierte Ende-zu-Ende-Aufrufe mit eigenen Konten nachweisen; Worker, Mediendienst und Secrets produktiv konfigurieren.
4. Für die tatsächliche Hostingumgebung TLS, Proxy-Limits, Backups, Datenlöschung, Schlüsselrotation und Speicherquoten festlegen. Insbesondere enthalten Backups eventuell bereits aus aktiven Aufträgen entfernte verschlüsselte Daten.

Konkrete Betriebsanleitungen stehen in [VIDEO-STUDIO.md](VIDEO-STUDIO.md) und [PUBLISHING.md](PUBLISHING.md).
