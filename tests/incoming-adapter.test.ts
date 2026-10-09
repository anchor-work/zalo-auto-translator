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

  it("uses the visual bubble as the overlay anchor when the semantic row is wider", () => {
    const row = document.createElement("div");
    row.className = "message-row incoming";
    const bubble = document.createElement("div");
    bubble.style.backgroundColor = "white";
    bubble.style.borderRadius = "10px";
    const text = document.createElement("span");
    text.className = "message-text";
    text.textContent = "Tôi đã nhận được nha";
    bubble.append(text);
    row.append(bubble);
    document.body.append(row);

    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({
      x: 70, y: 120, left: 70, top: 120, right: 370, bottom: 180,
      width: 300, height: 60, toJSON: () => ({})
    });
    vi.spyOn(text, "getBoundingClientRect").mockReturnValue({
      x: 82, y: 132, left: 82, top: 132, right: 350, bottom: 158,
      width: 268, height: 26, toJSON: () => ({})
    });

    expect(findIncomingMessages()).toEqual([
      { container: bubble, textElement: text, text: "Tôi đã nhận được nha" }
    ]);
  });

  it("creates one candidate from the real body and ignores sender, quote, mention, and time", () => {
    const row = document.createElement("div");
    row.className = "message-row incoming";
    const bubble = document.createElement("div");
    bubble.style.backgroundColor = "white";
    bubble.style.borderRadius = "10px";

    const sender = document.createElement("div");
    sender.style.fontWeight = "700";
    sender.textContent = "Hồng Tiên";
    const quote = document.createElement("div");
    quote.className = "quoted-reply";
    quote.style.borderLeft = "3px solid blue";
    quote.textContent = "Anh đã thanh toán tiền thuê nhà rồi";
    const mention = document.createElement("span");
    mention.className = "mention-tag";
    mention.textContent = "Bảo Ngọc";
    const body = document.createElement("span");
    body.textContent = "dạ em đã nhận được nha";
    const time = document.createElement("span");
    time.textContent = "09:28";
    bubble.append(sender, quote, mention, body, time);
    row.append(bubble);
    document.body.append(row);

    const bubbleRect = {
      x: 70, y: 120, left: 70, top: 120, right: 570, bottom: 260,
      width: 500, height: 140, toJSON: () => ({})
    };
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue(bubbleRect);
    vi.spyOn(sender, "getBoundingClientRect").mockReturnValue({
      ...bubbleRect, left: 85, top: 130, right: 180, bottom: 150,
      width: 95, height: 20
    });
    vi.spyOn(quote, "getBoundingClientRect").mockReturnValue({
      ...bubbleRect, left: 85, top: 155, right: 500, bottom: 185,
      width: 415, height: 30
    });
    vi.spyOn(mention, "getBoundingClientRect").mockReturnValue({
      ...bubbleRect, left: 85, top: 188, right: 175, bottom: 203,
      width: 90, height: 15
    });
    vi.spyOn(body, "getBoundingClientRect").mockReturnValue({
      ...bubbleRect, left: 85, top: 205, right: 300, bottom: 230,
      width: 215, height: 25
    });
    vi.spyOn(time, "getBoundingClientRect").mockReturnValue({
      ...bubbleRect, left: 85, top: 235, right: 125, bottom: 250,
      width: 40, height: 15
    });

    expect(findIncomingMessages()).toEqual([
      {
        container: bubble,
        textElement: body,
        text: "dạ em đã nhận được nha"
      }
    ]);
  });

  it("returns one candidate when a message body is split across multiple elements", () => {
    const row = document.createElement("div");
    row.className = "message-row incoming";
    const bubble = document.createElement("div");
    bubble.style.backgroundColor = "white";
    bubble.style.borderRadius = "10px";
    const first = document.createElement("p");
    first.textContent = "Xin chào bạn.";
    const second = document.createElement("p");
    second.textContent = "Bạn khỏe không?";
    bubble.append(first, second);
    row.append(bubble);
    document.body.append(row);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({
      x: 70, y: 120, left: 70, top: 120, right: 370, bottom: 200,
      width: 300, height: 80, toJSON: () => ({})
    });
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue({
      x: 85, y: 130, left: 85, top: 130, right: 300, bottom: 155,
      width: 215, height: 25, toJSON: () => ({})
    });
    vi.spyOn(second, "getBoundingClientRect").mockReturnValue({
      x: 85, y: 165, left: 85, top: 165, right: 300, bottom: 190,
      width: 215, height: 25, toJSON: () => ({})
    });

    expect(findIncomingMessages()).toEqual([
      {
        container: bubble,
        textElement: bubble,
        text: "Xin chào bạn.\nBạn khỏe không?"
      }
    ]);
  });

  it("excludes file cards", () => {
    const row = document.createElement("div");
    row.className = "message-row incoming";
    const fileCard = document.createElement("div");
    fileCard.className = "file-card";
    fileCard.style.backgroundColor = "white";
    fileCard.style.borderRadius = "10px";
    const filename = document.createElement("span");
    filename.textContent = "2026-10-08 HOP DONG MUON TIEN GIA.pdf";
    const size = document.createElement("span");
    size.textContent = "194.28 KB";
    fileCard.append(filename, size);
    row.append(fileCard);
    document.body.append(row);
    vi.spyOn(fileCard, "getBoundingClientRect").mockReturnValue({
      x: 70, y: 120, left: 70, top: 120, right: 440, bottom: 210,
      width: 370, height: 90, toJSON: () => ({})
    });
    vi.spyOn(filename, "getBoundingClientRect").mockReturnValue({
      x: 85, y: 130, left: 85, top: 130, right: 410, bottom: 155,
      width: 325, height: 25, toJSON: () => ({})
    });
    vi.spyOn(size, "getBoundingClientRect").mockReturnValue({
      x: 85, y: 165, left: 85, top: 165, right: 180, bottom: 185,
      width: 95, height: 20, toJSON: () => ({})
    });

    expect(findIncomingMessages()).toEqual([]);
  });

  it("excludes date separators and group headers", () => {
    const date = document.createElement("div");
    date.style.backgroundColor = "gray";
    date.style.borderRadius = "20px";
    date.textContent = "17:15 Hôm qua";
    document.body.append(date);
    vi.spyOn(date, "getBoundingClientRect").mockReturnValue({
      x: 500, y: 100, left: 500, top: 100, right: 620, bottom: 130,
      width: 120, height: 30, toJSON: () => ({})
    });

    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = "Anchor_TRÍ LUẬT";
    const members = document.createElement("span");
    members.textContent = "9 thành viên";
    header.append(title, members);
    document.body.append(header);

    expect(findIncomingMessages()).toEqual([]);
  });

  it("excludes URL-only and link-preview text", () => {
    const row = document.createElement("div");
    row.className = "message-row incoming";
    const bubble = document.createElement("div");
    bubble.style.backgroundColor = "white";
    bubble.style.borderRadius = "10px";
    const url = document.createElement("span");
    url.textContent = "https://example.com/document";
    const preview = document.createElement("span");
    preview.className = "link-preview";
    preview.textContent = "Example website";
    bubble.append(url, preview);
    row.append(bubble);
    document.body.append(row);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({
      x: 70, y: 120, left: 70, top: 120, right: 370, bottom: 200,
      width: 300, height: 80, toJSON: () => ({})
    });
    vi.spyOn(url, "getBoundingClientRect").mockReturnValue({
      x: 85, y: 130, left: 85, top: 130, right: 300, bottom: 155,
      width: 215, height: 25, toJSON: () => ({})
    });
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
      x: 85, y: 165, left: 85, top: 165, right: 300, bottom: 190,
      width: 215, height: 25, toJSON: () => ({})
    });

    expect(findIncomingMessages()).toEqual([]);
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
