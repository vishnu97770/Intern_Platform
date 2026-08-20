import type { Request, Response } from "express";
import type { AuthResponse } from "@intern-platform/shared";
import * as authService from "./auth.service.js";
import type { RegisterBody, LoginBody } from "./auth.validators.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../lib/errors.js";

const REFRESH_COOKIE_NAME = "refresh_token";
// Scoped to /api/auth so the cookie is never sent on unrelated API calls.
const REFRESH_COOKIE_PATH = "/api/auth";

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function toAuthResponse(user: AuthResponse["user"], tokens: authService.IssuedTokens): AuthResponse {
  return { user, accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}

export const registerHandler = asyncHandler(async (req: Request<unknown, unknown, RegisterBody>, res: Response) => {
  const { user, tokens } = await authService.register(req.body);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json(toAuthResponse(user, tokens));
});

export const loginHandler = asyncHandler(async (req: Request<unknown, unknown, LoginBody>, res: Response) => {
  const { user, tokens } = await authService.login(req.body);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(200).json(toAuthResponse(user, tokens));
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    throw new UnauthorizedError("Missing refresh token");
  }
  const { user, tokens } = await authService.refresh(rawToken);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(200).json(toAuthResponse(user, tokens));
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) {
    await authService.logout(rawToken);
  }
  clearRefreshCookie(res);
  res.status(204).send();
});
