import type {
  StudentProfileDTO,
  UpdateStudentProfileInput,
  SkillCategory,
} from "@intern-platform/shared";
import { apiRequest } from "./apiClient";

export const getProfile = () => apiRequest<StudentProfileDTO>("/profile");

export const updateProfile = (input: UpdateStudentProfileInput) =>
  apiRequest<StudentProfileDTO>("/profile", { method: "PATCH", body: input });

export const addSkill = (input: { name: string; category: SkillCategory; proficiency?: number | null }) =>
  apiRequest<StudentProfileDTO>("/profile/skills", { method: "POST", body: input });

export const removeSkill = (skillId: string) =>
  apiRequest<StudentProfileDTO>(`/profile/skills/${skillId}`, { method: "DELETE" });

export const addProject = (input: {
  title: string;
  description?: string | null;
  techStack: string[];
  url?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) => apiRequest<StudentProfileDTO>("/profile/projects", { method: "POST", body: input });

export const deleteProject = (projectId: string) =>
  apiRequest<StudentProfileDTO>(`/profile/projects/${projectId}`, { method: "DELETE" });

export const addExperience = (input: {
  title: string;
  organization: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
}) => apiRequest<StudentProfileDTO>("/profile/experience", { method: "POST", body: input });

export const deleteExperience = (experienceId: string) =>
  apiRequest<StudentProfileDTO>(`/profile/experience/${experienceId}`, { method: "DELETE" });

export const addCertification = (input: {
  name: string;
  issuer?: string | null;
  issueDate?: string | null;
  url?: string | null;
}) => apiRequest<StudentProfileDTO>("/profile/certifications", { method: "POST", body: input });

export const deleteCertification = (certificationId: string) =>
  apiRequest<StudentProfileDTO>(`/profile/certifications/${certificationId}`, { method: "DELETE" });
