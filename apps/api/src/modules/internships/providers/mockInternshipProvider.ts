import type { InternshipProvider, RawInternshipListing } from "@intern-platform/shared";

/**
 * Seed/mock provider so internship discovery works end-to-end without real
 * provider credentials. Replace or add alongside real integrations by
 * implementing InternshipProvider and registering it in ./index.ts — no
 * other code needs to change (see PROJECT_PLAN.md provider abstraction).
 */

interface SeedListing {
  externalId: string;
  title: string;
  company: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "On-site";
  required: string[];
  preferred: string[];
  stipendMin: number;
  stipendMax: number;
  durationMonths: number;
  deadlineDaysFromNow: number;
  minExperienceMonths: number;
  gradYearMin: number;
  gradYearMax: number;
  summary: string;
}

const SEED_LISTINGS: SeedListing[] = [
  {
    externalId: "mock-001",
    title: "Backend Developer Intern",
    company: "Northwind Systems",
    location: "Bengaluru, India",
    workMode: "Hybrid",
    required: ["Go", "Python", "SQL", "Git", "REST APIs"],
    preferred: ["Docker", "Kubernetes"],
    stipendMin: 20000,
    stipendMax: 30000,
    durationMonths: 6,
    deadlineDaysFromNow: 45,
    minExperienceMonths: 0,
    gradYearMin: 2026,
    gradYearMax: 2027,
    summary: "Build and scale backend services powering our logistics platform.",
  },
  {
    externalId: "mock-002",
    title: "Frontend Developer Intern",
    company: "Bluepeak Labs",
    location: "Remote",
    workMode: "Remote",
    required: ["JavaScript", "TypeScript", "React"],
    preferred: ["Tailwind CSS", "GraphQL"],
    stipendMin: 15000,
    stipendMax: 25000,
    durationMonths: 3,
    deadlineDaysFromNow: 20,
    minExperienceMonths: 0,
    gradYearMin: 2025,
    gradYearMax: 2027,
    summary: "Ship user-facing features for a fast-growing SaaS product.",
  },
  {
    externalId: "mock-003",
    title: "Full Stack Engineering Intern",
    company: "Northwind Systems",
    location: "Bengaluru, India",
    workMode: "On-site",
    required: ["JavaScript", "Node.js", "React", "PostgreSQL"],
    preferred: ["TypeScript", "AWS"],
    stipendMin: 25000,
    stipendMax: 35000,
    durationMonths: 6,
    deadlineDaysFromNow: 30,
    minExperienceMonths: 3,
    gradYearMin: 2026,
    gradYearMax: 2026,
    summary: "Own features end-to-end across our web application.",
  },
  {
    externalId: "mock-004",
    title: "Data Science Intern",
    company: "Aurora Analytics",
    location: "Hyderabad, India",
    workMode: "Hybrid",
    required: ["Python", "SQL"],
    preferred: ["TensorFlow", "PyTorch", "scikit-learn"],
    stipendMin: 20000,
    stipendMax: 28000,
    durationMonths: 4,
    deadlineDaysFromNow: 25,
    minExperienceMonths: 0,
    gradYearMin: 2025,
    gradYearMax: 2026,
    summary: "Analyze large datasets to drive product decisions.",
  },
  {
    externalId: "mock-005",
    title: "DevOps Engineering Intern",
    company: "Cascade Cloud",
    location: "Remote",
    workMode: "Remote",
    required: ["Docker", "Kubernetes", "AWS", "Git"],
    preferred: ["Terraform", "CI/CD"],
    stipendMin: 22000,
    stipendMax: 32000,
    durationMonths: 6,
    deadlineDaysFromNow: 40,
    minExperienceMonths: 6,
    gradYearMin: 2025,
    gradYearMax: 2026,
    summary: "Automate deployment pipelines and cloud infrastructure.",
  },
  {
    externalId: "mock-006",
    title: "Machine Learning Intern",
    company: "Aurora Analytics",
    location: "Hyderabad, India",
    workMode: "On-site",
    required: ["Python", "TensorFlow", "PyTorch"],
    preferred: ["Keras", "AWS"],
    stipendMin: 25000,
    stipendMax: 35000,
    durationMonths: 6,
    deadlineDaysFromNow: 35,
    minExperienceMonths: 3,
    gradYearMin: 2026,
    gradYearMax: 2027,
    summary: "Prototype and train ML models for recommendation systems.",
  },
  {
    externalId: "mock-007",
    title: "Cloud Engineer Intern",
    company: "Cascade Cloud",
    location: "Pune, India",
    workMode: "Hybrid",
    required: ["AWS", "Docker", "Linux"],
    preferred: ["Kubernetes", "Terraform"],
    stipendMin: 20000,
    stipendMax: 30000,
    durationMonths: 6,
    deadlineDaysFromNow: 50,
    minExperienceMonths: 0,
    gradYearMin: 2026,
    gradYearMax: 2027,
    summary: "Support cloud infrastructure reliability and cost optimization.",
  },
  {
    externalId: "mock-008",
    title: "Mobile App Development Intern",
    company: "Bluepeak Labs",
    location: "Remote",
    workMode: "Remote",
    required: ["Kotlin", "Swift"],
    preferred: ["React"],
    stipendMin: 15000,
    stipendMax: 22000,
    durationMonths: 3,
    deadlineDaysFromNow: 15,
    minExperienceMonths: 0,
    gradYearMin: 2025,
    gradYearMax: 2027,
    summary: "Build native features for our iOS and Android apps.",
  },
  {
    externalId: "mock-009",
    title: "QA Engineering Intern",
    company: "Northwind Systems",
    location: "Bengaluru, India",
    workMode: "On-site",
    required: ["Selenium", "JUnit", "Git"],
    preferred: ["Python", "CI/CD"],
    stipendMin: 15000,
    stipendMax: 20000,
    durationMonths: 3,
    deadlineDaysFromNow: 18,
    minExperienceMonths: 0,
    gradYearMin: 2026,
    gradYearMax: 2027,
    summary: "Design and automate test suites for our core platform.",
  },
  {
    externalId: "mock-010",
    title: "Unpaid Open Source Contributor Internship",
    company: "OpenGrid Foundation",
    location: "Remote",
    workMode: "Remote",
    required: ["Git", "Python"],
    preferred: ["Docker"],
    stipendMin: 0,
    stipendMax: 0,
    durationMonths: 2,
    deadlineDaysFromNow: 60,
    minExperienceMonths: 0,
    gradYearMin: 2025,
    gradYearMax: 2028,
    summary: "Contribute to a community-maintained open source data platform.",
  },
];

function buildDescription(listing: SeedListing, deadline: Date): string {
  const workModeLabel = listing.workMode === "On-site" ? "On-site" : listing.workMode;
  const stipendLine =
    listing.stipendMin === 0 && listing.stipendMax === 0
      ? "Stipend: Unpaid"
      : `Stipend: ₹${listing.stipendMin.toLocaleString("en-IN")} - ₹${listing.stipendMax.toLocaleString("en-IN")}/month`;

  return `${listing.summary}

${workModeLabel} internship based in ${listing.location}.

Requirements:
${listing.required.join(", ")}

Preferred:
${listing.preferred.length > 0 ? listing.preferred.join(", ") : "None"}

Location: ${listing.location}

Duration: ${listing.durationMonths} months

${stipendLine}

Experience: ${listing.minExperienceMonths} months of experience preferred

Eligible graduating years: ${listing.gradYearMin}-${listing.gradYearMax}

Apply by: ${deadline.toISOString().slice(0, 10)}`;
}

export class MockInternshipProvider implements InternshipProvider {
  readonly slug = "mock-seed";
  readonly displayName = "Seed Internships (Mock Provider)";

  async fetchListings(): Promise<RawInternshipListing[]> {
    const now = new Date();

    return SEED_LISTINGS.map((listing) => {
      const deadline = new Date(now.getTime() + listing.deadlineDaysFromNow * 24 * 60 * 60 * 1000);
      const description = buildDescription(listing, deadline);

      return {
        externalId: listing.externalId,
        title: listing.title,
        company: listing.company,
        description,
        location: listing.location,
        applicationUrl: `https://example-careers.invalid/${listing.company.toLowerCase().replace(/\s+/g, "-")}/${listing.externalId}/apply`,
        sourceUrl: `https://example-careers.invalid/${listing.company.toLowerCase().replace(/\s+/g, "-")}/${listing.externalId}`,
        postedAt: now.toISOString(),
        raw: listing,
      };
    });
  }
}
