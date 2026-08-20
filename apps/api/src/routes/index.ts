import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { profileRouter } from "../modules/profile/profile.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/profile", profileRouter);
