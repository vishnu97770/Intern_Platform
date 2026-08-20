import { afterEach, describe, expect, it, vi } from "vitest";

const requestJsonCompletion = vi.fn();

vi.mock("../../src/lib/llm/llmClient.js", () => ({
  requestJsonCompletion: (...args: unknown[]) => requestJsonCompletion(...args),
}));

const { LlmJobDescriptionParser } = await import("../../src/modules/internships/parsers/llmJobDescriptionParser.js");

const parser = new LlmJobDescriptionParser();

describe("LlmJobDescriptionParser", () => {
  afterEach(() => {
    requestJsonCompletion.mockReset();
  });

  it("maps a well-formed completion, keeping only dictionary-recognized skills mapped to canonical casing", async () => {
    requestJsonCompletion.mockResolvedValue({
      requiredSkills: ["python", "GO", "made-up-skill"],
      preferredSkills: ["docker"],
      minGraduationYear: 2026,
      maxGraduationYear: 2027,
      minExperienceMonths: 3,
      workMode: "HYBRID",
      locations: ["Bengaluru"],
      stipendMin: 20000,
      stipendMax: 30000,
      stipendCurrency: "INR",
      durationMonths: 6,
      applicationDeadline: "2026-10-15",
    });

    const result = await parser.parse("Some internship description text");

    expect(result.requiredSkills).toEqual(expect.arrayContaining(["Python", "Go"]));
    expect(result.requiredSkills).not.toContain("made-up-skill");
    expect(result.preferredSkills).toEqual(["Docker"]);
    expect(result.workMode).toBe("HYBRID");
    expect(result.minGraduationYear).toBe(2026);
    expect(result.applicationDeadline).toBe(new Date("2026-10-15").toISOString());
  });

  it("never lets a skill appear in both required and preferred", async () => {
    requestJsonCompletion.mockResolvedValue({
      requiredSkills: ["Python", "Docker"],
      preferredSkills: ["Docker", "Kubernetes"],
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
    });

    const result = await parser.parse("desc");
    expect(result.requiredSkills).toEqual(["Python"]);
    expect(result.preferredSkills).toEqual(expect.arrayContaining(["Docker", "Kubernetes"]));
  });

  it("degrades an invalid workMode / malformed deadline to null instead of failing the whole parse", async () => {
    requestJsonCompletion.mockResolvedValue({
      requiredSkills: [],
      preferredSkills: [],
      minGraduationYear: null,
      maxGraduationYear: null,
      minExperienceMonths: null,
      workMode: "FROM_A_BEACH", // not a valid enum value
      locations: [],
      stipendMin: null,
      stipendMax: null,
      stipendCurrency: null,
      durationMonths: null,
      applicationDeadline: "not a real date",
    });

    const result = await parser.parse("desc");
    expect(result.workMode).toBeNull();
    expect(result.applicationDeadline).toBeNull();
  });

  it("rejects an empty description before ever calling the LLM client", async () => {
    await expect(parser.parse("   ")).rejects.toThrow("Empty description");
    expect(requestJsonCompletion).not.toHaveBeenCalled();
  });

  it("propagates an LLM client failure (caller falls back to the deterministic parser)", async () => {
    requestJsonCompletion.mockRejectedValue(new Error("All configured LLM providers failed"));
    await expect(parser.parse("desc")).rejects.toThrow("All configured LLM providers failed");
  });
});
