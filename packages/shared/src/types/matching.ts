/** Types for the Phase 4 matching engine — see interfaces/MatchingEngine.ts. */
import type { MatchResultDTO } from "./future.js";
import type { InternshipSummaryDTO } from "./internship.js";

/** A persisted match result — same shape MatchingEngine.score() returns, plus when it was computed. */
export interface MatchResultRecordDTO extends MatchResultDTO {
  computedAt: string;
}

export interface RecommendationDTO extends MatchResultRecordDTO {
  internship: InternshipSummaryDTO;
}

export interface RecommendationsQuery {
  minScore?: number;
  page?: number;
  pageSize?: number;
}
