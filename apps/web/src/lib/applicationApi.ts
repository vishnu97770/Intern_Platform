import type {
  ApplicationDTO,
  ApplicationSearchParams,
  ApplicationStatus,
  PaginatedResult,
  UpdateApplicationStatusInput,
} from "@intern-platform/shared";
import { apiRequest } from "./apiClient";

export function listApplications(params: ApplicationSearchParams = {}): Promise<PaginatedResult<ApplicationDTO>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const qs = query.toString();
  return apiRequest<PaginatedResult<ApplicationDTO>>(`/applications${qs ? `?${qs}` : ""}`);
}

export const getApplication = (id: string) => apiRequest<ApplicationDTO>(`/applications/${id}`);

export const createApplication = (internshipId: string) =>
  apiRequest<ApplicationDTO>("/applications", { method: "POST", body: { internshipId } });

export const updateApplicationStatus = (id: string, input: UpdateApplicationStatusInput) =>
  apiRequest<ApplicationDTO>(`/applications/${id}/status`, { method: "PATCH", body: input });

export const deleteApplication = (id: string) => apiRequest<void>(`/applications/${id}`, { method: "DELETE" });

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "DISCOVERED",
  "ELIGIBLE",
  "QUEUED",
  "APPLYING",
  "APPLIED",
  "FAILED",
  "MANUAL_ACTION_REQUIRED",
  "REJECTED",
  "INTERVIEW",
  "OFFER",
  "WITHDRAWN",
];
