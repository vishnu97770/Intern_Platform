import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmUnavailableError, requestJsonCompletion, type LlmProviderConfig } from "../../src/lib/llm/llmClient.js";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function chatCompletion(content: string) {
  return { choices: [{ message: { content } }] };
}

function provider(name: string): LlmProviderConfig {
  return { name, baseUrl: `https://${name}.example.invalid/v1`, apiKey: `secret-key-for-${name}`, model: "test-model" };
}

describe("requestJsonCompletion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws LlmUnavailableError immediately when no providers are configured", async () => {
    await expect(requestJsonCompletion({ systemPrompt: "s", userPrompt: "u", providers: [] })).rejects.toThrow(
      LlmUnavailableError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("parses a successful completion's JSON content", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(chatCompletion(JSON.stringify({ hello: "world" }))));

    const result = await requestJsonCompletion({ systemPrompt: "s", userPrompt: "u", providers: [provider("groq")] });
    expect(result).toEqual({ hello: "world" });
  });

  it("strips a markdown code fence if the model added one despite instructions", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(chatCompletion('```json\n{"a":1}\n```')),
    );

    const result = await requestJsonCompletion({ systemPrompt: "s", userPrompt: "u", providers: [provider("groq")] });
    expect(result).toEqual({ a: 1 });
  });

  it("falls over to the next provider on 401 without retrying the failed one", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const result = await requestJsonCompletion({
      systemPrompt: "s",
      userPrompt: "u",
      providers: [provider("groq"), provider("together")],
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls over to the next provider on 429 rate limiting", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429, { "Retry-After": "30" }))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const result = await requestJsonCompletion({
      systemPrompt: "s",
      userPrompt: "u",
      providers: [provider("groq"), provider("together")],
    });
    expect(result).toEqual({ ok: true });
  });

  it("falls over to the next provider on a 500 provider error", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 503))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const result = await requestJsonCompletion({
      systemPrompt: "s",
      userPrompt: "u",
      providers: [provider("groq"), provider("together")],
    });
    expect(result).toEqual({ ok: true });
  });

  it("falls over on a malformed (non-JSON) response body", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response("not json at all", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const result = await requestJsonCompletion({
      systemPrompt: "s",
      userPrompt: "u",
      providers: [provider("groq"), provider("together")],
    });
    expect(result).toEqual({ ok: true });
  });

  it("falls over when the completion content itself isn't valid JSON", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse(chatCompletion("I cannot help with that.")))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const result = await requestJsonCompletion({
      systemPrompt: "s",
      userPrompt: "u",
      providers: [provider("groq"), provider("together")],
    });
    expect(result).toEqual({ ok: true });
  });

  it("falls over on an empty choices array", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ choices: [] }))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const result = await requestJsonCompletion({
      systemPrompt: "s",
      userPrompt: "u",
      providers: [provider("groq"), provider("together")],
    });
    expect(result).toEqual({ ok: true });
  });

  it("throws LlmUnavailableError with a per-provider summary when every provider fails", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 429));

    const providers = [provider("groq"), provider("together"), provider("openrouter")];
    await expect(requestJsonCompletion({ systemPrompt: "s", userPrompt: "u", providers })).rejects.toThrow(
      LlmUnavailableError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never includes any provider's API key in a thrown error message", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    const secretProvider = provider("groq");
    try {
      await requestJsonCompletion({ systemPrompt: "s", userPrompt: "u", providers: [secretProvider] });
      throw new Error("expected requestJsonCompletion to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(secretProvider.apiKey);
    }
  });

  it("aborts a provider that exceeds its timeout and falls over to the next one", async () => {
    vi.useFakeTimers();
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      )
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const resultPromise = requestJsonCompletion({
      systemPrompt: "s",
      userPrompt: "u",
      providers: [provider("groq"), provider("together")],
    });

    // Exceeds any plausible configured LLM_TIMEOUT_SECONDS (single-digit
    // seconds in this project's config) without depending on its exact value.
    await vi.advanceTimersByTimeAsync(20000);
    const result = await resultPromise;

    expect(result).toEqual({ ok: true });
    vi.useRealTimers();
  });

  it("sends the Authorization header and never puts the key in the URL or body", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));

    const p = provider("groq");
    await requestJsonCompletion({ systemPrompt: "s", userPrompt: "u", providers: [p] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(p.apiKey);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${p.apiKey}`);
    expect(init.body as string).not.toContain(p.apiKey);
  });
});
