import type { ParsedResume, ResumeParser } from "@intern-platform/shared";
import { escapeRegex, lookupSkill, SKILLS_DICTIONARY } from "../../../lib/skills/skillsDictionary.js";
import { DOCX_MIME_TYPE, extractResumeText, PDF_MIME_TYPE } from "./textExtraction.js";
import { computeResumeConfidence } from "./resumeConfidence.js";

/**
 * Rule-based resume parser: no AI/network dependency, same input always
 * produces the same output. Extraction is necessarily best-effort (resumes
 * have no fixed format) — every field is a *proposal* the student reviews
 * before it touches their profile (see resume.service.ts `confirmResume`).
 *
 * `ResumeParser` is an interface (packages/shared) so a hosted/AI-assisted
 * implementation can be added later without changing any caller.
 */

type SectionKey = "education" | "skills" | "projects" | "experience" | "certifications";

const SECTION_HEADINGS: Record<SectionKey, string[]> = {
  education: ["education", "academic background", "academics", "educational qualifications"],
  skills: [
    "skills",
    "technical skills",
    "skills & interests",
    "core competencies",
    "technologies",
    "skills and abilities",
  ],
  projects: ["projects", "personal projects", "academic projects", "key projects"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "internships",
    "internship experience",
    "employment history",
  ],
  certifications: ["certifications", "certificates", "licenses & certifications", "licenses and certifications"],
};

const DEGREE_KEYWORDS = [
  "B.Tech", "B.E.", "Bachelor of Technology", "Bachelor of Engineering", "M.Tech",
  "Master of Technology", "MBA", "BCA", "MCA", "B.Sc", "M.Sc", "Bachelor of Science",
  "Master of Science", "Bachelor of Arts", "Master of Arts", "B.A", "M.A", "Ph.D", "Diploma",
  "Bachelor", "Master",
];

function detectHeading(line: string): SectionKey | null {
  const cleaned = line.trim().toLowerCase().replace(/:$/, "");
  if (!cleaned || cleaned.length > 45) return null;
  for (const key of Object.keys(SECTION_HEADINGS) as SectionKey[]) {
    const variants = SECTION_HEADINGS[key];
    if (variants.some((v) => cleaned === v || cleaned.startsWith(v))) return key;
  }
  return null;
}

function splitSections(lines: string[]): { preamble: string[]; sections: Record<SectionKey, string[]> } {
  const sections: Record<SectionKey, string[]> = {
    education: [],
    skills: [],
    projects: [],
    experience: [],
    certifications: [],
  };
  const preamble: string[] = [];
  let current: SectionKey | null = null;

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      continue;
    }
    if (current) sections[current].push(line);
    else preamble.push(line);
  }

  return { preamble, sections };
}

/** Splits a section's lines into blank-line-separated blocks (one project/job/cert per block). */
function groupBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match?.[0] ?? null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return match[0].trim();
}

function extractLinks(text: string): { githubUrl: string | null; linkedinUrl: string | null; portfolioUrl: string | null } {
  const githubMatch = text.match(/https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i);
  const linkedinMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i);
  const urlMatches = text.match(/https?:\/\/[^\s,)]+/gi) ?? [];
  const portfolio = urlMatches.find((u) => !/github\.com|linkedin\.com/i.test(u)) ?? null;

  return {
    githubUrl: githubMatch?.[0] ?? null,
    linkedinUrl: linkedinMatch?.[0] ?? null,
    portfolioUrl: portfolio ?? null,
  };
}

function extractName(preamble: string[]): string | null {
  for (const line of preamble) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("@") || /https?:\/\//i.test(trimmed) || /\d{3,}/.test(trimmed)) continue;
    const words = trimmed.split(/\s+/);
    if (words.length >= 1 && words.length <= 5) return trimmed;
  }
  return null;
}

function extractGraduationYear(text: string): number | null {
  const years = [...text.matchAll(/\b(19[9]\d|20[0-4]\d)\b/g)]
    .map((m) => Number(m[0]))
    .filter((y) => y >= 1990 && y <= 2035);
  if (years.length === 0) return null;
  return Math.max(...years);
}

function extractCGPA(text: string): number | null {
  const match = text.match(/\b(?:CGPA|GPA)\s*[:-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/\s*(\d{1,2}))?/i);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  const scale = match[2] ? Number(match[2]) : 10;
  if (Number.isNaN(value)) return null;
  const normalized = scale === 10 ? value : (value / scale) * 10;
  if (normalized < 0 || normalized > 10) return null;
  return Math.round(normalized * 100) / 100;
}

function extractEducationDetails(educationLines: string[]): { degree: string | null; college: string | null; branch: string | null } {
  let degree: string | null = null;
  let branch: string | null = null;
  let college: string | null = null;

  for (const rawLine of educationLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!degree) {
      const matchedKeyword = DEGREE_KEYWORDS.find((kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(line));
      if (matchedKeyword) {
        degree = matchedKeyword;
        const inMatch = line.match(/\bin\s+([A-Za-z&,/\s]+?)(?:[,|\-–]|\s+\d{4}|$)/i);
        if (inMatch?.[1]) branch = inMatch[1].trim();
      }
    }

    if (!college && /university|institute|college|\biit\b|\bnit\b/i.test(line)) {
      // The college name may share a line with the degree (comma/pipe
      // separated) — isolate the segment that actually names the school.
      const segments = line.split(/[,|]/).map((s) => s.trim());
      college = segments.find((s) => /university|institute|college|\biit\b|\bnit\b/i.test(s)) ?? line;
    }
  }

  return { degree, branch, college };
}

function extractSkills(skillsLines: string[], wholeText: string): Array<{ name: string; category: import("@intern-platform/shared").SkillCategory }> {
  const found = new Map<string, { name: string; category: import("@intern-platform/shared").SkillCategory }>();

  const skillsText = skillsLines.join(" ");
  const tokens = skillsText.split(/[,•|;/\n]/).map((t) => t.replace(/^[\s\-*]+|[\s\-*]+$/g, ""));
  for (const token of tokens) {
    if (!token) continue;
    const skill = lookupSkill(token);
    if (skill) found.set(skill.name, skill);
  }

  // Fallback: catch single-word skills mentioned elsewhere (e.g. inline in
  // project descriptions) that a dedicated skills section didn't list.
  for (const key of Object.keys(SKILLS_DICTIONARY)) {
    if (key.includes(" ")) continue;
    const entry = SKILLS_DICTIONARY[key];
    if (!entry || found.has(entry.name)) continue;
    if (new RegExp(`\\b${escapeRegex(key)}\\b`, "i").test(wholeText)) {
      found.set(entry.name, entry);
    }
  }

  return [...found.values()];
}

function detectTechStack(blockText: string): string[] {
  const explicit = blockText.match(/tech(?:nologies)?(?:\s*stack)?\s*[:-]\s*(.+)/i);
  const source = explicit?.[1] ?? blockText;
  const found = new Set<string>();
  for (const key of Object.keys(SKILLS_DICTIONARY)) {
    const entry = SKILLS_DICTIONARY[key];
    if (!entry) continue;
    const pattern = key.includes(" ") ? key : `\\b${escapeRegex(key)}\\b`;
    if (new RegExp(pattern, "i").test(source)) found.add(entry.name);
  }
  return [...found];
}

function extractProjects(lines: string[]): ParsedResume["projects"] {
  return groupBlocks(lines).map((block) => {
    const [headerLine, ...rest] = block;
    const header = headerLine ?? "";
    const separatorMatch = header.match(/^(.*?)\s*[-–:]\s*(.+)$/);
    const title = (separatorMatch?.[1] ?? header).trim() || "Untitled project";
    const descriptionParts = [separatorMatch?.[2], ...rest].filter((v): v is string => Boolean(v && v.trim()));
    const description = descriptionParts.join(" ").trim() || null;
    const techStack = detectTechStack(block.join(" "));
    return { title, description, techStack };
  });
}

function extractExperience(lines: string[]): ParsedResume["experience"] {
  return groupBlocks(lines).map((block) => {
    const [headerLine, ...rest] = block;
    const header = headerLine ?? "";
    const splitMatch = header.match(/^(.*?)\s*(?:[-–|@]|,)\s*(.+)$/);
    const title = (splitMatch?.[1] ?? header).trim() || "Role";
    const organization = (splitMatch?.[2] ?? "Unknown organization").replace(/\d{4}.*$/, "").trim() || "Unknown organization";
    const description = rest.join(" ").trim() || null;
    return { title, organization, description };
  });
}

function extractCertifications(lines: string[]): ParsedResume["certifications"] {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*[-–,]\s*(.+)$/);
      return { name: (match?.[1] ?? line).trim(), issuer: match?.[2]?.trim() ?? null };
    });
}

/** Pure parsing logic, kept separate from file I/O so it's directly unit-testable. */
export function parseResumeText(rawText: string): ParsedResume {
  const lines = rawText.split(/\r?\n/);
  const { preamble, sections } = splitSections(lines);

  const email = extractEmail(rawText);
  const phone = extractPhone(rawText);
  const links = extractLinks(rawText);
  const fullName = extractName(preamble);
  const graduationYear = extractGraduationYear(sections.education.join(" ") || rawText);
  const cgpa = extractCGPA(rawText);
  const { degree, branch, college } = extractEducationDetails(sections.education);
  const skills = extractSkills(sections.skills, rawText);
  const projects = extractProjects(sections.projects);
  const experience = extractExperience(sections.experience);
  const certifications = extractCertifications(sections.certifications);

  const base = {
    fullName,
    email,
    phone,
    location: null,
    college,
    degree,
    branch,
    graduationYear,
    cgpa,
    githubUrl: links.githubUrl,
    linkedinUrl: links.linkedinUrl,
    portfolioUrl: links.portfolioUrl,
    skills,
    projects,
    experience,
    certifications,
  };

  return { ...base, rawText, confidence: computeResumeConfidence(base) };
}

export class DeterministicResumeParser implements ResumeParser {
  readonly name = "deterministic-v1";

  supports(mimeType: string): boolean {
    return mimeType === PDF_MIME_TYPE || mimeType === DOCX_MIME_TYPE;
  }

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedResume> {
    const text = await extractResumeText(fileBuffer, mimeType);
    return parseResumeText(text);
  }
}
