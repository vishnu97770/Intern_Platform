import { z } from "zod";

export const recommendationsQuerySchema = z.object({
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type RecommendationsQueryInput = z.infer<typeof recommendationsQuerySchema>;
