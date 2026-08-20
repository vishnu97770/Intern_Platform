import type { ParsedResume } from "../types/future.js";

/**
 * Extracts structured profile data from a resume file. Implementations are
 * swappable (deterministic text-parsing, local model, hosted AI API,
 * hybrid) — no caller should depend on which one is active.
 *
 * Implemented starting Phase 2. Extracted data is always treated as a
 * suggestion: the student reviews and edits it before it becomes their
 * profile of record (see PROJECT_PLAN.md — resume pipeline).
 */
export interface ResumeParser {
  /** Human-readable identifier for logging/telemetry, e.g. "deterministic-v1". */
  readonly name: string;

  /** @param mimeType one of the mime types this parser declares support for. */
  supports(mimeType: string): boolean;

  parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedResume>;
}
