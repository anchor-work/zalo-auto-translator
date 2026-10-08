import { describe, expect, it } from "vitest";
import { translateWithDemo } from "../src/translation/demo-provider";

describe("demo translation provider", () => {
  it("translates a supported Korean phrase", async () => {
    const result = await translateWithDemo({
      text: "지금 어디에 있어요?",
      sourceLanguage: "ko",
      targetLanguage: "vi",
      tone: "natural",
      vietnameseAddress: "neutral",
      requestId: "test"
    });

    expect(result.translatedText).toBe("Bây giờ bạn đang ở đâu?");
    expect(result.inputCharacters).toBeGreaterThan(0);
  });

  it("does not pretend to translate unsupported text", async () => {
    await expect(
      translateWithDemo({
        text: "지원하지 않는 임의 문장",
        sourceLanguage: "ko",
        targetLanguage: "vi",
        tone: "natural",
        vietnameseAddress: "neutral",
        requestId: "test"
      })
    ).rejects.toThrow("예시 문장만 지원");
  });
});
