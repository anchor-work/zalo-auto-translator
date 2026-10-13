import { afterEach, describe, expect, it, vi } from "vitest";
import { translateWithLocalApi } from "../src/translation/local-api-provider";

const request = {
  text: "안녕하세요",
  sourceLanguage: "ko" as const,
  targetLanguage: "vi" as const,
  tone: "natural" as const,
  vietnameseAddress: "neutral" as const,
  requestId: "request-1"
};

describe("local API provider authentication", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds the Firebase bearer token when supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          translatedText: "Xin chào",
          usage: { inputCharacters: 5 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await translateWithLocalApi(
      request,
      "https://zalo-translator-api-s6bip5vp3a-du.a.run.app",
      "firebase-token"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/translations"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer firebase-token"
        })
      })
    );
  });

  it("does not send an Authorization header without a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ translatedText: "Xin chào" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await translateWithLocalApi(
      request,
      "https://zalo-translator-api-s6bip5vp3a-du.a.run.app"
    );

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
