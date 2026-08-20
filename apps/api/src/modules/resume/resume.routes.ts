import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { heavyOperationRateLimiter } from "../../middleware/rateLimiter.js";
import { resumeUpload } from "../../middleware/upload.js";
import { confirmResumeSchema } from "./resume.validators.js";
import {
  confirmResumeHandler,
  deleteResumeHandler,
  getResumeFileHandler,
  getResumeHandler,
  listResumesHandler,
  uploadResumeHandler,
} from "./resume.controller.js";

export const resumeRouter = Router();

resumeRouter.use(authenticate);

resumeRouter.get("/", listResumesHandler);
resumeRouter.post("/upload", heavyOperationRateLimiter, resumeUpload.single("resume"), uploadResumeHandler);
resumeRouter.get("/:resumeId", getResumeHandler);
resumeRouter.get("/:resumeId/file", getResumeFileHandler);
resumeRouter.post("/:resumeId/confirm", validateBody(confirmResumeSchema), confirmResumeHandler);
resumeRouter.delete("/:resumeId", deleteResumeHandler);
