import { z } from "zod";
import type { ParsedResume, ResumeParser, SkillCategory } from "@intern-platform/shared";
import { lookupSkill } from "../../../lib/skills/skillsDictionary.js";
import { requestJsonCompletion } from "../../../lib/llm/llmClient.js";
import { DOCX_MIME_TYPE, extractResumeText, PDF_MIME_TYPE } from "./textExtraction.js";
import { computeResumeConfidence } from "./resumeConfidence.js";

/**
 * LLM-backed ResumeParser (see packages/shared) using the cascading
 * Groq → Together → OpenRouter client (lib/llm/llmClient.ts). Only ever
 * used through parsers/index.ts's fallback wrapper, which falls back to
 * the deterministic parser on any failure — this class alone never needs
 * to guarantee success.
 *
 * The model is instructed to extract only what's explicitly present and
 * never invent values; its output is still treated as untrusted input:
 * every field is validated/coerced (`.catch()` per field so one bad field
 * can't fail the whole parse) and skills are resolved against our own
 * skills dictionary rather than trusting the model's categorization, so
 * a confirmed skill always lines up with the Skill catalog the same way
 * the deterministic parser's output does.
 */

const SYSTEM_PROMPT = `You extract structured data from a resume's plain text. Respond with ONLY a single valid JSON object (no prose, no markdown code fences) matching exactly this shape:
{
  "fullName": string|null,
  "email": string|null,
  "phone": string|null,
  "location": string|null,
  "college": string|null,
  "degree": string|null,
  "branch": string|null,
  "graduationYear": number|null,
  "cgpa": number|null,
  "githubUrl": string|null,
  "linkedinUrl": string|null,
  "portfolioUrl": string|null,
  "skills": string[],
  "projects": [{"title": string, "description": string|null, "techStack": string[]}],
  "experience": [{"title": string, "organization": string, "description": string|null}],
  "certifications": [{"name": string, "issuer": string|null}]
}
Only extract information explicitly present in the text. Never invent, guess, or embellish a value — use null (or an empty array) when something isn't present. cgpa must be on a 0-10 scale if present.`;

// Every leaf uses .catch() so one malformed field degrades gracefully to a
// safe default instead of failing the entire response — malformed model
// output is expected occasionally, not a reason to throw away everything.
const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .catch(null);

const llmResumeSchema = z.object({
  fullName: optionalTrimmedString,
  email: optionalTrimmedString,
  phone: optionalTrimmedString,
  location: optionalTrimmedString,
  college: optionalTrimmedString,
  degree: optionalTrimmedString,
  branch: optionalTrimmedString,
  graduationYear: z.number().int().min(1990).max(2035).nullable().catch(null),
  cgpa: z.number().min(0).max(10).nullable().catch(null),
  githubUrl: optionalTrimmedString,
  linkedinUrl: optionalTrimmedString,
  portfolioUrl: optionalTrimmedString,
  skills: z.array(z.string()).catch([]),
  projects: z
    .array(
      z.object({
        title: z.string().catch("Untitled project"),
        description: z.string().nullable().catch(null),
        techStack: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
  experience: z
    .array(
      z.object({
        title: z.string().catch("Role"),
        organization: z.string().catch("Unknown organization"),
        description: z.string().nullable().catch(null),
      }),
    )
    .catch([]),
  certifications: z
    .array(z.object({ name: z.string(), issuer: z.string().nullable().catch(null) }))
    .catch([]),
});

type LlmResumeShape = z.infer<typeof llmResumeSchema>;

function toSkillEntry(name: string): { name: string; category: SkillCategory } {
  return lookupSkill(name) ?? { name: name.trim().slice(0, 100), category: "OTHER" };
}

const truncate = (s: string, max: number) => s.slice(0, max);

/** Bounds every field to the limits the downstream profile validators (profile.validators.ts) already enforce, so a review-and-confirm never fails on an over-length LLM-extracted value. */
function sanitize(parsed: LlmResumeShape): Omit<ParsedResume, "rawText" | "confidence"> {
  return {
    fullName: parsed.fullName ? truncate(parsed.fullName, 200) : null,
    email: parsed.email ? truncate(parsed.email, 320) : null,
    phone: parsed.phone ? truncate(parsed.phone, 30) : null,
    location: parsed.location ? truncate(parsed.location, 200) : null,
    college: parsed.college ? truncate(parsed.college, 200) : null,
    degree: parsed.degree ? truncate(parsed.degree, 200) : null,
    branch: parsed.branch ? truncate(parsed.branch, 200) : null,
    graduationYear: parsed.graduationYear,
    cgpa: parsed.cgpa,
    githubUrl: parsed.githubUrl,
    linkedinUrl: parsed.linkedinUrl,
    portfolioUrl: parsed.portfolioUrl,
    skills: parsed.skills.slice(0, 50).map((s) => toSkillEntry(s)),
    projects: parsed.projects.slice(0, 20).map((p) => ({
      title: truncate(p.title || "Untitled project", 200),
      description: p.description ? truncate(p.description, 2000) : null,
      techStack: p.techStack.slice(0, 30).map((t) => truncate(t, 50)),
    })),
    experience: parsed.experience.slice(0, 20).map((e) => ({
      title: truncate(e.title || "Role", 200),
      organization: truncate(e.organization || "Unknown organization", 200),
      description: e.description ? truncate(e.description, 2000) : null,
    })),
    certifications: parsed.certifications.slice(0, 20).map((c) => ({
      name: truncate(c.name, 200),
      issuer: c.issuer ? truncate(c.issuer, 200) : null,
    })),
  };
}

// Bounds the prompt size — a resume's own text rarely exceeds this, and it
// keeps token usage/cost predictable across all three providers.
const MAX_PROMPT_CHARS = 12000;

export class LlmResumeParser implements ResumeParser {
  readonly name = "llm-cascade-v1";

  supports(mimeType: string): boolean {
    return mimeType === PDF_MIME_TYPE || mimeType === DOCX_MIME_TYPE;
  }

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedResume> {
    const rawText = await extractResumeText(fileBuffer, mimeType);
    if (!rawText.trim()) {
      throw new Error("No extractable text in file");
    }

    const completion = await requestJsonCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: rawText.slice(0, MAX_PROMPT_CHARS),
    });

    // The completion must at least be a JSON object — if the model returned
    // something else entirely (e.g. a JSON array, or garbage that happened
    // to parse), that's a hard failure for this parser, not something
    // .catch() on individual fields can paper over.
    const parsedRaw = llmResumeSchema.parse(completion);
    const base = sanitize(parsedRaw);

    return { ...base, rawText, confidence: computeResumeConfidence(base) };
  }
}
