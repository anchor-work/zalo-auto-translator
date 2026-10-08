const EDITABLE_SELECTOR = '[contenteditable="true"]';
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

export function readComposer(composer: HTMLElement): string {
  return (composer.innerText || composer.textContent || "")
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

export function writeComposer(composer: HTMLElement, text: string): void {
  composer.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const beforeInput = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: text
  });
  composer.dispatchEvent(beforeInput);

  const inserted =
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, text);

  if (!inserted) {
    replaceContentSafely(composer, text);
  }

  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text
    })
  );
  composer.dispatchEvent(new Event("change", { bubbles: true }));

  const endRange = document.createRange();
  endRange.selectNodeContents(composer);
  endRange.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(endRange);
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
        candidate.getAttribute("aria-disabled") === "true"
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

function dispatchEnter(composer: HTMLElement): void {
  const options: KeyboardEventInit = {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true
  };
  ["keydown", "keypress", "keyup"].forEach((type) => {
    const event = new KeyboardEvent(type, options);
    Object.defineProperties(event, {
      keyCode: { get: () => 13 },
      which: { get: () => 13 }
    });
    composer.dispatchEvent(event);
  });
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

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
  confirmationDelayMs = 1_600
): Promise<boolean> {
  writeComposer(composer, text);

  await delay(confirmationDelayMs === 0 ? 0 : 120);
  const sendButton = findSendButton(composer);
  if (sendButton) {
    sendButton.click();
    if (await waitForComposerCleared(composer, confirmationDelayMs)) return true;
  }

  dispatchEnter(composer);
  return waitForComposerCleared(composer, confirmationDelayMs === 0 ? 0 : 800);
}
