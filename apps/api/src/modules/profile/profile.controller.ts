import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as profileService from "./profile.service.js";

export const getProfileHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.getProfile(req.userId);
  res.status(200).json(profile);
});

export const updateProfileHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.updateProfile(req.userId, req.body);
  res.status(200).json(profile);
});

export const addSkillHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.addSkill(req.userId, req.body);
  res.status(201).json(profile);
});

export const removeSkillHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.removeSkill(req.userId, req.params.skillId as string);
  res.status(200).json(profile);
});

export const addProjectHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.addProject(req.userId, req.body);
  res.status(201).json(profile);
});

export const deleteProjectHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.deleteProject(req.userId, req.params.projectId as string);
  res.status(200).json(profile);
});

export const addExperienceHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.addExperience(req.userId, req.body);
  res.status(201).json(profile);
});

export const deleteExperienceHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.deleteExperience(req.userId, req.params.experienceId as string);
  res.status(200).json(profile);
});

export const addCertificationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.addCertification(req.userId, req.body);
  res.status(201).json(profile);
});

export const deleteCertificationHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await profileService.deleteCertification(req.userId, req.params.certificationId as string);
  res.status(200).json(profile);
});
