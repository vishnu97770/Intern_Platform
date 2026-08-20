import { z } from "zod";

export const internshipSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  skill: z.string().trim().max(100).optional(),
  minStipend: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["recent", "deadline", "stipend"]).default("recent"),
});
export type InternshipSearchQuery = z.infer<typeof internshipSearchSchema>;
