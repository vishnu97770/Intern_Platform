import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/** Parses `req.body` against `schema`, replacing it with the parsed (typed) value. Throws ZodError on failure, caught by errorHandler. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}
