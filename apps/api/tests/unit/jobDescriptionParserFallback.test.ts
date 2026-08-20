import { afterEach, describe, expect, it, vi } from "vitest";

const isLlmEnabled = vi.fn();
const llmParse = vi.fn();

vi.mock("../../src/lib/llm/llmClient.js", () => ({ isLlmEnabled: () => isLlmEnabled() }));
vi.mock("../../src/modules/internships/parsers/llmJobDescriptionParser.js", () => ({
  LlmJobDescriptionParser: class {
    parse(...args: unknown[]) {
      return llmParse(...args);
    }
  },
}));

const { jobDescriptionParser } = await import("../../src/modules/internships/parsers/index.js");

const SAMPLE_DESCRIPTION = "Requirements:\nPython, Go\n\nLocation: Remote";

describe("internships parsers/index.ts fallback registry", () => {
  afterEach(() => {
    isLlmEnabled.mockReset();
    llmParse.mockReset();
  });

  it("uses the deterministic parser directly when LLM parsing is disabled", async () => {
    isLlmEnabled.mockReturnValue(false);
    const result = await jobDescriptionParser.parse(SAMPLE_DESCRIPTION);

    expect(llmParse).not.toHaveBeenCalled();
    expect(result.requiredSkills).toEqual(expect.arrayContaining(["Python", "Go"]));
  });

  it("uses the LLM parser's result when it succeeds", async () => {
    isLlmEnabled.mockReturnValue(true);
    llmParse.mockResolvedValue({
      requiredSkills: ["React"],
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
    });

    const result = await jobDescriptionParser.parse(SAMPLE_DESCRIPTION);
    expect(result.requiredSkills).toEqual(["React"]);
  });

  it("falls back to the deterministic parser when the LLM parser throws", async () => {
    isLlmEnabled.mockReturnValue(true);
    llmParse.mockRejectedValue(new Error("All configured LLM providers failed"));

    const result = await jobDescriptionParser.parse(SAMPLE_DESCRIPTION);
    expect(result.requiredSkills).toEqual(expect.arrayContaining(["Python", "Go"]));
  });
});
