import { browser } from "wxt/browser";
import { getEnterAction, type ComposeOperation } from "../../src/compose-flow";
import type {
  BackgroundMessage,
  BackgroundResponse,
  ExtensionSettings,
  TranslationResult,
  TranslationTone,
  VietnameseAddress
} from "../../src/types";
import { findComposerFromFocus, sendComposer } from "../../src/zalo/dom-adapter";
import {
  findIncomingMessages,
  type IncomingMessageCandidate
} from "../../src/zalo/incoming-adapter";
import contentStyle from "./style.css?inline";

const ROOT_ID = "zalo-auto-translator-root";

function createButton(label: string, className = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  return button;
}

export default defineContentScript({
  matches: ["https://chat.zalo.me/*"],
  runAt: "document_idle",
  main() {
    if (document.getElementById(ROOT_ID)) return;

    let activeComposer: HTMLElement | null = null;
    let translatedSource = "";
    let translatedTone: TranslationTone | null = null;
    let translatedAddress: VietnameseAddress | null = null;
    let translatedTarget: "vi" | "en" | null = null;
    let requestSequence = 0;
    let operation: ComposeOperation = "idle";
    let currentSettings: ExtensionSettings | null = null;
    const incomingCache = new Map<string, string>();

    const host = document.createElement("div");
    host.id = ROOT_ID;
    const shadow = host.attachShadow({ mode: "open" });
    document.documentElement.append(host);

    const style = document.createElement("style");
    style.textContent = contentStyle;
    shadow.append(style);

    const panel = document.createElement("section");
    panel.className = "zat-panel";
    panel.setAttribute("aria-label", "Zalo 번역기");

    const header = document.createElement("div");
    header.className = "zat-header";
    const title = document.createElement("strong");
    title.textContent = "메시지 번역";
    const collapseButton = createButton("−", "zat-icon-button");
    collapseButton.setAttribute("aria-label", "번역기 접기");
    header.append(title, collapseButton);

    const body = document.createElement("div");
    body.className = "zat-body";

    const status = document.createElement("p");
    status.className = "zat-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "전송할 Zalo 메시지 입력창을 한 번 클릭해 주세요.";

    const sourceLabel = document.createElement("label");
    sourceLabel.textContent = "한국어 메시지";
    const sourceText = document.createElement("textarea");
    sourceText.rows = 3;
    sourceText.maxLength = 5_000;
    sourceText.placeholder = "여기에 한국어를 입력하세요";
    sourceText.setAttribute("aria-describedby", "zat-keyboard-hint");
    const keyboardHint = document.createElement("small");
    keyboardHint.id = "zat-keyboard-hint";
    keyboardHint.className = "zat-hint";
    sourceLabel.append(sourceText, keyboardHint);

    const targetLabel = document.createElement("label");
    targetLabel.textContent = "보내는 언어";
    const targetSelect = document.createElement("select");
    const targetOptions: Array<["vi" | "en", string]> = [
      ["vi", "베트남어"],
      ["en", "영어"]
    ];
    targetOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      targetSelect.append(option);
    });
    targetLabel.append(targetSelect);

    const addressLabel = document.createElement("label");
    addressLabel.textContent = "베트남어 호칭 관계";
    const addressSelect = document.createElement("select");
    const addresses: Array<[VietnameseAddress, string]> = [
      ["neutral", "관계 모름 · tôi / bạn"],
      ["older_male", "상대가 약간 연상 남성 · em / anh"],
      ["older_female", "상대가 약간 연상 여성 · em / chị"],
      ["younger_from_male", "내가 연상 남성 · anh / em"],
      ["younger_from_female", "내가 연상 여성 · chị / em"],
      ["same_age", "동갑 또는 친구 · mình / bạn"],
      ["much_older_male", "상대가 많이 연상 남성 · cháu / chú"],
      ["much_older_female", "상대가 많이 연상 여성 · cháu / cô"],
      ["customer", "고객 · tôi / anh·chị·quý khách"]
    ];
    addresses.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      addressSelect.append(option);
    });
    addressLabel.append(addressSelect);

    const toneLabel = document.createElement("label");
    toneLabel.textContent = "말투";
    const toneSelect = document.createElement("select");
    const tones: Array<[TranslationTone, string]> = [
      ["natural", "자연스럽게"],
      ["polite", "정중하게"],
      ["friendly", "친구에게"],
      ["coworker", "동료에게"],
      ["customer", "고객에게"],
      ["elder", "연장자에게"]
    ];
    tones.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      toneSelect.append(option);
    });
    toneLabel.append(toneSelect);

    const incomingToggleLabel = document.createElement("label");
    incomingToggleLabel.className = "zat-toggle zat-incoming-toggle";
    const incomingToggle = document.createElement("input");
    incomingToggle.type = "checkbox";
    const incomingToggleText = document.createElement("span");
    incomingToggleText.textContent = "새로 받은 메시지 자동 번역";
    incomingToggleLabel.append(incomingToggle, incomingToggleText);
    const incomingHint = document.createElement("small");
    incomingHint.className = "zat-hint";
    incomingHint.textContent = "상대방 텍스트 메시지 옆의 번역 아이콘을 누르거나, 새 메시지를 자동으로 한국어 번역합니다.";

    const sourceActions = document.createElement("div");
    sourceActions.className = "zat-source-actions";
    const clearAllButton = createButton("모두 지우기", "zat-secondary");
    const translateButton = createButton("베트남어로 번역", "zat-primary");
    sourceActions.append(clearAllButton, translateButton);

    const preview = document.createElement("div");
    preview.className = "zat-preview zat-hidden";
    const previewLabel = document.createElement("label");
    previewLabel.textContent = "번역 미리보기 · 직접 수정 가능";
    const previewText = document.createElement("textarea");
    previewText.rows = 4;
    previewText.maxLength = 5_000;
    previewLabel.append(previewText);

    const previewActions = document.createElement("div");
    previewActions.className = "zat-actions";
    const cancelButton = createButton("번역 취소", "zat-secondary");
    const sendButton = createButton("Zalo로 전송", "zat-primary");
    previewActions.append(cancelButton, sendButton);
    preview.append(previewLabel, previewActions);

    body.append(
      status,
      sourceLabel,
      targetLabel,
      addressLabel,
      toneLabel,
      sourceActions,
      preview,
      incomingToggleLabel,
      incomingHint
    );
    panel.append(header, body);
    shadow.append(panel);

    const setStatus = (message: string, kind?: "success" | "error") => {
      status.textContent = message;
      status.className = `zat-status${kind ? ` zat-${kind}` : ""}`;
    };

    const previewIsCurrent = () =>
      Boolean(previewText.value.trim()) &&
      translatedSource === sourceText.value.trim() &&
      translatedTone === toneSelect.value &&
      translatedAddress === addressSelect.value &&
      translatedTarget === targetSelect.value;

    const targetLanguageName = () =>
      targetSelect.value === "en" ? "영어" : "베트남어";

    const refreshControls = () => {
      const ready = previewIsCurrent();
      const hasSource = Boolean(sourceText.value.trim());
      const sending = operation === "sending";

      sourceText.disabled = sending;
      toneSelect.disabled = operation !== "idle";
      addressSelect.disabled = operation !== "idle";
      targetSelect.disabled = operation !== "idle";
      previewText.disabled = sending;
      translateButton.disabled = operation !== "idle" || !hasSource;
      sendButton.disabled = operation !== "idle" || !ready;
      cancelButton.disabled = sending;
      clearAllButton.disabled = sending || (!hasSource && !previewText.value.trim());

      translateButton.textContent =
        operation === "translating"
          ? "번역 중…"
          : ready
            ? "다시 번역"
            : `${targetLanguageName()}로 번역`;
      addressLabel.hidden = targetSelect.value !== "vi";
      sendButton.textContent = operation === "sending" ? "전송 중…" : "Zalo로 전송";
      keyboardHint.textContent =
        operation === "translating"
          ? "번역 중입니다…"
          : sending
            ? "Zalo로 전송 중입니다…"
            : ready
              ? "Enter: 전송 · Shift+Enter: 줄바꿈 · Esc: 번역 취소"
              : "Enter: 번역 · Shift+Enter: 줄바꿈 · Esc: 번역 취소";
    };

    const clearPreview = () => {
      previewText.value = "";
      translatedSource = "";
      translatedTone = null;
      translatedAddress = null;
      translatedTarget = null;
      preview.classList.add("zat-hidden");
      preview.classList.remove("zat-stale");
    };

    const cancelTranslation = () => {
      if (operation === "sending") return;
      requestSequence += 1;
      operation = "idle";
      clearPreview();
      refreshControls();
      setStatus("번역을 취소했습니다. 한국어 원문은 그대로 유지됩니다.");
      sourceText.focus();
    };

    const clearAll = () => {
      if (operation === "sending") return;
      requestSequence += 1;
      operation = "idle";
      sourceText.value = "";
      clearPreview();
      refreshControls();
      setStatus("내용을 모두 지웠습니다. 새 메시지를 작성하세요.");
      sourceText.focus();
    };

    const invalidatePreview = () => {
      if (operation === "translating") {
        requestSequence += 1;
        operation = "idle";
      }

      if (!sourceText.value.trim()) {
        clearPreview();
        setStatus("한국어 메시지를 입력한 뒤 Enter를 눌러 번역하세요.");
      } else if (previewIsCurrent()) {
        preview.classList.remove("zat-stale");
        setStatus("Enter를 누르면 번역문을 Zalo로 전송합니다.", "success");
      } else if (!preview.classList.contains("zat-hidden")) {
        preview.classList.add("zat-stale");
        setStatus("원문, 언어, 호칭 또는 말투가 변경되었습니다. 다시 번역합니다.");
      } else {
        setStatus(`Enter를 누르면 ${targetLanguageName()}로 번역합니다.`);
      }
      refreshControls();
    };

    const updateComposer = (target: EventTarget | null) => {
      const composer = findComposerFromFocus(target);
      if (!composer) return;
      activeComposer = composer;
      if (operation === "sending") return;

      setStatus(
        previewIsCurrent()
          ? "Zalo 입력창이 연결되었습니다. Enter를 누르면 번역문을 전송합니다."
          : "Zalo 입력창이 연결되었습니다. 번역 패널에 한국어를 작성하세요.",
        "success"
      );
    };

    const getActiveComposer = (): HTMLElement | null => {
      if (activeComposer && document.contains(activeComposer)) return activeComposer;
      setStatus("전송할 Zalo 대화 입력창을 먼저 한 번 클릭해 주세요.", "error");
      return null;
    };

    const requestTranslation = async (): Promise<void> => {
      if (operation !== "idle") return;
      const text = sourceText.value.trim();
      const tone = toneSelect.value as TranslationTone;
      const vietnameseAddress = addressSelect.value as VietnameseAddress;
      const targetLanguage = targetSelect.value as "vi" | "en";
      if (!text) {
        setStatus("위 입력란에 번역할 한국어를 입력해 주세요.", "error");
        sourceText.focus();
        return;
      }

      const sequence = ++requestSequence;
      operation = "translating";
      refreshControls();
      setStatus(`${targetLanguageName()} 번역을 준비하고 있습니다.`);

      const message: BackgroundMessage = {
        type: "translate",
        payload: {
          text,
          sourceLanguage: "ko",
          targetLanguage,
          tone,
          vietnameseAddress
        }
      };

      try {
        const response = (await browser.runtime.sendMessage(
          message
        )) as BackgroundResponse<TranslationResult>;
        if (!response.ok) throw new Error(response.error);
        if (
          sequence !== requestSequence ||
          sourceText.value.trim() !== text ||
          toneSelect.value !== tone ||
          addressSelect.value !== vietnameseAddress ||
          targetSelect.value !== targetLanguage
        ) {
          return;
        }

        previewText.value = response.data.translatedText;
        translatedSource = text;
        translatedTone = tone;
        translatedAddress = vietnameseAddress;
        translatedTarget = targetLanguage;
        preview.classList.remove("zat-hidden", "zat-stale");
        operation = "idle";
        refreshControls();
        setStatus("번역을 확인하거나 수정하세요. Enter를 한 번 더 누르면 전송됩니다.", "success");
      } catch (error) {
        if (sequence !== requestSequence) return;
        operation = "idle";
        refreshControls();
        setStatus(error instanceof Error ? error.message : "번역에 실패했습니다.", "error");
      } finally {
        if (sequence === requestSequence && operation === "translating") {
          operation = "idle";
          refreshControls();
        }
      }
    };

    const sendTranslation = async (translated: string): Promise<void> => {
      if (operation !== "idle") return;
      const composer = getActiveComposer();
      if (!composer) return;
      if (!translated.trim()) {
        setStatus(`전송할 ${targetLanguageName()} 번역문을 확인해 주세요.`, "error");
        return;
      }

      operation = "sending";
      refreshControls();
      setStatus("Zalo로 전송하고 있습니다…");
      try {
        const confirmed = await sendComposer(composer, translated.trim());
        operation = "idle";
        if (!confirmed) {
          refreshControls();
          setStatus(
            "자동 전송을 확인하지 못했습니다. Zalo 입력창의 번역문을 확인한 뒤 직접 전송해 주세요.",
            "error"
          );
          return;
        }

        requestSequence += 1;
        sourceText.value = "";
        clearPreview();
        refreshControls();
        setStatus("메시지를 전송했습니다. 새 메시지를 작성할 수 있습니다.", "success");
        sourceText.focus();
      } catch {
        operation = "idle";
        refreshControls();
        setStatus(
          "Zalo 전송 중 오류가 발생했습니다. 입력창 연결 상태를 확인하고 다시 시도해 주세요.",
          "error"
        );
      }
    };

    const persistPanelSettings = async (
      patch: Partial<Pick<
        ExtensionSettings,
        "tone" | "vietnameseAddress" | "outgoingTargetLanguage" | "autoTranslateIncoming"
      >>
    ): Promise<void> => {
      if (!currentSettings) return;
      currentSettings = { ...currentSettings, ...patch };
      const response = (await browser.runtime.sendMessage({
        type: "save-settings",
        payload: currentSettings
      } satisfies BackgroundMessage)) as BackgroundResponse<ExtensionSettings>;
      if (!response.ok) throw new Error(response.error);
    };

    const translateIncomingMessage = async (
      candidate: IncomingMessageCandidate,
      button: HTMLButtonElement,
      result: HTMLDivElement
    ): Promise<void> => {
      if (button.disabled) return;
      const cached = incomingCache.get(candidate.text);
      if (cached) {
        delete result.dataset.state;
        result.textContent = cached;
        result.hidden = false;
        button.dataset.state = "translated";
        button.setAttribute("aria-label", "한국어 번역 닫기");
        button.title = "한국어 번역 닫기";
        return;
      }

      button.disabled = true;
      button.dataset.state = "loading";
      button.setAttribute("aria-label", "한국어 번역 중");
      button.title = "한국어 번역 중";
      result.hidden = true;
      const message: BackgroundMessage = {
        type: "translate",
        payload: {
          text: candidate.text,
          sourceLanguage: "auto",
          targetLanguage: "ko",
          tone: "natural",
          vietnameseAddress: "neutral"
        }
      };

      try {
        const response = (await browser.runtime.sendMessage(
          message
        )) as BackgroundResponse<TranslationResult>;
        if (!response.ok) throw new Error(response.error);
        incomingCache.set(candidate.text, response.data.translatedText);
        delete result.dataset.state;
        result.textContent = response.data.translatedText;
        result.hidden = false;
        button.dataset.state = "translated";
        button.setAttribute("aria-label", "한국어 번역 닫기");
        button.title = "한국어 번역 닫기";
      } catch (error) {
        result.textContent =
          error instanceof Error ? error.message : "받은 메시지 번역에 실패했습니다.";
        result.dataset.state = "error";
        result.hidden = false;
        button.dataset.state = "error";
        button.setAttribute("aria-label", "한국어 번역 재시도");
        button.title = "한국어 번역 재시도";
      } finally {
        button.disabled = false;
      }
    };

    const incomingStyle = document.createElement("style");
    incomingStyle.id = "zalo-auto-translator-incoming-style";
    incomingStyle.textContent = `
      .zat-incoming-icon { all: initial !important; align-items: center !important; background: #fff !important; border: 1px solid #cad5e5 !important; border-radius: 50% !important; box-shadow: 0 2px 8px rgba(22, 34, 55, .16) !important; color: #607086 !important; cursor: pointer !important; display: flex !important; height: 28px !important; justify-content: center !important; padding: 0 !important; position: fixed !important; transition: background .15s, border-color .15s, color .15s, transform .15s !important; width: 28px !important; z-index: 2147483645 !important; }
      .zat-incoming-icon:hover { background: #2867e8 !important; border-color: #2867e8 !important; color: #fff !important; transform: scale(1.06) !important; }
      .zat-incoming-icon[data-state="translated"] { background: #eaf2ff !important; border-color: #8ab2f7 !important; color: #2867e8 !important; }
      .zat-incoming-icon[data-state="loading"] { cursor: wait !important; opacity: .65 !important; }
      .zat-incoming-icon svg { display: block !important; height: 17px !important; pointer-events: none !important; width: 17px !important; }
      .zat-incoming-card { all: initial !important; background: #eef6ff !important; border: 1px solid #b9d7ff !important; border-left: 4px solid #2867e8 !important; border-radius: 9px !important; box-shadow: 0 8px 24px rgba(22, 34, 55, .2) !important; box-sizing: border-box !important; color: #172033 !important; cursor: pointer !important; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; max-height: 220px !important; max-width: min(440px, calc(100vw - 24px)) !important; overflow: auto !important; padding: 28px 12px 10px !important; position: fixed !important; white-space: pre-wrap !important; z-index: 2147483646 !important; }
      .zat-incoming-card::before { color: #2867e8 !important; content: "한국어 번역 · 클릭하여 닫기" !important; font: 700 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; left: 12px !important; position: absolute !important; top: 9px !important; }
      .zat-incoming-card[data-state="error"] { background: #fff1f1 !important; border-color: #efb4b4 !important; border-left-color: #c52a2a !important; color: #a12121 !important; }
      .zat-incoming-overlay[hidden] { display: none !important; }
    `;
    document.head.append(incomingStyle);

    interface IncomingOverlay {
      candidate: IncomingMessageCandidate;
      button: HTMLButtonElement;
      result: HTMLDivElement;
    }

    const translationIcon = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
        <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
      </svg>`;
    const incomingOverlays = new Map<HTMLElement, IncomingOverlay>();
    let openOverlay: IncomingOverlay | null = null;

    const positionIncomingOverlay = (overlay: IncomingOverlay) => {
      const rect = overlay.candidate.container.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;
      overlay.button.hidden = !visible;
      if (!visible) {
        overlay.result.hidden = true;
        return;
      }

      overlay.button.style.left = `${Math.max(
        6,
        Math.min(rect.right + 7, window.innerWidth - 34)
      )}px`;
      overlay.button.style.top = `${Math.max(
        6,
        Math.min(rect.top + Math.max(0, (rect.height - 28) / 2), window.innerHeight - 34)
      )}px`;

      const cardWidth = Math.max(220, Math.min(440, rect.width));
      overlay.result.style.width = `${cardWidth}px`;
      overlay.result.style.left = `${Math.max(
        8,
        Math.min(rect.left, window.innerWidth - cardWidth - 8)
      )}px`;
      overlay.result.style.top = `${rect.bottom + 6}px`;
      overlay.result.style.setProperty(
        "max-height",
        `${Math.max(80, Math.min(220, window.innerHeight - rect.bottom - 14))}px`,
        "important"
      );
    };

    const closeOpenOverlay = (except?: IncomingOverlay) => {
      if (openOverlay && openOverlay !== except) openOverlay.result.hidden = true;
      openOverlay = except ?? null;
    };

    const createIncomingOverlay = (
      candidate: IncomingMessageCandidate,
      translateAutomatically: boolean
    ): IncomingOverlay => {
      const button = createButton("", "zat-incoming-overlay zat-incoming-icon");
      button.innerHTML = translationIcon;
      button.setAttribute("aria-label", "한국어로 번역");
      button.title = "한국어로 번역";
      const result = document.createElement("div");
      result.className = "zat-incoming-overlay zat-incoming-card";
      result.hidden = true;
      result.title = "클릭하면 번역을 닫습니다.";
      const overlay = { candidate, button, result };
      document.documentElement.append(button, result);

      button.addEventListener("click", () => {
        if (!result.hidden) {
          result.hidden = true;
          if (openOverlay === overlay) openOverlay = null;
          button.dataset.state = incomingCache.has(overlay.candidate.text)
            ? "translated"
            : "";
          button.setAttribute("aria-label", "한국어로 번역");
          button.title = "한국어로 번역";
          return;
        }
        closeOpenOverlay(overlay);
        positionIncomingOverlay(overlay);
        void translateIncomingMessage(overlay.candidate, button, result).then(() => {
          if (openOverlay !== overlay) result.hidden = true;
          positionIncomingOverlay(overlay);
        });
      });
      result.addEventListener("click", () => {
        result.hidden = true;
        if (openOverlay === overlay) openOverlay = null;
      });

      if (translateAutomatically) {
        closeOpenOverlay(overlay);
        void translateIncomingMessage(candidate, button, result).then(() => {
          if (openOverlay !== overlay) result.hidden = true;
          positionIncomingOverlay(overlay);
        });
      }
      return overlay;
    };

    const syncIncomingOverlays = (translateNewMessages: boolean) => {
      const candidates = findIncomingMessages(document);
      const seen = new Set<HTMLElement>();
      candidates.forEach((candidate) => {
        seen.add(candidate.container);
        let overlay = incomingOverlays.get(candidate.container);
        if (!overlay) {
          overlay = createIncomingOverlay(
            candidate,
            translateNewMessages && incomingToggle.checked
          );
          incomingOverlays.set(candidate.container, overlay);
        } else {
          if (overlay.candidate.text !== candidate.text) {
            overlay.result.hidden = true;
            delete overlay.button.dataset.state;
            overlay.button.setAttribute("aria-label", "한국어로 번역");
            overlay.button.title = "한국어로 번역";
            if (openOverlay === overlay) openOverlay = null;
          }
          overlay.candidate = candidate;
        }
        positionIncomingOverlay(overlay);
      });

      incomingOverlays.forEach((overlay, container) => {
        if (!document.contains(container)) {
          overlay.button.remove();
          overlay.result.remove();
          incomingOverlays.delete(container);
          if (openOverlay === overlay) openOverlay = null;
        } else if (!seen.has(container)) {
          overlay.button.hidden = true;
          overlay.result.hidden = true;
        }
      });
    };

    let incomingScanTimer: ReturnType<typeof setTimeout> | undefined;
    const incomingObserver = new MutationObserver(() => {
      if (incomingScanTimer) clearTimeout(incomingScanTimer);
      incomingScanTimer = setTimeout(() => {
        syncIncomingOverlays(true);
      }, 300);
    });
    incomingObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => syncIncomingOverlays(false), 700);
    setInterval(() => syncIncomingOverlays(false), 1_500);
    const repositionIncomingOverlays = () => {
      incomingOverlays.forEach(positionIncomingOverlay);
    };
    document.addEventListener("scroll", repositionIncomingOverlays, true);
    window.addEventListener("resize", repositionIncomingOverlays);

    const handleEnter = () => {
      const action = getEnterAction({
        operation,
        sourceText: sourceText.value,
        previewText: previewText.value,
        previewIsCurrent: previewIsCurrent()
      });
      if (action === "translate") void requestTranslation();
      if (action === "send") void sendTranslation(previewText.value);
    };

    document.addEventListener("focusin", (event) => updateComposer(event.target), true);
    document.addEventListener("pointerdown", (event) => updateComposer(event.target), true);

    collapseButton.addEventListener("click", () => {
      const collapsed = body.classList.toggle("zat-hidden");
      collapseButton.textContent = collapsed ? "+" : "−";
      collapseButton.setAttribute("aria-label", collapsed ? "번역기 펼치기" : "번역기 접기");
    });

    translateButton.addEventListener("click", () => void requestTranslation());
    clearAllButton.addEventListener("click", clearAll);
    cancelButton.addEventListener("click", cancelTranslation);
    sendButton.addEventListener("click", () => void sendTranslation(previewText.value));

    sourceText.addEventListener("input", invalidatePreview);
    const handleTranslationOptionChange = () => {
      invalidatePreview();
      void persistPanelSettings({
        tone: toneSelect.value as TranslationTone,
        vietnameseAddress: addressSelect.value as VietnameseAddress,
        outgoingTargetLanguage: targetSelect.value as "vi" | "en"
      }).catch(() => undefined);
      if (sourceText.value.trim()) void requestTranslation();
    };
    toneSelect.addEventListener("change", handleTranslationOptionChange);
    addressSelect.addEventListener("change", handleTranslationOptionChange);
    targetSelect.addEventListener("change", handleTranslationOptionChange);
    incomingToggle.addEventListener("change", () => {
      void persistPanelSettings({ autoTranslateIncoming: incomingToggle.checked }).catch(() => {
        incomingToggle.checked = !incomingToggle.checked;
        setStatus("자동 번역 설정을 저장하지 못했습니다.", "error");
      });
      setStatus(
        incomingToggle.checked
          ? "지금부터 새로 받은 메시지를 한국어로 자동 번역합니다."
          : "받은 메시지 자동 번역을 껐습니다."
      );
    });
    previewText.addEventListener("input", () => {
      refreshControls();
      if (previewIsCurrent()) {
        setStatus("수정한 번역문을 확인하세요. Enter를 누르면 전송됩니다.", "success");
      }
    });

    sourceText.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      handleEnter();
    });

    previewText.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      handleEnter();
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.isComposing || operation === "sending") return;
      event.preventDefault();
      cancelTranslation();
    });

    refreshControls();

    void browser.runtime
      .sendMessage({ type: "get-settings" } satisfies BackgroundMessage)
      .then((response: BackgroundResponse<ExtensionSettings>) => {
        if (!response.ok) return;
        toneSelect.value = response.data.tone;
        addressSelect.value = response.data.vietnameseAddress;
        targetSelect.value = response.data.outgoingTargetLanguage;
        incomingToggle.checked = response.data.autoTranslateIncoming;
        currentSettings = response.data;
        if (!response.data.enabled) body.classList.add("zat-hidden");
        refreshControls();
      });
  }
});
