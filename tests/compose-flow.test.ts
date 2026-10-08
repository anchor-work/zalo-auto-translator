import { describe, expect, it } from "vitest";
import { getEnterAction } from "../src/compose-flow";

describe("compose flow", () => {
  it("uses the first Enter to translate a draft", () => {
    expect(
      getEnterAction({
        operation: "idle",
        sourceText: "안녕하세요",
        previewText: "",
        previewIsCurrent: false
      })
    ).toBe("translate");
  });

  it("uses the next Enter to send a current preview", () => {
    expect(
      getEnterAction({
        operation: "idle",
        sourceText: "안녕하세요",
        previewText: "Xin chào!",
        previewIsCurrent: true
      })
    ).toBe("send");
  });

  it("requires retranslation after the source becomes stale", () => {
    expect(
      getEnterAction({
        operation: "idle",
        sourceText: "안녕하세요!",
        previewText: "Xin chào!",
        previewIsCurrent: false
      })
    ).toBe("translate");
  });

  it("blocks repeated Enter presses while busy", () => {
    expect(
      getEnterAction({
        operation: "translating",
        sourceText: "안녕하세요",
        previewText: "",
        previewIsCurrent: false
      })
    ).toBe("none");
  });
});
