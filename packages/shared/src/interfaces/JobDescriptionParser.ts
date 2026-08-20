import type { ParsedJobRequirements } from "../types/future.js";

/**
 * Extracts structured requirements (skills, eligibility, location/work
 * mode) from a raw internship posting's free-text description. Used when
 * an InternshipProvider only supplies unstructured text. Implemented
 * starting Phase 3/4.
 */
export interface JobDescriptionParser {
  readonly name: string;

  parse(rawDescription: string): Promise<ParsedJobRequirements>;
}
