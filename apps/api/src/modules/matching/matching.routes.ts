import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateQuery } from "../../middleware/validate.js";
import { recommendationsQuerySchema } from "./matching.validators.js";
import { calculateMatchHandler, getMatchHandler, getRecommendationsHandler } from "./matching.controller.js";

export const matchingRouter = Router();

matchingRouter.use(authenticate);

matchingRouter.get("/recommendations", validateQuery(recommendationsQuerySchema), getRecommendationsHandler);
// Explanations are embedded in the match result itself (MatchResultDTO.explanation) —
// no separate "retrieve explanation" endpoint needed.
matchingRouter.post("/internships/:internshipId", calculateMatchHandler);
matchingRouter.get("/internships/:internshipId", getMatchHandler);
