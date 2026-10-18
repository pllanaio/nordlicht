# Quellen und Drittanbieter

Der Video-Workflow wurde anhand von [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo), Commit `9e7d8b7efa6b912058156943906542b53b945f0a`, untersucht und für ContentDocks TypeScript-/PostgreSQL-Architektur neu implementiert. Der Ablauf Skript → Suchbegriffe → Stimme → Untertitel → Medien → Rendering sowie getrenntes Publishing ist dort dokumentiert. Keine upstream Musik-, Font- oder Videodateien wurden übernommen.

MoneyPrinterTurbo wird unter MIT angeboten. Der vollständige Hinweis wird zur eindeutigen Quellenzuordnung beigefügt:

```text
MIT License

Copyright (c) 2024 Harry

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

[REA](https://github.com/morluto/rea) wurde als Entwicklungswerkzeug ausgeführt, nicht als Laufzeit-Abhängigkeit eingebaut. [Cloudflare Security Audit Skill](https://github.com/cloudflare/security-audit-skill) wurde für die Prüfung verwendet. Die Pins und Evidenzgrenzen stehen in den jeweiligen Berichten.

Im Betrieb gelten zusätzlich die Bedingungen von OpenAI und [Pexels](https://www.pexels.com/license/), die Plattformbedingungen für veröffentlichte Inhalte sowie die jeweiligen Rechte an verwendeten Medien. Pexels-Quelle und Urheber werden pro generiertem Video gespeichert und angezeigt. FFmpeg und DejaVu kommen aus den Linux-Distributionspaketen im Worker-Image und behalten ihre dort mitgelieferten Lizenzen. Dieser Hinweis ändert die Lizenz des ContentDock-Projekts nicht.
