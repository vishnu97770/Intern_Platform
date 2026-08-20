import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { startAutoApplyWorker, closeAutoApplyQueue } from "./jobs/autoApplyQueue.js";
import { scheduleAutoApplyScan, closeAutoApplyScanQueue } from "./jobs/autoApplyScanQueue.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Background job processing (Phase 6): submission worker + recurring scan.
// Started after the HTTP server so a Redis outage delays only background
// processing, never the API itself; failures here are logged, not fatal.
try {
  startAutoApplyWorker();
  await scheduleAutoApplyScan();
  logger.info("Auto-apply background worker and scheduled scan started");
} catch (err) {
  logger.error({ err: err instanceof Error ? err.message : "unknown error" }, "Failed to start auto-apply background jobs");
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down`);
  server.close();
  await Promise.allSettled([closeAutoApplyQueue(), closeAutoApplyScanQueue()]);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
