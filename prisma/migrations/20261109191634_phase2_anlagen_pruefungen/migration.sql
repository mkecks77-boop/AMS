-- CreateEnum
CREATE TYPE "public"."EquipmentStatus" AS ENUM ('ACTIVE', 'LOCKED', 'REPAIR', 'DECOMMISSIONED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "public"."InspectorType" AS ENUM ('COMPETENT_PERSON', 'EXTERNAL', 'ZUS', 'EXPERT');

-- CreateEnum
CREATE TYPE "public"."InspectionResult" AS ENUM ('PASSED', 'DEFECTS', 'FAILED');

-- CreateTable
CREATE TABLE "public"."Site" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personnelNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "siteId" TEXT,
    "departmentId" TEXT,
    "apprentice" BOOLEAN NOT NULL DEFAULT false,
    "entryDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Equipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inventoryNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "yearBuilt" INTEGER,
    "ceMarked" BOOLEAN NOT NULL DEFAULT false,
    "hasDeclarationOfConformity" BOOLEAN NOT NULL DEFAULT false,
    "hasOperatingManual" BOOLEAN NOT NULL DEFAULT false,
    "commissionedAt" TIMESTAMP(3),
    "siteId" TEXT,
    "location" TEXT,
    "responsibleId" TEXT,
    "status" "public"."EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EquipmentStatusChange" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "from" "public"."EquipmentStatus" NOT NULL,
    "to" "public"."EquipmentStatus" NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InspectionObligation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "legalBasis" TEXT,
    "intervalMonths" INTEGER NOT NULL,
    "inspectorType" "public"."InspectorType" NOT NULL DEFAULT 'COMPETENT_PERSON',
    "lastInspectedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inspection" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "result" "public"."InspectionResult" NOT NULL,
    "notes" TEXT,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_organizationId_name_key" ON "public"."Site"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "public"."Department"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Employee_organizationId_lastName_idx" ON "public"."Employee"("organizationId", "lastName");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_personnelNumber_key" ON "public"."Employee"("organizationId", "personnelNumber");

-- CreateIndex
CREATE INDEX "Equipment_organizationId_status_idx" ON "public"."Equipment"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_organizationId_inventoryNumber_key" ON "public"."Equipment"("organizationId", "inventoryNumber");

-- CreateIndex
CREATE INDEX "InspectionObligation_organizationId_nextDueAt_idx" ON "public"."InspectionObligation"("organizationId", "nextDueAt");

-- AddForeignKey
ALTER TABLE "public"."Site" ADD CONSTRAINT "Site_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipment" ADD CONSTRAINT "Equipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipment" ADD CONSTRAINT "Equipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipment" ADD CONSTRAINT "Equipment_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EquipmentStatusChange" ADD CONSTRAINT "EquipmentStatusChange_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "public"."Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InspectionObligation" ADD CONSTRAINT "InspectionObligation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "public"."Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inspection" ADD CONSTRAINT "Inspection_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "public"."InspectionObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
