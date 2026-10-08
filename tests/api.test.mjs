import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiServer } from "../apps/api/src/app.mjs";
import {
  countCharacters,
  translateWithGemini,
  validateTranslationRequest
} from "../apps/api/src/gemini.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

async function startServer(options) {
  const server = createApiServer(options);
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

describe("Gemini translation backend", () => {
  it("validates and normalizes a Korean-to-Vietnamese request", () => {
    const request = validateTranslationRequest({
      text: "  안녕하세요  ",
      sourceLanguage: "ko",
      targetLanguage: "vi",
      tone: "natural",
      requestId: "request-1"
    });
    expect(request.text).toBe("안녕하세요");
    expect(countCharacters(request.text)).toBe(5);
  });

  it("extracts a translation and usage from Gemini", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Xin chào!" }] } }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 4, totalTokenCount: 54 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const result = await translateWithGemini(
      validateTranslationRequest({
        text: "안녕하세요",
        sourceLanguage: "ko",
        targetLanguage: "vi",
        tone: "natural"
      }),
      { apiKey: "test-key", fetchImpl }
    );
    expect(result.translatedText).toBe("Xin chào!");
    expect(result.usage.totalTokens).toBe(54);
  });

  it("uses the fallback model only after retryable primary failures", async () => {
    const busy = () =>
      new Response(
        JSON.stringify({ error: { code: 503, status: "UNAVAILABLE" } }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "Xin chào!" }] } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    const result = await translateWithGemini(
      validateTranslationRequest({
        text: "안녕하세요",
        sourceLanguage: "ko",
        targetLanguage: "vi",
        tone: "natural"
      }),
      {
        apiKey: "test-key",
        model: "gemini-3.1-flash-lite",
        fallbackModel: "gemini-3.5-flash-lite",
        fetchImpl,
        retryBaseDelayMs: 0
      }
    );
    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns an actionable error for a rejected Gemini request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(
      translateWithGemini(
        validateTranslationRequest({
          text: "안녕하세요",
          sourceLanguage: "ko",
          targetLanguage: "vi",
          tone: "natural"
        }),
        { apiKey: "test-key", fetchImpl }
      )
    ).rejects.toMatchObject({
      code: "provider_bad_request",
      message: expect.stringContaining("Secret Manager")
    });
  });

  it("serves a privacy-safe translation response", async () => {
    const translate = vi.fn().mockResolvedValue({
      translatedText: "Bây giờ bạn đang ở đâu?",
      provider: "gemini",
      model: "gemini-3.1-flash-lite",
      usage: { inputCharacters: 11, promptTokens: 50, outputTokens: 9, totalTokens: 59 }
    });
    const logger = { info: vi.fn(), error: vi.fn() };
    const baseUrl = await startServer({ translate, logger });
    const response = await fetch(`${baseUrl}/v1/translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "chrome-extension://test" },
      body: JSON.stringify({
        text: "지금 어디에 있어요?",
        sourceLanguage: "ko",
        targetLanguage: "vi",
        tone: "natural",
        requestId: "request-2"
      })
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("chrome-extension://test");
    expect(await response.json()).toMatchObject({ translatedText: "Bây giờ bạn đang ở đâu?" });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "translation_completed", inputCharacters: 11 })
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("지금 어디에 있어요?");
  });
});
