import type {
  IngestionResultDTO,
  InternshipDetailDTO,
  InternshipSearchParams,
  InternshipSummaryDTO,
  PaginatedResult,
} from "@intern-platform/shared";
import { apiRequest } from "./apiClient";

export function searchInternships(params: InternshipSearchParams): Promise<PaginatedResult<InternshipSummaryDTO>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return apiRequest<PaginatedResult<InternshipSummaryDTO>>(`/internships${qs ? `?${qs}` : ""}`);
}

export const getInternship = (id: string) => apiRequest<InternshipDetailDTO>(`/internships/${id}`);

export const syncInternships = () => apiRequest<IngestionResultDTO[]>("/internships/sync", { method: "POST" });
