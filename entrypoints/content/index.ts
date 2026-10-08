import { browser } from "wxt/browser";
import { getEnterAction, type ComposeOperation } from "../../src/compose-flow";
import type {
  BackgroundMessage,
  BackgroundResponse,
  ExtensionSettings,
  TranslationResult,
  TranslationTone
} from "../../src/types";
import { findComposerFromFocus, sendComposer } from "../../src/zalo/dom-adapter";
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
    let requestSequence = 0;
    let operation: ComposeOperation = "idle";

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
    title.textContent = "한→베 번역";
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

    const toneLabel = document.createElement("label");
    toneLabel.textContent = "상대방과 말투";
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

    body.append(status, sourceLabel, toneLabel, sourceActions, preview);
    panel.append(header, body);
    shadow.append(panel);

    const setStatus = (message: string, kind?: "success" | "error") => {
      status.textContent = message;
      status.className = `zat-status${kind ? ` zat-${kind}` : ""}`;
    };

    const previewIsCurrent = () =>
      Boolean(previewText.value.trim()) &&
      translatedSource === sourceText.value.trim() &&
      translatedTone === toneSelect.value;

    const refreshControls = () => {
      const ready = previewIsCurrent();
      const hasSource = Boolean(sourceText.value.trim());
      const sending = operation === "sending";

      sourceText.disabled = sending;
      toneSelect.disabled = operation !== "idle";
      previewText.disabled = sending;
      translateButton.disabled = operation !== "idle" || !hasSource;
      sendButton.disabled = operation !== "idle" || !ready;
      cancelButton.disabled = sending;
      clearAllButton.disabled = sending || (!hasSource && !previewText.value.trim());

      translateButton.textContent =
        operation === "translating" ? "번역 중…" : ready ? "다시 번역" : "베트남어로 번역";
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
        setStatus("원문 또는 말투가 변경되었습니다. Enter를 눌러 다시 번역하세요.");
      } else {
        setStatus("Enter를 누르면 베트남어로 번역합니다.");
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
      if (!text) {
        setStatus("위 입력란에 번역할 한국어를 입력해 주세요.", "error");
        sourceText.focus();
        return;
      }

      const sequence = ++requestSequence;
      operation = "translating";
      refreshControls();
      setStatus("베트남어 번역을 준비하고 있습니다.");

      const message: BackgroundMessage = {
        type: "translate",
        payload: { text, sourceLanguage: "ko", targetLanguage: "vi", tone }
      };

      try {
        const response = (await browser.runtime.sendMessage(
          message
        )) as BackgroundResponse<TranslationResult>;
        if (!response.ok) throw new Error(response.error);
        if (
          sequence !== requestSequence ||
          sourceText.value.trim() !== text ||
          toneSelect.value !== tone
        ) {
          return;
        }

        previewText.value = response.data.translatedText;
        translatedSource = text;
        translatedTone = tone;
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
        setStatus("전송할 베트남어 번역문을 확인해 주세요.", "error");
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
    toneSelect.addEventListener("change", invalidatePreview);
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
        if (!response.data.enabled) body.classList.add("zat-hidden");
        refreshControls();
      });
  }
});
