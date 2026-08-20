-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DISCOVERED', 'ELIGIBLE', 'QUEUED', 'APPLYING', 'APPLIED', 'FAILED', 'MANUAL_ACTION_REQUIRED', 'REJECTED', 'INTERVIEW', 'OFFER', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApplicationMethod" AS ENUM ('MANUAL', 'AUTO');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "matchScore" INTEGER,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DISCOVERED',
    "method" "ApplicationMethod" NOT NULL DEFAULT 'MANUAL',
    "applicationUrl" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_attempts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "method" "ApplicationMethod" NOT NULL,
    "status" "ApplicationStatus" NOT NULL,
    "providerReference" TEXT,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "application_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_studentProfileId_status_idx" ON "applications"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "applications_studentProfileId_createdAt_idx" ON "applications"("studentProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "applications_studentProfileId_internshipId_key" ON "applications"("studentProfileId", "internshipId");

-- CreateIndex
CREATE INDEX "application_attempts_applicationId_idx" ON "application_attempts"("applicationId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_attempts" ADD CONSTRAINT "application_attempts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
