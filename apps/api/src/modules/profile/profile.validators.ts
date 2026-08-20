import { z } from "zod";

const isoDate = z.string().refine((val) => !Number.isNaN(Date.parse(val)), "Must be a valid ISO date");

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(30).nullable(),
    location: z.string().trim().max(200).nullable(),
    college: z.string().trim().max(200).nullable(),
    degree: z.string().trim().max(200).nullable(),
    branch: z.string().trim().max(200).nullable(),
    graduationYear: z.number().int().min(1990).max(2100).nullable(),
    cgpa: z.number().min(0).max(10).nullable(),
    bio: z.string().trim().max(2000).nullable(),
    githubUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
    linkedinUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
    portfolioUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
    preferredRoles: z.array(z.string().trim().min(1).max(100)).max(20),
    preferredLocations: z.array(z.string().trim().min(1).max(100)).max(20),
    workModePreference: z.enum(["REMOTE", "HYBRID", "ONSITE", "ANY"]),
  })
  .partial();
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

export const skillCategorySchema = z.enum(["LANGUAGE", "FRAMEWORK", "DATABASE", "CLOUD", "TOOL", "OTHER"]);

export const addSkillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: skillCategorySchema.default("OTHER"),
  proficiency: z.number().int().min(1).max(5).nullable().optional(),
});
export type AddSkillBody = z.infer<typeof addSkillSchema>;

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  techStack: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  url: z.string().trim().url().max(500).nullable().optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
});
export type ProjectBody = z.infer<typeof projectSchema>;

export const experienceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  organization: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  isCurrent: z.boolean().default(false),
});
export type ExperienceBody = z.infer<typeof experienceSchema>;

export const certificationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuer: z.string().trim().max(200).nullable().optional(),
  issueDate: isoDate.nullable().optional(),
  url: z.string().trim().url().max(500).nullable().optional(),
});
export type CertificationBody = z.infer<typeof certificationSchema>;
