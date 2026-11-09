-- CreateEnum
CREATE TYPE "public"."IncidentType" AS ENUM ('ACCIDENT', 'COMMUTING', 'NEAR_MISS', 'UNSAFE_CONDITION');

-- CreateEnum
CREATE TYPE "public"."IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."CauseCategory" AS ENUM ('TECHNICAL', 'ORGANIZATIONAL', 'PERSONAL');

-- CreateEnum
CREATE TYPE "public"."ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."ActionLevel" AS ENUM ('SUBSTITUTION', 'TECHNICAL', 'ORGANIZATIONAL', 'PERSONAL');

-- CreateTable
CREATE TABLE "public"."Incident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "public"."IncidentType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,
    "location" TEXT,
    "employeeId" TEXT,
    "personName" TEXT,
    "activity" TEXT,
    "description" TEXT NOT NULL,
    "injury" TEXT,
    "bodyPart" TEXT,
    "witnesses" TEXT,
    "firstAider" TEXT,
    "doctorVisit" BOOLEAN NOT NULL DEFAULT false,
    "lostDays" INTEGER NOT NULL DEFAULT 0,
    "fatal" BOOLEAN NOT NULL DEFAULT false,
    "reportedToBgAt" TIMESTAMP(3),
    "causeCategory" "public"."CauseCategory",
    "rootCause" TEXT,
    "status" "public"."IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "reporterId" TEXT,
    "firstAidEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FirstAidEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,
    "location" TEXT,
    "employeeId" TEXT,
    "personName" TEXT,
    "description" TEXT NOT NULL,
    "injury" TEXT NOT NULL,
    "measures" TEXT NOT NULL,
    "firstAider" TEXT NOT NULL,
    "witnesses" TEXT,
    "reporterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirstAidEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Action" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" "public"."ActionLevel",
    "priority" "public"."ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "responsibleId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."ActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "effectivenessNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL DEFAULT 'OTHER',
    "incidentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Incident_firstAidEntryId_key" ON "public"."Incident"("firstAidEntryId");

-- CreateIndex
CREATE INDEX "Incident_organizationId_occurredAt_idx" ON "public"."Incident"("organizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_organizationId_number_key" ON "public"."Incident"("organizationId", "number");

-- CreateIndex
CREATE INDEX "FirstAidEntry_organizationId_occurredAt_idx" ON "public"."FirstAidEntry"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "Action_organizationId_status_dueDate_idx" ON "public"."Action"("organizationId", "status", "dueDate");

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Incident" ADD CONSTRAINT "Incident_firstAidEntryId_fkey" FOREIGN KEY ("firstAidEntryId") REFERENCES "public"."FirstAidEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FirstAidEntry" ADD CONSTRAINT "FirstAidEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FirstAidEntry" ADD CONSTRAINT "FirstAidEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FirstAidEntry" ADD CONSTRAINT "FirstAidEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "public"."Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
