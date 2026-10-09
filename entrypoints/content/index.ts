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
  resolveIncomingMessageFromTarget,
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
    incomingHint.textContent = "상대방 말풍선에 마우스를 올려 번역하거나, 새 메시지만 자동으로 한국어 번역합니다.";

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
        button.textContent = "다시 번역";
        return;
      }

      button.disabled = true;
      button.textContent = "번역 중…";
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
        button.textContent = "다시 번역";
      } catch (error) {
        result.textContent =
          error instanceof Error ? error.message : "받은 메시지 번역에 실패했습니다.";
        result.dataset.state = "error";
        result.hidden = false;
        button.textContent = "재시도";
      } finally {
        button.disabled = false;
      }
    };

    const decorateIncomingMessages = (root: ParentNode, translateAutomatically: boolean) => {
      findIncomingMessages(root).forEach((candidate) => {
        candidate.container.dataset.zatIncomingDecorated = "true";
        const controls = document.createElement("div");
        controls.className = "zat-incoming-tools";
        const button = createButton("한국어 번역", "zat-incoming-translate");
        const result = document.createElement("div");
        result.className = "zat-incoming-result";
        result.hidden = true;
        controls.append(button, result);
        candidate.textElement.insertAdjacentElement("afterend", controls);
        button.addEventListener("click", () => {
          incomingCache.delete(candidate.text);
          void translateIncomingMessage(candidate, button, result);
        });
        if (translateAutomatically) {
          void translateIncomingMessage(candidate, button, result);
        }
      });
    };

    const incomingStyle = document.createElement("style");
    incomingStyle.id = "zalo-auto-translator-incoming-style";
    incomingStyle.textContent = `
      .zat-incoming-tools { clear: both; display: grid; gap: 5px; margin: 4px 0 7px; max-width: min(420px, 75vw); }
      .zat-incoming-translate { background: transparent; border: 0; color: #2867e8; cursor: pointer; font: 600 11px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; justify-self: start; padding: 2px 4px; }
      .zat-incoming-translate:disabled { cursor: wait; opacity: .6; }
      .zat-incoming-result { background: #eef6ff; border-left: 3px solid #2867e8; border-radius: 6px; color: #172033; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 7px 9px; white-space: pre-wrap; }
      .zat-incoming-result[data-state="error"] { background: #fff1f1; border-left-color: #c52a2a; color: #a12121; }
      .zat-incoming-floating-button { all: initial !important; background: #2867e8 !important; border: 0 !important; border-radius: 999px !important; box-shadow: 0 4px 14px rgba(22, 34, 55, .24) !important; color: #fff !important; cursor: pointer !important; font: 700 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; padding: 7px 11px !important; position: fixed !important; z-index: 2147483646 !important; }
      .zat-incoming-floating-button:disabled { cursor: wait !important; opacity: .7 !important; }
      .zat-incoming-floating-result { all: initial !important; background: #eef6ff !important; border: 1px solid #b9d7ff !important; border-left: 4px solid #2867e8 !important; border-radius: 9px !important; box-shadow: 0 8px 24px rgba(22, 34, 55, .2) !important; box-sizing: border-box !important; color: #172033 !important; cursor: pointer !important; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; max-width: min(440px, calc(100vw - 24px)) !important; padding: 10px 12px !important; position: fixed !important; white-space: pre-wrap !important; z-index: 2147483646 !important; }
      .zat-incoming-floating-result[data-state="error"] { background: #fff1f1 !important; border-color: #efb4b4 !important; border-left-color: #c52a2a !important; color: #a12121 !important; }
      .zat-incoming-floating[hidden] { display: none !important; }
    `;
    document.head.append(incomingStyle);

    const hoverTranslateButton = createButton(
      "한국어 번역",
      "zat-incoming-floating zat-incoming-floating-button"
    );
    const hoverTranslationResult = document.createElement("div");
    hoverTranslationResult.className =
      "zat-incoming-floating zat-incoming-floating-result";
    hoverTranslateButton.hidden = true;
    hoverTranslationResult.hidden = true;
    hoverTranslationResult.title = "클릭하면 번역을 닫습니다.";
    document.documentElement.append(hoverTranslateButton, hoverTranslationResult);

    let hoveredIncoming: IncomingMessageCandidate | null = null;
    let hoverHideTimer: ReturnType<typeof setTimeout> | undefined;
    let hoverFrame: number | undefined;

    const positionFloatingTranslation = (candidate: IncomingMessageCandidate) => {
      const rect = candidate.container.getBoundingClientRect();
      const buttonLeft = Math.max(8, Math.min(rect.left + 6, window.innerWidth - 112));
      const buttonTop =
        rect.bottom + 38 < window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - 34);
      hoverTranslateButton.style.left = `${buttonLeft}px`;
      hoverTranslateButton.style.top = `${buttonTop}px`;
      hoverTranslationResult.style.left = `${buttonLeft}px`;
      hoverTranslationResult.style.top = `${Math.max(
        8,
        Math.min(buttonTop + 36, window.innerHeight - 120)
      )}px`;
    };

    const showFloatingTranslation = (candidate: IncomingMessageCandidate) => {
      if (hoverHideTimer) clearTimeout(hoverHideTimer);
      const changed =
        hoveredIncoming?.container !== candidate.container ||
        hoveredIncoming?.text !== candidate.text;
      hoveredIncoming = candidate;
      if (changed) {
        hoverTranslationResult.hidden = true;
        delete hoverTranslationResult.dataset.state;
        hoverTranslateButton.textContent = incomingCache.has(candidate.text)
          ? "번역 보기"
          : "한국어 번역";
      }
      positionFloatingTranslation(candidate);
      hoverTranslateButton.hidden = false;
    };

    document.addEventListener(
      "pointermove",
      (event) => {
        if (hoverFrame) cancelAnimationFrame(hoverFrame);
        const target = event.target;
        hoverFrame = requestAnimationFrame(() => {
          if (target instanceof Element && target.closest(".zat-incoming-floating")) {
            if (hoverHideTimer) clearTimeout(hoverHideTimer);
            return;
          }
          const candidate = resolveIncomingMessageFromTarget(target);
          if (candidate) {
            showFloatingTranslation(candidate);
            return;
          }
          if (hoverHideTimer) clearTimeout(hoverHideTimer);
          hoverHideTimer = setTimeout(() => {
            hoverTranslateButton.hidden = true;
          }, 350);
        });
      },
      true
    );

    hoverTranslateButton.addEventListener("click", () => {
      if (!hoveredIncoming) return;
      positionFloatingTranslation(hoveredIncoming);
      if (hoverTranslateButton.textContent === "다시 번역") {
        incomingCache.delete(hoveredIncoming.text);
      }
      void translateIncomingMessage(
        hoveredIncoming,
        hoverTranslateButton,
        hoverTranslationResult
      ).then(() => {
        if (hoveredIncoming) positionFloatingTranslation(hoveredIncoming);
      });
    });
    hoverTranslationResult.addEventListener("click", () => {
      hoverTranslationResult.hidden = true;
    });

    let incomingScanTimer: ReturnType<typeof setTimeout> | undefined;
    const incomingObserver = new MutationObserver((mutations) => {
      if (incomingScanTimer) clearTimeout(incomingScanTimer);
      const addedRoots = Array.from(
        new Set(
          mutations.flatMap((mutation) =>
            Array.from(mutation.addedNodes)
              .map((node) =>
                node instanceof HTMLElement
                  ? node
                  : node.parentElement instanceof HTMLElement
                    ? node.parentElement
                    : null
              )
              .filter((node): node is HTMLElement => node !== null)
          )
        )
      );
      if (!addedRoots.length) return;
      incomingScanTimer = setTimeout(() => {
        addedRoots.forEach((root) => decorateIncomingMessages(root, incomingToggle.checked));
      }, 250);
    });
    incomingObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => decorateIncomingMessages(document, false), 800);

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
