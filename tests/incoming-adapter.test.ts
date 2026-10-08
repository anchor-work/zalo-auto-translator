// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { findIncomingMessages } from "../src/zalo/incoming-adapter";

describe("incoming Zalo message adapter", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  });

  it("returns incoming messages and excludes outgoing messages", () => {
    const incoming = document.createElement("div");
    incoming.className = "message-row incoming";
    const incomingText = document.createElement("div");
    incomingText.className = "message-text";
    incomingText.textContent = "Xin chào!";
    incoming.append(incomingText);

    const outgoing = document.createElement("div");
    outgoing.className = "message-row outgoing";
    const outgoingText = document.createElement("div");
    outgoingText.className = "message-text";
    outgoingText.textContent = "안녕하세요";
    outgoing.append(outgoingText);
    document.body.append(incoming, outgoing);

    expect(findIncomingMessages()).toEqual([
      { container: incoming, textElement: incomingText, text: "Xin chào!" }
    ]);
  });

  it("uses conservative left-side geometry when direction metadata is absent", () => {
    const row = document.createElement("div");
    row.className = "message-row";
    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = "Bạn khỏe không?";
    row.append(text);
    document.body.append(row);
    vi.spyOn(text, "getBoundingClientRect").mockReturnValue({
      x: 360,
      y: 100,
      left: 360,
      top: 100,
      right: 540,
      bottom: 140,
      width: 180,
      height: 40,
      toJSON: () => ({})
    });

    expect(findIncomingMessages()).toHaveLength(1);
  });

  it("does not inspect composer text", () => {
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    const text = document.createElement("span");
    text.className = "message-text";
    text.textContent = "draft";
    composer.append(text);
    document.body.append(composer);

    expect(findIncomingMessages()).toEqual([]);
  });
});
