import { afterEach, describe, expect, it, vi } from "vitest";

const requestJsonCompletion = vi.fn();

vi.mock("../../src/lib/llm/llmClient.js", () => ({
  requestJsonCompletion: (...args: unknown[]) => requestJsonCompletion(...args),
}));

const { LlmResumeParser } = await import("../../src/modules/resume/parsers/llmResumeParser.js");
const { DOCX_MIME_TYPE } = await import("../../src/modules/resume/parsers/textExtraction.js");
const { Document, Packer, Paragraph } = await import("docx");

const parser = new LlmResumeParser();

async function buildDocxBuffer(lines: string[]): Promise<Buffer> {
  const doc = new Document({ sections: [{ children: lines.map((l) => new Paragraph(l)) }] });
  return Packer.toBuffer(doc);
}

describe("LlmResumeParser", () => {
  afterEach(() => {
    requestJsonCompletion.mockReset();
  });

  it("maps a well-formed completion into ParsedResume, categorizing skills via the skills dictionary", async () => {
    requestJsonCompletion.mockResolvedValue({
      fullName: "Grace Hopper",
      email: "grace@example.com",
      phone: "+1 415 555 0100",
      location: "Remote",
      college: "MIT",
      degree: "B.Tech",
      branch: "Computer Science",
      graduationYear: 2026,
      cgpa: 9.1,
      githubUrl: "https://github.com/gracehopper",
      linkedinUrl: null,
      portfolioUrl: null,
      skills: ["Python", "react", "not-a-real-skill-xyz"],
      projects: [{ title: "Resume Matcher", description: "Matches resumes to jobs.", techStack: ["TypeScript"] }],
      experience: [{ title: "SWE Intern", organization: "Acme", description: null }],
      certifications: [{ name: "AWS Certified", issuer: "AWS" }],
    });

    const buffer = await buildDocxBuffer(["Grace Hopper", "grace@example.com"]);
    const result = await parser.parse(buffer, DOCX_MIME_TYPE);

    expect(result.fullName).toBe("Grace Hopper");
    expect(result.graduationYear).toBe(2026);
    expect(result.cgpa).toBe(9.1);
    // "not-a-real-skill-xyz" isn't in our dictionary, so it's categorized OTHER
    // rather than dropped — unlike job-requirement skills, a resume skill the
    // student typed is still meaningful even if we don't recognize it.
    const skillNames = result.skills.map((s) => s.name);
    expect(skillNames).toEqual(expect.arrayContaining(["Python", "React"]));
    expect(result.skills.find((s) => s.name === "Python")?.category).toBe("LANGUAGE");
    expect(result.skills.find((s) => s.name === "React")?.category).toBe("FRAMEWORK");
    expect(result.projects).toHaveLength(1);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.rawText).toBeTruthy();
  });

  it("degrades a malformed individual field to its safe default instead of failing the whole parse", async () => {
    requestJsonCompletion.mockResolvedValue({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
      location: null,
      college: null,
      degree: null,
      branch: null,
      graduationYear: "not-a-number", // malformed — should degrade to null via .catch()
      cgpa: 999, // out of range — should degrade to null
      githubUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
      skills: [],
      projects: [],
      experience: [],
      certifications: [],
    });

    const buffer = await buildDocxBuffer(["Ada Lovelace"]);
    const result = await parser.parse(buffer, DOCX_MIME_TYPE);

    expect(result.fullName).toBe("Ada Lovelace");
    expect(result.graduationYear).toBeNull();
    expect(result.cgpa).toBeNull();
  });

  it("throws when the completion is not a JSON object at all (caller falls back to the deterministic parser)", async () => {
    requestJsonCompletion.mockResolvedValue(["not", "an", "object"]);

    const buffer = await buildDocxBuffer(["Some Resume"]);
    await expect(parser.parse(buffer, DOCX_MIME_TYPE)).rejects.toThrow();
  });

  it("propagates an LLM client failure (e.g. all providers unavailable)", async () => {
    requestJsonCompletion.mockRejectedValue(new Error("All configured LLM providers failed"));

    const buffer = await buildDocxBuffer(["Some Resume"]);
    await expect(parser.parse(buffer, DOCX_MIME_TYPE)).rejects.toThrow("All configured LLM providers failed");
  });

  it("truncates over-length fields so a downstream profile update never fails on an LLM-extracted value", async () => {
    requestJsonCompletion.mockResolvedValue({
      fullName: "A".repeat(500),
      email: null,
      phone: null,
      location: null,
      college: null,
      degree: null,
      branch: null,
      graduationYear: null,
      cgpa: null,
      githubUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
      skills: [],
      projects: [],
      experience: [],
      certifications: [],
    });

    const buffer = await buildDocxBuffer(["Resume"]);
    const result = await parser.parse(buffer, DOCX_MIME_TYPE);
    expect(result.fullName?.length).toBeLessThanOrEqual(200);
  });
});
