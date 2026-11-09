-- CreateEnum
CREATE TYPE "public"."RiskAssessmentKind" AS ENUM ('GENERAL', 'PSYCHOLOGICAL', 'MATERNITY');

-- CreateEnum
CREATE TYPE "public"."RiskAssessmentStatus" AS ENUM ('DRAFT', 'RELEASED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."WalkthroughStatus" AS ENUM ('PLANNED', 'DONE');

-- CreateEnum
CREATE TYPE "public"."AnswerResult" AS ENUM ('OK', 'DEFECT', 'NA');

-- AlterTable
ALTER TABLE "public"."Action" ADD COLUMN     "hazardId" TEXT,
ADD COLUMN     "riskAssessmentId" TEXT,
ADD COLUMN     "walkthroughId" TEXT;

-- CreateTable
CREATE TABLE "public"."RiskAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "public"."RiskAssessmentKind" NOT NULL DEFAULT 'GENERAL',
    "siteId" TEXT,
    "departmentId" TEXT,
    "scope" TEXT,
    "participants" TEXT,
    "responsibleId" TEXT,
    "reviewIntervalMonths" INTEGER NOT NULL DEFAULT 24,
    "status" "public"."RiskAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "reviewDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Hazard" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "factor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "measures" TEXT NOT NULL DEFAULT '',
    "residualProbability" INTEGER,
    "residualSeverity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChecklistItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Walkthrough" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "siteId" TEXT,
    "area" TEXT,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "performedAt" TIMESTAMP(3),
    "auditor" TEXT NOT NULL,
    "participants" TEXT,
    "summary" TEXT,
    "status" "public"."WalkthroughStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Walkthrough_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WalkthroughAnswer" (
    "id" TEXT NOT NULL,
    "walkthroughId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "result" "public"."AnswerResult" NOT NULL,
    "note" TEXT,

    CONSTRAINT "WalkthroughAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PpeItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "standard" TEXT,
    "replaceMonths" INTEGER,
    "inspectionRequired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PpeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PpeIssue" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "size" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "replaceDue" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "receiptSigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PpeIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "siteId" TEXT,
    "scope" TEXT,
    "appointedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskAssessment_organizationId_status_idx" ON "public"."RiskAssessment"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_organizationId_title_key" ON "public"."ChecklistTemplate"("organizationId", "title");

-- CreateIndex
CREATE INDEX "Walkthrough_organizationId_plannedAt_idx" ON "public"."Walkthrough"("organizationId", "plannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalkthroughAnswer_walkthroughId_itemId_key" ON "public"."WalkthroughAnswer"("walkthroughId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PpeItem_organizationId_name_key" ON "public"."PpeItem"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PpeIssue_employeeId_idx" ON "public"."PpeIssue"("employeeId");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_role_idx" ON "public"."Appointment"("organizationId", "role");

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "public"."RiskAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "public"."Hazard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_walkthroughId_fkey" FOREIGN KEY ("walkthroughId") REFERENCES "public"."Walkthrough"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RiskAssessment" ADD CONSTRAINT "RiskAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RiskAssessment" ADD CONSTRAINT "RiskAssessment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RiskAssessment" ADD CONSTRAINT "RiskAssessment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RiskAssessment" ADD CONSTRAINT "RiskAssessment_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Hazard" ADD CONSTRAINT "Hazard_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Walkthrough" ADD CONSTRAINT "Walkthrough_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Walkthrough" ADD CONSTRAINT "Walkthrough_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Walkthrough" ADD CONSTRAINT "Walkthrough_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalkthroughAnswer" ADD CONSTRAINT "WalkthroughAnswer_walkthroughId_fkey" FOREIGN KEY ("walkthroughId") REFERENCES "public"."Walkthrough"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalkthroughAnswer" ADD CONSTRAINT "WalkthroughAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PpeItem" ADD CONSTRAINT "PpeItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PpeIssue" ADD CONSTRAINT "PpeIssue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."PpeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PpeIssue" ADD CONSTRAINT "PpeIssue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
