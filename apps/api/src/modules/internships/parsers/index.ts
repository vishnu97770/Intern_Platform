import type { JobDescriptionParser, ParsedJobRequirements } from "@intern-platform/shared";
import { logger } from "../../../lib/logger.js";
import { isLlmEnabled } from "../../../lib/llm/llmClient.js";
import { DeterministicJobDescriptionParser } from "./deterministicJobDescriptionParser.js";
import { LlmJobDescriptionParser } from "./llmJobDescriptionParser.js";

/**
 * Same fallback policy as the resume parser registry
 * (resume/parsers/index.ts): try the LLM-backed parser when at least one
 * provider is configured, fall back to the deterministic parser on any
 * failure (including always in tests). Ingestion never fails outright
 * because of an LLM provider outage.
 */
class FallbackJobDescriptionParser implements JobDescriptionParser {
  readonly name = "fallback-v1";
  private readonly llm = new LlmJobDescriptionParser();
  private readonly deterministic = new DeterministicJobDescriptionParser();

  async parse(rawDescription: string): Promise<ParsedJobRequirements> {
    if (isLlmEnabled()) {
      try {
        return await this.llm.parse(rawDescription);
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : "unknown error" },
          "LLM job description parsing failed; falling back to deterministic parser",
        );
      }
    }
    return this.deterministic.parse(rawDescription);
  }
}

export const jobDescriptionParser: JobDescriptionParser = new FallbackJobDescriptionParser();
