const EDITABLE_SELECTOR = '[contenteditable="true"]';
const SEND_LABEL = /^(send|send message|gửi|gửi tin nhắn|전송|보내기)$/i;

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
  for (let depth = 0; ancestor && depth < 6; depth += 1) {
    scopes.push(ancestor);
    ancestor = ancestor.parentElement;
  }

  for (const scope of scopes) {
    const candidates = scope.querySelectorAll<HTMLElement>(
      'button, [role="button"], [aria-label], [title]'
    );
    for (const candidate of candidates) {
      if (
        candidate !== composer &&
        !candidate.hasAttribute("disabled") &&
        elementLabels(candidate).some((label) => SEND_LABEL.test(label))
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function dispatchEnter(composer: HTMLElement): void {
  const options: KeyboardEventInit = {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true
  };
  composer.dispatchEvent(new KeyboardEvent("keydown", options));
  composer.dispatchEvent(new KeyboardEvent("keypress", options));
  composer.dispatchEvent(new KeyboardEvent("keyup", options));
}

export async function sendComposer(
  composer: HTMLElement,
  text: string,
  confirmationDelayMs = 250
): Promise<boolean> {
  writeComposer(composer, text);

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const sendButton = findSendButton(composer);
  if (sendButton) {
    sendButton.click();
  } else {
    dispatchEnter(composer);
  }

  await new Promise<void>((resolve) => setTimeout(resolve, confirmationDelayMs));
  return readComposer(composer).length === 0;
}
