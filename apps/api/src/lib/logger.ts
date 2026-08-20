import pino from "pino";
import { env } from "../config/env.js";

/**
 * Structured logger. Redacts fields that commonly carry secrets so a
 * misplaced `logger.info({ req })` call can't leak credentials/tokens.
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
});
