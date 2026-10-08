import { describe, expect, it } from "vitest";
import { validateApiBaseUrl } from "../src/settings";

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
