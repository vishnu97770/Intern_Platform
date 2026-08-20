import type {
  MatchBreakdown,
  MatchExplanation,
  MatchingEngine,
  MatchResultDTO,
  ParsedJobRequirements,
  StudentProfileDTO,
  WorkModePreference,
} from "@intern-platform/shared";

/**
 * Deterministic, explainable scoring: identical (profile, requirements)
 * always produces the identical MatchResultDTO — no randomness anywhere,
 * per PROJECT_PLAN.md matching engine notes. Every sub-score is a pure
 * function of its inputs, which is what makes the unit tests exact-value
 * assertions rather than "score > 0" smoke tests.
 *
 * Weights (must sum to 1): skills matter most, the rest share the
 * remainder evenly.
 */
const WEIGHTS = { skill: 0.4, education: 0.15, experience: 0.15, location: 0.15, role: 0.15 } as const;

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function monthsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

function totalExperienceMonths(experience: StudentProfileDTO["experience"]): number {
  const now = new Date();
  return experience.reduce((sum, e) => sum + monthsBetween(new Date(e.startDate), e.endDate ? new Date(e.endDate) : now), 0);
}

interface SkillMatchResult {
  score: number;
  matchedRequired: string[];
  matchedPreferred: string[];
  missingRequired: string[];
  missingPreferred: string[];
}

function computeSkillMatch(profileSkillNames: Set<string>, required: string[], preferred: string[]): SkillMatchResult {
  if (required.length === 0 && preferred.length === 0) {
    return { score: 100, matchedRequired: [], matchedPreferred: [], missingRequired: [], missingPreferred: [] };
  }

  const matchedRequired = required.filter((s) => profileSkillNames.has(s.toLowerCase()));
  const matchedPreferred = preferred.filter((s) => profileSkillNames.has(s.toLowerCase()));
  const requiredScore = required.length > 0 ? matchedRequired.length / required.length : 1;
  const preferredScore = preferred.length > 0 ? matchedPreferred.length / preferred.length : 1;

  return {
    score: Math.round((requiredScore * 0.75 + preferredScore * 0.25) * 100),
    matchedRequired,
    matchedPreferred,
    missingRequired: required.filter((s) => !matchedRequired.includes(s)),
    missingPreferred: preferred.filter((s) => !matchedPreferred.includes(s)),
  };
}

function computeEducationMatch(
  graduationYear: number | null,
  minGraduationYear: number | null,
  maxGraduationYear: number | null,
): { score: number; concern: string | null } {
  if (minGraduationYear === null && maxGraduationYear === null) return { score: 100, concern: null };
  if (graduationYear === null) {
    return { score: 50, concern: "Your graduation year isn't set, so eligibility couldn't be fully verified." };
  }

  const lo = minGraduationYear ?? maxGraduationYear!;
  const hi = maxGraduationYear ?? minGraduationYear!;
  if (graduationYear >= lo && graduationYear <= hi) return { score: 100, concern: null };

  const distance = graduationYear < lo ? lo - graduationYear : graduationYear - hi;
  return {
    score: Math.max(0, 100 - distance * 25),
    concern: `Your graduation year (${graduationYear}) is outside the stated eligibility window (${lo}-${hi}).`,
  };
}

function computeExperienceMatch(totalMonths: number, minExperienceMonths: number | null): { score: number; concern: string | null } {
  if (!minExperienceMonths) return { score: 100, concern: null };
  if (totalMonths >= minExperienceMonths) return { score: 100, concern: null };
  return {
    score: Math.round((totalMonths / minExperienceMonths) * 100),
    concern: `Internship requests ${minExperienceMonths} months experience`,
  };
}

function computeLocationMatch(
  preferredLocations: string[],
  workModePreference: WorkModePreference,
  reqLocations: string[],
  reqWorkMode: WorkModePreference | null,
): { score: number; concern: string | null } {
  const modeScore = reqWorkMode && workModePreference !== "ANY" && workModePreference !== reqWorkMode ? 40 : 100;

  let locScore = 100;
  if (reqLocations.length > 0 && reqWorkMode !== "REMOTE") {
    const normalizedPrefs = preferredLocations.map((l) => l.toLowerCase());
    const matchesAny = reqLocations.some((loc) =>
      normalizedPrefs.some((p) => loc.toLowerCase().includes(p) || p.includes(loc.toLowerCase())),
    );
    if (!matchesAny) locScore = preferredLocations.length === 0 ? 60 : 30;
  }

  const score = Math.round((modeScore + locScore) / 2);
  return { score, concern: score < 70 ? "Location or work mode may not match your preferences." : null };
}

function computeRoleMatch(preferredRoles: string[], title: string): number {
  if (preferredRoles.length === 0 || !title) return 60;

  const titleWords = normalizeWords(title);
  let best = 0;
  for (const role of preferredRoles) {
    const roleWords = normalizeWords(role);
    if (roleWords.size === 0) continue;
    let matched = 0;
    for (const w of roleWords) if (titleWords.has(w)) matched += 1;
    best = Math.max(best, matched / roleWords.size);
  }
  return Math.round(best * 100);
}

export class DeterministicMatchingEngine implements MatchingEngine {
  readonly name = "deterministic-v1";

  async score(profile: StudentProfileDTO, requirements: ParsedJobRequirements, internshipId: string): Promise<MatchResultDTO> {
    const profileSkillNames = new Set(profile.skills.map((s) => s.name.toLowerCase()));

    const skill = computeSkillMatch(profileSkillNames, requirements.requiredSkills, requirements.preferredSkills);
    const education = computeEducationMatch(profile.graduationYear, requirements.minGraduationYear, requirements.maxGraduationYear);
    const experience = computeExperienceMatch(totalExperienceMonths(profile.experience), requirements.minExperienceMonths);
    const location = computeLocationMatch(profile.preferredLocations, profile.workModePreference, requirements.locations, requirements.workMode);
    const roleScore = computeRoleMatch(profile.preferredRoles, requirements.title ?? "");

    const breakdown: MatchBreakdown = {
      skillMatch: skill.score,
      educationMatch: education.score,
      experienceMatch: experience.score,
      locationMatch: location.score,
      roleMatch: roleScore,
    };

    const overallScore = Math.round(
      breakdown.skillMatch * WEIGHTS.skill +
        breakdown.educationMatch * WEIGHTS.education +
        breakdown.experienceMatch * WEIGHTS.experience +
        breakdown.locationMatch * WEIGHTS.location +
        breakdown.roleMatch * WEIGHTS.role,
    );

    const explanation: MatchExplanation = {
      strongMatches: [...skill.matchedRequired, ...skill.matchedPreferred],
      missing: [...skill.missingRequired, ...skill.missingPreferred],
      concerns: [education.concern, experience.concern, location.concern].filter((c): c is string => Boolean(c)),
    };

    return { internshipId, overallScore, breakdown, explanation };
  }
}
