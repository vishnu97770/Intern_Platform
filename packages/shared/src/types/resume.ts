/**
 * Types for the Phase 2 resume pipeline: upload → extract → parse →
 * propose profile data → student reviews/edits → confirms → profile
 * updated. A Resume row is never applied to the profile automatically —
 * `ConfirmResumeInput` is always an explicit, student-approved action.
 */

import type { ParsedResume } from "./future.js";
import type { SkillCategory, StudentProfileDTO } from "./profile.js";

export type ResumeStatus = "UPLOADED" | "PARSED" | "FAILED" | "CONFIRMED";

export interface ResumeDTO {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  status: ResumeStatus;
  parserName: string | null;
  confidence: number | null;
  failureReason: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full detail view, including the parser's proposed profile data for review. */
export interface ResumeDetailDTO extends ResumeDTO {
  parsedData: ParsedResume | null;
}

type ProfileFieldEdits = Partial<
  Pick<
    StudentProfileDTO,
    | "fullName"
    | "phone"
    | "location"
    | "college"
    | "degree"
    | "branch"
    | "graduationYear"
    | "cgpa"
    | "githubUrl"
    | "linkedinUrl"
    | "portfolioUrl"
  >
>;

/**
 * What the student explicitly approved after reviewing/editing the
 * proposed data — every section is optional so they can accept only part
 * of what was extracted (e.g. skills but not education).
 */
export interface ConfirmResumeInput {
  profile?: ProfileFieldEdits;
  skills?: Array<{ name: string; category: SkillCategory; proficiency?: number | null }>;
  projects?: Array<{
    title: string;
    description?: string | null;
    techStack: string[];
    url?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  experience?: Array<{
    title: string;
    organization: string;
    description?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent: boolean;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string | null;
    issueDate?: string | null;
    url?: string | null;
  }>;
}
