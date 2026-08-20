import type { StudentProfileDTO } from "../types/profile.js";
import type { MatchResultDTO, ParsedJobRequirements } from "../types/future.js";

/**
 * Scores how well a student profile matches an internship's requirements
 * and explains the score (never a meaningless/random number — see
 * PROJECT_PLAN.md matching engine notes). Implemented starting Phase 4.
 */
export interface MatchingEngine {
  readonly name: string;

  score(
    profile: StudentProfileDTO,
    requirements: ParsedJobRequirements,
    internshipId: string,
  ): Promise<MatchResultDTO>;
}
