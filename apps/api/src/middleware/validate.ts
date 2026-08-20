import type { NextFunction, Request, Response } from "express";
import type { ZodSchema, ZodTypeAny } from "zod";

/** Parses `req.body` against `schema`, replacing it with the parsed (typed) value. Throws ZodError on failure, caught by errorHandler. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

/**
 * Same as validateBody, but for `req.query` (e.g. search/filter/pagination
 * params). Typed by the schema's output only (`ZodTypeAny`, not
 * `ZodSchema<T>`) — query schemas commonly use `.default()`/`.transform()`,
 * whose *input* type legitimately differs from T, which trips up
 * `ZodSchema<T>`'s stricter input===output constraint.
 */
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as typeof req.query;
    next();
  };
}
