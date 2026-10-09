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
const FALLBACK_TAGS = "div, p, span";
const NON_MESSAGE_TEXT = /^(?:(?:\d{1,2}:\d{2})\s*)?(?:hôm nay|today|yesterday|어제|오늘)(?:\s*\d{1,2}:\d{2})?$|^(?:\d{1,2}:\d{2}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/i;
const HAS_LETTER = /\p{L}/u;

export interface IncomingMessageCandidate {
  container: HTMLElement;
  textElement: HTMLElement;
  text: string;
}

export function incomingCandidateStillMatches(
  candidate: IncomingMessageCandidate
): boolean {
  if (!candidate.container.isConnected) return false;

  const textElementStillMatches =
    candidate.textElement.isConnected &&
    normalizedText(candidate.textElement).includes(candidate.text);
  return (
    textElementStillMatches ||
    normalizedText(candidate.container).includes(candidate.text)
  );
}

function normalizedText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageText(element: HTMLElement): string {
  const lines = normalizedText(element)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  while (lines.length > 1 && NON_MESSAGE_TEXT.test(lines.at(-1) ?? "")) lines.pop();
  return lines.join("\n").trim();
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

interface ConversationBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function visibleComposerBounds(): ConversationBounds | null {
  const best = Array.from(
    document.querySelectorAll<HTMLElement>('[contenteditable="true"]')
  )
    .filter((composer) => !composer.closest("#zalo-auto-translator-root"))
    .map((composer) => composer.getBoundingClientRect())
    .filter(
      (rect) =>
        rect.width > 180 &&
        rect.height > 15 &&
        rect.bottom <= window.innerHeight + 10
    )
    .sort((left, right) => right.width - left.width)[0];
  if (!best) return null;
  return {
    left: Math.max(0, best.left - 24),
    right: Math.min(window.innerWidth, best.right + 24),
    top: 48,
    bottom: Math.max(120, best.top - 8)
  };
}

function conversationBounds(): ConversationBounds {
  return (
    visibleComposerBounds() ?? {
      left: 0,
      right: window.innerWidth,
      top: 48,
      bottom: window.innerHeight * 0.9
    }
  );
}

function isIncoming(
  container: HTMLElement,
  textElement: HTMLElement,
  bounds: ConversationBounds
): boolean {
  const hints = directionHints(container);
  if (OUTGOING_HINT.test(hints) || container.getAttribute("data-from-me") === "true") {
    return false;
  }
  if (INCOMING_HINT.test(hints) || container.getAttribute("data-from-me") === "false") {
    return true;
  }

  const rect = textElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const measuredContainerRect = container.getBoundingClientRect();
  const containerRect =
    measuredContainerRect.width > 0 && measuredContainerRect.height > 0
      ? measuredContainerRect
      : rect;
  const conversationWidth = Math.max(1, bounds.right - bounds.left);
  if (
    containerRect.bottom < bounds.top ||
    containerRect.top > bounds.bottom ||
    containerRect.right < bounds.left ||
    containerRect.left > bounds.right
  ) return false;

  const nearRightEdge = containerRect.right >= bounds.right - conversationWidth * 0.08;
  if (nearRightEdge) return false;
  const nearLeftEdge = containerRect.left <= bounds.left + conversationWidth * 0.22;
  return nearLeftEdge || containerRect.left + containerRect.width / 2 < bounds.left + conversationWidth * 0.55;
}

function hasDirectMessageText(element: HTMLElement): boolean {
  const text = normalizedText(element);
  if (
    !text ||
    text.length > 5_000 ||
    NON_MESSAGE_TEXT.test(text) ||
    !HAS_LETTER.test(text)
  ) return false;
  if (!Array.from(element.childNodes).some((node) =>
    node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  )) return false;

  const rect = element.getBoundingClientRect();
  return (
    rect.width >= 24 &&
    rect.height >= 14 &&
    rect.width <= window.innerWidth * 0.82 &&
    rect.height <= Math.max(320, window.innerHeight * 0.4)
  );
}

function hasBubbleAppearance(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const background = style.backgroundColor.replace(/\s/g, "").toLowerCase();
  const hasBackground =
    background !== "" &&
    background !== "transparent" &&
    background !== "rgba(0,0,0,0)";
  const radius = Math.max(
    Number.parseFloat(style.borderTopLeftRadius) || 0,
    Number.parseFloat(style.borderTopRightRadius) || 0,
    Number.parseFloat(style.borderBottomLeftRadius) || 0,
    Number.parseFloat(style.borderBottomRightRadius) || 0
  );
  return hasBackground && radius >= 4;
}

function visualBubbleFor(textElement: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = textElement;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const rect = current.getBoundingClientRect();
    if (
      hasBubbleAppearance(current) &&
      rect.width > 40 &&
      rect.width <= window.innerWidth * 0.82 &&
      rect.height <= Math.max(360, window.innerHeight * 0.45)
    ) return current;
    current = current.parentElement;
  }
  return null;
}

function candidateElements(root: ParentNode): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  if (root instanceof HTMLElement && root.matches(MESSAGE_TEXT_SELECTOR)) {
    candidates.add(root);
  }
  root.querySelectorAll<HTMLElement>(MESSAGE_TEXT_SELECTOR).forEach((element) => {
    candidates.add(element);
  });

  if (root instanceof HTMLElement && root.matches(FALLBACK_TAGS) && hasDirectMessageText(root)) {
    candidates.add(root);
  }
  root.querySelectorAll<HTMLElement>(FALLBACK_TAGS).forEach((element) => {
    if (hasDirectMessageText(element)) candidates.add(element);
  });

  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    const parent = textNode.parentElement;
    if (
      parent &&
      !parent.matches("script, style, noscript, svg, textarea, input") &&
      hasDirectMessageText(parent)
    ) candidates.add(parent);
    textNode = walker.nextNode();
  }
  return [...candidates];
}

export function findIncomingMessages(root: ParentNode = document): IncomingMessageCandidate[] {
  const results: IncomingMessageCandidate[] = [];
  const seenContainers = new Set<HTMLElement>();
  const bounds = conversationBounds();

  for (const textElement of candidateElements(root)) {
    if (
      textElement.closest("#zalo-auto-translator-root") ||
      textElement.closest(".zat-incoming-tools, .zat-incoming-overlay") ||
      textElement.closest('[contenteditable="true"], textarea, input, nav, aside') ||
      textElement.closest("[aria-hidden='true']")
    ) continue;

    const semanticContainer =
      textElement.parentElement?.closest<HTMLElement>(MESSAGE_CONTAINER_SELECTOR) ?? null;
    const visualContainer = visualBubbleFor(textElement);
    const semanticHasDirection = semanticContainer
      ? OUTGOING_HINT.test(directionHints(semanticContainer)) ||
        INCOMING_HINT.test(directionHints(semanticContainer)) ||
        semanticContainer.hasAttribute("data-from-me")
      : false;
    const container = semanticHasDirection
      ? semanticContainer!
      : visualContainer ?? textElement;
    if (seenContainers.has(container)) {
      continue;
    }

    const text = normalizedText(textElement);
    if (
      !text ||
      text.length > 5_000 ||
      NON_MESSAGE_TEXT.test(text) ||
      !HAS_LETTER.test(text) ||
      !isIncoming(container, textElement, bounds)
    ) continue;

    seenContainers.add(container);
    results.push({ container, textElement, text });
  }

  return results;
}

export function resolveIncomingMessageFromTarget(
  target: EventTarget | null
): IncomingMessageCandidate | null {
  if (!(target instanceof HTMLElement)) return null;
  if (
    target.closest("#zalo-auto-translator-root, .zat-incoming-tools, .zat-incoming-floating") ||
    target.closest('[contenteditable="true"], textarea, input, nav, aside')
  ) return null;

  const bounds = conversationBounds();
  let current: HTMLElement | null = target;
  let textElement: HTMLElement | null = null;
  for (let depth = 0; current && depth < 7; depth += 1) {
    const text = messageText(current);
    const rect = current.getBoundingClientRect();
    if (
      text &&
      text.length <= 5_000 &&
      !NON_MESSAGE_TEXT.test(text) &&
      HAS_LETTER.test(text) &&
      rect.width >= 20 &&
      rect.height >= 14 &&
      rect.bottom >= bounds.top &&
      rect.top <= bounds.bottom
    ) {
      textElement = current;
      break;
    }
    current = current.parentElement;
  }
  if (!textElement) return null;

  const semanticContainer =
    textElement.parentElement?.closest<HTMLElement>(MESSAGE_CONTAINER_SELECTOR) ?? null;
  const visualContainer = visualBubbleFor(textElement);
  const semanticHasDirection = semanticContainer
    ? OUTGOING_HINT.test(directionHints(semanticContainer)) ||
      INCOMING_HINT.test(directionHints(semanticContainer)) ||
      semanticContainer.hasAttribute("data-from-me")
    : false;
  const container = semanticHasDirection
    ? semanticContainer!
    : visualContainer ?? textElement;
  if (!isIncoming(container, textElement, bounds)) return null;

  const text = messageText(textElement);
  return text ? { container, textElement, text } : null;
}

