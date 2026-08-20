import type { ApplicationResult, ApplicationSubmission } from "../types/future.js";

/**
 * Submits an application through a specific, technically and contractually
 * supported integration (e.g. an official partner API). If no supported
 * integration exists for an internship, the platform must surface "Manual
 * application required" with the official application URL instead of
 * attempting one — see PROJECT_PLAN.md non-goals. Implemented starting
 * Phase 6, and only for providers with a legitimate application channel.
 */
export interface ApplicationProvider {
  readonly slug: string;

  /** Whether this provider can submit to the given application URL/domain. */
  supports(applicationUrl: string): boolean;

  submit(submission: ApplicationSubmission): Promise<ApplicationResult>;
}
