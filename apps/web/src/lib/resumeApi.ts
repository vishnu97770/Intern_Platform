import type { ConfirmResumeInput, ResumeDetailDTO, ResumeDTO, StudentProfileDTO } from "@intern-platform/shared";
import { apiRequest, apiRequestBlob, apiUpload } from "./apiClient";

export const listResumes = () => apiRequest<ResumeDTO[]>("/resume");

export const getResume = (id: string) => apiRequest<ResumeDetailDTO>(`/resume/${id}`);

export function uploadResume(file: File): Promise<ResumeDetailDTO> {
  const form = new FormData();
  form.append("resume", file);
  return apiUpload<ResumeDetailDTO>("/resume/upload", form);
}

export const confirmResume = (id: string, input: ConfirmResumeInput) =>
  apiRequest<{ resume: ResumeDetailDTO; profile: StudentProfileDTO }>(`/resume/${id}/confirm`, {
    method: "POST",
    body: input,
  });

export const deleteResume = (id: string) => apiRequest<void>(`/resume/${id}`, { method: "DELETE" });

export const getResumeFileBlob = (id: string) => apiRequestBlob(`/resume/${id}/file`);
