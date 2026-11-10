# AMS – Arbeitsschutzmanagementsystem

Online-Werkzeug für Fachkräfte für Arbeitssicherheit (intern und extern) – mandantenfähig:
**ein System für viele Unternehmen**, jede Person kann mehreren Unternehmen angehören.

Gesamtplanung: [docs/PLAN.md](docs/PLAN.md)

## Stand: Phasen 1–10 umgesetzt

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
| Unterweisungen & Schulungen | Themen mit Intervall und Zielgruppe (Abteilungen, alle, nur Azubis), Erfassung durchgeführter Unterweisungen mit Teilnehmenden, Azubis automatisch halbjährlich (JArbSchG § 29), Unterweisung direkt aus einer Betriebsanweisung, druckbarer Unterweisungsnachweis mit Unterschriftenliste |
| Schulungsmatrix | Beschäftigte × Pflichtthemen mit Ampel und Erfüllungsquote, Filter nach Standort/Abteilung |
| Qualifikationen | Ersthelfer, Brandschutzhelfer, Staplerschein, Kran, EuP … mit Ablaufdatum; Quote je Standort (DGUV V1 § 26, ASR A2.2) |
| Melden | Für alle Beschäftigten: Arbeitsunfall, Wegeunfall, Beinaheunfall, unsicherer Zustand – oder Verbandbucheintrag |
| Unfälle & Ereignisse | Fortlaufende Nummer je Jahr, Untersuchung mit Ursachenkategorie und 5-Why, Meldepflicht (> 3 Tage AU / tödlich) mit 3-Tage-Frist, Unfallanzeige als vorbereiteter Ausdruck, Abschluss nur mit Ursache, Anzeige und erledigten Maßnahmen |
| Verbandbuch | Nach DGUV V1 § 24, nur für Admin/Sifa sichtbar, keine Gesundheitsdaten im Protokoll, automatische Löschung nach 5 Jahren, Umwandlung in Unfallmeldung, Druckansicht |
| Maßnahmen | Zentraler Pool (Quelle, STOP-Art, Priorität, Verantwortliche, Frist), Statusablauf mit Wirksamkeitsprüfung, Verlauf, Umsetzungsquote |
| Unfallkennzahlen | Unfälle, meldepflichtige, Ausfalltage, 1000-Mann-Quote, Beinaheunfälle, Verlauf nach Monat, Vorjahresvergleich |
| Gefährdungsbeurteilung | Nach §§ 5, 6 ArbSchG: Arbeitsplatz/Tätigkeit, psychische Belastung, Mutterschutz; Gefährdungsfaktoren nach GDA; 5×5-Risikomatrix vorher/nachher; Maßnahmen nach STOP; Freigabe nur mit Maßnahmen und bewertetem Restrisiko (nicht „sehr hoch“); jede Änderung setzt auf Entwurf; Überprüfungsfrist; Kopie als Vorlage; Druckansicht |
| Begehungen | Standard-Checklisten (Betrieb, Büro/Bildschirm) und eigene Checklisten; Planung; Durchführung am Handy (i. O. / Mangel / n. z.); Abschluss nur vollständig mit Mangelbeschreibung; Erfüllungsgrad; Maßnahmen aus Mängeln; Bericht |
| PSA | Katalog mit Normen und Gebrauchsdauer, Ausgabe mit Größe und Empfangsbestätigung (§ 3 PSA-BV), Austauschfrist, Rückgabe |
| Beauftragte | Pflichtenübertragung (§ 13 DGUV V1), Sicherheitsbeauftragte, Brandschutz-, Gefahrgut-, Abfall-, Laser-, Strahlenschutzbeauftragte, verantwortliche Elektrofachkraft; Befristung; druckbare Bestellung |
| Arbeitsschutzausschuss | ASA-Sitzungen (§ 11 ASiG) mit automatisch vorbereiteter Tagesordnung samt Kennzahlen, Protokoll, Maßnahmen, Einladung/Protokoll als Ausdruck; vierteljährliche Fälligkeit im Fristenkalender |
| Einsatzzeit | Tätigkeitsnachweis der Sifa nach Aufgabenfeldern (DGUV V2), Soll/Ist je Jahr |
| Jahresbericht | Bericht nach § 5 ASiG mit Unfallkennzahlen (Vorjahresvergleich), GBU, Begehungen, Prüfungen, Gefahrstoffen, Maßnahmen, Unterweisungsquote, ASA, Einsatzzeit – druckbar |
| Zwei-Faktor-Anmeldung | TOTP (RFC 6238) mit QR-Code für Authenticator-Apps, im Profil ein-/ausschaltbar |
| E-Mail | Einladungen und tägliche Fristen-Zusammenfassung per SMTP (abbestellbar), Versandprotokoll für den Plattform-Betreiber |
| Arbeitsmedizinische Vorsorge | Vorsorgekartei nach ArbMedVV ohne Befunde: Pflicht-, Angebots-, Wunschvorsorge, Zuordnung nach Abteilung, Übersicht mit Warnung „Tätigkeitsverbot“ bei fehlender Pflichtvorsorge, Fristen |
| Fremdfirmen | Firmen mit Haftpflichtnachweis und Sperre, Personen mit Fremdfirmeneinweisung (12 Monate), Einsatzbereitschaft auf einen Blick |
| Erlaubnisscheine | Heißarbeiten, enge Räume, Absturz, Elektro, Erdarbeiten: Antrag → Genehmigung im Vier-Augen-Prinzip (prüft Sperre, Haftpflicht, Einweisungen) → Freigabe vor Ort mit Checkliste → Abschluss mit Brandwache (≥ 30 min); max. 24 h; Ausdruck |
| Rechtskataster | Grundbestand von 23 Pflichten (ArbSchG, ASiG, DGUV V1/V2/V3, BetrSichV, GefStoffV, ArbMedVV …), Bewertung mit Nachweis, Erfüllungsgrad, Maßnahmen für Lücken, jährliche Wiedervorlage |
| Dateien | Anhänge an Gefahrstoffen (SDB), Anlagen, Unfällen, Begehungen (Fotos vom Handy), GBU, Fremdfirmen, Mitarbeitenden (Zertifikate) und Maßnahmen (Nachweise); PDF/Bilder/Word/Excel bis 15 MB mit Inhaltsprüfung; Download nur mit Leserecht im eigenen Unternehmen; Ablage lokal oder S3-kompatibel (EU) |
| Brandschutz & Notfall | Alarmplan je Standort (Notrufe, Sammelplatz, D-Arzt, AED, Räumungshelfer) mit jährlicher Überprüfung und druckbarem Aushang; Räumungs-, Lösch- und Erste-Hilfe-Übungen (auch unangekündigt) mit Auswertung, Räumungszeit, Fotos und Maßnahmen; nächste Übung je Standort im Fristenkalender |
| Navigation | Gruppierte Menüs (Ereignisse, Gefährdungen, Betrieb, Personal, Sifa, Verwaltung), „Melden“ immer sichtbar |
| Dashboard | Überfällige und bald fällige Fristen, gesperrte Anlagen, offene Gefahrstoff-Anträge, BA zur Freigabe, Gefahrstoffe ohne gültige BA, Unterweisungsquote, Quotenlücken, Tage ohne Ausfallunfall, offene Meldungen, überfällige Maßnahmen |

Ohne konfigurierten SMTP-Server werden Einladungslinks angezeigt und vom Admin weitergegeben.

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

## Betrieb in der Cloud

1. **Datenbank**: verwaltete PostgreSQL-Instanz in der EU (z. B. bei Hetzner, IONOS, OVH, AWS Frankfurt, Azure Germany). `DATABASE_URL` setzen.
2. **Anwendung**: Node-Hosting mit `npm ci && npx prisma migrate deploy && npm run build && npm start` (z. B. Docker auf einem EU-Server, Render/Fly.io in Frankfurt, Vercel mit Region fra1). `APP_URL` auf die öffentliche Adresse setzen.
3. **E-Mail** (optional): `SMTP_URL` und `MAIL_FROM`.
3a. **Dateien**: bei mehreren Servern oder ohne dauerhaften Datenträger einen S3-kompatiblen Objektspeicher in der EU nutzen (`S3_BUCKET`, `S3_REGION`, ggf. `S3_ENDPOINT`, Zugangsschlüssel); sonst `UPLOAD_DIR` auf ein gesichertes Verzeichnis setzen und ins Backup aufnehmen.
4. **Täglicher Lauf**: `CRON_SECRET` setzen und täglich `POST /api/cron/digest` mit `Authorization: Bearer <CRON_SECRET>` aufrufen (Fristen-E-Mails, Löschung alter Verbandbucheinträge). Alternativ `npm run notify` per Cron.
5. **Erstes Konto**: `npm run setup -- --email … --name …`, dann unter *Verwaltung → Plattform* die Kundenunternehmen anlegen.
6. **Datenschutz**: Auftragsverarbeitungsvertrag (AVV) mit jedem Kundenunternehmen; Backups der Datenbank täglich; Zwei-Faktor-Anmeldung für Admins und Sifa empfehlen.
