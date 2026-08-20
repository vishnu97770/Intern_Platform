import { Router } from "express";
import { checkHealth } from "../modules/health/health.service.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { profileRouter } from "../modules/profile/profile.routes.js";
import { resumeRouter } from "../modules/resume/resume.routes.js";
import { internshipRouter } from "../modules/internships/internship.routes.js";
import { matchingRouter } from "../modules/matching/matching.routes.js";
import { applicationRouter } from "../modules/applications/application.routes.js";
import { autoApplyRouter } from "../modules/auto-apply/autoApply.routes.js";

export const apiRouter = Router();

apiRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const health = await checkHealth();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  }),
);

apiRouter.use("/auth", authRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/resume", resumeRouter);
apiRouter.use("/internships", internshipRouter);
apiRouter.use("/matches", matchingRouter);
apiRouter.use("/applications", applicationRouter);
apiRouter.use("/auto-apply", autoApplyRouter);
