import { describe, expect, it } from "vitest";
import { validateApiBaseUrl } from "../src/settings";

describe("translation API URL validation", () => {
  it("accepts local development URLs", () => {
    expect(validateApiBaseUrl("http://localhost:8787/v1/translations")).toBe(
      "http://localhost:8787"
    );
  });

  it("accepts HTTPS Cloud Run URLs", () => {
    expect(
      validateApiBaseUrl(
        "https://zalo-translator-api-example.asia-northeast3.run.app/"
      )
    ).toBe("https://zalo-translator-api-example.asia-northeast3.run.app");
  });

  it("rejects insecure public and credential-bearing URLs", () => {
    expect(() => validateApiBaseUrl("http://example.com")).toThrow("Cloud Run");
    expect(() =>
      validateApiBaseUrl("https://user:password@example.run.app")
    ).toThrow("Cloud Run");
  });
});
