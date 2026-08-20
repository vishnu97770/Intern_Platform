import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as autoApplyRuleService from "./autoApplyRule.service.js";
import * as autoApplyEngineService from "./autoApplyEngine.service.js";

export const getRuleHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rule = await autoApplyRuleService.getRule(req.userId);
  res.status(200).json(rule);
});

export const updateRuleHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rule = await autoApplyRuleService.updateRule(req.userId, req.body);
  res.status(200).json(rule);
});

export const runAutoApplyHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await autoApplyEngineService.runAutoApplyForStudent(req.userId);
  res.status(200).json(result);
});

export const approveApplicationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const application = await autoApplyEngineService.approveQueuedApplication(req.userId, req.params.applicationId as string);
  res.status(200).json(application);
});

export const getQueueStatusHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const status = await autoApplyEngineService.getQueueStatus(req.userId);
  res.status(200).json(status);
});
