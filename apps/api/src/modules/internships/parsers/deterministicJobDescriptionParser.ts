import type { JobDescriptionParser, ParsedJobRequirements, WorkModePreference } from "@intern-platform/shared";
import { escapeRegex, SKILLS_DICTIONARY } from "../../../lib/skills/skillsDictionary.js";

/**
 * Rule-based extraction of structured requirements from a free-text
 * internship description — same philosophy as the resume parser
 * (deterministic, no network/AI dependency, swappable via the shared
 * JobDescriptionParser interface). Used by the ingestion pipeline when a
 * provider only supplies unstructured text (packages/shared InternshipProvider).
 */

const REQUIRED_SECTION_HEADINGS = ["requirements", "required skills", "must have", "must-have"];
const PREFERRED_SECTION_HEADINGS = ["preferred", "preferred skills", "nice to have", "nice-to-have", "bonus"];

function extractSection(text: string, headings: string[]): string | null {
  for (const heading of headings) {
    const pattern = new RegExp(`${escapeRegex(heading)}\\s*:?\\s*\\n?([\\s\\S]*?)(?:\\n\\s*\\n|$)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractSkillsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const key of Object.keys(SKILLS_DICTIONARY)) {
    const entry = SKILLS_DICTIONARY[key];
    if (!entry) continue;
    const pattern = key.includes(" ") ? escapeRegex(key) : `\\b${escapeRegex(key)}\\b`;
    if (new RegExp(pattern, "i").test(text)) found.add(entry.name);
  }
  return [...found];
}

function extractGraduationYears(text: string): { min: number | null; max: number | null } {
  // Prefer a labeled mention ("graduating years: 2025-2026", "2025-2026 batch")
  // over a bare year scan, so an unrelated year elsewhere (e.g. a deadline
  // date) can't be mistaken for an eligibility cutoff.
  const labeled = text.match(/(?:graduat\w*|batch|eligib\w*)[^\n]*?\b(20[2-4]\d)\b(?:\s*(?:-|to)\s*\b(20[2-4]\d)\b)?/i);
  if (labeled?.[1]) {
    const a = Number(labeled[1]);
    const b = labeled[2] ? Number(labeled[2]) : a;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }

  const years = [...text.matchAll(/\b(20[2-4]\d)\b/g)].map((m) => Number(m[0]));
  if (years.length === 0) return { min: null, max: null };
  return { min: Math.min(...years), max: Math.max(...years) };
}

function extractExperienceMonths(text: string): number | null {
  const monthsMatch = text.match(/(\d+)\+?\s*months?\s+(?:of\s+)?experience/i);
  if (monthsMatch?.[1]) return Number(monthsMatch[1]);
  const yearsMatch = text.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/i);
  if (yearsMatch?.[1]) return Number(yearsMatch[1]) * 12;
  if (/no\s+(?:prior\s+)?experience\s+(?:required|necessary)/i.test(text)) return 0;
  return null;
}

function extractWorkMode(text: string): WorkModePreference | null {
  if (/\bremote\b/i.test(text)) return "REMOTE";
  if (/\bhybrid\b/i.test(text)) return "HYBRID";
  if (/\bon-?site\b|\bin-?office\b/i.test(text)) return "ONSITE";
  return null;
}

function extractLocations(text: string): string[] {
  const match = text.match(/location\s*:?\s*([^\n]+)/i);
  if (!match?.[1]) return [];
  return match[1]
    .split(/[,/]/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.length < 60);
}

function extractStipend(text: string): { min: number | null; max: number | null; currency: string | null } {
  // Matches "₹15,000 - ₹25,000/month", "$500-$1000 per month", "Rs. 20000/month", "20k-30k INR/month".
  const match = text.match(
    /(₹|Rs\.?|INR|\$|USD)\s*([\d,]+)\s*(k|K)?\s*(?:-|to)\s*(₹|Rs\.?|INR|\$|USD)?\s*([\d,]+)\s*(k|K)?\s*(?:\/|per\s*)?(?:month|mo)?/,
  );
  if (match) {
    const currency = match[1]?.startsWith("$") || match[1]?.toUpperCase() === "USD" ? "USD" : "INR";
    const scale = (suffix?: string) => (suffix ? 1000 : 1);
    const min = Number(match[2]?.replace(/,/g, "")) * scale(match[3]);
    const max = Number(match[5]?.replace(/,/g, "")) * scale(match[6]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max, currency };
  }

  const single = text.match(/(₹|Rs\.?|INR|\$|USD)\s*([\d,]+)\s*(k|K)?\s*(?:\/|per\s*)?(?:month|mo)/);
  if (single) {
    const currency = single[1]?.startsWith("$") || single[1]?.toUpperCase() === "USD" ? "USD" : "INR";
    const value = Number(single[2]?.replace(/,/g, "")) * (single[3] ? 1000 : 1);
    if (!Number.isNaN(value)) return { min: value, max: value, currency };
  }

  if (/unpaid/i.test(text)) return { min: 0, max: 0, currency: null };

  return { min: null, max: null, currency: null };
}

function extractDurationMonths(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:-|to)\s*(\d+)?\s*months?\s+(?:duration|internship)?/i) ?? text.match(/duration\s*:?\s*(\d+)\s*months?/i);
  if (match?.[2]) return Number(match[2]);
  if (match?.[1]) return Number(match[1]);
  return null;
}

function extractDeadline(text: string): string | null {
  const match = text.match(/(?:apply by|deadline|last date to apply)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (!match?.[1]) return null;
  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export class DeterministicJobDescriptionParser implements JobDescriptionParser {
  readonly name = "deterministic-v1";

  async parse(rawDescription: string): Promise<ParsedJobRequirements> {
    const requiredSection = extractSection(rawDescription, REQUIRED_SECTION_HEADINGS);
    const preferredSection = extractSection(rawDescription, PREFERRED_SECTION_HEADINGS);

    const preferredSkills = preferredSection ? extractSkillsFromText(preferredSection) : [];
    const requiredSource = requiredSection ?? rawDescription;
    const requiredSkills = extractSkillsFromText(requiredSource).filter((s) => !preferredSkills.includes(s));

    const { min: minGraduationYear, max: maxGraduationYear } = extractGraduationYears(rawDescription);
    const stipend = extractStipend(rawDescription);

    return {
      requiredSkills,
      preferredSkills,
      minGraduationYear,
      maxGraduationYear,
      minExperienceMonths: extractExperienceMonths(rawDescription),
      workMode: extractWorkMode(rawDescription),
      locations: extractLocations(rawDescription),
      stipendMin: stipend.min,
      stipendMax: stipend.max,
      stipendCurrency: stipend.currency,
      durationMonths: extractDurationMonths(rawDescription),
      applicationDeadline: extractDeadline(rawDescription),
    };
  }
}
