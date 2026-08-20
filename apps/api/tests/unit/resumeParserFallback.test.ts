import { afterEach, describe, expect, it, vi } from "vitest";

const isLlmEnabled = vi.fn();
const llmParse = vi.fn();

vi.mock("../../src/lib/llm/llmClient.js", () => ({ isLlmEnabled: () => isLlmEnabled() }));
vi.mock("../../src/modules/resume/parsers/llmResumeParser.js", () => ({
  LlmResumeParser: class {
    supports() {
      return true;
    }
    parse(...args: unknown[]) {
      return llmParse(...args);
    }
  },
}));

const { resumeParser } = await import("../../src/modules/resume/parsers/index.js");
const { DOCX_MIME_TYPE } = await import("../../src/modules/resume/parsers/textExtraction.js");
const { Document, Packer, Paragraph } = await import("docx");

async function buildDocxBuffer(): Promise<Buffer> {
  const doc = new Document({ sections: [{ children: [new Paragraph("Jane Doe"), new Paragraph("jane@example.com")] }] });
  return Packer.toBuffer(doc);
}

describe("resume parsers/index.ts fallback registry", () => {
  afterEach(() => {
    isLlmEnabled.mockReset();
    llmParse.mockReset();
  });

  it("uses the deterministic parser directly when LLM parsing is disabled (never touches the LLM parser)", async () => {
    isLlmEnabled.mockReturnValue(false);
    const buffer = await buildDocxBuffer();

    const result = await resumeParser.parse(buffer, DOCX_MIME_TYPE);

    expect(llmParse).not.toHaveBeenCalled();
    expect(result.fullName).toBe("Jane Doe");
  });

  it("uses the LLM parser's result when it succeeds", async () => {
    isLlmEnabled.mockReturnValue(true);
    llmParse.mockResolvedValue({
      fullName: "From LLM",
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
      rawText: "raw",
      confidence: 0.5,
    });

    const result = await resumeParser.parse(await buildDocxBuffer(), DOCX_MIME_TYPE);
    expect(result.fullName).toBe("From LLM");
  });

  it("falls back to the deterministic parser when the LLM parser throws, without surfacing the error to the caller", async () => {
    isLlmEnabled.mockReturnValue(true);
    llmParse.mockRejectedValue(new Error("All configured LLM providers failed"));

    const result = await resumeParser.parse(await buildDocxBuffer(), DOCX_MIME_TYPE);
    // The deterministic parser still successfully extracts the name from the same text.
    expect(result.fullName).toBe("Jane Doe");
  });
});
