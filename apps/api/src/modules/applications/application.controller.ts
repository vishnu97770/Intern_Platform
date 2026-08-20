import type { Response } from "express";
import type { ApplicationSearchParams } from "@intern-platform/shared";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as applicationService from "./application.service.js";
import type { ApplicationSearchQuery } from "./application.validators.js";

export const createApplicationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const application = await applicationService.createApplication(req.userId, req.body);
  res.status(201).json(application);
});

export const listApplicationsHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.query as unknown as ApplicationSearchQuery;
  const result = await applicationService.listApplications(req.userId, query as ApplicationSearchParams);
  res.status(200).json(result);
});

export const getApplicationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const application = await applicationService.getApplication(req.userId, req.params.id as string);
  res.status(200).json(application);
});

export const updateApplicationStatusHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const application = await applicationService.updateApplicationStatus(req.userId, req.params.id as string, req.body);
  res.status(200).json(application);
});

export const deleteApplicationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await applicationService.deleteApplication(req.userId, req.params.id as string);
  res.status(204).send();
});
