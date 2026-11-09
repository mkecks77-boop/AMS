-- Mandantentrennung in der Datenbank (PostgreSQL Row-Level Security)
--
-- Die Anwendung setzt je Anfrage `app.org_id` (SET LOCAL innerhalb einer Transaktion).
-- Ist die Variable gesetzt, sind nur Zeilen dieses Unternehmens sichtbar und änderbar.
-- Ohne Mandanten-Kontext (Anmeldung, Plattform-Verwaltung, nächtlicher Lauf) gelten die Filter der Anwendung.
-- Hinweis: Superuser und Rollen mit BYPASSRLS umgehen RLS immer – die Anwendung muss mit einer eigenen Rolle verbinden.

CREATE OR REPLACE FUNCTION ams_tenant() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.org_id', true), '') $$;

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Membership" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Invitation" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant() OR "organizationId" IS NULL) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant() OR "organizationId" IS NULL);

ALTER TABLE "Site" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Site" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Site" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Department" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Employee" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Equipment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Equipment" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "InspectionObligation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InspectionObligation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "InspectionObligation" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "HazardousSubstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HazardousSubstance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "HazardousSubstance" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "OperatingInstruction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatingInstruction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OperatingInstruction" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "TrainingTopic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingTopic" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TrainingTopic" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "QualificationType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualificationType" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "QualificationType" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Incident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Incident" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Incident" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "FirstAidEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FirstAidEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FirstAidEntry" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Action" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Action" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Action" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "RiskAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RiskAssessment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RiskAssessment" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "ChecklistTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ChecklistTemplate" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Walkthrough" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Walkthrough" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Walkthrough" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "PpeItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PpeItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PpeItem" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Appointment" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "AsaMeeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AsaMeeting" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AsaMeeting" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TimeEntry" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "MedicalCheckType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicalCheckType" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MedicalCheckType" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Contractor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contractor" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Contractor" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Permit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permit" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Permit" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "LegalRequirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LegalRequirement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LegalRequirement" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attachment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Attachment" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "EmergencyPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmergencyPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EmergencyPlan" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "Drill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Drill" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Drill" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());

ALTER TABLE "SsoConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SsoConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SsoConfig" USING (ams_tenant() IS NULL OR "organizationId" = ams_tenant()) WITH CHECK (ams_tenant() IS NULL OR "organizationId" = ams_tenant());
