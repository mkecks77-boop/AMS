# AMS – Arbeitsschutzmanagementsystem

Online-Werkzeug für Fachkräfte für Arbeitssicherheit (intern und extern) – mandantenfähig:
**ein System für viele Unternehmen**, jede Person kann mehreren Unternehmen angehören.

Gesamtplanung: [docs/PLAN.md](docs/PLAN.md)

## Stand: Phase 1 – Grundgerüst, Mandanten & Nutzerverwaltung

| Bereich | Umfang |
|---|---|
| Mandanten | Unternehmen anlegen, sperren/aktivieren (Plattform-Betreiber); Daten strikt je Unternehmen |
| Anmeldung | E-Mail + Passwort (bcrypt), Sitzungs-Cookie (nur Hash in der DB), 14 Tage gültig |
| Unternehmens-Umschalter | Externe Sifa wechselt zwischen betreuten Unternehmen |
| Rollen | Unternehmens-Admin · Fachkraft für Arbeitssicherheit · Führungskraft · Prüfer/in · Mitarbeiter/in; Kennzeichen „extern“ |
| Nutzerverwaltung | Einladen per Link (7 Tage), bestehende Konten werden direkt hinzugefügt, Rolle ändern, deaktivieren, Passwort-Link (24 h) |
| Schutzregeln | Letzter Admin kann nicht entfernt werden; ein Kunde kann das Passwort einer Person, die auch anderen Unternehmen angehört (z. B. externe Sifa), nicht zurücksetzen |
| Protokoll | Alle Änderungen mit Person und Zeitpunkt je Unternehmen |

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
| admin@metallbau.example.com | Unternehmens-Admin Muster Metallbau |
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
