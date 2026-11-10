-- CreateEnum
CREATE TYPE "public"."TrainingKind" AS ENUM ('INSTRUCTION', 'COURSE');

-- CreateEnum
CREATE TYPE "public"."QualificationCategory" AS ENUM ('FIRST_AID', 'FIRE_WARDEN', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "fireWardenRate" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "firstAidRate" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "public"."TrainingTopic" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "public"."TrainingKind" NOT NULL DEFAULT 'INSTRUCTION',
    "description" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "legalBasis" TEXT,
    "intervalMonths" INTEGER NOT NULL DEFAULT 12,
    "beforeStart" BOOLEAN NOT NULL DEFAULT true,
    "instructionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingRequirement" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "departmentId" TEXT,
    "apprenticesOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TrainingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingSession" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "trainer" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingRecord" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QualificationType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "public"."QualificationCategory" NOT NULL DEFAULT 'OTHER',
    "validityMonths" INTEGER,
    "legalBasis" TEXT,

    CONSTRAINT "QualificationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Qualification" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "issuer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingTopic_organizationId_idx" ON "public"."TrainingTopic"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRequirement_topicId_departmentId_apprenticesOnly_key" ON "public"."TrainingRequirement"("topicId", "departmentId", "apprenticesOnly");

-- CreateIndex
CREATE INDEX "TrainingRecord_employeeId_topicId_idx" ON "public"."TrainingRecord"("employeeId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationType_organizationId_name_key" ON "public"."QualificationType"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Qualification_employeeId_idx" ON "public"."Qualification"("employeeId");

-- AddForeignKey
ALTER TABLE "public"."TrainingTopic" ADD CONSTRAINT "TrainingTopic_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingTopic" ADD CONSTRAINT "TrainingTopic_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "public"."OperatingInstruction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."TrainingTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingSession" ADD CONSTRAINT "TrainingSession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."TrainingTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingRecord" ADD CONSTRAINT "TrainingRecord_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."TrainingTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingRecord" ADD CONSTRAINT "TrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingRecord" ADD CONSTRAINT "TrainingRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QualificationType" ADD CONSTRAINT "QualificationType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Qualification" ADD CONSTRAINT "Qualification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."QualificationType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Qualification" ADD CONSTRAINT "Qualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
