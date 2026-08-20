import { Redis } from "ioredis";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

/**
 * Real connectivity checks (not just "the process is up") — a database or
 * Redis outage should be visible at /api/health, not discovered only when
 * a request fails downstream.
 */
export interface HealthStatus {
  status: "ok" | "degraded";
  database: "ok" | "error";
  redis: "ok" | "error";
}

let redisHealthClient: Redis | null = null;

function getRedisHealthClient(): Redis {
  if (!redisHealthClient) {
    redisHealthClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
    // Health failures are reported explicitly by checkHealth() — this only
    // stops an unhandled 'error' event from crashing the process.
    redisHealthClient.on("error", () => undefined);
  }
  return redisHealthClient;
}

async function checkDatabase(): Promise<"ok" | "error"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<"ok" | "error"> {
  try {
    const client = getRedisHealthClient();
    if (client.status === "wait" || client.status === "end") await client.connect();
    return (await client.ping()) === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function checkHealth(): Promise<HealthStatus> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return { status: database === "ok" && redis === "ok" ? "ok" : "degraded", database, redis };
}

/** For clean shutdown/test teardown — not needed by the running server (the process exit itself is enough). */
export async function closeHealthRedisClient(): Promise<void> {
  await redisHealthClient?.quit();
  redisHealthClient = null;
}
