import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { runAutoApplyForAllEnabledStudents } from "../modules/auto-apply/autoApplyEngine.service.js";

/**
 * Recurring background scan: every AUTO_APPLY_SCAN_INTERVAL_MS, evaluate
 * auto-apply for every student who has it enabled — so discovery →
 * matching → auto-apply happens on a schedule, not only when a student
 * happens to have the app open (PROJECT_PLAN.md background jobs diagram).
 */
// Namespaced by NODE_ENV — see autoApplyQueue.ts for why.
const SCAN_QUEUE_NAME = `auto-apply-scan-${env.NODE_ENV}`;
const RECURRING_JOB_ID = "auto-apply-scan-recurring";

let connection: Redis | null = null;
let scanQueue: Queue | null = null;
let scanWorker: Worker | null = null;

function getConnection(): Redis {
  if (!connection) connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

export async function scheduleAutoApplyScan(): Promise<void> {
  if (!scanQueue) scanQueue = new Queue(SCAN_QUEUE_NAME, { connection: getConnection() });

  // A stable jobId means re-scheduling on every server restart replaces
  // the existing repeatable job instead of stacking duplicates.
  await scanQueue.add(
    "scan",
    {},
    { repeat: { every: env.AUTO_APPLY_SCAN_INTERVAL_MS }, jobId: RECURRING_JOB_ID },
  );

  if (!scanWorker) {
    scanWorker = new Worker(
      SCAN_QUEUE_NAME,
      async () => {
        await runAutoApplyForAllEnabledStudents();
      },
      { connection: getConnection() },
    );
    scanWorker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, err: err.message }, "Auto-apply background scan failed");
    });
  }
}

export async function closeAutoApplyScanQueue(): Promise<void> {
  await scanWorker?.close();
  await scanQueue?.close();
  await connection?.quit();
  scanWorker = null;
  scanQueue = null;
  connection = null;
}
