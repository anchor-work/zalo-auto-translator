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
const NON_MESSAGE_TEXT = /^(?:(?:\d{1,2}:\d{2})\s*)?(?:hôm nay|hôm qua|today|yesterday|어제|오늘)(?:\s*\d{1,2}:\d{2})?$|^(?:\d{1,2}:\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/i;
const HAS_LETTER = /\p{L}/u;
const MENTION_ONLY = /^(?:@[\p{L}\p{N}_.-]+(?:\s+|$))+[.!?]?$/u;
const URL_OR_EMAIL_ONLY = /^(?:(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,})$/i;
const FILE_NAME = /\.(?:pdf|docx?|xlsx?|pptx?|txt|rtf|csv|zip|rar|7z|apk|exe)(?:\s|$)/i;
const FILE_SIZE = /\b\d+(?:[.,]\d+)?\s*(?:bytes?|kb|mb|gb|tb)\b/i;
const SYSTEM_TEXT = /^(?:\d+\s*(?:thành viên|members?|명)|đã thu hồi tin nhắn|message (?:was )?recalled|tin nhắn đã được thu hồi|cuộc gọi(?: nhỡ)?|missed call|đã tham gia nhóm|đã rời nhóm)$/i;
const FILE_OR_MEDIA_HINT = /(^|[\s_-])(file|attachment|document|media|photo|image|video|audio|voice|sticker|gif|location|contact|poll)(?=$|[\s_-])/i;
const META_HINT = /(^|[\s_-])(sender|author|username|user-name|display-name|profile-name|timestamp|time|date|meta|reaction|status|member-count|participant-count|link-preview|link-card|preview)(?=$|[\s_-])/i;
const QUOTE_HINT = /(^|[\s_-])(quote|quoted|reply|replied|forward|forwarded)(?=$|[\s_-])/i;
const MENTION_HINT = /(^|[\s_-])(mention|mentioned|tag|tagged)(?=$|[\s_-])/i;
const PAGE_CHROME_SELECTOR = [
  "header",
  "[role='banner']",
  "[role='navigation']",
  "[role='toolbar']",
  "[class*='conversation-header']",
  "[class*='chat-header']",
  "[class*='group-header']",
  "[class*='thread-header']"
].join(",");
const ZALO_MESSAGE_FRAME_SELECTOR = '[data-component="message-content-view"]';
const ZALO_RECEIVED_TEXT_SELECTOR = '[data-id*="ReceivedMsg_Text"]';

export interface IncomingMessageCandidate {
  container: HTMLElement;
  textElement: HTMLElement;
  text: string;
}

export function incomingCandidateStillMatches(
  candidate: IncomingMessageCandidate
): boolean {
  if (!candidate.container.isConnected) return false;

  const currentText = normalizedText(candidate.container);
  return candidate.text
    .split("\n")
    .filter(Boolean)
    .every((line) => currentText.includes(line));
}

function normalizedValue(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizedText(element: HTMLElement): string {
  return normalizedValue(element.innerText || element.textContent || "");
}

function cleanMessageText(value: string): string {
  const lines = normalizedValue(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  while (lines.length > 1 && NON_MESSAGE_TEXT.test(lines.at(-1) ?? "")) lines.pop();
  return lines.join("\n").trim();
}

function messageText(element: HTMLElement): string {
  return cleanMessageText(element.innerText || element.textContent || "");
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

function elementHints(element: HTMLElement): string {
  return [
    element.className,
    element.id,
    element.getAttribute("data-testid"),
    element.getAttribute("data-type"),
    element.getAttribute("role"),
    element.getAttribute("aria-label")
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

interface MessageGroup {
  container: HTMLElement;
  elements: Set<HTMLElement>;
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
    top: 80,
    bottom: Math.max(120, best.top - 8)
  };
}

function conversationBounds(): ConversationBounds {
  return (
    visibleComposerBounds() ?? {
      left: 0,
      right: window.innerWidth,
      top: 80,
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

  const nearLeftEdge = containerRect.left <= bounds.left + conversationWidth * 0.24;
  if (nearLeftEdge) return true;
  const nearRightEdge = containerRect.right >= bounds.right - conversationWidth * 0.08;
  if (nearRightEdge) return false;
  return containerRect.left + containerRect.width / 2 < bounds.left + conversationWidth * 0.55;
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
    rect.width <= window.innerWidth * 0.96 &&
    rect.height <= Math.max(560, window.innerHeight * 0.75)
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
  let outermostBubble: HTMLElement | null = null;
  for (let depth = 0; current && depth < 14; depth += 1) {
    const rect = current.getBoundingClientRect();
    if (
      hasBubbleAppearance(current) &&
      rect.width > 40 &&
      rect.width <= window.innerWidth * 0.96 &&
      rect.height <= Math.max(560, window.innerHeight * 0.75)
    ) outermostBubble = current;
    current = current.parentElement;
  }
  return outermostBubble;
}

function hintsBetween(
  element: HTMLElement,
  boundary: HTMLElement,
  pattern: RegExp
): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (pattern.test(elementHints(current))) return true;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return false;
}

function isInsideQuotedBlock(element: HTMLElement, boundary: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (QUOTE_HINT.test(elementHints(current))) return true;
    const style = window.getComputedStyle(current);
    if ((Number.parseFloat(style.borderLeftWidth) || 0) >= 2) return true;
    if (current === boundary) break;
    current = current.parentElement;
  }
  return false;
}

function isFileOrMediaMessage(container: HTMLElement): boolean {
  const text = normalizedText(container);
  if (FILE_NAME.test(text) || FILE_SIZE.test(text)) return true;
  if (FILE_OR_MEDIA_HINT.test(elementHints(container))) return true;
  return Boolean(
    container.querySelector(
      "video, audio, object, embed, [download], [class*='attachment'], [class*='file-card'], [class*='file-message'], [class*='sticker'], [class*='voice-message']"
    )
  );
}

function looksLikeSenderName(
  element: HTMLElement,
  text: string,
  otherElements: HTMLElement[]
): boolean {
  if (
    text.length > 80 ||
    text.includes("\n") ||
    text.split(/\s+/).length > 7 ||
    /[.!?,:;]$/.test(text)
  ) return false;

  const weight = window.getComputedStyle(element).fontWeight;
  const isBold = weight === "bold" || (Number.parseInt(weight, 10) || 0) >= 600;
  const rect = element.getBoundingClientRect();
  return otherElements.some((other) => {
    const otherRect = other.getBoundingClientRect();
    if (otherRect.top < rect.bottom - 2) return false;
    const otherText = messageText(other);
    const followedByLongerBody =
      otherText.length >= Math.max(24, Math.ceil(text.length * 1.5));
    return isBold || followedByLongerBody;
  });
}

function usableBodyElement(
  element: HTMLElement,
  container: HTMLElement,
  allElements: HTMLElement[]
): boolean {
  const text = messageText(element);
  if (
    !text ||
    NON_MESSAGE_TEXT.test(text) ||
    SYSTEM_TEXT.test(text) ||
    MENTION_ONLY.test(text) ||
    URL_OR_EMAIL_ONLY.test(text) ||
    !HAS_LETTER.test(text)
  ) return false;
  if (hintsBetween(element, container, META_HINT)) return false;
  if (hintsBetween(element, container, MENTION_HINT)) return false;
  if (isInsideQuotedBlock(element, container)) return false;
  if (looksLikeSenderName(element, text, allElements)) return false;
  return true;
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

function nearestCommonElement(
  left: HTMLElement,
  right: HTMLElement
): HTMLElement | null {
  const leftAncestors = new Set<HTMLElement>();
  let current: HTMLElement | null = left;
  while (current) {
    leftAncestors.add(current);
    current = current.parentElement;
  }
  current = right;
  while (current) {
    if (leftAncestors.has(current)) return current;
    current = current.parentElement;
  }
  return null;
}

function sharedMessageContainer(
  left: HTMLElement,
  right: HTMLElement,
  bounds: ConversationBounds
): HTMLElement | null {
  if (left.contains(right)) return left;
  if (right.contains(left)) return right;

  const common = nearestCommonElement(left, right);
  if (!common || common === document.body || common === document.documentElement) {
    return null;
  }
  if (common.closest(PAGE_CHROME_SELECTOR)) return null;

  const rect = common.getBoundingClientRect();
  const conversationWidth = Math.max(1, bounds.right - bounds.left);
  const plausibleSize =
    rect.width >= 40 &&
    rect.height >= 18 &&
    rect.width <= conversationWidth * 0.96 &&
    rect.height <= Math.max(560, window.innerHeight * 0.75);
  if (!plausibleSize) return null;
  if (
    !hasBubbleAppearance(common) &&
    !common.hasAttribute("data-message-id") &&
    !common.hasAttribute("data-msg-id")
  ) {
    return null;
  }
  return common;
}

function mergeMessageGroups(
  groups: MessageGroup[],
  bounds: ConversationBounds
): MessageGroup[] {
  const merged = [...groups];
  let changed = true;
  while (changed) {
    changed = false;
    for (let leftIndex = 0; leftIndex < merged.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < merged.length; rightIndex += 1) {
        const left = merged[leftIndex]!;
        const right = merged[rightIndex]!;
        const container = sharedMessageContainer(
          left.container,
          right.container,
          bounds
        );
        if (!container) continue;
        right.elements.forEach((element) => left.elements.add(element));
        left.container = container;
        merged.splice(rightIndex, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return merged;
}

function structuredIncomingMessages(
  root: ParentNode,
  bounds: ConversationBounds
): IncomingMessageCandidate[] {
  const results: IncomingMessageCandidate[] = [];
  const seenFrames = new Set<HTMLElement>();
  root.querySelectorAll<HTMLElement>(ZALO_RECEIVED_TEXT_SELECTOR).forEach((received) => {
    const frame = received.closest<HTMLElement>(ZALO_MESSAGE_FRAME_SELECTOR);
    if (!frame || seenFrames.has(frame)) return;
    const textElement =
      received.querySelector<HTMLElement>('[data-component="text-container"]') ??
      received.querySelector<HTMLElement>('[data-component="message-text-content"]') ??
      received;
    const text = cleanMessageText(textElement.textContent || textElement.innerText || "");
    if (
      !text ||
      text.length > 5_000 ||
      NON_MESSAGE_TEXT.test(text) ||
      SYSTEM_TEXT.test(text) ||
      URL_OR_EMAIL_ONLY.test(text) ||
      !HAS_LETTER.test(text)
    ) return;

    const rect = frame.getBoundingClientRect();
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      (rect.bottom < bounds.top || rect.top > bounds.bottom)
    ) return;

    seenFrames.add(frame);
    results.push({ container: frame, textElement, text });
  });
  return results;
}

export function findIncomingMessages(root: ParentNode = document): IncomingMessageCandidate[] {
  const groups = new Map<HTMLElement, MessageGroup>();
  const bounds = conversationBounds();
  const structuredResults = structuredIncomingMessages(root, bounds);

  for (const textElement of candidateElements(root)) {
    if (
      textElement.closest("#zalo-auto-translator-root") ||
      textElement.closest(".zat-incoming-tools, .zat-incoming-overlay") ||
      textElement.closest(ZALO_MESSAGE_FRAME_SELECTOR) ||
      textElement.closest('[contenteditable="true"], textarea, input, nav, aside') ||
      textElement.closest(PAGE_CHROME_SELECTOR) ||
      textElement.closest("[aria-hidden='true']")
    ) continue;

    const rawText = messageText(textElement);
    if (
      !rawText ||
      rawText.length > 5_000 ||
      NON_MESSAGE_TEXT.test(rawText) ||
      SYSTEM_TEXT.test(rawText) ||
      URL_OR_EMAIL_ONLY.test(rawText) ||
      !HAS_LETTER.test(rawText)
    ) continue;

    const semanticContainer =
      textElement.parentElement?.closest<HTMLElement>(MESSAGE_CONTAINER_SELECTOR) ?? null;
    const visualContainer = visualBubbleFor(textElement);
    const semanticHasDirection = semanticContainer
      ? OUTGOING_HINT.test(directionHints(semanticContainer)) ||
        INCOMING_HINT.test(directionHints(semanticContainer)) ||
        semanticContainer.hasAttribute("data-from-me")
      : false;
    const directionContainer = semanticHasDirection
      ? semanticContainer!
      : visualContainer ?? textElement;
    const container = visualContainer ?? directionContainer;
    const rect = container.getBoundingClientRect();
    if (
      (rect.width > 0 && rect.height > 0 &&
        (rect.bottom < bounds.top || rect.top > bounds.bottom)) ||
      !isIncoming(directionContainer, textElement, bounds)
    ) continue;

    const group = groups.get(container) ?? {
      container,
      elements: new Set<HTMLElement>()
    };
    group.elements.add(textElement);
    groups.set(container, group);
  }

  const results: IncomingMessageCandidate[] = [...structuredResults];
  mergeMessageGroups([...groups.values()], bounds).forEach(({ container, elements }) => {
    if (isFileOrMediaMessage(container)) return;

    const allElements = [...elements];
    const bodyElements = allElements
      .filter((element) => usableBodyElement(element, container, allElements))
      .filter(
        (element) =>
          !allElements.some(
            (other) => other !== element && element.contains(other) &&
              usableBodyElement(other, container, allElements)
          )
      )
      .sort((left, right) => {
        const position = left.compareDocumentPosition(right);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

    const parts: string[] = [];
    bodyElements.forEach((element) => {
      const text = messageText(element);
      if (text && !parts.includes(text)) parts.push(text);
    });
    const text = parts.join("\n").trim();
    if (!text || !HAS_LETTER.test(text)) return;

    results.push({
      container,
      textElement: bodyElements.length === 1 ? bodyElements[0]! : container,
      text
    });
  });
  return results;
}

export function resolveIncomingMessageFromTarget(
  target: EventTarget | null
): IncomingMessageCandidate | null {
  if (!(target instanceof HTMLElement)) return null;
  return (
    findIncomingMessages(document).find(
      (candidate) =>
        candidate.container === target || candidate.container.contains(target)
    ) ?? null
  );
}

