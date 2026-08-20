import type { ParsedResume } from "@intern-platform/shared";

/**
 * Shared by every ResumeParser implementation (deterministic, LLM) so
 * "confidence" means the same thing regardless of which parser produced
 * the result — how many core fields were actually filled in, with small
 * bonuses for skills/projects/experience being present at all.
 */
export function computeResumeConfidence(parsed: Omit<ParsedResume, "rawText" | "confidence">): number {
  const coreFields = [parsed.fullName, parsed.email, parsed.phone, parsed.college, parsed.degree, parsed.graduationYear, parsed.cgpa];
  const filled = coreFields.filter((v) => v !== null && v !== "").length;
  let score = filled / coreFields.length;
  if (parsed.skills.length > 0) score += 0.1;
  if (parsed.projects.length > 0 || parsed.experience.length > 0) score += 0.05;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}
