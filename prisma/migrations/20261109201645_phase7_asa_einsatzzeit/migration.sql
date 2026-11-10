-- CreateEnum
CREATE TYPE "public"."MeetingStatus" AS ENUM ('PLANNED', 'DONE');

-- AlterTable
ALTER TABLE "public"."Action" ADD COLUMN     "asaMeetingId" TEXT;

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "sifaHoursTarget" INTEGER;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailDigest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "public"."AsaMeeting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "participants" TEXT,
    "agenda" TEXT NOT NULL DEFAULT '',
    "minutes" TEXT NOT NULL DEFAULT '',
    "status" "public"."MeetingStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsaMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsaMeeting_organizationId_date_idx" ON "public"."AsaMeeting"("organizationId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_date_idx" ON "public"."TimeEntry"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "public"."Action" ADD CONSTRAINT "Action_asaMeetingId_fkey" FOREIGN KEY ("asaMeetingId") REFERENCES "public"."AsaMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AsaMeeting" ADD CONSTRAINT "AsaMeeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimeEntry" ADD CONSTRAINT "TimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
