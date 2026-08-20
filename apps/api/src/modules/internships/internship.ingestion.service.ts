import type { IngestionResultDTO, InternshipProvider as InternshipProviderContract, RawInternshipListing } from "@intern-platform/shared";
import type { InternshipProvider as InternshipProviderRow, InternshipWorkMode } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { lookupSkill } from "../../lib/skills/skillsDictionary.js";
import { internshipProviders } from "./providers/index.js";
import { DeterministicJobDescriptionParser } from "./parsers/deterministicJobDescriptionParser.js";

/**
 * Ingestion pipeline: fetch → normalize → deduplicate → store. One
 * provider's failure never aborts the run for the others (see
 * `ingestAllProviders`) — each provider's errors are recorded on its own
 * IngestionResultDTO instead.
 */
const jobDescriptionParser = new DeterministicJobDescriptionParser();

async function ensureProviderRow(provider: InternshipProviderContract): Promise<InternshipProviderRow> {
  return prisma.internshipProvider.upsert({
    where: { slug: provider.slug },
    update: { displayName: provider.displayName, isActive: true },
    create: { slug: provider.slug, displayName: provider.displayName },
  });
}

async function ensureSkillId(name: string): Promise<string> {
  const category = lookupSkill(name)?.category ?? "OTHER";
  const skill = await prisma.skill.upsert({ where: { name }, create: { name, category }, update: {} });
  return skill.id;
}

/** Internship.workMode has no "ANY" — that's only a meaningful *preference*, never an actual posting's mode. */
function toInternshipWorkMode(workMode: string | null): InternshipWorkMode | null {
  return workMode === "REMOTE" || workMode === "HYBRID" || workMode === "ONSITE" ? workMode : null;
}

async function ingestListing(providerRow: InternshipProviderRow, listing: RawInternshipListing): Promise<"created" | "updated"> {
  const requirements = await jobDescriptionParser.parse(listing.description);

  const data = {
    title: listing.title.trim(),
    company: listing.company.trim(),
    description: listing.description.trim(),
    location: listing.location?.trim() || requirements.locations[0] || null,
    workMode: toInternshipWorkMode(requirements.workMode),
    stipendMin: requirements.stipendMin,
    stipendMax: requirements.stipendMax,
    stipendCurrency: requirements.stipendCurrency,
    durationMonths: requirements.durationMonths,
    applicationDeadline: requirements.applicationDeadline ? new Date(requirements.applicationDeadline) : null,
    minGraduationYear: requirements.minGraduationYear,
    maxGraduationYear: requirements.maxGraduationYear,
    minExperienceMonths: requirements.minExperienceMonths,
    requirements: requirements.requiredSkills.length > 0 ? requirements.requiredSkills.join(", ") : null,
    sourceUrl: listing.sourceUrl,
    applicationUrl: listing.applicationUrl,
    isActive: true,
  };

  const existing = await prisma.internship.findUnique({
    where: { providerId_externalId: { providerId: providerRow.id, externalId: listing.externalId } },
    select: { id: true },
  });

  const internship = await prisma.internship.upsert({
    where: { providerId_externalId: { providerId: providerRow.id, externalId: listing.externalId } },
    create: { providerId: providerRow.id, externalId: listing.externalId, ...data },
    update: data,
  });

  // Recompute skill links from the latest parse rather than diffing —
  // ingestion runs infrequently enough that a full replace is simple and
  // correct without risking stale required/preferred flags.
  await prisma.internshipSkill.deleteMany({ where: { internshipId: internship.id } });
  const skillRefs = [
    ...requirements.requiredSkills.map((name) => ({ name, isRequired: true })),
    ...requirements.preferredSkills.map((name) => ({ name, isRequired: false })),
  ];
  if (skillRefs.length > 0) {
    const rows = await Promise.all(
      skillRefs.map(async ({ name, isRequired }) => ({
        internshipId: internship.id,
        skillId: await ensureSkillId(name),
        isRequired,
      })),
    );
    await prisma.internshipSkill.createMany({ data: rows, skipDuplicates: true });
  }

  return existing ? "updated" : "created";
}

export async function ingestProvider(provider: InternshipProviderContract): Promise<IngestionResultDTO> {
  const providerRow = await ensureProviderRow(provider);
  const result: IngestionResultDTO = { provider: provider.slug, fetched: 0, created: 0, updated: 0, skipped: 0, errors: [] };

  let listings: RawInternshipListing[];
  try {
    listings = await provider.fetchListings();
  } catch (err) {
    logger.error({ provider: provider.slug, err: err instanceof Error ? err.message : "unknown error" }, "Internship provider fetch failed");
    result.errors.push(err instanceof Error ? err.message : "Failed to fetch listings");
    return result;
  }

  result.fetched = listings.length;

  for (const listing of listings) {
    try {
      const outcome = await ingestListing(providerRow, listing);
      if (outcome === "created") result.created += 1;
      else result.updated += 1;
    } catch (err) {
      logger.warn(
        { provider: provider.slug, externalId: listing.externalId, err: err instanceof Error ? err.message : "unknown error" },
        "Failed to ingest internship listing",
      );
      result.skipped += 1;
      result.errors.push(`${listing.externalId}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return result;
}

export async function ingestAllProviders(): Promise<IngestionResultDTO[]> {
  const results: IngestionResultDTO[] = [];
  for (const provider of internshipProviders) {
    results.push(await ingestProvider(provider));
  }
  return results;
}
