/**
 * Types describing the student career profile. Shared between the API
 * (response/request shapes) and the web app (form state) so both sides of
 * the contract change together.
 */

export type WorkModePreference = "REMOTE" | "HYBRID" | "ONSITE" | "ANY";

export type SkillCategory =
  | "LANGUAGE"
  | "FRAMEWORK"
  | "DATABASE"
  | "CLOUD"
  | "TOOL"
  | "OTHER";

export interface SkillDTO {
  id: string;
  name: string;
  category: SkillCategory;
}

export interface StudentSkillDTO extends SkillDTO {
  proficiency: number | null; // 1-5, optional self-rating
}

export interface ProjectDTO {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  url: string | null;
  startDate: string | null; // ISO date
  endDate: string | null; // ISO date, null = ongoing
}

export interface ExperienceDTO {
  id: string;
  title: string;
  organization: string;
  description: string | null;
  startDate: string; // ISO date
  endDate: string | null; // null = ongoing
  isCurrent: boolean;
}

export interface CertificationDTO {
  id: string;
  name: string;
  issuer: string | null;
  issueDate: string | null; // ISO date
  url: string | null;
}

export interface StudentProfileDTO {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  location: string | null;
  college: string | null;
  degree: string | null;
  branch: string | null;
  graduationYear: number | null;
  cgpa: number | null;
  bio: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  preferredRoles: string[];
  preferredLocations: string[];
  workModePreference: WorkModePreference;
  skills: StudentSkillDTO[];
  projects: ProjectDTO[];
  experience: ExperienceDTO[];
  certifications: CertificationDTO[];
  createdAt: string;
  updatedAt: string;
}

/** Payload for partial profile updates (PATCH semantics). */
export type UpdateStudentProfileInput = Partial<
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
    | "bio"
    | "githubUrl"
    | "linkedinUrl"
    | "portfolioUrl"
    | "preferredRoles"
    | "preferredLocations"
    | "workModePreference"
  >
>;
