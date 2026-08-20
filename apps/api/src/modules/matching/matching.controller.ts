import type { Response } from "express";
import type { RecommendationsQuery } from "@intern-platform/shared";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as matchingService from "./matching.service.js";
import type { RecommendationsQueryInput } from "./matching.validators.js";

export const calculateMatchHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await matchingService.calculateMatch(req.userId, req.params.internshipId as string);
  res.status(200).json(result);
});

export const getMatchHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await matchingService.getMatch(req.userId, req.params.internshipId as string);
  res.status(200).json(result);
});

export const getRecommendationsHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.query as unknown as RecommendationsQueryInput;
  const result = await matchingService.getRecommendations(req.userId, query as RecommendationsQuery);
  res.status(200).json(result);
});
