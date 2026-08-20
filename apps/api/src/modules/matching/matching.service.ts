import type {
  MatchBreakdown,
  MatchExplanation,
  MatchResultRecordDTO,
  ParsedJobRequirements,
  RecommendationDTO,
  RecommendationsQuery,
  PaginatedResult,
} from "@intern-platform/shared";
import type { MatchResult, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../lib/errors.js";
import * as profileService from "../profile/profile.service.js";
import { internshipInclude, toInternshipSummaryDTO, type InternshipWithRelations } from "../internships/internship.service.js";
import { DeterministicMatchingEngine } from "./deterministicMatchingEngine.js";

/** Swappable — see packages/shared MatchingEngine. */
const matchingEngine = new DeterministicMatchingEngine();

async function requireProfile(userId: string): Promise<{ profileId: string; profile: Awaited<ReturnType<typeof profileService.getProfile>> }> {
  const profile = await profileService.getProfile(userId);
  return { profileId: profile.id, profile };
}

async function fetchActiveInternship(internshipId: string): Promise<InternshipWithRelations> {
  const internship = await prisma.internship.findUnique({ where: { id: internshipId }, include: internshipInclude });
  if (!internship || !internship.isActive) throw new NotFoundError("Internship not found");
  return internship;
}

/**
 * Reconstructs the requirements shape a JobDescriptionParser would have
 * produced, from what ingestion already normalized and stored — avoids
 * re-parsing the description text on every match calculation.
 */
function toParsedJobRequirements(internship: InternshipWithRelations): ParsedJobRequirements {
  return {
    title: internship.title,
    requiredSkills: internship.skills.filter((s) => s.isRequired).map((s) => s.skill.name),
    preferredSkills: internship.skills.filter((s) => !s.isRequired).map((s) => s.skill.name),
    minGraduationYear: internship.minGraduationYear,
    maxGraduationYear: internship.maxGraduationYear,
    minExperienceMonths: internship.minExperienceMonths,
    workMode: internship.workMode,
    locations: internship.location ? [internship.location] : [],
    stipendMin: internship.stipendMin,
    stipendMax: internship.stipendMax,
    stipendCurrency: internship.stipendCurrency,
    durationMonths: internship.durationMonths,
    applicationDeadline: internship.applicationDeadline ? internship.applicationDeadline.toISOString() : null,
  };
}

async function persistMatch(profileId: string, internshipId: string, result: Awaited<ReturnType<DeterministicMatchingEngine["score"]>>): Promise<MatchResult> {
  const data = {
    overallScore: result.overallScore,
    breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
    explanation: result.explanation as unknown as Prisma.InputJsonValue,
    engineName: matchingEngine.name,
  };

  return prisma.matchResult.upsert({
    where: { studentProfileId_internshipId: { studentProfileId: profileId, internshipId } },
    create: { studentProfileId: profileId, internshipId, ...data },
    update: data,
  });
}

function toMatchResultRecordDTO(row: MatchResult): MatchResultRecordDTO {
  return {
    internshipId: row.internshipId,
    overallScore: row.overallScore,
    breakdown: row.breakdown as unknown as MatchBreakdown,
    explanation: row.explanation as unknown as MatchExplanation,
    computedAt: row.computedAt.toISOString(),
  };
}

/** Forces a fresh score and persists it, overwriting any cached result. */
export async function calculateMatch(userId: string, internshipId: string): Promise<MatchResultRecordDTO> {
  const { profile, profileId } = await requireProfile(userId);
  const internship = await fetchActiveInternship(internshipId);
  const result = await matchingEngine.score(profile, toParsedJobRequirements(internship), internship.id);
  const row = await persistMatch(profileId, internship.id, result);
  return toMatchResultRecordDTO(row);
}

/** Returns the cached match if one exists, otherwise computes and caches it. */
export async function getMatch(userId: string, internshipId: string): Promise<MatchResultRecordDTO> {
  const { profileId } = await requireProfile(userId);
  const existing = await prisma.matchResult.findUnique({
    where: { studentProfileId_internshipId: { studentProfileId: profileId, internshipId } },
  });
  if (existing) return toMatchResultRecordDTO(existing);
  return calculateMatch(userId, internshipId);
}

export async function getRecommendations(userId: string, params: RecommendationsQuery): Promise<PaginatedResult<RecommendationDTO>> {
  const { profile, profileId } = await requireProfile(userId);
  const internships = await prisma.internship.findMany({ where: { isActive: true }, include: internshipInclude });

  const scored = await Promise.all(
    internships.map(async (internship) => {
      const result = await matchingEngine.score(profile, toParsedJobRequirements(internship), internship.id);
      const row = await persistMatch(profileId, internship.id, result);
      return { internship, record: toMatchResultRecordDTO(row) };
    }),
  );

  const minScore = params.minScore ?? 0;
  const ranked = scored
    .filter((s) => s.record.overallScore >= minScore)
    .sort((a, b) => b.record.overallScore - a.record.overallScore);

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const pageItems = ranked.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  const items: RecommendationDTO[] = pageItems.map(({ internship, record }) => ({
    ...record,
    internship: toInternshipSummaryDTO(internship),
  }));

  return { items, total: ranked.length, page, pageSize, totalPages: Math.max(1, Math.ceil(ranked.length / pageSize)) };
}
