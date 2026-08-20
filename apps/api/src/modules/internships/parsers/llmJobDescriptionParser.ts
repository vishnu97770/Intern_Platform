import { z } from "zod";
import type { JobDescriptionParser, ParsedJobRequirements } from "@intern-platform/shared";
import { lookupSkill } from "../../../lib/skills/skillsDictionary.js";
import { requestJsonCompletion } from "../../../lib/llm/llmClient.js";

/**
 * LLM-backed JobDescriptionParser (see packages/shared), using the same
 * cascading Groq → Together → OpenRouter client as the resume parser.
 * Only ever used through parsers/index.ts's fallback wrapper, which falls
 * back to the deterministic parser on any failure.
 *
 * Skill names are resolved against our skills dictionary and only kept
 * when they match a known skill — same policy as the deterministic
 * parser — so ingestion (internship.ingestion.service.ts, which upserts a
 * Skill row per name) never creates a duplicate, differently-cased Skill
 * for what's really the same skill the model just phrased differently.
 */

const SYSTEM_PROMPT = `You extract structured hiring requirements from an internship posting's plain text. Respond with ONLY a single valid JSON object (no prose, no markdown code fences) matching exactly this shape:
{
  "requiredSkills": string[],
  "preferredSkills": string[],
  "minGraduationYear": number|null,
  "maxGraduationYear": number|null,
  "minExperienceMonths": number|null,
  "workMode": "REMOTE"|"HYBRID"|"ONSITE"|null,
  "locations": string[],
  "stipendMin": number|null,
  "stipendMax": number|null,
  "stipendCurrency": string|null,
  "durationMonths": number|null,
  "applicationDeadline": string|null
}
Only extract information explicitly stated in the text. Never invent a value — use null (or an empty array) when something isn't stated. applicationDeadline must be an ISO 8601 date (YYYY-MM-DD) if present, otherwise null.`;

const llmRequirementsSchema = z.object({
  requiredSkills: z.array(z.string()).catch([]),
  preferredSkills: z.array(z.string()).catch([]),
  minGraduationYear: z.number().int().min(1990).max(2100).nullable().catch(null),
  maxGraduationYear: z.number().int().min(1990).max(2100).nullable().catch(null),
  minExperienceMonths: z.number().min(0).nullable().catch(null),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]).nullable().catch(null),
  locations: z.array(z.string()).catch([]),
  stipendMin: z.number().min(0).nullable().catch(null),
  stipendMax: z.number().min(0).nullable().catch(null),
  stipendCurrency: z.string().nullable().catch(null),
  durationMonths: z.number().min(0).nullable().catch(null),
  applicationDeadline: z.string().nullable().catch(null),
});

/** Keeps only dictionary-recognized skills, mapped to their canonical name — mirrors the deterministic parser's behavior exactly. */
function resolveKnownSkills(names: string[]): string[] {
  const canonical = new Set<string>();
  for (const name of names) {
    const match = lookupSkill(name);
    if (match) canonical.add(match.name);
  }
  return [...canonical];
}

function normalizeDeadline(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const MAX_PROMPT_CHARS = 8000;

export class LlmJobDescriptionParser implements JobDescriptionParser {
  readonly name = "llm-cascade-v1";

  async parse(rawDescription: string): Promise<ParsedJobRequirements> {
    if (!rawDescription.trim()) {
      throw new Error("Empty description");
    }

    const completion = await requestJsonCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: rawDescription.slice(0, MAX_PROMPT_CHARS),
    });

    const parsed = llmRequirementsSchema.parse(completion);
    const preferredSkills = resolveKnownSkills(parsed.preferredSkills);
    const requiredSkills = resolveKnownSkills(parsed.requiredSkills).filter((s) => !preferredSkills.includes(s));

    return {
      requiredSkills,
      preferredSkills,
      minGraduationYear: parsed.minGraduationYear,
      maxGraduationYear: parsed.maxGraduationYear,
      minExperienceMonths: parsed.minExperienceMonths,
      workMode: parsed.workMode,
      locations: parsed.locations.slice(0, 20).map((l) => l.slice(0, 100)),
      stipendMin: parsed.stipendMin,
      stipendMax: parsed.stipendMax,
      stipendCurrency: parsed.stipendCurrency,
      durationMonths: parsed.durationMonths,
      applicationDeadline: normalizeDeadline(parsed.applicationDeadline),
    };
  }
}
