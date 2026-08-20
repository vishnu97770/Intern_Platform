import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { heavyOperationRateLimiter } from "../../middleware/rateLimiter.js";
import { updateAutoApplyRuleSchema } from "./autoApplyRule.validators.js";
import {
  approveApplicationHandler,
  getQueueStatusHandler,
  getRuleHandler,
  runAutoApplyHandler,
  updateRuleHandler,
} from "./autoApply.controller.js";

export const autoApplyRouter = Router();

autoApplyRouter.use(authenticate);

autoApplyRouter.get("/rule", getRuleHandler);
autoApplyRouter.patch("/rule", validateBody(updateAutoApplyRuleSchema), updateRuleHandler);

autoApplyRouter.post("/run", heavyOperationRateLimiter, runAutoApplyHandler);
autoApplyRouter.get("/queue", getQueueStatusHandler);
autoApplyRouter.post("/queue/:applicationId/approve", heavyOperationRateLimiter, approveApplicationHandler);
