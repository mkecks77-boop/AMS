-- CreateEnum
CREATE TYPE "public"."MedicalKind" AS ENUM ('MANDATORY', 'OFFER', 'WISH');

-- CreateEnum
CREATE TYPE "public"."MedicalOutcome" AS ENUM ('DONE', 'DECLINED');

-- CreateEnum
CREATE TYPE "public"."PermitType" AS ENUM ('HOT_WORK', 'CONFINED_SPACE', 'HEIGHT', 'ELECTRICAL', 'EXCAVATION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PermitStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ComplianceStatus" AS ENUM ('NOT_EVALUATED', 'FULFILLED', 'PARTIAL', 'NOT_FULFILLED', 'NOT_RELEVANT');

-- AlterTable
ALTER TABLE "public"."Action" ADD COLUMN     "legalRequirementId" TEXT;

-- CreateTable
CREATE TABLE "public"."MedicalCheckType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."MedicalKind" NOT NULL,
    "reason" TEXT,
    "intervalMonths" INTEGER NOT NULL DEFAULT 36,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MedicalCheckType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicalRequirement" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "departmentId" TEXT,

    CONSTRAINT "MedicalRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicalRecord" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "outcome" "public"."MedicalOutcome" NOT NULL DEFAULT 'DONE',
    "nextDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contractor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "insuranceUntil" TIMESTAMP(3),
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContractorWorker" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "briefedAt" TIMESTAMP(3),
    "briefedUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "public"."PermitType" NOT NULL,
    "siteId" TEXT,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contractorId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "status" "public"."PermitStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "checks" TEXT[],
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "fireWatchUntil" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PermitWorker" (
    "permitId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,

    CONSTRAINT "PermitWorker_pkey" PRIMARY KEY ("permitId","workerId")
);

-- CreateTable
CREATE TABLE "public"."LegalRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "law" TEXT NOT NULL,
    "reference" TEXT,
    "obligation" TEXT NOT NULL,
    "status" "public"."ComplianceStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
    "evidence" TEXT,
    "responsibleId" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "reviewDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalCheckType_organizationId_name_key" ON "public"."MedicalCheckType"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRequirement_typeId_departmentId_key" ON "public"."MedicalRequirement"("typeId", "departmentId");

-- CreateIndex
CREATE INDEX "MedicalRecord_employeeId_typeId_idx" ON "public"."MedicalRecord"("employeeId", "typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_organizationId_name_key" ON "public"."Contractor"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_organizationId_number_key" ON "public"."Permit"("organizationId", "number");

-- CreateIndex
CREATE INDEX "LegalRequirement_organizationId_area_idx" ON "public"."LegalRequirement"("organizationId", "area");

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_legalRequirementId_fkey" FOREIGN KEY ("legalRequirementId") REFERENCES "public"."LegalRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalCheckType" ADD CONSTRAINT "MedicalCheckType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalRequirement" ADD CONSTRAINT "MedicalRequirement_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."MedicalCheckType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalRequirement" ADD CONSTRAINT "MedicalRequirement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalRecord" ADD CONSTRAINT "MedicalRecord_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."MedicalCheckType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalRecord" ADD CONSTRAINT "MedicalRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contractor" ADD CONSTRAINT "Contractor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractorWorker" ADD CONSTRAINT "ContractorWorker_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "public"."Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Permit" ADD CONSTRAINT "Permit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Permit" ADD CONSTRAINT "Permit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Permit" ADD CONSTRAINT "Permit_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "public"."Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PermitWorker" ADD CONSTRAINT "PermitWorker_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "public"."Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PermitWorker" ADD CONSTRAINT "PermitWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "public"."ContractorWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LegalRequirement" ADD CONSTRAINT "LegalRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LegalRequirement" ADD CONSTRAINT "LegalRequirement_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
