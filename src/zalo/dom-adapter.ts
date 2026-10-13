const EDITABLE_SELECTOR =
  '#richInput.rich-input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"][contenteditable]';
const SEND_LABEL = /^(send|send message|gửi|gửi tin nhắn|전송|보내기)$/i;
const SEND_LABEL_CONTAINS = /(send|gửi|전송|보내기)/i;
const SEND_ATTRIBUTE_HINT = /(send|submit|sent[-_]?msg|btn[-_]?send|gửi|gui)/i;

export function isUsableComposer(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.matches(EDITABLE_SELECTOR)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    !element.closest("[aria-hidden='true']") &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 80 &&
    rect.height > 15
  );
}

export function findComposerFromFocus(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const candidate = target.closest(EDITABLE_SELECTOR);
  return isUsableComposer(candidate) ? candidate : null;
}

export function findVisibleComposers(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)).filter(
    (candidate) =>
      !candidate.closest("#zalo-auto-translator-root") && isUsableComposer(candidate)
  );
}

export function readComposer(composer: HTMLElement): string {
  const text = composer instanceof HTMLTextAreaElement ? composer.value : composer.innerText || composer.textContent || "";
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function replaceContentSafely(composer: HTMLElement, text: string): void {
  const fragment = document.createDocumentFragment();
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.append(document.createElement("br"));
    }
    fragment.append(document.createTextNode(line));
  });

  composer.replaceChildren(fragment);
}

function currentComposer(composer: HTMLElement): HTMLElement {
  if (composer.id !== "richInput" || !composer.classList.contains("rich-input")) {
    return composer;
  }
  return document.querySelector<HTMLElement>("#chatInput #richInput.rich-input") ?? composer;
}

export function writeComposer(composer: HTMLElement, text: string): HTMLElement {
  const isZaloRichInput = composer.id === "richInput" && composer.classList.contains("rich-input");
  composer.click();
  composer = currentComposer(composer);
  if (isZaloRichInput) composer.setAttribute("contenteditable", "true");
  composer.focus();
  composer = currentComposer(composer);

  if (isZaloRichInput) {
    replaceContentSafely(composer, text);
    composer.classList.toggle("empty", text.length === 0);
    composer.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
    return composer;
  }

  if (composer instanceof HTMLTextAreaElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    valueSetter?.call(composer, text);
    if (!valueSetter) composer.value = text;
    composer.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
    composer.dispatchEvent(new Event("change", { bubbles: true }));
    composer.setSelectionRange(text.length, text.length);
    return composer;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  try {
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch {
    // Zalo can replace richInput while focus is moving. The fallback below still
    // writes to the latest connected element and emits the input event.
  }

  const inserted =
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, text);

  if (!inserted) {
    replaceContentSafely(composer, text);
    composer.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
  }

  const endRange = document.createRange();
  endRange.selectNodeContents(composer);
  try {
    endRange.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(endRange);
  } catch {
    // Keeping the text is more important than restoring a caret on a replaced node.
  }
  return composer;
}

function elementLabels(element: Element): string[] {
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("data-title"),
    element.getAttribute("data-tooltip-content"),
    element.textContent
  ]
    .filter((label): label is string => Boolean(label))
    .map((label) => label.replace(/\s+/g, " ").trim());
}

export function findSendButton(composer: HTMLElement): HTMLElement | null {
  const scopes: Element[] = [];
  const form = composer.closest("form");
  if (form) scopes.push(form);

  let ancestor: Element | null = composer.parentElement;
  for (let depth = 0; ancestor && depth < 10; depth += 1) {
    scopes.push(ancestor);
    ancestor = ancestor.parentElement;
  }

  let bestMatch: { element: HTMLElement; score: number } | null = null;
  const seen = new Set<HTMLElement>();

  for (const scope of scopes) {
    const candidates = scope.querySelectorAll<HTMLElement>(
      'button, [role="button"], [aria-label], [title], [data-title], [data-tooltip-content]'
    );
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (
        candidate === composer ||
        composer.contains(candidate) ||
        candidate.hasAttribute("disabled") ||
        candidate.getAttribute("aria-disabled") === "true" ||
        candidate.closest("[aria-hidden='true']") ||
        window.getComputedStyle(candidate).display === "none" ||
        window.getComputedStyle(candidate).visibility === "hidden"
      ) continue;

      const labels = elementLabels(candidate);
      const searchableAttributes = [
        candidate.id,
        candidate.className,
        candidate.getAttribute("data-id"),
        candidate.getAttribute("data-action"),
        candidate.querySelector("svg")?.getAttribute("data-icon"),
        candidate.querySelector("use")?.getAttribute("href")
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
      const hasSendIcon = Boolean(
        candidate.querySelector(
          '[class*="send" i], [class*="sent-msg" i], [data-icon*="send" i], [data-icon*="sent" i]'
        )
      );

      let score = 0;
      if (labels.some((label) => SEND_LABEL.test(label))) score = Math.max(score, 120);
      if (labels.some((label) => SEND_LABEL_CONTAINS.test(label))) score = Math.max(score, 100);
      if (candidate instanceof HTMLButtonElement && candidate.type === "submit") {
        score = Math.max(score, 90);
      }
      if (SEND_ATTRIBUTE_HINT.test(searchableAttributes)) score = Math.max(score, 75);
      if (hasSendIcon) score = Math.max(score, 80);

      const composerRect = composer.getBoundingClientRect();
      const candidateRect = candidate.getBoundingClientRect();
      if (
        candidateRect.width > 0 &&
        candidateRect.height > 0 &&
        candidateRect.left >= composerRect.left &&
        Math.abs(candidateRect.top - composerRect.top) < 160
      ) {
        score += 10;
      }

      if (score >= 75 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { element: candidate, score };
      }
    }
  }

  return bestMatch?.element ?? null;
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function waitForSendButton(
  composer: HTMLElement,
  timeoutMs: number
): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (!document.contains(composer)) return null;
    const sendButton = findSendButton(composer);
    if (sendButton) return sendButton;
    if (timeoutMs === 0) break;
    await delay(50);
  } while (Date.now() < deadline);
  return findSendButton(composer);
}

async function waitForComposerCleared(
  composer: HTMLElement,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (!document.contains(composer) || readComposer(composer).length === 0) return true;
    if (timeoutMs === 0) break;
    await delay(50);
  } while (Date.now() < deadline);
  return !document.contains(composer) || readComposer(composer).length === 0;
}

export async function sendComposer(
  composer: HTMLElement,
  text: string,
  confirmationDelayMs = 2_400,
  sendButtonWaitMs = 1_200
): Promise<boolean> {
  composer = writeComposer(composer, text);

  const sendButton = await waitForSendButton(composer, sendButtonWaitMs);
  if (!sendButton) return false;

  sendButton.click();
  return waitForComposerCleared(composer, confirmationDelayMs);
}
