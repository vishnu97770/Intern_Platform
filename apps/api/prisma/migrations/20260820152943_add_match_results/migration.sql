-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "engineName" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_results_studentProfileId_overallScore_idx" ON "match_results"("studentProfileId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_studentProfileId_internshipId_key" ON "match_results"("studentProfileId", "internshipId");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
