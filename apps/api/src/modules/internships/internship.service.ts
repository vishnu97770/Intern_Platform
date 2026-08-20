import type { InternshipDetailDTO, InternshipSearchParams, InternshipSummaryDTO, PaginatedResult } from "@intern-platform/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../lib/errors.js";

/** Exported so the matching module (Phase 4) can reuse the exact same shape and mapping. */
export const internshipInclude = {
  provider: true,
  skills: { include: { skill: true } },
} satisfies Prisma.InternshipInclude;

export type InternshipWithRelations = Prisma.InternshipGetPayload<{ include: typeof internshipInclude }>;

export function toInternshipSummaryDTO(internship: InternshipWithRelations): InternshipSummaryDTO {
  return {
    id: internship.id,
    title: internship.title,
    company: internship.company,
    location: internship.location,
    workMode: internship.workMode,
    stipendMin: internship.stipendMin,
    stipendMax: internship.stipendMax,
    stipendCurrency: internship.stipendCurrency,
    durationMonths: internship.durationMonths,
    applicationDeadline: internship.applicationDeadline ? internship.applicationDeadline.toISOString() : null,
    source: internship.provider.displayName,
    sourceUrl: internship.sourceUrl,
    applicationUrl: internship.applicationUrl,
    discoveredAt: internship.discoveredAt.toISOString(),
    updatedAt: internship.updatedAt.toISOString(),
    requiredSkills: internship.skills.filter((s) => s.isRequired).map((s) => s.skill.name),
    preferredSkills: internship.skills.filter((s) => !s.isRequired).map((s) => s.skill.name),
  };
}

function toDetailDTO(internship: InternshipWithRelations): InternshipDetailDTO {
  return {
    ...toInternshipSummaryDTO(internship),
    description: internship.description,
    responsibilities: internship.responsibilities,
    requirements: internship.requirements,
    eligibility: internship.eligibility,
    minGraduationYear: internship.minGraduationYear,
    maxGraduationYear: internship.maxGraduationYear,
    minExperienceMonths: internship.minExperienceMonths,
  };
}

export async function searchInternships(params: InternshipSearchParams): Promise<PaginatedResult<InternshipSummaryDTO>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const where: Prisma.InternshipWhereInput = { isActive: true };
  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { company: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.location) where.location = { contains: params.location, mode: "insensitive" };
  if (params.workMode) where.workMode = params.workMode;
  if (params.minStipend != null) where.stipendMax = { gte: params.minStipend };
  if (params.skill) where.skills = { some: { skill: { name: { equals: params.skill, mode: "insensitive" } } } };

  const orderBy: Prisma.InternshipOrderByWithRelationInput[] =
    params.sortBy === "deadline"
      ? [{ applicationDeadline: { sort: "asc", nulls: "last" } }]
      : params.sortBy === "stipend"
        ? [{ stipendMax: { sort: "desc", nulls: "last" } }]
        : [{ discoveredAt: "desc" }];

  const [total, rows] = await Promise.all([
    prisma.internship.count({ where }),
    prisma.internship.findMany({
      where,
      include: internshipInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toInternshipSummaryDTO),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getInternshipById(id: string): Promise<InternshipDetailDTO> {
  const internship = await prisma.internship.findUnique({ where: { id }, include: internshipInclude });
  if (!internship) throw new NotFoundError("Internship not found");
  return toDetailDTO(internship);
}
