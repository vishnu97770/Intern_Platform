import type { ParsedResume, ResumeParser } from "@intern-platform/shared";
import { logger } from "../../../lib/logger.js";
import { isLlmEnabled } from "../../../lib/llm/llmClient.js";
import { DeterministicResumeParser } from "./deterministicResumeParser.js";
import { LlmResumeParser } from "./llmResumeParser.js";

/**
 * Tries the LLM-backed parser first when at least one provider is
 * configured (see lib/llm/llmClient.ts), falling back to the
 * deterministic parser on any failure — malformed model output, every
 * provider unavailable, or LLM parsing disabled entirely (including
 * always in NODE_ENV=test, so the test suite never depends on live API
 * calls). The deterministic parser never throws, so it's always the
 * guaranteed final result: a resume upload never fails outright because
 * of a provider outage.
 */
class FallbackResumeParser implements ResumeParser {
  readonly name = "fallback-v1";
  private readonly llm = new LlmResumeParser();
  private readonly deterministic = new DeterministicResumeParser();

  supports(mimeType: string): boolean {
    return this.deterministic.supports(mimeType);
  }

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedResume> {
    if (isLlmEnabled()) {
      try {
        return await this.llm.parse(fileBuffer, mimeType);
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : "unknown error" },
          "LLM resume parsing failed; falling back to deterministic parser",
        );
      }
    }
    return this.deterministic.parse(fileBuffer, mimeType);
  }
}

export const resumeParser: ResumeParser = new FallbackResumeParser();
