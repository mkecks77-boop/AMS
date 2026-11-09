# AMS – Arbeitsschutzmanagementsystem

Online-Werkzeug für Fachkräfte für Arbeitssicherheit (intern und extern) – mandantenfähig:
**ein System für viele Unternehmen**, jede Person kann mehreren Unternehmen angehören.

Gesamtplanung: [docs/PLAN.md](docs/PLAN.md)

## Stand: Phase 1–3

| Bereich | Umfang |
|---|---|
| Mandanten | Unternehmen anlegen, sperren/aktivieren (Plattform-Betreiber); Daten strikt je Unternehmen |
| Anmeldung | E-Mail + Passwort (bcrypt), Sitzungs-Cookie (nur Hash in der DB), 14 Tage gültig |
| Unternehmens-Umschalter | Externe Sifa wechselt zwischen betreuten Unternehmen |
| Rollen | Unternehmens-Admin · Fachkraft für Arbeitssicherheit · Führungskraft · Prüfer/in · Mitarbeiter/in; Kennzeichen „extern“ |
| Nutzerverwaltung | Einladen per Link (7 Tage), bestehende Konten werden direkt hinzugefügt, Rolle ändern, deaktivieren, Passwort-Link (24 h) |
| Schutzregeln | Letzter Admin kann nicht entfernt werden; ein Kunde kann das Passwort einer Person, die auch anderen Unternehmen angehört (z. B. externe Sifa), nicht zurücksetzen |
| Protokoll | Alle Änderungen mit Person und Zeitpunkt je Unternehmen |
| Stammdaten | Standorte, Abteilungen, Mitarbeiterstamm (auch ohne Login, Azubi-Kennzeichen, Ein-/Austritt) |
| Anlagen & Maschinen | Verzeichnis mit Hersteller, Typ, Baujahr, CE, Konformitätserklärung, Betriebsanleitung, Standort, Verantwortlichem; Status (in Betrieb, gesperrt, Reparatur, stillgelegt, verschrottet) mit Verlauf |
| Prüfpflichten | Beliebig viele je Anlage, Prüfkatalog mit 19 Vorlagen (DGUV V3, Leitern, Regale, Krane, Stapler, Druckbehälter, Feuerlöscher …), Intervall, Rechtsgrundlage, Art des Prüfers |
| Prüfungen | Prüfprotokoll; nächste Fälligkeit automatisch; „nicht bestanden“ sperrt die Anlage, Freigabe nur mit Begründung |
| Fristenkalender | Alle Fristen nach Monat, Ampel (überfällig / ≤ 30 / ≤ 90 Tage), Filter nach Standort und Zeitraum, CSV-Export (Excel) |
| Gefahrstoffverzeichnis | Nach § 6 Abs. 12 GefStoffV: GHS-Piktogramme, Signalwort, H-/P-Sätze mit deutschem Text, Lagerklasse (TRGS 510), WGK, CMR-Erkennung, Einsatzorte und Mengen, CSV-Export |
| Gefahrstoff-Freigabe | Antrag → Prüfung durch die Sifa (Substitutionsprüfung und SDB-Datum Pflicht) → Freigabe oder begründete Ablehnung; SDB-Wiedervorlage im Fristenkalender |
| Betriebsanweisungen | Für Gefahrstoffe, Maschinen, Tätigkeiten, Biostoffe und PSA; Standardlayout mit farbigen Balken und Piktogrammen (GHS, ISO 7010); Entwurf wird bei Gefahrstoff-Freigabe automatisch aus den SDB-Daten erzeugt |
| BA-Freigabe | Entwurf → zur Freigabe → Freigabe im Vier-Augen-Prinzip; Versionierung (alte Version wird archiviert); Überprüfung nach 24 Monaten im Fristenkalender; Druckansicht / PDF |
| Dashboard | Überfällige und bald fällige Fristen, gesperrte Anlagen, offene Gefahrstoff-Anträge, BA zur Freigabe, Gefahrstoffe ohne gültige BA |

E-Mail-Versand folgt später – bis dahin wird der Einladungslink angezeigt und vom Admin weitergegeben.

## Tech-Stack

Next.js 15 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Vitest

## Schnellstart

```bash
cp .env.example .env            # DATABASE_URL und APP_URL anpassen
npm install
npm run db:deploy               # Migrationen anwenden
npm run setup -- --email du@firma.de --name "Max Muster"   # Plattform-Betreiber anlegen
# optional: Demodaten
npm run db:seed
npm run dev                     # http://localhost:3000
```

Demo-Zugänge (Passwort `Demo-Passwort1`):

| E-Mail | Rolle |
|---|---|
| betreiber@example.com | Plattform-Betreiber |
| sifa@example.com | Externe Sifa in beiden Demo-Unternehmen |
| admin@metallbau.example.com | Unternehmens-Admin Muster Metallbau (mit Demo-Anlagen und Prüffristen) |
| meister@metallbau.example.com | Führungskraft Muster Metallbau |
| admin@logistik.example.com | Unternehmens-Admin Beispiel Logistik |

## Tests

```bash
# eigene Testdatenbank (wird bei jedem Lauf geleert)
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ams_test
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
npm test
```

## Regeln für neue Module

- Jede Fachtabelle bekommt `organizationId`.
- Seiten und Server Actions holen den Kontext mit `requireOrg("<recht>")` und filtern **jede**
  Abfrage mit `ctx.organization.id`.
- Änderungen werden mit `audit()` protokolliert.
