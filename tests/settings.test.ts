import { describe, expect, it } from "vitest";
import { normalizeSettings, validateApiBaseUrl } from "../src/settings";

describe("settings migration", () => {
  it("migrates existing users to Korean without losing their preferences", () => {
    const settings = normalizeSettings({
      schemaVersion: 4 as never,
      enabled: false,
      tone: "friendly",
      outgoingTargetLanguage: "en"
    });
    expect(settings).toMatchObject({
      schemaVersion: 5,
      enabled: false,
      userLanguage: "ko",
      languageSetupCompleted: false,
      tone: "friendly",
      outgoingTargetLanguage: "en",
      conversationLanguageOverrides: {}
    });
  });

  it("prevents the source and target languages from being identical", () => {
    expect(normalizeSettings({ userLanguage: "vi", outgoingTargetLanguage: "vi" }))
      .toMatchObject({ userLanguage: "vi", outgoingTargetLanguage: "ko" });
  });
});

describe("translation API URL validation", () => {
  it("accepts local development URLs", () => {
    expect(validateApiBaseUrl("http://localhost:8787/v1/translations")).toBe(
      "http://localhost:8787"
    );
  });

  it("accepts the production Cloud Run URL", () => {
    expect(
      validateApiBaseUrl(
        "https://zalo-translator-api-s6bip5vp3a-du.a.run.app/"
      )
    ).toBe("https://zalo-translator-api-s6bip5vp3a-du.a.run.app");
  });

  it("rejects unknown, insecure, and credential-bearing URLs", () => {
    expect(() => validateApiBaseUrl("http://example.com")).toThrow("공식 번역 서버");
    expect(() =>
      validateApiBaseUrl("https://another-service.run.app")
    ).toThrow("공식 번역 서버");
    expect(() =>
      validateApiBaseUrl("https://user:password@example.run.app")
    ).toThrow("공식 번역 서버");
  });
});
