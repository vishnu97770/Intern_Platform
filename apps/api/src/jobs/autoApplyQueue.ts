import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { submitQueuedApplication } from "../modules/auto-apply/autoApplyEngine.service.js";

/**
 * BullMQ-backed background processing for the auto-apply pipeline:
 *
 *   evaluateAndQueueForStudent() → SUBMIT_QUEUE job → submitQueuedApplication()
 *
 * so a submission doesn't require the student's browser to stay open, and
 * failures get durable retries with backoff instead of being lost. The
 * Queue/Worker connections are created lazily and only started for the
 * running server process (see index.ts) — tests exercise the business
 * logic (submitQueuedApplication, evaluateAutoApplyEligibility) directly,
 * without needing a live worker.
 */
// Namespaced by NODE_ENV so a test run's enqueued jobs never land in the
// same Redis queue the dev/production worker is draining (and vice versa).
const SUBMIT_QUEUE_NAME = `auto-apply-submit-${env.NODE_ENV}`;

export interface SubmitApplicationJobData {
  userId: string;
  applicationId: string;
}

let connection: Redis | null = null;
let submitQueue: Queue<SubmitApplicationJobData> | null = null;
let submitWorker: Worker<SubmitApplicationJobData> | null = null;

function getConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getAutoApplySubmitQueue(): Queue<SubmitApplicationJobData> {
  if (!submitQueue) {
    submitQueue = new Queue<SubmitApplicationJobData>(SUBMIT_QUEUE_NAME, { connection: getConnection() });
  }
  return submitQueue;
}

/** Enqueues a submission with retries + exponential backoff — never submitted synchronously from a request handler. */
export async function enqueueSubmission(data: SubmitApplicationJobData): Promise<void> {
  await getAutoApplySubmitQueue().add("submit", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export function startAutoApplyWorker(): Worker<SubmitApplicationJobData> {
  if (submitWorker) return submitWorker;

  submitWorker = new Worker<SubmitApplicationJobData>(
    SUBMIT_QUEUE_NAME,
    async (job: Job<SubmitApplicationJobData>) => {
      await submitQueuedApplication(job.data.userId, job.data.applicationId);
    },
    { connection: getConnection(), concurrency: 2 },
  );

  submitWorker.on("failed", (job, err) => {
    logger.warn({ jobId: job?.id, applicationId: job?.data.applicationId, err: err.message }, "Auto-apply submission job failed");
  });

  return submitWorker;
}

/** Closes all connections cleanly — used by tests and graceful shutdown. */
export async function closeAutoApplyQueue(): Promise<void> {
  await submitWorker?.close();
  await submitQueue?.close();
  await connection?.quit();
  submitWorker = null;
  submitQueue = null;
  connection = null;
}
