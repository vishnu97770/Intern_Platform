-- CreateIndex
CREATE INDEX "application_attempts_method_startedAt_idx" ON "application_attempts"("method", "startedAt");
