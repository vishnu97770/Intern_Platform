import type {
  ApplicationDTO,
  AutoApplyEvaluationDTO,
  AutoApplyOutcome,
  AutoApplyQueueStatusDTO,
  AutoApplyRunResultDTO,
  ApplicationStatus,
} from "@intern-platform/shared";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import * as profileService from "../profile/profile.service.js";
import * as applicationService from "../applications/application.service.js";
import * as matchingService from "../matching/matching.service.js";
import { internshipInclude, toInternshipSummaryDTO } from "../internships/internship.service.js";
import { getRule } from "./autoApplyRule.service.js";
import { evaluateAutoApplyEligibility } from "./autoApplyEligibility.js";
import { resolveApplicationProvider } from "./providers/index.js";
import { enqueueSubmission } from "../../jobs/autoApplyQueue.js";

async function requireProfileId(userId: string): Promise<string> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError("Student profile not found");
  return profile.id;
}

async function countAutoAttemptsToday(profileId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.applicationAttempt.count({
    where: { method: "AUTO", startedAt: { gte: startOfDay }, application: { studentProfileId: profileId } },
  });
}

/**
 * Runs the full checklist (PROJECT_PLAN.md) against every active
 * internship for one student, and acts on the result: eligible +
 * provider-supported → tracked as QUEUED (and submitted immediately
 * unless the rule requires manual approval); eligible but
 * unsupported → tracked as MANUAL_ACTION_REQUIRED; anything else →
 * left untouched (SKIPPED, not tracked). Every outcome is returned with
 * its full check-by-check trace.
 */
export async function runAutoApplyForStudent(userId: string): Promise<AutoApplyRunResultDTO> {
  const profileId = await requireProfileId(userId);
  const profile = await profileService.getProfile(userId);
  const rule = await getRule(userId);

  const internships = await prisma.internship.findMany({ where: { isActive: true }, include: internshipInclude });
  const tracked = await prisma.application.findMany({ where: { studentProfileId: profileId }, select: { internshipId: true } });
  const trackedIds = new Set(tracked.map((a) => a.internshipId));

  let appliedTodayCount = await countAutoAttemptsToday(profileId);

  const evaluations: AutoApplyEvaluationDTO[] = [];
  let queued = 0;
  let manualActionRequired = 0;
  let skipped = 0;

  for (const internship of internships) {
    const match = await matchingService.calculateMatch(userId, internship.id);
    const supportedProvider = resolveApplicationProvider(internship.applicationUrl) !== null;

    const checks = evaluateAutoApplyEligibility({
      rule,
      matchScore: match.overallScore,
      internship: {
        title: internship.title,
        company: internship.company,
        location: internship.location,
        workMode: internship.workMode,
        minGraduationYear: internship.minGraduationYear,
        maxGraduationYear: internship.maxGraduationYear,
      },
      graduationYear: profile.graduationYear,
      appliedTodayCount,
      alreadyTracked: trackedIds.has(internship.id),
      supportedProvider,
    });

    const blocking = checks.filter((c) => c.id !== "SUPPORTED_PROVIDER");
    const eligible = blocking.every((c) => c.passed);

    let outcome: AutoApplyOutcome = "SKIPPED";
    let applicationId: string | null = null;

    if (eligible) {
      const application = await applicationService.createApplication(userId, { internshipId: internship.id }, "AUTO");
      applicationId = application.id;

      if (supportedProvider) {
        await applicationService.updateApplicationStatus(userId, application.id, { status: "QUEUED" }, "AUTO");
        outcome = "QUEUED";
        queued += 1;
        appliedTodayCount += 1; // reserve a slot so the rest of this run respects the daily limit too

        if (!rule.requireManualApproval) {
          await enqueueSubmission({ userId, applicationId: application.id });
        }
      } else {
        await applicationService.updateApplicationStatus(
          userId,
          application.id,
          { status: "MANUAL_ACTION_REQUIRED", failureReason: "No supported automated application provider for this internship — use the official application link." },
          "AUTO",
        );
        outcome = "MANUAL_ACTION_REQUIRED";
        manualActionRequired += 1;
      }
      trackedIds.add(internship.id);
    } else {
      skipped += 1;
    }

    evaluations.push({
      internshipId: internship.id,
      internship: toInternshipSummaryDTO(internship),
      matchScore: match.overallScore,
      checks,
      outcome,
      applicationId,
    });
  }

  return { ruleSnapshot: rule, evaluated: evaluations.length, queued, manualActionRequired, skipped, evaluations };
}

/**
 * Actually submits one QUEUED application — called by the background
 * worker (jobs/autoApplyQueue.ts) and by the manual-approval endpoint.
 * Every outcome (success, provider failure, no supported provider) is
 * recorded as an ApplicationAttempt via applicationService, method AUTO.
 */
export async function submitQueuedApplication(userId: string, applicationId: string): Promise<ApplicationDTO> {
  const application = await applicationService.getApplication(userId, applicationId);
  if (application.status !== "QUEUED") {
    throw new ValidationError(`Cannot submit an application in status ${application.status}`);
  }

  await applicationService.updateApplicationStatus(userId, applicationId, { status: "APPLYING" }, "AUTO");

  const provider = resolveApplicationProvider(application.applicationUrl);
  if (!provider) {
    return applicationService.updateApplicationStatus(
      userId,
      applicationId,
      { status: "MANUAL_ACTION_REQUIRED", failureReason: "No supported automated application provider for this internship." },
      "AUTO",
    );
  }

  try {
    const result = await provider.submit({
      internshipExternalId: application.internship.id,
      applicationUrl: application.applicationUrl,
      resumeFileUrl: "",
      coverLetter: null,
    });

    if (result.success) {
      return applicationService.updateApplicationStatus(
        userId,
        applicationId,
        { status: "APPLIED", providerReference: result.providerReference },
        "AUTO",
      );
    }

    return applicationService.updateApplicationStatus(
      userId,
      applicationId,
      { status: "FAILED", failureReason: result.failureReason ?? "Submission failed" },
      "AUTO",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown submission error";
    await applicationService.updateApplicationStatus(userId, applicationId, { status: "FAILED", failureReason: message }, "AUTO");
    throw err; // rethrow so the background worker's retry/backoff policy applies
  }
}

/** Called by the recurring background scan (jobs/autoApplyScanQueue.ts) — one student's failure never stops the rest. */
export async function runAutoApplyForAllEnabledStudents(): Promise<void> {
  const rules = await prisma.autoApplyRule.findMany({
    where: { isEnabled: true },
    include: { studentProfile: { select: { userId: true } } },
  });

  for (const rule of rules) {
    try {
      await runAutoApplyForStudent(rule.studentProfile.userId);
    } catch (err) {
      logger.error(
        { userId: rule.studentProfile.userId, err: err instanceof Error ? err.message : "unknown error" },
        "Auto-apply scan failed for student",
      );
    }
  }
}

/** Bypasses queue processing timing and submits immediately — for the explicit human "Approve & submit" action. */
export async function approveQueuedApplication(userId: string, applicationId: string): Promise<ApplicationDTO> {
  return submitQueuedApplication(userId, applicationId);
}

export async function getQueueStatus(userId: string): Promise<AutoApplyQueueStatusDTO> {
  const profileId = await requireProfileId(userId);
  const rows = await prisma.application.findMany({
    where: { studentProfileId: profileId, method: "AUTO" },
    include: { internship: { include: internshipInclude } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const countByStatus: Partial<Record<ApplicationStatus, number>> = {};
  for (const row of rows) countByStatus[row.status] = (countByStatus[row.status] ?? 0) + 1;

  return {
    items: rows.map((row) => ({
      applicationId: row.id,
      internship: toInternshipSummaryDTO(row.internship),
      status: row.status,
      matchScore: row.matchScore,
      updatedAt: row.updatedAt.toISOString(),
    })),
    countByStatus,
  };
}
