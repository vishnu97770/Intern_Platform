/** Types for the Phase 5 application tracking system (manual apply flow; Phase 6 adds auto-apply). */
import type { InternshipSummaryDTO } from "./internship.js";

export type ApplicationStatus =
  | "DISCOVERED"
  | "ELIGIBLE"
  | "QUEUED"
  | "APPLYING"
  | "APPLIED"
  | "FAILED"
  | "MANUAL_ACTION_REQUIRED"
  | "REJECTED"
  | "INTERVIEW"
  | "OFFER"
  | "WITHDRAWN";

export type ApplicationMethod = "MANUAL" | "AUTO";

/** One submission attempt for an application — the audit trail behind every status change. */
export interface ApplicationAttemptDTO {
  id: string;
  attemptNumber: number;
  method: ApplicationMethod;
  status: ApplicationStatus;
  providerReference: string | null;
  failureReason: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ApplicationDTO {
  id: string;
  internship: InternshipSummaryDTO;
  matchScore: number | null;
  status: ApplicationStatus;
  method: ApplicationMethod;
  applicationUrl: string;
  appliedAt: string | null;
  failureReason: string | null;
  notes: string | null;
  attempts: ApplicationAttemptDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  internshipId: string;
}

export interface UpdateApplicationStatusInput {
  status: ApplicationStatus;
  failureReason?: string | null;
  providerReference?: string | null;
  notes?: string | null;
}

export interface ApplicationSearchParams {
  status?: ApplicationStatus[];
  page?: number;
  pageSize?: number;
  sortBy?: "recent" | "matchScore" | "deadline";
}
