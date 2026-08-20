import { env } from "../../config/env.js";
import { logger } from "../logger.js";

/**
 * Cascading, OpenAI-compatible chat-completion client for the three
 * configured hosted LLM providers — Groq, Together AI, and OpenRouter.
 * These are general-purpose LLM inference APIs, not internship/job-board
 * or ATS APIs, so they back the swappable ResumeParser/JobDescriptionParser
 * interfaces (see PROJECT_PLAN.md), not InternshipProvider/ApplicationProvider.
 *
 * Providers are tried in order, each bounded by LLM_TIMEOUT_SECONDS, with
 * the whole cascade bounded by LLM_TOTAL_BUDGET_SECONDS. A provider is
 * tried at most once per call — on any failure (auth, rate limit, server
 * error, timeout, malformed response) we move to the next provider rather
 * than retrying the same one, so this can never become an aggressive
 * request loop. If every configured provider fails, or none are
 * configured, `requestJsonCompletion` throws `LlmUnavailableError` and the
 * caller (see parsers/index.ts in each module) falls back to the
 * deterministic parser.
 */

export interface LlmProviderConfig {
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly extraHeaders?: Record<string, string>;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

interface ProviderDef {
  name: string;
  baseUrl: string;
  apiKeyEnv: "GROQ_API_KEY" | "TOGETHER_API_KEY" | "OPENROUTER_API_KEY";
  modelEnv: "GROQ_MODEL" | "TOGETHER_MODEL" | "OPENROUTER_MODEL";
  extraHeaders?: Record<string, string>;
}

const PROVIDER_DEFS: ProviderDef[] = [
  { name: "groq", baseUrl: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL" },
  { name: "together", baseUrl: "https://api.together.xyz/v1", apiKeyEnv: "TOGETHER_API_KEY", modelEnv: "TOGETHER_MODEL" },
  {
    name: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    extraHeaders: { "X-Title": "Intern Platform" },
  },
];

/**
 * Catches the exact mistake that caused the Phase 8 incident (see
 * PROJECT_PLAN.md): a `*_MODEL` variable set to an API key instead of a
 * model identifier. Deliberately narrow — only provider-specific key
 * prefixes and "long, separator-free hex blob" (real model ids are
 * "vendor/name" or otherwise contain letters/digits/./-, never a bare
 * 32+ char hex string) trigger it, so a legitimate model id is never
 * rejected by mistake.
 */
function looksLikeCredential(value: string): boolean {
  if (/^gsk_/.test(value)) return true; // Groq key prefix
  if (/^sk-or-v1-/.test(value)) return true; // OpenRouter key prefix
  if (/^sk-/.test(value)) return true; // OpenAI-style key prefix, used by several providers
  if (value.length >= 32 && /^[0-9a-f]+$/i.test(value)) return true; // raw hex token, e.g. a Together API key
  return false;
}

const warnedAboutCredentialLikeModel = new Set<string>();

/**
 * Only providers with both an API key and a model configured are usable.
 * A provider whose model looks like a credential is treated as
 * unconfigured (it would only ever fail against the real API anyway) and
 * logged once — see looksLikeCredential above.
 */
export function getConfiguredLlmProviders(): LlmProviderConfig[] {
  const providers: LlmProviderConfig[] = [];
  for (const def of PROVIDER_DEFS) {
    const apiKey = env[def.apiKeyEnv];
    const model = env[def.modelEnv];
    if (!apiKey || !model) continue;

    if (looksLikeCredential(model)) {
      if (!warnedAboutCredentialLikeModel.has(def.modelEnv)) {
        warnedAboutCredentialLikeModel.add(def.modelEnv);
        logger.warn(
          { variable: def.modelEnv },
          `${def.modelEnv} appears to contain a credential, not a model identifier. ` +
            `Set ${def.modelEnv} to a model identifier (e.g. from the provider's model-listing endpoint or docs) ` +
            `and keep the API key only in ${def.apiKeyEnv}. This provider is being skipped until it's fixed.`,
        );
      }
      continue;
    }

    providers.push({ name: def.name, baseUrl: def.baseUrl, apiKey, model, extraHeaders: def.extraHeaders });
  }
  return providers;
}

/** Tests must never depend on live external API calls — see PROJECT_PLAN.md and the parsers' fallback registries. */
export function isLlmEnabled(): boolean {
  if (env.NODE_ENV === "test") return false;
  return getConfiguredLlmProviders().length > 0;
}

interface RequestJsonCompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  /** Explicit provider list, for tests — bypasses env/isLlmEnabled entirely. */
  providers?: LlmProviderConfig[];
}

async function callProvider(provider: LlmProviderConfig, systemPrompt: string, userPrompt: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Never logged, never included in a thrown error message below.
          Authorization: `Bearer ${provider.apiKey}`,
          ...provider.extraHeaders,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw new Error("request timed out");
      throw new Error(`network error (${err instanceof Error ? err.message : "unknown"})`);
    }

    if (res.status === 401 || res.status === 403) throw new Error(`authentication failed (HTTP ${res.status})`);
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      throw new Error(`rate limited (HTTP 429${retryAfter ? `, retry-after ${retryAfter}s` : ""})`);
    }
    if (res.status === 404) throw new Error("model or endpoint not found (HTTP 404)");
    if (res.status >= 500) throw new Error(`provider error (HTTP ${res.status})`);
    if (!res.ok) throw new Error(`unexpected response (HTTP ${res.status})`);

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error("malformed JSON response");
    }

    const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("empty completion content");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Parses a chat completion's content as JSON, stripping a markdown code fence if the model added one despite instructions not to. */
function parseCompletionJson(content: string): unknown {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(stripped);
}

export async function requestJsonCompletion(options: RequestJsonCompletionOptions): Promise<unknown> {
  const providers = options.providers ?? getConfiguredLlmProviders();
  if (providers.length === 0) {
    throw new LlmUnavailableError("No LLM provider is configured.");
  }

  const deadline = Date.now() + env.LLM_TOTAL_BUDGET_SECONDS * 1000;
  const failures: string[] = [];

  for (const provider of providers) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      failures.push(`${provider.name}: skipped (total budget exhausted)`);
      continue;
    }
    const perCallTimeoutMs = Math.min(env.LLM_TIMEOUT_SECONDS * 1000, remainingMs);

    try {
      const content = await callProvider(provider, options.systemPrompt, options.userPrompt, perCallTimeoutMs);
      return parseCompletionJson(content);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      logger.warn({ provider: provider.name, reason }, "LLM provider call failed; trying next provider if available");
      failures.push(`${provider.name}: ${reason}`);
    }
  }

  throw new LlmUnavailableError(`All configured LLM providers failed: ${failures.join("; ")}`);
}
