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

  it("detects an incoming visual bubble even when Zalo class names are opaque", () => {
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    document.body.append(composer);
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({
      x: 20,
      y: 700,
      left: 20,
      top: 700,
      right: 1180,
      bottom: 750,
      width: 1160,
      height: 50,
      toJSON: () => ({})
    });

    const incoming = document.createElement("div");
    incoming.className = "x1a2b3";
    incoming.style.backgroundColor = "white";
    incoming.style.borderRadius = "12px";
    incoming.textContent = "Tôi có thể hiểu được.";
    document.body.append(incoming);
    vi.spyOn(incoming, "getBoundingClientRect").mockReturnValue({
      x: 80,
      y: 120,
      left: 80,
      top: 120,
      right: 620,
      bottom: 180,
      width: 540,
      height: 60,
      toJSON: () => ({})
    });

    const outgoing = document.createElement("div");
    outgoing.className = "z9y8x7";
    outgoing.style.backgroundColor = "lightblue";
    outgoing.style.borderRadius = "12px";
    outgoing.textContent = "Anh đã thanh toán rồi.";
    document.body.append(outgoing);
    vi.spyOn(outgoing, "getBoundingClientRect").mockReturnValue({
      x: 600,
      y: 220,
      left: 600,
      top: 220,
      right: 1180,
      bottom: 280,
      width: 580,
      height: 60,
      toJSON: () => ({})
    });

    expect(findIncomingMessages()).toEqual([
      { container: incoming, textElement: incoming, text: "Tôi có thể hiểu được." }
    ]);
  });
});
