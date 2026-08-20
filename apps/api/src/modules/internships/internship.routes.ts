import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateQuery } from "../../middleware/validate.js";
import { heavyOperationRateLimiter } from "../../middleware/rateLimiter.js";
import { internshipSearchSchema } from "./internship.validators.js";
import { getInternshipHandler, searchInternshipsHandler, syncInternshipsHandler } from "./internship.controller.js";

export const internshipRouter = Router();

internshipRouter.use(authenticate);

internshipRouter.get("/", validateQuery(internshipSearchSchema), searchInternshipsHandler);
// Synchronous, on-demand ingestion trigger — useful for development and
// for forcing a refresh. A scheduled BullMQ job (see jobs/) would call the
// same ingestAllProviders() on a timer for hands-off production use.
internshipRouter.post("/sync", heavyOperationRateLimiter, syncInternshipsHandler);
internshipRouter.get("/:id", getInternshipHandler);
