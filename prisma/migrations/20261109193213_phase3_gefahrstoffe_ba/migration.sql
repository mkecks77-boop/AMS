-- CreateEnum
CREATE TYPE "public"."SubstanceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PHASED_OUT');

-- CreateEnum
CREATE TYPE "public"."SignalWord" AS ENUM ('DANGER', 'WARNING', 'NONE');

-- CreateEnum
CREATE TYPE "public"."InstructionType" AS ENUM ('HAZARDOUS_SUBSTANCE', 'MACHINE', 'ACTIVITY', 'BIOLOGICAL', 'PPE');

-- CreateEnum
CREATE TYPE "public"."InstructionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'RELEASED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "public"."HazardousSubstance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "casNumber" TEXT,
    "usage" TEXT,
    "pictograms" TEXT[],
    "signalWord" "public"."SignalWord" NOT NULL DEFAULT 'NONE',
    "hStatements" TEXT[],
    "pStatements" TEXT[],
    "storageClass" TEXT,
    "waterHazardClass" TEXT,
    "sdsDate" TIMESTAMP(3),
    "sdsReviewDue" TIMESTAMP(3),
    "ppe" TEXT,
    "substitutionChecked" BOOLEAN NOT NULL DEFAULT false,
    "substitutionNotes" TEXT,
    "status" "public"."SubstanceStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardousSubstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubstanceUse" (
    "id" TEXT NOT NULL,
    "substanceId" TEXT NOT NULL,
    "siteId" TEXT,
    "workArea" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubstanceUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OperatingInstruction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "type" "public"."InstructionType" NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "hazards" TEXT NOT NULL DEFAULT '',
    "protectiveMeasures" TEXT NOT NULL DEFAULT '',
    "malfunctions" TEXT NOT NULL DEFAULT '',
    "firstAid" TEXT NOT NULL DEFAULT '',
    "maintenance" TEXT NOT NULL DEFAULT '',
    "pictograms" TEXT[],
    "emergencyPhone" TEXT,
    "postings" TEXT,
    "status" "public"."InstructionStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "lastEditorId" TEXT,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "reviewDue" TIMESTAMP(3),
    "substanceId" TEXT,
    "equipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HazardousSubstance_organizationId_status_idx" ON "public"."HazardousSubstance"("organizationId", "status");

-- CreateIndex
CREATE INDEX "OperatingInstruction_organizationId_status_idx" ON "public"."OperatingInstruction"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingInstruction_seriesId_version_key" ON "public"."OperatingInstruction"("seriesId", "version");

-- AddForeignKey
ALTER TABLE "public"."HazardousSubstance" ADD CONSTRAINT "HazardousSubstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubstanceUse" ADD CONSTRAINT "SubstanceUse_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "public"."HazardousSubstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubstanceUse" ADD CONSTRAINT "SubstanceUse_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OperatingInstruction" ADD CONSTRAINT "OperatingInstruction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OperatingInstruction" ADD CONSTRAINT "OperatingInstruction_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "public"."HazardousSubstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OperatingInstruction" ADD CONSTRAINT "OperatingInstruction_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "public"."Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
