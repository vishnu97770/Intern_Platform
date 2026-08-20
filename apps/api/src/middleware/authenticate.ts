import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../lib/jwt.js";
import { UnauthorizedError } from "../lib/errors.js";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

/** Requires a valid `Authorization: Bearer <access token>` header. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing bearer token"));
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Access token expired"));
      return;
    }
    next(new UnauthorizedError("Invalid access token"));
  }
}
