import { randomUUID } from "node:crypto";
import type { ApplicationProvider, ApplicationResult, ApplicationSubmission } from "@intern-platform/shared";

/**
 * Demonstration-only ApplicationProvider, mirroring MockInternshipProvider
 * (Phase 3): it "supports" only the fabricated, non-resolvable
 * `example-careers.invalid` domain that MockInternshipProvider itself
 * generates application URLs for. `submit()` never makes a network call —
 * it's a pure local simulation, so the pipeline can be exercised
 * end-to-end (queue → submit → record result) without contacting any
 * real external site, bypassing any real security control, or scraping
 * anything.
 *
 * No real internship source has a technically/contractually supported
 * automated application channel available to this project yet. For every
 * such internship, `resolveApplicationProvider` correctly returns null and
 * the pipeline falls back to "Manual Application Required" with the
 * official link — see PROJECT_PLAN.md non-goals. Add a real provider here
 * (implementing this same interface against an official partner API) the
 * moment one becomes available; nothing else needs to change.
 */
export class MockApplicationProvider implements ApplicationProvider {
  readonly slug = "mock-demo";

  supports(applicationUrl: string): boolean {
    try {
      return new URL(applicationUrl).hostname.endsWith("example-careers.invalid");
    } catch {
      return false;
    }
  }

  async submit(_submission: ApplicationSubmission): Promise<ApplicationResult> {
    return { success: true, providerReference: `mock-submission-${randomUUID()}`, failureReason: null };
  }
}
