import type { Request, Response } from "express";
import type { InternshipSearchParams } from "@intern-platform/shared";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as ingestionService from "./internship.ingestion.service.js";
import * as internshipService from "./internship.service.js";
import type { InternshipSearchQuery } from "./internship.validators.js";

export const searchInternshipsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as InternshipSearchQuery;
  const result = await internshipService.searchInternships(query as InternshipSearchParams);
  res.status(200).json(result);
});

export const getInternshipHandler = asyncHandler(async (req: Request, res: Response) => {
  const internship = await internshipService.getInternshipById(req.params.id as string);
  res.status(200).json(internship);
});

export const syncInternshipsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const results = await ingestionService.ingestAllProviders();
  res.status(200).json(results);
});
