import type { AutoApplyCheckResult, AutoApplyRuleDTO, InternshipWorkMode } from "@intern-platform/shared";

/** The subset of an Internship row the checklist needs — kept minimal so this stays a pure, directly-testable function. */
export interface EligibilityInternship {
  title: string;
  company: string;
  location: string | null;
  workMode: InternshipWorkMode | null;
  minGraduationYear: number | null;
  maxGraduationYear: number | null;
}

export interface EligibilityInput {
  rule: AutoApplyRuleDTO;
  matchScore: number;
  internship: EligibilityInternship;
  graduationYear: number | null;
  /** AUTO-method attempts already made today (for the daily limit gate). */
  appliedTodayCount: number;
  /** Whether the student already has any Application row for this internship. */
  alreadyTracked: boolean;
  /** Whether a registered ApplicationProvider can submit to this internship's applicationUrl. */
  supportedProvider: boolean;
}

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function titleMatchesRole(title: string, role: string): boolean {
  const titleWords = normalizeWords(title);
  const roleWords = normalizeWords(role);
  if (roleWords.size === 0) return false;
  for (const w of roleWords) if (titleWords.has(w)) return true;
  return false;
}

function isGraduationEligible(graduationYear: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  // Conservative on purpose: auto-apply submits on the student's behalf,
  // so an unset graduation year does not get the benefit of the doubt
  // the way it does in match *scoring* (see DeterministicMatchingEngine).
  if (graduationYear === null) return false;
  const lo = min ?? max!;
  const hi = max ?? min!;
  return graduationYear >= lo && graduationYear <= hi;
}

function locationMatches(internship: EligibilityInternship, preferredLocations: string[]): boolean {
  if (preferredLocations.length === 0) return true;
  if (internship.workMode === "REMOTE") return true;
  if (!internship.location) return false;
  const loc = internship.location.toLowerCase();
  return preferredLocations.some((p) => loc.includes(p.toLowerCase()) || p.toLowerCase().includes(loc));
}

/**
 * Runs every gate in the checklist (PROJECT_PLAN.md auto-apply flow), in
 * order, and returns a pass/fail result for each — always all nine, even
 * once an earlier one has already failed, so a run's output is a complete,
 * traceable record of *why* an internship was or wasn't auto-applied to.
 */
export function evaluateAutoApplyEligibility(input: EligibilityInput): AutoApplyCheckResult[] {
  const { rule, matchScore, internship, graduationYear, appliedTodayCount, alreadyTracked, supportedProvider } = input;

  const eligible = isGraduationEligible(graduationYear, internship.minGraduationYear, internship.maxGraduationYear);
  const roleOk = rule.preferredRoles.length === 0 || rule.preferredRoles.some((r) => titleMatchesRole(internship.title, r));
  const locationOk = locationMatches(internship, rule.preferredLocations);
  const excluded = rule.excludedCompanies.some((c) => c.toLowerCase() === internship.company.toLowerCase());
  const withinDailyLimit = appliedTodayCount < rule.maxApplicationsPerDay;

  return [
    {
      id: "AUTO_APPLY_ENABLED",
      passed: rule.isEnabled,
      detail: rule.isEnabled ? "Auto-apply is enabled" : "Auto-apply is turned off",
    },
    {
      id: "MATCH_SCORE",
      passed: matchScore >= rule.minMatchScore,
      detail: `Match score ${matchScore}% (minimum ${rule.minMatchScore}%)`,
    },
    {
      id: "ELIGIBLE",
      passed: eligible,
      detail: eligible ? "Meets the stated eligibility window" : "Outside the stated graduation-year eligibility window",
    },
    {
      id: "PREFERRED_ROLE",
      passed: roleOk,
      detail: roleOk ? "Matches a preferred role" : "Does not match any preferred role",
    },
    {
      id: "PREFERRED_LOCATION",
      passed: locationOk,
      detail: locationOk ? "Matches a preferred location or work mode" : "Does not match any preferred location",
    },
    {
      id: "EXCLUDED_COMPANY",
      passed: !excluded,
      detail: excluded ? `${internship.company} is on the excluded companies list` : "Company is not excluded",
    },
    {
      id: "DAILY_LIMIT",
      passed: withinDailyLimit,
      detail: `${appliedTodayCount}/${rule.maxApplicationsPerDay} auto-applications used today`,
    },
    {
      id: "ALREADY_APPLIED",
      passed: !alreadyTracked,
      detail: alreadyTracked ? "Already tracked" : "Not yet applied",
    },
    {
      id: "SUPPORTED_PROVIDER",
      passed: supportedProvider,
      detail: supportedProvider ? "An automated application provider is available" : "No supported provider — manual application required",
    },
  ];
}
