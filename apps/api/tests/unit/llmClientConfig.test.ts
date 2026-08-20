import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A mutable mock env object — llmClient.ts reads properties off it at call
// time (never destructures at import time), so mutating these fields
// between tests changes what getConfiguredLlmProviders()/isLlmEnabled()
// see, without needing to re-import the module.
const mockEnv: Record<string, string | number | undefined> = {
  NODE_ENV: "production",
  GROQ_API_KEY: undefined,
  GROQ_MODEL: undefined,
  TOGETHER_API_KEY: undefined,
  TOGETHER_MODEL: undefined,
  OPENROUTER_API_KEY: undefined,
  OPENROUTER_MODEL: undefined,
  LLM_TIMEOUT_SECONDS: 8,
  LLM_TOTAL_BUDGET_SECONDS: 20,
};

vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));

const loggerWarn = vi.fn();
vi.mock("../../src/lib/logger.js", () => ({ logger: { warn: (...args: unknown[]) => loggerWarn(...args), error: vi.fn(), info: vi.fn() } }));

const { getConfiguredLlmProviders, isLlmEnabled } = await import("../../src/lib/llm/llmClient.js");

function resetEnv() {
  mockEnv.NODE_ENV = "production";
  mockEnv.GROQ_API_KEY = undefined;
  mockEnv.GROQ_MODEL = undefined;
  mockEnv.TOGETHER_API_KEY = undefined;
  mockEnv.TOGETHER_MODEL = undefined;
  mockEnv.OPENROUTER_API_KEY = undefined;
  mockEnv.OPENROUTER_MODEL = undefined;
}

describe("getConfiguredLlmProviders / isLlmEnabled — configuration validation", () => {
  beforeEach(resetEnv);
  afterEach(() => {
    loggerWarn.mockReset();
  });

  it("includes a provider with both a valid API key and a valid model identifier configured", () => {
    mockEnv.GROQ_API_KEY = "gsk_realkeyvaluehere1234567890";
    mockEnv.GROQ_MODEL = "openai/gpt-oss-20b";

    const providers = getConfiguredLlmProviders();
    expect(providers.map((p) => p.name)).toEqual(["groq"]);
  });

  it("excludes a provider missing its API key, even with a model configured", () => {
    mockEnv.GROQ_MODEL = "openai/gpt-oss-20b";
    expect(getConfiguredLlmProviders()).toEqual([]);
  });

  it("excludes a provider missing its model, even with an API key configured", () => {
    mockEnv.GROQ_API_KEY = "gsk_realkeyvaluehere1234567890";
    expect(getConfiguredLlmProviders()).toEqual([]);
  });

  it("excludes a provider whose model value looks like a Groq API key (gsk_ prefix), warns once (naming the variable but never the value) even across repeated calls", () => {
    mockEnv.GROQ_API_KEY = "gsk_realkeyvaluehere1234567890";
    mockEnv.GROQ_MODEL = "gsk_thisisactuallyakeynotamodel1234567890";

    expect(getConfiguredLlmProviders()).toEqual([]);
    expect(getConfiguredLlmProviders()).toEqual([]);
    expect(getConfiguredLlmProviders()).toEqual([]);

    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const [meta, message] = loggerWarn.mock.calls[0] as [Record<string, unknown>, string];
    expect(meta.variable).toBe("GROQ_MODEL");
    expect(message).toContain("GROQ_MODEL");
    expect(message).not.toContain(mockEnv.GROQ_MODEL as string);
  });

  it("excludes a provider whose model value looks like an OpenRouter API key (sk-or-v1- prefix)", () => {
    mockEnv.OPENROUTER_API_KEY = "sk-or-v1-fakekeyforthistestonly0000000000000000000000000000000000000";
    mockEnv.OPENROUTER_MODEL = "sk-or-v1-anotherfakekeyshapedvalue00000000000000000000000000000000000";

    expect(getConfiguredLlmProviders()).toEqual([]);
  });

  it("excludes a provider whose model value is a raw hex token (Together key shape) rather than a vendor/model id", () => {
    mockEnv.TOGETHER_API_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    mockEnv.TOGETHER_MODEL = "57cd4b0e12471d50064f3effedf32feb330f7df568a87737e77ce10b8116576";

    expect(getConfiguredLlmProviders()).toEqual([]);
  });

  it("does not reject a legitimate model identifier that happens to be long or contain a slash", () => {
    mockEnv.TOGETHER_API_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    mockEnv.TOGETHER_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";

    expect(getConfiguredLlmProviders().map((p) => p.name)).toEqual(["together"]);
  });

  it("configures multiple providers independently — one misconfigured provider doesn't affect the others", () => {
    mockEnv.GROQ_API_KEY = "gsk_realkeyvaluehere1234567890";
    mockEnv.GROQ_MODEL = "gsk_thisisactuallyakeynotamodel1234567890"; // misconfigured
    mockEnv.TOGETHER_API_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    mockEnv.TOGETHER_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"; // correct

    const providers = getConfiguredLlmProviders();
    expect(providers.map((p) => p.name)).toEqual(["together"]);
  });

  it("isLlmEnabled is false when no provider is configured", () => {
    expect(isLlmEnabled()).toBe(false);
  });

  it("isLlmEnabled is true once at least one provider is validly configured (outside test env)", () => {
    mockEnv.GROQ_API_KEY = "gsk_realkeyvaluehere1234567890";
    mockEnv.GROQ_MODEL = "openai/gpt-oss-20b";
    expect(isLlmEnabled()).toBe(true);
  });

  it("isLlmEnabled is always false under NODE_ENV=test, even with valid providers configured", () => {
    mockEnv.NODE_ENV = "test";
    mockEnv.GROQ_API_KEY = "gsk_realkeyvaluehere1234567890";
    mockEnv.GROQ_MODEL = "openai/gpt-oss-20b";
    expect(isLlmEnabled()).toBe(false);
  });
});
