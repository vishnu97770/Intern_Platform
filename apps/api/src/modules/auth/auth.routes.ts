import { Router } from "express";
import { validateBody } from "../../middleware/validate.js";
import { authRateLimiter } from "../../middleware/rateLimiter.js";
import { registerSchema, loginSchema } from "./auth.validators.js";
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimiter, validateBody(registerSchema), registerHandler);
authRouter.post("/login", authRateLimiter, validateBody(loginSchema), loginHandler);
authRouter.post("/refresh", authRateLimiter, refreshHandler);
authRouter.post("/logout", logoutHandler);
