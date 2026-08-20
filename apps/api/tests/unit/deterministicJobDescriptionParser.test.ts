import { describe, expect, it } from "vitest";
import { DeterministicJobDescriptionParser } from "../../src/modules/internships/parsers/deterministicJobDescriptionParser.js";

const parser = new DeterministicJobDescriptionParser();

const SAMPLE_DESCRIPTION = `Build and scale backend services powering our logistics platform.

Hybrid internship based in Bengaluru, India.

Requirements:
Go, Python, SQL, Git, REST APIs

Preferred:
Docker, Kubernetes

Location: Bengaluru, India

Duration: 6 months

Stipend: ₹20,000 - ₹30,000/month

Experience: 3 months of experience preferred

Eligible graduating years: 2026-2027

Apply by: 2026-10-15`;

describe("DeterministicJobDescriptionParser", () => {
  it("separates required from preferred skills", async () => {
    const result = await parser.parse(SAMPLE_DESCRIPTION);
    expect(result.requiredSkills).toEqual(expect.arrayContaining(["Go", "Python", "SQL", "Git"]));
    expect(result.preferredSkills).toEqual(expect.arrayContaining(["Docker", "Kubernetes"]));
    // A skill listed as preferred must not also appear as required.
    expect(result.requiredSkills).not.toEqual(expect.arrayContaining(["Docker"]));
  });

  it("extracts work mode, location, stipend, and duration", async () => {
    const result = await parser.parse(SAMPLE_DESCRIPTION);
    expect(result.workMode).toBe("HYBRID");
    expect(result.locations).toEqual(["Bengaluru", "India"]);
    expect(result.stipendMin).toBe(20000);
    expect(result.stipendMax).toBe(30000);
    expect(result.stipendCurrency).toBe("INR");
    expect(result.durationMonths).toBe(6);
  });

  it("extracts graduation year range, experience requirement, and deadline", async () => {
    const result = await parser.parse(SAMPLE_DESCRIPTION);
    expect(result.minGraduationYear).toBe(2026);
    expect(result.maxGraduationYear).toBe(2027);
    expect(result.minExperienceMonths).toBe(3);
    expect(result.applicationDeadline).toBe(new Date("2026-10-15").toISOString());
  });

  it("recognizes remote work mode and unpaid stipend", async () => {
    const result = await parser.parse("Remote internship. Stipend: Unpaid. Requirements: Git, Python");
    expect(result.workMode).toBe("REMOTE");
    expect(result.stipendMin).toBe(0);
    expect(result.stipendMax).toBe(0);
  });

  it("is deterministic", async () => {
    const first = await parser.parse(SAMPLE_DESCRIPTION);
    const second = await parser.parse(SAMPLE_DESCRIPTION);
    expect(second).toEqual(first);
  });

  it("degrades gracefully on text with no structured signals", async () => {
    const result = await parser.parse("A short internship posting with no details.");
    expect(result.requiredSkills).toEqual([]);
    expect(result.workMode).toBeNull();
    expect(result.stipendMin).toBeNull();
    expect(result.applicationDeadline).toBeNull();
  });
});
