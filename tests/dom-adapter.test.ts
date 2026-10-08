// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findSendButton,
  findComposerFromFocus,
  readComposer,
  sendComposer,
  writeComposer
} from "../src/zalo/dom-adapter";

describe("Zalo DOM adapter", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("finds a visible contenteditable from a nested focused element", () => {
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    const child = document.createElement("span");
    composer.append(child);
    document.body.append(composer);
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({
      width: 300,
      height: 40,
      top: 0,
      right: 300,
      bottom: 40,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    expect(findComposerFromFocus(child)).toBe(composer);
  });

  it("reads and safely replaces composer text", () => {
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    composer.textContent = "  안녕하세요  ";
    document.body.append(composer);

    expect(readComposer(composer)).toBe("안녕하세요");
    writeComposer(composer, "Xin chào!\nCảm ơn bạn.");
    expect(composer.textContent).toBe("Xin chào!Cảm ơn bạn.");
    expect(composer.querySelector("br")).not.toBeNull();
  });

  it("finds the send button near the active composer", () => {
    const form = document.createElement("form");
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    const sendButton = document.createElement("button");
    sendButton.type = "button";
    sendButton.setAttribute("aria-label", "Gửi");
    form.append(composer, sendButton);
    document.body.append(form);

    expect(findSendButton(composer)).toBe(sendButton);
  });

  it("writes translated text and confirms a send when the composer clears", async () => {
    const form = document.createElement("form");
    const composer = document.createElement("div");
    composer.contentEditable = "true";
    const sendButton = document.createElement("button");
    sendButton.type = "button";
    sendButton.title = "Send";
    sendButton.addEventListener("click", () => composer.replaceChildren());
    form.append(composer, sendButton);
    document.body.append(form);

    await expect(sendComposer(composer, "Xin chào!", 0)).resolves.toBe(true);
  });
});
