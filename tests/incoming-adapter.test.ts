// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findIncomingMessages,
  incomingCandidateStillMatches,
  resolveIncomingMessageFromTarget
} from "../src/zalo/incoming-adapter";

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

  it("resolves a hovered nested text element without relying on class names", () => {
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    document.body.append(composer);
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({
      x: 20, y: 700, left: 20, top: 700, right: 1180, bottom: 750,
      width: 1160, height: 50, toJSON: () => ({})
    });

    const bubble = document.createElement("div");
    bubble.className = "opaque-a1";
    bubble.style.backgroundColor = "white";
    bubble.style.borderRadius = "10px";
    const message = document.createElement("span");
    message.textContent = "xin quá haha";
    const time = document.createElement("span");
    time.textContent = "16:42";
    bubble.append(message, time);
    document.body.append(bubble);
    const bubbleRect = {
      x: 70, y: 100, left: 70, top: 100, right: 300, bottom: 170,
      width: 230, height: 70, toJSON: () => ({})
    };
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue(bubbleRect);
    vi.spyOn(message, "getBoundingClientRect").mockReturnValue({
      ...bubbleRect, right: 270, bottom: 140, width: 200, height: 40
    });

    expect(resolveIncomingMessageFromTarget(message)).toMatchObject({
      container: bubble,
      textElement: message,
      text: "xin quá haha"
    });
  });

  it("finds message text inside a custom Zalo element through text nodes", () => {
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    document.body.append(composer);
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({
      x: 20, y: 700, left: 20, top: 700, right: 1180, bottom: 750,
      width: 1160, height: 50, toJSON: () => ({})
    });

    const bubble = document.createElement("section");
    bubble.className = "opaque-bubble";
    bubble.style.backgroundColor = "white";
    bubble.style.borderRadius = "10px";
    const customText = document.createElement("zalo-message-text");
    customText.textContent = "okay nếu tôi có ý tưởng khác";
    bubble.append(customText);
    document.body.append(bubble);
    const rect = {
      x: 70, y: 120, left: 70, top: 120, right: 430, bottom: 180,
      width: 360, height: 60, toJSON: () => ({})
    };
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue(rect);
    vi.spyOn(customText, "getBoundingClientRect").mockReturnValue(rect);

    expect(findIncomingMessages()).toEqual([
      {
        container: bubble,
        textElement: customText,
        text: "okay nếu tôi có ý tưởng khác"
      }
    ]);
  });

  it("keeps a previously detected message while its original text remains", () => {
    const bubble = document.createElement("div");
    const message = document.createElement("span");
    message.textContent = "xin quá haha";
    bubble.append(message);
    document.body.append(bubble);

    const candidate = {
      container: bubble,
      textElement: message,
      text: "xin quá haha"
    };
    expect(incomingCandidateStillMatches(candidate)).toBe(true);

    message.textContent = "virtualized replacement message";
    expect(incomingCandidateStillMatches(candidate)).toBe(false);

    bubble.remove();
    expect(incomingCandidateStillMatches(candidate)).toBe(false);
  });
});
