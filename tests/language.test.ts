import { describe, expect, it } from "vitest";
import {
  detectMessageLanguage,
  incomingTranslationDecision
} from "../src/language";

describe("message language detection", () => {
  it("detects Korean and Vietnamese without an API call", () => {
    expect(detectMessageLanguage("오늘 회의 자료를 확인해 주세요")).toEqual({
      language: "ko",
      confident: true
    });
    expect(detectMessageLanguage("Dạ em đã nhận được rồi anh nhé")).toEqual({
      language: "vi",
      confident: true
    });
  });

  it("detects clear English sentences", () => {
    expect(detectMessageLanguage("Please check the message and send it today")).toEqual({
      language: "en",
      confident: true
    });
  });

  it("keeps short or ambiguous text undecided", () => {
    expect(detectMessageLanguage("OK haha")).toEqual({
      language: null,
      confident: false
    });
  });
});

describe("incoming translation decisions", () => {
  it("hides translation for the user's own language", () => {
    expect(incomingTranslationDecision("오늘 확인했습니다", "ko").showButton).toBe(false);
  });

  it("shows and auto-translates a confidently different language", () => {
    expect(incomingTranslationDecision("Dạ em đã nhận được rồi anh nhé", "ko")).toEqual({
      showButton: true,
      autoTranslate: true,
      sourceLanguage: "vi"
    });
  });

  it("shows a manual button but does not auto-translate ambiguous text", () => {
    expect(incomingTranslationDecision("OK haha", "ko")).toEqual({
      showButton: true,
      autoTranslate: false,
      sourceLanguage: "auto"
    });
  });

  it("honors the current conversation override", () => {
    expect(incomingTranslationDecision("OK", "en", "en").showButton).toBe(false);
    expect(incomingTranslationDecision("OK", "ko", "vi")).toEqual({
      showButton: true,
      autoTranslate: true,
      sourceLanguage: "vi"
    });
  });
});
