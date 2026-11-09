-- CreateEnum
CREATE TYPE "public"."DrillKind" AS ENUM ('EVACUATION', 'FIRE', 'FIRST_AID', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Action" ADD COLUMN     "drillId" TEXT;

-- CreateTable
CREATE TABLE "public"."EmergencyPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "internalEmergency" TEXT,
    "fireBrigade" TEXT NOT NULL DEFAULT '112',
    "poisonCenter" TEXT,
    "doctorOnDuty" TEXT,
    "dArzt" TEXT,
    "assemblyPoint" TEXT NOT NULL,
    "evacuationHelpers" TEXT,
    "firstAidRooms" TEXT,
    "aedLocations" TEXT,
    "alarmSignal" TEXT,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDue" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Drill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "public"."DrillKind" NOT NULL DEFAULT 'EVACUATION',
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "performedAt" TIMESTAMP(3),
    "scenario" TEXT,
    "announced" BOOLEAN NOT NULL DEFAULT true,
    "participants" INTEGER,
    "evacuationMinutes" INTEGER,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyPlan_siteId_key" ON "public"."EmergencyPlan"("siteId");

-- CreateIndex
CREATE INDEX "Drill_organizationId_plannedAt_idx" ON "public"."Drill"("organizationId", "plannedAt");

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "public"."Drill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Drill" ADD CONSTRAINT "Drill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Drill" ADD CONSTRAINT "Drill_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
