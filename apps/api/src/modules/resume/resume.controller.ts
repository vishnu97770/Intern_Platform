import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { ValidationError } from "../../lib/errors.js";
import * as resumeService from "./resume.service.js";

export const uploadResumeHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file;
  if (!file) throw new ValidationError("No file uploaded. Attach a PDF or DOCX under field 'resume'.");

  const resume = await resumeService.uploadResume(req.userId, {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  });
  res.status(201).json(resume);
});

export const listResumesHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const resumes = await resumeService.listResumes(req.userId);
  res.status(200).json(resumes);
});

export const getResumeHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const resume = await resumeService.getResume(req.userId, req.params.resumeId as string);
  res.status(200).json(resume);
});

export const getResumeFileHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { buffer, mimeType, fileName } = await resumeService.getResumeFile(req.userId, req.params.resumeId as string);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
  res.status(200).send(buffer);
});

export const confirmResumeHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await resumeService.confirmResume(req.userId, req.params.resumeId as string, req.body);
  res.status(200).json(result);
});

export const deleteResumeHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await resumeService.deleteResume(req.userId, req.params.resumeId as string);
  res.status(204).send();
});
