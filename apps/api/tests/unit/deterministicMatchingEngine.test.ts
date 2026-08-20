import { describe, expect, it } from "vitest";
import type { ParsedJobRequirements, SkillCategory, StudentProfileDTO } from "@intern-platform/shared";
import { DeterministicMatchingEngine } from "../../src/modules/matching/deterministicMatchingEngine.js";

const engine = new DeterministicMatchingEngine();

function buildProfile(overrides: Partial<StudentProfileDTO> = {}): StudentProfileDTO {
  return {
    id: "profile-1",
    userId: "user-1",
    fullName: "Grace Hopper",
    phone: null,
    location: null,
    college: null,
    degree: null,
    branch: null,
    graduationYear: null,
    cgpa: null,
    bio: null,
    githubUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    preferredRoles: [],
    preferredLocations: [],
    workModePreference: "ANY",
    skills: [],
    projects: [],
    experience: [],
    certifications: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function skill(name: string, category: SkillCategory = "LANGUAGE") {
  return { id: name, name, category, proficiency: null };
}

function buildRequirements(overrides: Partial<ParsedJobRequirements> = {}): ParsedJobRequirements {
  return {
    title: undefined,
    requiredSkills: [],
    preferredSkills: [],
    minGraduationYear: null,
    maxGraduationYear: null,
    minExperienceMonths: null,
    workMode: null,
    locations: [],
    stipendMin: null,
    stipendMax: null,
    stipendCurrency: null,
    durationMonths: null,
    applicationDeadline: null,
    ...overrides,
  };
}

describe("DeterministicMatchingEngine", () => {
  it("scores a perfect match at 100 with no concerns", async () => {
    const profile = buildProfile({
      graduationYear: 2026,
      preferredRoles: ["Backend Developer"],
      preferredLocations: ["Bengaluru"],
      workModePreference: "HYBRID",
      skills: [skill("Go"), skill("Python"), skill("Docker")],
      experience: [{ id: "e1", title: "Intern", organization: "Acme", description: null, startDate: "2026-02-20T00:00:00.000Z", endDate: null, isCurrent: true }],
    });
    const requirements = buildRequirements({
      title: "Backend Developer Intern",
      requiredSkills: ["Go", "Python"],
      preferredSkills: ["Docker"],
      minGraduationYear: 2026,
      maxGraduationYear: 2027,
      minExperienceMonths: 3,
      workMode: "HYBRID",
      locations: ["Bengaluru"],
    });

    const result = await engine.score(profile, requirements, "internship-1");

    expect(result.internshipId).toBe("internship-1");
    expect(result.overallScore).toBe(100);
    expect(result.breakdown).toEqual({ skillMatch: 100, educationMatch: 100, experienceMatch: 100, locationMatch: 100, roleMatch: 100 });
    expect(result.explanation.strongMatches).toEqual(expect.arrayContaining(["Go", "Python", "Docker"]));
    expect(result.explanation.missing).toEqual([]);
    expect(result.explanation.concerns).toEqual([]);
  });

  it("computes an exact, explainable score for a partial match with gaps", async () => {
    const profile = buildProfile({
      graduationYear: 2026,
      preferredRoles: ["Backend Developer"],
      preferredLocations: ["Bengaluru"],
      workModePreference: "REMOTE",
      skills: [skill("Go")],
      experience: [],
    });
    const requirements = buildRequirements({
      title: "Backend Developer Intern",
      requiredSkills: ["Go", "Python", "SQL"],
      preferredSkills: ["Docker", "Kubernetes"],
      minGraduationYear: 2025,
      maxGraduationYear: 2025,
      minExperienceMonths: 6,
      workMode: "ONSITE",
      locations: ["Mumbai"],
    });

    const result = await engine.score(profile, requirements, "internship-2");

    // skillMatch = round((1/3 * 0.75 + 0/2 * 0.25) * 100) = 25
    // educationMatch = 100 - |2026-2025| * 25 = 75
    // experienceMatch = round((0/6) * 100) = 0
    // locationMatch = round((40 [mode mismatch] + 30 [no location match]) / 2) = 35
    // roleMatch = 100 (title fully covers "Backend Developer")
    expect(result.breakdown).toEqual({ skillMatch: 25, educationMatch: 75, experienceMatch: 0, locationMatch: 35, roleMatch: 100 });
    // overallScore = round(25*.4 + 75*.15 + 0*.15 + 35*.15 + 100*.15) = round(41.5) = 42
    expect(result.overallScore).toBe(42);

    expect(result.explanation.strongMatches).toEqual(["Go"]);
    expect(result.explanation.missing).toEqual(["Python", "SQL", "Docker", "Kubernetes"]);
    expect(result.explanation.concerns).toEqual([
      "Your graduation year (2026) is outside the stated eligibility window (2025-2025).",
      "Internship requests 6 months experience",
      "Location or work mode may not match your preferences.",
    ]);
  });

  it("treats unspecified requirements as fully satisfied (never penalizes missing data)", async () => {
    const profile = buildProfile();
    const result = await engine.score(profile, buildRequirements(), "internship-3");

    expect(result.breakdown.skillMatch).toBe(100);
    expect(result.breakdown.educationMatch).toBe(100);
    expect(result.breakdown.experienceMatch).toBe(100);
    expect(result.explanation.missing).toEqual([]);
  });

  it("is deterministic: identical inputs always produce an identical result", async () => {
    const profile = buildProfile({ skills: [skill("Python")], graduationYear: 2026 });
    const requirements = buildRequirements({ requiredSkills: ["Python"], minGraduationYear: 2026 });

    const first = await engine.score(profile, requirements, "internship-4");
    const second = await engine.score(profile, requirements, "internship-4");

    expect(second).toEqual(first);
  });

  it("never returns a score outside 0-100", async () => {
    const profile = buildProfile({ graduationYear: 1990 });
    const requirements = buildRequirements({ minGraduationYear: 2030, maxGraduationYear: 2031 });

    const result = await engine.score(profile, requirements, "internship-5");
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.breakdown.educationMatch).toBe(0);
  });
});
