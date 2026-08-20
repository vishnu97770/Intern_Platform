import { z } from "zod";

export const updateAutoApplyRuleSchema = z
  .object({
    isEnabled: z.boolean(),
    minMatchScore: z.number().int().min(0).max(100),
    maxApplicationsPerDay: z.number().int().min(1).max(100),
    preferredRoles: z.array(z.string().trim().min(1).max(100)).max(20),
    preferredLocations: z.array(z.string().trim().min(1).max(100)).max(20),
    excludedCompanies: z.array(z.string().trim().min(1).max(200)).max(50),
    requireManualApproval: z.boolean(),
  })
  .partial();
export type UpdateAutoApplyRuleBody = z.infer<typeof updateAutoApplyRuleSchema>;
