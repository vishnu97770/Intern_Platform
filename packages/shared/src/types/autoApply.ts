/**
 * Types for the Phase 6 authorized auto-apply engine. Every decision the
 * engine makes is traceable: `AutoApplyEvaluationDTO.checks` records the
 * pass/fail result of every gate in the checklist (PROJECT_PLAN.md),
 * in order, for every internship considered on a run.
 */
import type { ApplicationStatus } from "./application.js";
import type { InternshipSummaryDTO } from "./internship.js";

export interface AutoApplyRuleDTO {
  isEnabled: boolean;
  minMatchScore: number;
  maxApplicationsPerDay: number;
  preferredRoles: string[];
  preferredLocations: string[];
  excludedCompanies: string[];
  /** When true, an eligible+supported match is queued but never auto-submitted until POST /auto-apply/queue/:applicationId/approve. */
  requireManualApproval: boolean;
  updatedAt: string;
}

export type UpdateAutoApplyRuleInput = Partial<Omit<AutoApplyRuleDTO, "updatedAt">>;

export type AutoApplyCheckId =
  | "AUTO_APPLY_ENABLED"
  | "MATCH_SCORE"
  | "ELIGIBLE"
  | "PREFERRED_ROLE"
  | "PREFERRED_LOCATION"
  | "EXCLUDED_COMPANY"
  | "DAILY_LIMIT"
  | "ALREADY_APPLIED"
  | "SUPPORTED_PROVIDER";

export interface AutoApplyCheckResult {
  id: AutoApplyCheckId;
  passed: boolean;
  detail: string;
}

export type AutoApplyOutcome = "QUEUED" | "MANUAL_ACTION_REQUIRED" | "SKIPPED";

export interface AutoApplyEvaluationDTO {
  internshipId: string;
  internship: InternshipSummaryDTO;
  matchScore: number;
  checks: AutoApplyCheckResult[];
  outcome: AutoApplyOutcome;
  applicationId: string | null;
}

export interface AutoApplyRunResultDTO {
  ruleSnapshot: AutoApplyRuleDTO;
  evaluated: number;
  queued: number;
  manualActionRequired: number;
  skipped: number;
  evaluations: AutoApplyEvaluationDTO[];
}

export interface AutoApplyQueueItemDTO {
  applicationId: string;
  internship: InternshipSummaryDTO;
  status: ApplicationStatus;
  matchScore: number | null;
  updatedAt: string;
}

export interface AutoApplyQueueStatusDTO {
  items: AutoApplyQueueItemDTO[];
  countByStatus: Partial<Record<ApplicationStatus, number>>;
}
