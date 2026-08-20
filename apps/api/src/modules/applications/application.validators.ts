import { z } from "zod";

export const applicationStatusSchema = z.enum([
  "DISCOVERED",
  "ELIGIBLE",
  "QUEUED",
  "APPLYING",
  "APPLIED",
  "FAILED",
  "MANUAL_ACTION_REQUIRED",
  "REJECTED",
  "INTERVIEW",
  "OFFER",
  "WITHDRAWN",
]);

export const createApplicationSchema = z.object({
  internshipId: z.string().uuid(),
});
export type CreateApplicationBody = z.infer<typeof createApplicationSchema>;

export const updateApplicationStatusSchema = z.object({
  status: applicationStatusSchema,
  failureReason: z.string().trim().max(1000).nullable().optional(),
  providerReference: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateApplicationStatusBody = z.infer<typeof updateApplicationStatusSchema>;

const csvStatusList = z
  .string()
  .transform((val) => val.split(",").map((s) => s.trim()))
  .pipe(z.array(applicationStatusSchema));

export const applicationSearchSchema = z.object({
  status: csvStatusList.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["recent", "matchScore", "deadline"]).default("recent"),
});
export type ApplicationSearchQuery = z.infer<typeof applicationSearchSchema>;
