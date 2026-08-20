/**
 * Forward-looking contract types referenced by the Phase 2+ interfaces
 * below. These are NOT backed by database tables yet — they exist so the
 * interfaces in `interfaces/` can be defined now (per the architecture
 * plan) without later phases needing to reshape Phase 1 modules. Expect
 * these shapes to be refined as each phase is actually implemented.
 */

import type { SkillCategory, WorkModePreference } from "./profile.js";

/** Best-effort structured data extracted from an uploaded resume file. */
export interface ParsedResume {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  college: string | null;
  degree: string | null;
  branch: string | null;
  graduationYear: number | null;
  cgpa: number | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  /** Categorized so a confirmed skill maps directly onto Skill.category (languages, frameworks, databases, ...). */
  skills: Array<{ name: string; category: SkillCategory }>;
  projects: Array<{
    title: string;
    description: string | null;
    techStack: string[];
  }>;
  experience: Array<{
    title: string;
    organization: string;
    description: string | null;
  }>;
  certifications: Array<{ name: string; issuer: string | null }>;
  /** Raw extracted text, kept for audit/debugging and re-parsing. */
  rawText: string;
  /** 0-1 confidence the parser has in this extraction, for UI review prompts. */
  confidence: number;
}

/** Requirements extracted or provided for a single internship posting. */
export interface ParsedJobRequirements {
  requiredSkills: string[];
  preferredSkills: string[];
  minGraduationYear: number | null;
  maxGraduationYear: number | null;
  minExperienceMonths: number | null;
  workMode: WorkModePreference | null;
  locations: string[];
}

export interface MatchBreakdown {
  skillMatch: number; // 0-100
  educationMatch: number;
  experienceMatch: number;
  locationMatch: number;
  roleMatch: number;
}

export interface MatchExplanation {
  strongMatches: string[]; // e.g. "Go", "Python"
  missing: string[]; // required/preferred items not found
  concerns: string[]; // human-readable warnings, e.g. experience gap
}

export interface MatchResultDTO {
  internshipId: string;
  overallScore: number; // 0-100
  breakdown: MatchBreakdown;
  explanation: MatchExplanation;
}

export interface RawInternshipListing {
  externalId: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  applicationUrl: string;
  sourceUrl: string;
  postedAt: string | null;
  raw: unknown;
}

export interface ApplicationSubmission {
  internshipExternalId: string;
  applicationUrl: string;
  resumeFileUrl: string;
  coverLetter: string | null;
}

export interface ApplicationResult {
  success: boolean;
  providerReference: string | null;
  failureReason: string | null;
}
