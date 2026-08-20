import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { profileRouter } from "../modules/profile/profile.routes.js";
import { resumeRouter } from "../modules/resume/resume.routes.js";
import { internshipRouter } from "../modules/internships/internship.routes.js";
import { matchingRouter } from "../modules/matching/matching.routes.js";
import { applicationRouter } from "../modules/applications/application.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/resume", resumeRouter);
apiRouter.use("/internships", internshipRouter);
apiRouter.use("/matches", matchingRouter);
apiRouter.use("/applications", applicationRouter);
