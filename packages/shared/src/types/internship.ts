/**
 * Types for the Phase 3 internship discovery system: providers fetch raw
 * listings (see interfaces/InternshipProvider.ts), the ingestion pipeline
 * normalizes + deduplicates + stores them, and these DTOs are what the API
 * and web app exchange.
 */
import type { SkillCategory } from "./profile.js";

export type InternshipWorkMode = "REMOTE" | "HYBRID" | "ONSITE";

export interface InternshipSkillDTO {
  id: string;
  name: string;
  category: SkillCategory;
  isRequired: boolean;
}

export interface InternshipSummaryDTO {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: InternshipWorkMode | null;
  stipendMin: number | null;
  stipendMax: number | null;
  stipendCurrency: string | null;
  durationMonths: number | null;
  applicationDeadline: string | null; // ISO date
  source: string; // provider display name
  sourceUrl: string;
  applicationUrl: string;
  discoveredAt: string;
  updatedAt: string;
  requiredSkills: string[];
  preferredSkills: string[];
}

export interface InternshipDetailDTO extends InternshipSummaryDTO {
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  eligibility: string | null;
  minGraduationYear: number | null;
  maxGraduationYear: number | null;
  minExperienceMonths: number | null;
}

export type InternshipSortBy = "recent" | "deadline" | "stipend";

export interface InternshipSearchParams {
  q?: string;
  location?: string;
  workMode?: InternshipWorkMode;
  skill?: string;
  minStipend?: number;
  page?: number;
  pageSize?: number;
  sortBy?: InternshipSortBy;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IngestionResultDTO {
  provider: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}
