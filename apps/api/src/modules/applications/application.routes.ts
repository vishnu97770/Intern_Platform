import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { applicationSearchSchema, createApplicationSchema, updateApplicationStatusSchema } from "./application.validators.js";
import {
  createApplicationHandler,
  deleteApplicationHandler,
  getApplicationHandler,
  listApplicationsHandler,
  updateApplicationStatusHandler,
} from "./application.controller.js";

export const applicationRouter = Router();

applicationRouter.use(authenticate);

applicationRouter.get("/", validateQuery(applicationSearchSchema), listApplicationsHandler);
applicationRouter.post("/", validateBody(createApplicationSchema), createApplicationHandler);
applicationRouter.get("/:id", getApplicationHandler);
applicationRouter.patch("/:id/status", validateBody(updateApplicationStatusSchema), updateApplicationStatusHandler);
applicationRouter.delete("/:id", deleteApplicationHandler);
