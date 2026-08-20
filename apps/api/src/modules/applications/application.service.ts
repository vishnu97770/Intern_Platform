import type {
  ApplicationAttemptDTO,
  ApplicationDTO,
  ApplicationSearchParams,
  PaginatedResult,
} from "@intern-platform/shared";
import { Prisma } from "@prisma/client";
import type { Application, ApplicationAttempt } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { internshipInclude, toInternshipSummaryDTO, type InternshipWithRelations } from "../internships/internship.service.js";
import type { CreateApplicationBody, UpdateApplicationStatusBody } from "./application.validators.js";

const applicationInclude = {
  internship: { include: internshipInclude },
  attempts: { orderBy: { attemptNumber: "asc" } },
} satisfies Prisma.ApplicationInclude;

type ApplicationWithRelations = Application & { internship: InternshipWithRelations; attempts: ApplicationAttempt[] };

function toAttemptDTO(attempt: ApplicationAttempt): ApplicationAttemptDTO {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    method: attempt.method,
    status: attempt.status,
    providerReference: attempt.providerReference,
    failureReason: attempt.failureReason,
    startedAt: attempt.startedAt.toISOString(),
    completedAt: attempt.completedAt ? attempt.completedAt.toISOString() : null,
  };
}

function toApplicationDTO(application: ApplicationWithRelations): ApplicationDTO {
  return {
    id: application.id,
    internship: toInternshipSummaryDTO(application.internship),
    matchScore: application.matchScore,
    status: application.status,
    method: application.method,
    applicationUrl: application.applicationUrl,
    appliedAt: application.appliedAt ? application.appliedAt.toISOString() : null,
    failureReason: application.failureReason,
    notes: application.notes,
    attempts: application.attempts.map(toAttemptDTO),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

async function requireProfileId(userId: string): Promise<string> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError("Student profile not found");
  return profile.id;
}

async function requireOwnedApplication(profileId: string, applicationId: string): Promise<ApplicationWithRelations> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, studentProfileId: profileId },
    include: applicationInclude,
  });
  if (!application) throw new NotFoundError("Application not found");
  return application;
}

/** Creates a tracked application, or fails clearly if this internship is already tracked (see schema's duplicate-prevention note). */
export async function createApplication(
  userId: string,
  input: CreateApplicationBody,
  method: "MANUAL" | "AUTO" = "MANUAL",
): Promise<ApplicationDTO> {
  const profileId = await requireProfileId(userId);

  const internship = await prisma.internship.findUnique({ where: { id: input.internshipId } });
  if (!internship || !internship.isActive) throw new NotFoundError("Internship not found");

  const existing = await prisma.application.findUnique({
    where: { studentProfileId_internshipId: { studentProfileId: profileId, internshipId: internship.id } },
  });
  if (existing) throw new ConflictError("You're already tracking an application for this internship");

  const cachedMatch = await prisma.matchResult.findUnique({
    where: { studentProfileId_internshipId: { studentProfileId: profileId, internshipId: internship.id } },
    select: { overallScore: true },
  });

  const created = await prisma.application.create({
    data: {
      studentProfileId: profileId,
      internshipId: internship.id,
      applicationUrl: internship.applicationUrl,
      matchScore: cachedMatch?.overallScore ?? null,
      status: "DISCOVERED",
      method,
    },
    include: applicationInclude,
  });

  return toApplicationDTO(created);
}

export async function listApplications(userId: string, params: ApplicationSearchParams): Promise<PaginatedResult<ApplicationDTO>> {
  const profileId = await requireProfileId(userId);
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const where: Prisma.ApplicationWhereInput = { studentProfileId: profileId };
  if (params.status && params.status.length > 0) where.status = { in: params.status };

  const orderBy: Prisma.ApplicationOrderByWithRelationInput[] =
    params.sortBy === "matchScore"
      ? [{ matchScore: { sort: "desc", nulls: "last" } }]
      : params.sortBy === "deadline"
        ? [{ internship: { applicationDeadline: "asc" } }]
        : [{ createdAt: "desc" }];

  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({ where, include: applicationInclude, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return {
    items: rows.map(toApplicationDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getApplication(userId: string, applicationId: string): Promise<ApplicationDTO> {
  const profileId = await requireProfileId(userId);
  const application = await requireOwnedApplication(profileId, applicationId);
  return toApplicationDTO(application);
}

/**
 * Records a new attempt and updates the application's current status —
 * used for both manual status changes here (Phase 5) and the auto-apply
 * worker's outcomes (Phase 6), so every status change stays traceable.
 */
export async function updateApplicationStatus(
  userId: string,
  applicationId: string,
  input: UpdateApplicationStatusBody,
  method: "MANUAL" | "AUTO" = "MANUAL",
): Promise<ApplicationDTO> {
  const profileId = await requireProfileId(userId);
  const application = await requireOwnedApplication(profileId, applicationId);

  const isFailureStatus = input.status === "FAILED" || input.status === "MANUAL_ACTION_REQUIRED";

  await prisma.applicationAttempt.create({
    data: {
      applicationId: application.id,
      attemptNumber: application.attempts.length + 1,
      method,
      status: input.status,
      providerReference: input.providerReference ?? null,
      failureReason: isFailureStatus ? (input.failureReason ?? null) : null,
      completedAt: new Date(),
    },
  });

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: input.status,
      appliedAt: input.status === "APPLIED" ? (application.appliedAt ?? new Date()) : application.appliedAt,
      failureReason: isFailureStatus ? (input.failureReason ?? application.failureReason) : null,
      notes: input.notes !== undefined ? input.notes : application.notes,
    },
    include: applicationInclude,
  });

  return toApplicationDTO(updated);
}

export async function deleteApplication(userId: string, applicationId: string): Promise<void> {
  const profileId = await requireProfileId(userId);
  const application = await requireOwnedApplication(profileId, applicationId);
  await prisma.application.delete({ where: { id: application.id } });
}
