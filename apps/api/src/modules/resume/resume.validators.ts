import { z } from "zod";
import { addSkillSchema, certificationSchema, experienceSchema, projectSchema } from "../profile/profile.validators.js";

const profileEditsSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(30).nullable(),
    location: z.string().trim().max(200).nullable(),
    college: z.string().trim().max(200).nullable(),
    degree: z.string().trim().max(200).nullable(),
    branch: z.string().trim().max(200).nullable(),
    graduationYear: z.number().int().min(1990).max(2100).nullable(),
    cgpa: z.number().min(0).max(10).nullable(),
    githubUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
    linkedinUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
    portfolioUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
  })
  .partial();

/** What the student explicitly approved after reviewing the parsed proposal — see PROJECT_PLAN.md resume pipeline. */
export const confirmResumeSchema = z.object({
  profile: profileEditsSchema.optional(),
  skills: z.array(addSkillSchema).max(50).optional(),
  projects: z.array(projectSchema).max(50).optional(),
  experience: z.array(experienceSchema).max(50).optional(),
  certifications: z.array(certificationSchema).max(50).optional(),
});
export type ConfirmResumeBody = z.infer<typeof confirmResumeSchema>;
