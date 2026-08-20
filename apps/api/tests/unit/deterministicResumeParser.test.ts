import { describe, expect, it } from "vitest";
import { parseResumeText } from "../../src/modules/resume/parsers/deterministicResumeParser.js";

const SAMPLE_RESUME = `Grace Hopper
grace.hopper@example.com
+1 415-555-0182
https://github.com/gracehopper
https://linkedin.com/in/gracehopper
https://gracehopper.dev

EDUCATION
B.Tech in Computer Science, Massachusetts Institute of Technology
CGPA: 9.1/10
2021 - 2025

SKILLS
Python, Go, JavaScript, React, PostgreSQL, Docker, Git, REST APIs

PROJECTS
Resume Matcher - A tool that parses resumes and matches them to internships.
Tech Stack: TypeScript, Node.js, PostgreSQL
Built with React and deployed on AWS.

EXPERIENCE
Software Engineering Intern - Acme Corp
Worked on backend services using Go and PostgreSQL.

CERTIFICATIONS
AWS Certified Cloud Practitioner - Amazon Web Services
`;

describe("parseResumeText", () => {
  const parsed = parseResumeText(SAMPLE_RESUME);

  it("extracts contact details", () => {
    expect(parsed.fullName).toBe("Grace Hopper");
    expect(parsed.email).toBe("grace.hopper@example.com");
    expect(parsed.phone).toContain("415");
  });

  it("extracts social/portfolio links", () => {
    expect(parsed.githubUrl).toBe("https://github.com/gracehopper");
    expect(parsed.linkedinUrl).toBe("https://linkedin.com/in/gracehopper");
    expect(parsed.portfolioUrl).toBe("https://gracehopper.dev");
  });

  it("extracts education details", () => {
    expect(parsed.degree).toBe("B.Tech");
    expect(parsed.branch).toMatch(/Computer Science/);
    expect(parsed.college).toMatch(/Massachusetts Institute of Technology/);
    expect(parsed.graduationYear).toBe(2025);
    expect(parsed.cgpa).toBe(9.1);
  });

  it("extracts and categorizes skills from the skills section", () => {
    const names = parsed.skills.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Python", "Go", "JavaScript", "React", "PostgreSQL", "Docker", "Git"]));
    expect(parsed.skills.find((s) => s.name === "Python")?.category).toBe("LANGUAGE");
    expect(parsed.skills.find((s) => s.name === "React")?.category).toBe("FRAMEWORK");
    expect(parsed.skills.find((s) => s.name === "PostgreSQL")?.category).toBe("DATABASE");
    expect(parsed.skills.find((s) => s.name === "Docker")?.category).toBe("CLOUD");
  });

  it("extracts projects with a detected tech stack", () => {
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0]?.title).toBe("Resume Matcher");
    expect(parsed.projects[0]?.techStack).toEqual(expect.arrayContaining(["TypeScript", "PostgreSQL"]));
  });

  it("extracts experience entries", () => {
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0]?.title).toBe("Software Engineering Intern");
    expect(parsed.experience[0]?.organization).toBe("Acme Corp");
  });

  it("extracts certifications", () => {
    expect(parsed.certifications).toEqual([{ name: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services" }]);
  });

  it("produces a confidence score reflecting how much was extracted", () => {
    expect(parsed.confidence).toBeGreaterThan(0.5);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
  });

  it("is deterministic: parsing the same text twice yields identical output", () => {
    const again = parseResumeText(SAMPLE_RESUME);
    expect(again).toEqual(parsed);
  });

  it("degrades gracefully on sparse/empty input", () => {
    const empty = parseResumeText("");
    expect(empty.fullName).toBeNull();
    expect(empty.email).toBeNull();
    expect(empty.skills).toEqual([]);
    expect(empty.confidence).toBe(0);
  });
});
