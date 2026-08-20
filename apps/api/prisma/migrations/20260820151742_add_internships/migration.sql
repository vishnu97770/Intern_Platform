-- CreateEnum
CREATE TYPE "InternshipWorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateTable
CREATE TABLE "internship_providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internships" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "location" TEXT,
    "workMode" "InternshipWorkMode",
    "stipendMin" INTEGER,
    "stipendMax" INTEGER,
    "stipendCurrency" TEXT DEFAULT 'INR',
    "durationMonths" INTEGER,
    "applicationDeadline" TIMESTAMP(3),
    "minGraduationYear" INTEGER,
    "maxGraduationYear" INTEGER,
    "minExperienceMonths" INTEGER,
    "eligibility" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "applicationUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internship_skills" (
    "internshipId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "internship_skills_pkey" PRIMARY KEY ("internshipId","skillId")
);

-- CreateIndex
CREATE UNIQUE INDEX "internship_providers_slug_key" ON "internship_providers"("slug");

-- CreateIndex
CREATE INDEX "internships_isActive_discoveredAt_idx" ON "internships"("isActive", "discoveredAt");

-- CreateIndex
CREATE INDEX "internships_applicationDeadline_idx" ON "internships"("applicationDeadline");

-- CreateIndex
CREATE INDEX "internships_company_idx" ON "internships"("company");

-- CreateIndex
CREATE UNIQUE INDEX "internships_providerId_externalId_key" ON "internships"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "internship_skills_skillId_idx" ON "internship_skills"("skillId");

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "internship_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_skills" ADD CONSTRAINT "internship_skills_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_skills" ADD CONSTRAINT "internship_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
