import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateQuery } from "../../middleware/validate.js";
import { internshipSearchSchema } from "./internship.validators.js";
import { getInternshipHandler, searchInternshipsHandler, syncInternshipsHandler } from "./internship.controller.js";

export const internshipRouter = Router();

internshipRouter.use(authenticate);

internshipRouter.get("/", validateQuery(internshipSearchSchema), searchInternshipsHandler);
// Synchronous, on-demand ingestion trigger for development. Phase 6 wires
// this same ingestAllProviders() call into a scheduled BullMQ job instead
// of requiring a manual call.
internshipRouter.post("/sync", syncInternshipsHandler);
internshipRouter.get("/:id", getInternshipHandler);
