-- Eigene Datenbankrolle für die Anwendung (ohne Superuser/BYPASSRLS), damit Row-Level Security greift.
-- Ausführen als Eigentümer der Datenbank, nachdem die Migrationen gelaufen sind:
--   psql "$ADMIN_DATABASE_URL" -v app_password="'…'" -f scripts/db-app-role.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ams_app') THEN
    CREATE ROLE ams_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
ALTER ROLE ams_app PASSWORD :app_password;
GRANT USAGE ON SCHEMA public TO ams_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ams_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ams_app;
GRANT EXECUTE ON FUNCTION ams_tenant() TO ams_app;
-- auch für Tabellen künftiger Migrationen
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ams_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ams_app;
