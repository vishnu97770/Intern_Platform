import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

/**
 * Single shared Prisma client. Reused across the app (and cached on
 * `globalThis` in dev) to avoid exhausting Postgres connections when the
 * dev server hot-reloads.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
