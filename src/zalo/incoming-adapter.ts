const MESSAGE_TEXT_SELECTOR = [
  "[data-message-text]",
  "[data-translate-text]",
  '[class*="message-text"]',
  '[class*="message__text"]',
  '[class*="msg-text"]',
  '[class*="text-message"]',
  '[class*="bubble"] [class*="text"]',
  '[class*="message"] [dir="auto"]'
].join(",");

const MESSAGE_CONTAINER_SELECTOR = [
  "[data-message-id]",
  '[class*="message-item"]',
  '[class*="message-row"]',
  '[class*="chat-message"]',
  '[class*="message"]',
  '[class*="bubble"]',
  '[class*="msg"]'
].join(",");

const OUTGOING_HINT = /(^|[\s_-])(outgoing|sent|right|self|mine|owner|me)(?=$|[\s_-])/i;
const INCOMING_HINT = /(^|[\s_-])(incoming|received|receive|left|friend|other)(?=$|[\s_-])/i;

export interface IncomingMessageCandidate {
  container: HTMLElement;
  textElement: HTMLElement;
  text: string;
}

function normalizedText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function directionHints(container: HTMLElement): string {
  return [
    container.className,
    container.id,
    container.getAttribute("data-direction"),
    container.getAttribute("data-side"),
    container.getAttribute("data-sender"),
    container.getAttribute("data-from-me"),
    container.getAttribute("aria-label")
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function isIncoming(container: HTMLElement, textElement: HTMLElement): boolean {
  const hints = directionHints(container);
  if (OUTGOING_HINT.test(hints) || container.getAttribute("data-from-me") === "true") {
    return false;
  }
  if (INCOMING_HINT.test(hints) || container.getAttribute("data-from-me") === "false") {
    return true;
  }

  const rect = textElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const conversationStart = Math.max(240, viewportWidth * 0.24);
  return rect.left >= conversationStart && rect.left < viewportWidth * 0.62;
}

function candidateElements(root: ParentNode): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(MESSAGE_TEXT_SELECTOR)) {
    candidates.push(root);
  }
  root.querySelectorAll<HTMLElement>(MESSAGE_TEXT_SELECTOR).forEach((element) => {
    candidates.push(element);
  });
  return candidates;
}

export function findIncomingMessages(root: ParentNode = document): IncomingMessageCandidate[] {
  const results: IncomingMessageCandidate[] = [];
  const seenContainers = new Set<HTMLElement>();

  for (const textElement of candidateElements(root)) {
    if (
      textElement.closest("#zalo-auto-translator-root") ||
      textElement.closest('[contenteditable="true"], textarea, input, nav, aside') ||
      textElement.closest("[aria-hidden='true']")
    ) continue;

    const container =
      textElement.parentElement?.closest<HTMLElement>(MESSAGE_CONTAINER_SELECTOR) ?? textElement;
    if (seenContainers.has(container) || container.dataset.zatIncomingDecorated === "true") {
      continue;
    }

    const text = normalizedText(textElement);
    if (!text || text.length > 5_000 || !isIncoming(container, textElement)) continue;

    seenContainers.add(container);
    results.push({ container, textElement, text });
  }

  return results;
}

