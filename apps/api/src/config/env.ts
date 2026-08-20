import "dotenv/config";
import { z } from "zod";

/**
 * Validates and centralizes access to environment configuration. Fails fast
 * on startup if required variables are missing, instead of surfacing an
 * obscure error the first time a route touches an unset value.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  UPLOAD_DIR: z.string().default("uploads"),
  REDIS_URL: z.string().default("redis://localhost:6380"),
  // How often the background auto-apply scan runs for every student with
  // auto-apply enabled (Phase 6 background job). Defaults to 15 minutes.
  AUTO_APPLY_SCAN_INTERVAL_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),

  // ---- Hosted LLM providers (optional) ---------------------------------
  // Cascading chat-completion backends for the LLM-assisted resume/job
  // parsers (see lib/llm/llmClient.ts). All optional — with none
  // configured, parsing runs on the deterministic parser only, exactly as
  // before. Each provider needs both its API key and its model id to be
  // considered configured; a key with no model (or vice versa) is treated
  // as not configured for that provider rather than erroring at startup,
  // since these are enhancements, never a hard requirement.
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  TOGETHER_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  // Per-provider request timeout and total cross-provider budget for one
  // parse call, in seconds — bounds both a single slow provider and the
  // worst case of falling through all of them.
  LLM_TIMEOUT_SECONDS: z.coerce.number().positive().default(8),
  LLM_TOTAL_BUDGET_SECONDS: z.coerce.number().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  // Intentionally do not log process.env here — only the specific problems.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
