import { describe, expect, it } from "vitest";
import type { AutoApplyRuleDTO } from "@intern-platform/shared";
import { evaluateAutoApplyEligibility, type EligibilityInternship } from "../../src/modules/auto-apply/autoApplyEligibility.js";

function buildRule(overrides: Partial<AutoApplyRuleDTO> = {}): AutoApplyRuleDTO {
  return {
    isEnabled: true,
    minMatchScore: 80,
    maxApplicationsPerDay: 5,
    preferredRoles: [],
    preferredLocations: [],
    excludedCompanies: [],
    requireManualApproval: true,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildInternship(overrides: Partial<EligibilityInternship> = {}): EligibilityInternship {
  return {
    title: "Backend Developer Intern",
    company: "Northwind Systems",
    location: "Bengaluru, India",
    workMode: "HYBRID",
    minGraduationYear: null,
    maxGraduationYear: null,
    ...overrides,
  };
}

function checkById(checks: ReturnType<typeof evaluateAutoApplyEligibility>, id: string) {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`Missing check ${id}`);
  return found;
}

describe("evaluateAutoApplyEligibility", () => {
  it("passes every check when everything matches (the fully-eligible baseline)", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ preferredRoles: ["Backend Developer"], preferredLocations: ["Bengaluru"] }),
      matchScore: 90,
      internship: buildInternship({ minGraduationYear: 2026, maxGraduationYear: 2027 }),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });

    expect(checks).toHaveLength(9);
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it("fails AUTO_APPLY_ENABLED when the rule is off", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ isEnabled: false }),
      matchScore: 100,
      internship: buildInternship(),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "AUTO_APPLY_ENABLED").passed).toBe(false);
  });

  it("fails MATCH_SCORE when below the configured minimum", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ minMatchScore: 85 }),
      matchScore: 70,
      internship: buildInternship(),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "MATCH_SCORE").passed).toBe(false);
  });

  it("fails ELIGIBLE when the graduation year is outside the internship's window", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule(),
      matchScore: 90,
      internship: buildInternship({ minGraduationYear: 2025, maxGraduationYear: 2025 }),
      graduationYear: 2027,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "ELIGIBLE").passed).toBe(false);
  });

  it("fails ELIGIBLE conservatively when graduation year is unset but the internship requires one", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule(),
      matchScore: 90,
      internship: buildInternship({ minGraduationYear: 2025, maxGraduationYear: 2026 }),
      graduationYear: null,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "ELIGIBLE").passed).toBe(false);
  });

  it("fails PREFERRED_ROLE when the title matches none of the preferred roles", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ preferredRoles: ["Data Scientist"] }),
      matchScore: 90,
      internship: buildInternship({ title: "Backend Developer Intern" }),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "PREFERRED_ROLE").passed).toBe(false);
  });

  it("passes PREFERRED_LOCATION for a remote internship regardless of the preferred-locations list", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ preferredLocations: ["Mumbai"] }),
      matchScore: 90,
      internship: buildInternship({ location: "Remote", workMode: "REMOTE" }),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "PREFERRED_LOCATION").passed).toBe(true);
  });

  it("fails PREFERRED_LOCATION for a non-remote internship that doesn't match", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ preferredLocations: ["Mumbai"] }),
      matchScore: 90,
      internship: buildInternship({ location: "Bengaluru, India", workMode: "ONSITE" }),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "PREFERRED_LOCATION").passed).toBe(false);
  });

  it("fails EXCLUDED_COMPANY when the company is on the exclusion list (case-insensitive)", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ excludedCompanies: ["northwind systems"] }),
      matchScore: 90,
      internship: buildInternship({ company: "Northwind Systems" }),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "EXCLUDED_COMPANY").passed).toBe(false);
  });

  it("fails DAILY_LIMIT once today's count reaches the configured maximum", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule({ maxApplicationsPerDay: 3 }),
      matchScore: 90,
      internship: buildInternship(),
      graduationYear: 2026,
      appliedTodayCount: 3,
      alreadyTracked: false,
      supportedProvider: true,
    });
    expect(checkById(checks, "DAILY_LIMIT").passed).toBe(false);
  });

  it("fails ALREADY_APPLIED when the student already has an application for this internship", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule(),
      matchScore: 90,
      internship: buildInternship(),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: true,
      supportedProvider: true,
    });
    expect(checkById(checks, "ALREADY_APPLIED").passed).toBe(false);
  });

  it("fails SUPPORTED_PROVIDER when no provider supports the application URL, without failing the other checks", () => {
    const checks = evaluateAutoApplyEligibility({
      rule: buildRule(),
      matchScore: 90,
      internship: buildInternship(),
      graduationYear: 2026,
      appliedTodayCount: 0,
      alreadyTracked: false,
      supportedProvider: false,
    });
    expect(checkById(checks, "SUPPORTED_PROVIDER").passed).toBe(false);
    expect(checks.filter((c) => c.id !== "SUPPORTED_PROVIDER").every((c) => c.passed)).toBe(true);
  });

  it("is deterministic", () => {
    const input = {
      rule: buildRule({ preferredRoles: ["Backend Developer"] }),
      matchScore: 82,
      internship: buildInternship(),
      graduationYear: 2026,
      appliedTodayCount: 1,
      alreadyTracked: false,
      supportedProvider: true,
    };
    expect(evaluateAutoApplyEligibility(input)).toEqual(evaluateAutoApplyEligibility(input));
  });
});
