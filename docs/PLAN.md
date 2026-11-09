# AMS – Projektplan

## Ziel
Cloud-basiertes Arbeitsschutzmanagementsystem für Fachkräfte für Arbeitssicherheit – intern und extern –
für mehrere Unternehmen (Mandanten), mit Nutzerverwaltung je Unternehmen.
Rechtsrahmen: ASiG, DGUV Vorschrift 1 und 2, BetrSichV, GefStoffV, ArbStättV, JArbSchG, ArbMedVV, optional ISO 45001.

## Mandanten und Rollen

| Rolle | Wirkungsbereich | Rechte |
|---|---|---|
| Plattform-Betreiber | alle Unternehmen | Unternehmen anlegen/sperren, Module freischalten |
| Externe Sifa | mehrere Unternehmen | Umschalter, Sifa-Rechte je Unternehmen |
| Interne Sifa | ein Unternehmen | volle Fachrechte |
| Unternehmens-Admin | ein Unternehmen | Nutzer, Standorte, Stammdaten |
| Führungskraft | eigener Bereich | Maßnahmen, Unterweisungen der eigenen Leute, Freigaben |
| Prüfer/in (auch extern) | zugewiesene Anlagen | Prüfungen erfassen |
| Mitarbeiter/in | eigene Daten | Melden, Unterweisungen, Betriebsanweisungen lesen |

## Kernmodule

1. **Arbeitsunfälle** – Meldung (mobil, mit Foto), Einstufung (meldepflichtig > 3 Tage, Bagatell, Wegeunfall,
   Beinaheunfall), digitales Verbandbuch (5 Jahre), Unfallanzeige als PDF mit 3-Tage-Frist,
   Ursachenanalyse, Maßnahmen, Kennzahlen (1000-Mann-Quote, Ausfalltage, Schwerpunkte).
2. **Schulungen & Ausbildung** – Unterweisungen mit Intervall, Unterschrift am Tablet, Online-Unterweisung mit Test,
   Qualifikationen mit Ablaufdatum (Ersthelfer, Brandschutzhelfer, Stapler, Kran, EuP/EFK, Atemschutz),
   Schulungsmatrix, Schulungsplanung, Azubi-Unterweisung (JArbSchG § 29), Quotenwarnungen.
3. **Gefahrstoffverzeichnis** – nach § 6 GefStoffV, GHS, H-/P-Sätze, Lagerklasse TRGS 510, WGK, SDB mit
   Wiedervorlage, CMR, Substitutionsprüfung, Freigabeprozess, Betriebsanweisung vorbefüllt.
4. **Betriebsanweisungen** – Editor im Standardlayout (Farbbalken je Art), Piktogramme ISO 7010/GHS,
   Vorlagen, Versionierung, Vier-Augen-Freigabe, Aushangorte, PDF, QR-Code, Unterweisung aus BA.
5. **Anlagen & Maschinen** – Stammdaten inkl. CE, Konformitätserklärung, Betriebsanleitung; Status mit Verlauf;
   mehrere Prüfpflichten je Anlage; Bedienung nur mit Befähigung.
6. **Prüfungen & Fristenkalender** – eine Übersicht aller Fristen aller Module, Ampel, Jahres-Prüfplan,
   Prüfkatalog, Prüfprotokoll mit automatischer Sperre, Erinnerungen, Export für Dienstleister.

## Zusatzmodule
Gefährdungsbeurteilung (inkl. psychischer Belastung, Mutterschutz) · Maßnahmenpool · Begehungen mobil ·
ASA-Sitzungen · Beauftragte & Pflichtenübertragung · PSA-Verwaltung · Arbeitsmedizinische Vorsorge ·
Brandschutz & Notfall · Fremdfirmen & Erlaubnisscheine · Rechtskataster · Sifa-Tätigkeitsnachweis
(DGUV V2) mit Jahresbericht · Dashboard · optional KI-Assistent.

## Technik
Next.js + TypeScript, PostgreSQL + Prisma, Tailwind, PWA. Hosting in Deutschland/EU, Dateien in
S3-kompatiblem EU-Speicher, PDF serverseitig, später 2FA und Microsoft-Login, E-Mail-Benachrichtigungen,
tägliche Fristenprüfung, Backups, AVV je Kunde. Mandantentrennung in der Anwendung (`requireOrg`),
zusätzlich geplant: PostgreSQL Row-Level Security.

## Phasen

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Login, Mandanten, Rollen, Nutzerverwaltung, Umschalter, Protokoll | ✅ |
| 2 | Standorte/Abteilungen, Mitarbeiterstamm (auch ohne Login), Anlagen, Prüfpflichten, Fristenkalender | ✅ |
| 3 | Gefahrstoffverzeichnis, Betriebsanweisungs-Editor | ✅ |
| 4 | Schulungen, Qualifikationen, Unterweisungen | ✅ |
| 5 | Unfälle, Verbandbuch, Unfallanzeige, Maßnahmen | ✅ |
| 6 | Gefährdungsbeurteilung, Begehungen, PSA, Beauftragte | ✅ |
| 7 | ASA-Sitzungen, Tätigkeitsnachweis, Jahresbericht, E-Mail, 2FA | ✅ (KI-Assistent zurückgestellt, s. u.) |

## Offene Punkte aus Phase 3 (für später)
- Originalgrafiken der GHS- und ISO-7010-Zeichen als Bilddateien (derzeit genormte Form/Farbe mit Code)
- SDB als Datei hochladen (mit Phase „Dokumente/Dateiablage“)
- QR-Code an der Maschine, der die aktuelle BA öffnet
- Prüfung der Zusammenlagerung nach TRGS 510
- Unterweisung direkt aus einer BA erzeugen (Phase 4)

## Mögliche Erweiterungen
- KI-Assistent (Entwürfe für GBU/BA, SDB auslesen) – erfordert Entscheidung zu Anbieter und Datenschutz
- ~~Arbeitsmedizinische Vorsorge, Fremdfirmen & Erlaubnisscheine, Rechtskataster~~ ✅ Phase 8
- Brandschutz & Notfall (Räumungsübungen, Alarmplan)
- ~~Datei-Uploads (SDB, Zertifikate, Fotos)~~ ✅ Phase 9
- Microsoft-Login (SSO) je Unternehmen, PostgreSQL Row-Level Security als zusätzliche Mandantentrennung
