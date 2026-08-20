-- CreateTable
CREATE TABLE "auto_apply_rules" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minMatchScore" INTEGER NOT NULL DEFAULT 80,
    "maxApplicationsPerDay" INTEGER NOT NULL DEFAULT 5,
    "preferredRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireManualApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_apply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auto_apply_rules_studentProfileId_key" ON "auto_apply_rules"("studentProfileId");

-- AddForeignKey
ALTER TABLE "auto_apply_rules" ADD CONSTRAINT "auto_apply_rules_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
