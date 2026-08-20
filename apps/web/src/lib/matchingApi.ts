import type { MatchResultRecordDTO, PaginatedResult, RecommendationDTO, RecommendationsQuery } from "@intern-platform/shared";
import { apiRequest } from "./apiClient";

export const calculateMatch = (internshipId: string) =>
  apiRequest<MatchResultRecordDTO>(`/matches/internships/${internshipId}`, { method: "POST" });

export const getMatch = (internshipId: string) => apiRequest<MatchResultRecordDTO>(`/matches/internships/${internshipId}`);

export function getRecommendations(params: RecommendationsQuery = {}): Promise<PaginatedResult<RecommendationDTO>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const qs = query.toString();
  return apiRequest<PaginatedResult<RecommendationDTO>>(`/matches/recommendations${qs ? `?${qs}` : ""}`);
}
