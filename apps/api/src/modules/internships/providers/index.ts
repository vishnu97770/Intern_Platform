import type { InternshipProvider } from "@intern-platform/shared";
import { MockInternshipProvider } from "./mockInternshipProvider.js";

/**
 * Every registered internship source. Add a real provider (an official
 * partner API, a permitted feed) here alongside — or instead of — the mock
 * once credentials are available; nothing else in the ingestion pipeline
 * needs to change (see PROJECT_PLAN.md InternshipProvider abstraction).
 */
export const internshipProviders: InternshipProvider[] = [new MockInternshipProvider()];
