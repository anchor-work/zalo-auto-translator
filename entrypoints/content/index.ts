import { browser } from "wxt/browser";
import { getEnterAction, type ComposeOperation } from "../../src/compose-flow";
import { languageName, toneName, uiText } from "../../src/i18n";
import { incomingTranslationDecision } from "../../src/language";
import { DEFAULT_SETTINGS } from "../../src/settings";
import {
  defaultConversationProfile,
  incomingSocialContext,
  outgoingSocialContext,
  vietnameseAddressExample,
  vietnameseAddressForProfile
} from "../../src/conversation-profile";
import type {
  BackgroundMessage,
  BackgroundResponse,
  ConversationProfile,
  ConversationRelationship,
  ExtensionSettings,
  ParticipantGender,
  RelativeAge,
  TranslationLanguage,
  TranslationResult,
  TranslationSourceLanguage,
  TranslationTone,
  VietnameseAddress
} from "../../src/types";
import { findComposerFromFocus, sendComposer } from "../../src/zalo/dom-adapter";
import {
  findIncomingMessages,
  incomingCandidateStillMatches,
  type IncomingMessageCandidate
} from "../../src/zalo/incoming-adapter";
import contentStyle from "./style.css?inline";

const ROOT_ID = "zalo-auto-translator-root";
const INCOMING_STYLE_ID = "zalo-auto-translator-incoming-style";
const INCOMING_ICON_SIZE = 28;
const INCOMING_ICON_GAP = 7;

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
  async main() {
    const extensionVersion = browser.runtime.getManifest().version;
    const existingRoot = document.getElementById(ROOT_ID);
    const existingPanel = existingRoot?.shadowRoot?.querySelector(".zat-panel");
    if (
      existingRoot?.dataset.extensionVersion === extensionVersion &&
      existingRoot.dataset.status === "ready" &&
      existingPanel
    ) return;

    existingRoot?.remove();
    document.getElementById(INCOMING_STYLE_ID)?.remove();
    document.querySelectorAll(".zat-incoming-overlay").forEach((element) => element.remove());

    let activeComposer: HTMLElement | null = null;
    let translatedSource = "";
    let translatedTone: TranslationTone | null = null;
    let translatedAddress: VietnameseAddress | null = null;
    let translatedTarget: TranslationLanguage | null = null;
    let requestSequence = 0;
    let operation: ComposeOperation = "idle";
    let currentSettings: ExtensionSettings = { ...DEFAULT_SETTINGS };
    try {
      const response = (await browser.runtime.sendMessage({
        type: "get-settings"
      } satisfies BackgroundMessage)) as BackgroundResponse<ExtensionSettings>;
      if (response.ok) currentSettings = response.data;
    } catch {
      // Keep migrated defaults so the content UI remains usable offline.
    }
    const uiLanguage = currentSettings.userLanguage;
    const t = (key: Parameters<typeof uiText>[1], variables?: Record<string, string | number>) =>
      uiText(uiLanguage, key, variables);
    const incomingCache = new Map<string, string>();
    let activeProfile = defaultConversationProfile(currentSettings);
    let currentConversationKey = "";
    let conversationSettingsEditing = false;

    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.dataset.extensionVersion = extensionVersion;
    host.dataset.status = "starting";
    const shadow = host.attachShadow({ mode: "open" });
    document.documentElement.append(host);

    const style = document.createElement("style");
    style.textContent = contentStyle;
    shadow.append(style);

    const panel = document.createElement("section");
    panel.className = "zat-panel";
    panel.setAttribute("aria-label", t("appName"));

    const header = document.createElement("div");
    header.className = "zat-header";
    header.title = t("dragPanel");
    const title = document.createElement("strong");
    title.textContent = t("panelTitle");
    const headerActions = document.createElement("div");
    headerActions.className = "zat-header-actions";
    const resetPositionButton = createButton("↺", "zat-icon-button zat-position-reset");
    resetPositionButton.setAttribute("aria-label", t("resetPanelPosition"));
    resetPositionButton.title = t("resetPanelPosition");
    const collapseButton = createButton("−", "zat-icon-button");
    collapseButton.setAttribute("aria-label", t("collapse"));
    headerActions.append(resetPositionButton, collapseButton);
    header.append(title, headerActions);

    const body = document.createElement("div");
    body.className = "zat-body";

    const status = document.createElement("p");
    status.className = "zat-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = t("clickComposer");

    const sourceLabel = document.createElement("label");
    sourceLabel.textContent = t("sourceMessage", {
      language: languageName(uiLanguage, currentSettings.userLanguage)
    });
    const sourceText = document.createElement("textarea");
    sourceText.rows = 3;
    sourceText.maxLength = 5_000;
    sourceText.placeholder = t("sourcePlaceholder", {
      language: languageName(uiLanguage, currentSettings.userLanguage)
    });
    sourceText.setAttribute("aria-describedby", "zat-keyboard-hint");
    const keyboardHint = document.createElement("small");
    keyboardHint.id = "zat-keyboard-hint";
    keyboardHint.className = "zat-hint";
    sourceLabel.append(sourceText, keyboardHint);

    const targetLabel = document.createElement("label");
    targetLabel.textContent = t("targetLanguage");
    const targetSelect = document.createElement("select");
    const targetOptions: TranslationLanguage[] = ["ko", "en", "vi"];
    targetOptions.filter((value) => value !== currentSettings.userLanguage).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = languageName(uiLanguage, value);
      targetSelect.append(option);
    });
    targetLabel.append(targetSelect);

    const conversationLanguageLabel = document.createElement("label");
    conversationLanguageLabel.textContent = t("conversationLanguage");
    const conversationLanguageSelect = document.createElement("select");
    (["auto", "ko", "en", "vi"] as TranslationSourceLanguage[]).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "auto"
        ? t("detectAutomatically")
        : languageName(uiLanguage, value);
      conversationLanguageSelect.append(option);
    });
    conversationLanguageLabel.append(conversationLanguageSelect);

    const relationshipLabel = document.createElement("label");
    relationshipLabel.textContent = t("relationship");
    const relationshipSelect = document.createElement("select");
    const relationships: Array<[ConversationRelationship, Parameters<typeof uiText>[1]]> = [
      ["unknown", "relationshipUnknown"],
      ["friend", "relationshipFriend"],
      ["coworker", "relationshipCoworker"],
      ["customer", "relationshipCustomer"],
      ["group", "relationshipGroup"]
    ];
    relationships.forEach(([value, key]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(key);
      relationshipSelect.append(option);
    });
    relationshipLabel.append(relationshipSelect);

    const relativeAgeLabel = document.createElement("label");
    relativeAgeLabel.textContent = t("relativeAge");
    const relativeAgeSelect = document.createElement("select");
    const ages: Array<[RelativeAge, Parameters<typeof uiText>[1]]> = [
      ["unknown", "ageUnknown"], ["older", "ageOlder"], ["same", "ageSame"], ["younger", "ageYounger"]
    ];
    ages.forEach(([value, key]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(key);
      relativeAgeSelect.append(option);
    });
    relativeAgeLabel.append(relativeAgeSelect);

    const recipientGenderLabel = document.createElement("label");
    recipientGenderLabel.textContent = t("recipientGender");
    const recipientGenderSelect = document.createElement("select");
    const recipientGenders: Array<[ParticipantGender, Parameters<typeof uiText>[1]]> = [
      ["unknown", "genderUnknown"], ["male", "male"], ["female", "female"]
    ];
    recipientGenders.forEach(([value, key]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(key);
      recipientGenderSelect.append(option);
    });
    recipientGenderLabel.append(recipientGenderSelect);

    const addressRecommendation = document.createElement("small");
    addressRecommendation.className = "zat-address-recommendation";

    const toneLabel = document.createElement("label");
    toneLabel.textContent = t("tone");
    const toneSelect = document.createElement("select");
    const tones: TranslationTone[] = ["natural", "polite", "friendly", "coworker", "customer", "elder"];
    tones.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = toneName(uiLanguage, value);
      toneSelect.append(option);
    });
    toneLabel.append(toneSelect);

    const conversationSettingsHeader = document.createElement("button");
    conversationSettingsHeader.type = "button";
    conversationSettingsHeader.className = "zat-conversation-summary zat-hidden";
    const conversationSummaryText = document.createElement("span");
    const conversationEditText = document.createElement("span");
    conversationEditText.className = "zat-summary-edit";
    conversationEditText.textContent = "✎";
    conversationSettingsHeader.setAttribute("aria-label", t("editConversationSettings"));
    conversationSettingsHeader.append(conversationSummaryText, conversationEditText);

    const conversationSettings = document.createElement("section");
    conversationSettings.className = "zat-conversation-settings";
    const conversationSettingsTitle = document.createElement("strong");
    conversationSettingsTitle.textContent = t("conversationSettings");
    const conversationSettingsActions = document.createElement("div");
    conversationSettingsActions.className = "zat-settings-actions";
    const resetConversationButton = createButton(t("resetConversationSettings"), "zat-secondary");
    const doneConversationButton = createButton(t("conversationSettingsDone"), "zat-primary");
    conversationSettingsActions.append(resetConversationButton, doneConversationButton);
    conversationSettings.append(
      conversationSettingsTitle,
      targetLabel,
      conversationLanguageLabel,
      relationshipLabel,
      relativeAgeLabel,
      recipientGenderLabel,
      addressRecommendation,
      toneLabel,
      conversationSettingsActions
    );

    const incomingToggleLabel = document.createElement("label");
    incomingToggleLabel.className = "zat-toggle zat-incoming-toggle";
    const incomingToggle = document.createElement("input");
    incomingToggle.type = "checkbox";
    const incomingToggleText = document.createElement("span");
    incomingToggleText.textContent = t("autoIncoming");
    incomingToggleLabel.append(incomingToggle, incomingToggleText);
    const incomingHint = document.createElement("small");
    incomingHint.className = "zat-hint";
    incomingHint.textContent = t("incomingHint");

    const sourceActions = document.createElement("div");
    sourceActions.className = "zat-source-actions";
    const clearAllButton = createButton(t("clearAll"), "zat-secondary");
    const translateButton = createButton("", "zat-primary");
    sourceActions.append(clearAllButton, translateButton);

    const preview = document.createElement("div");
    preview.className = "zat-preview zat-hidden";
    const previewLabel = document.createElement("label");
    previewLabel.textContent = t("preview");
    const previewText = document.createElement("textarea");
    previewText.rows = 4;
    previewText.maxLength = 5_000;
    previewLabel.append(previewText);

    const previewActions = document.createElement("div");
    previewActions.className = "zat-actions";
    const cancelButton = createButton(t("cancel"), "zat-secondary");
    const sendButton = createButton(t("sendToZalo"), "zat-primary");
    previewActions.append(cancelButton, sendButton);
    preview.append(previewLabel, previewActions);

    body.append(
      status,
      sourceLabel,
      conversationSettingsHeader,
      conversationSettings,
      sourceActions,
      preview,
      incomingToggleLabel,
      incomingHint
    );
    panel.append(header, body);
    const incomingLayer = document.createElement("div");
    incomingLayer.className = "zat-incoming-layer";
    shadow.append(incomingLayer, panel);
    host.style.setProperty("--zat-stale-message", JSON.stringify(t("stale")));
    host.style.setProperty(
      "--zat-incoming-title",
      JSON.stringify(t("incomingTitle", { language: languageName(uiLanguage, uiLanguage) }))
    );
    host.dataset.status = "ui-ready";

    const setStatus = (message: string, kind?: "success" | "error") => {
      status.textContent = message;
      status.className = `zat-status${kind ? ` zat-${kind}` : ""}`;
    };

    const currentAddress = (): VietnameseAddress =>
      vietnameseAddressForProfile(activeProfile, currentSettings.userGender);

    const previewIsCurrent = () =>
      Boolean(previewText.value.trim()) &&
      translatedSource === sourceText.value.trim() &&
      translatedTone === toneSelect.value &&
      translatedAddress === currentAddress() &&
      translatedTarget === targetSelect.value;

    const targetLanguageName = () =>
      languageName(uiLanguage, targetSelect.value as TranslationLanguage);

    const refreshControls = () => {
      const ready = previewIsCurrent();
      const hasSource = Boolean(sourceText.value.trim());
      const sending = operation === "sending";

      sourceText.disabled = sending;
      toneSelect.disabled = operation !== "idle";
      relationshipSelect.disabled = operation !== "idle";
      relativeAgeSelect.disabled = operation !== "idle";
      recipientGenderSelect.disabled = operation !== "idle";
      targetSelect.disabled = operation !== "idle";
      conversationLanguageSelect.disabled = operation !== "idle";
      previewText.disabled = sending;
      translateButton.disabled = operation !== "idle" || !hasSource;
      sendButton.disabled = operation !== "idle" || !ready;
      cancelButton.disabled = sending;
      clearAllButton.disabled = sending || (!hasSource && !previewText.value.trim());

      translateButton.textContent =
        operation === "translating"
          ? t("translating")
          : ready
            ? t("translateAgain")
            : t("translateTo", { language: targetLanguageName() });
      const showVietnameseRelationship = targetSelect.value === "vi";
      relationshipLabel.hidden = !showVietnameseRelationship;
      const relationshipNeedsDetails = !new Set(["customer", "group"]).has(relationshipSelect.value);
      relativeAgeLabel.hidden = !showVietnameseRelationship || !relationshipNeedsDetails;
      recipientGenderLabel.hidden = !showVietnameseRelationship || !relationshipNeedsDetails;
      addressRecommendation.hidden = !showVietnameseRelationship;
      addressRecommendation.textContent = t("addressRecommendation", {
        address: activeProfile.relationship === "group"
          ? "tôi → mọi người"
          : vietnameseAddressExample(currentAddress())
      });
      sendButton.textContent = operation === "sending" ? t("sending") : t("sendToZalo");
      keyboardHint.textContent =
        operation === "translating"
          ? t("keyboardTranslating")
          : sending
            ? t("keyboardSending")
            : ready
              ? t("keyboardSend")
              : t("keyboardTranslate");
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
      setStatus(t("cancelled"));
      sourceText.focus();
    };

    const clearAll = () => {
      if (operation === "sending") return;
      requestSequence += 1;
      operation = "idle";
      sourceText.value = "";
      clearPreview();
      refreshControls();
      setStatus(t("cleared"));
      sourceText.focus();
    };

    const invalidatePreview = () => {
      if (operation === "translating") {
        requestSequence += 1;
        operation = "idle";
      }

      if (!sourceText.value.trim()) {
        clearPreview();
        setStatus(t("enterAfterInput"));
      } else if (previewIsCurrent()) {
        preview.classList.remove("zat-stale");
        setStatus(t("enterToSend"), "success");
      } else if (!preview.classList.contains("zat-hidden")) {
        preview.classList.add("zat-stale");
        setStatus(t("changed"));
      } else {
        setStatus(t("translateTo", { language: targetLanguageName() }));
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
          ? t("composerConnectedSend")
          : t("composerConnectedWrite"),
        "success"
      );
    };

    const getActiveComposer = (): HTMLElement | null => {
      if (activeComposer && document.contains(activeComposer)) return activeComposer;
      setStatus(t("composerRequired"), "error");
      return null;
    };

    const requestTranslation = async (): Promise<void> => {
      if (operation !== "idle") return;
      const text = sourceText.value.trim();
      const tone = toneSelect.value as TranslationTone;
      const vietnameseAddress = currentAddress();
      const targetLanguage = targetSelect.value as TranslationLanguage;
      if (!text) {
        setStatus(t("inputRequired"), "error");
        sourceText.focus();
        return;
      }

      const sequence = ++requestSequence;
      operation = "translating";
      refreshControls();
      setStatus(t("preparing", { language: targetLanguageName() }));

      const message: BackgroundMessage = {
        type: "translate",
        payload: {
          text,
          sourceLanguage: currentSettings.userLanguage,
          targetLanguage,
          tone,
          vietnameseAddress,
          socialContext: outgoingSocialContext(activeProfile, currentSettings.userGender)
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
          currentAddress() !== vietnameseAddress ||
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
        setStatus(t("reviewThenSend"), "success");
      } catch (error) {
        if (sequence !== requestSequence) return;
        operation = "idle";
        refreshControls();
        setStatus(uiLanguage === "ko" && error instanceof Error ? error.message : t("translationFailed"), "error");
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
        setStatus(t("checkTranslation", { language: targetLanguageName() }), "error");
        return;
      }

      operation = "sending";
      refreshControls();
      setStatus(t("sendingToZalo"));
      try {
        const confirmed = await sendComposer(composer, translated.trim());
        operation = "idle";
        if (!confirmed) {
          refreshControls();
          setStatus(
            t("sendUnconfirmed"),
            "error"
          );
          return;
        }

        requestSequence += 1;
        sourceText.value = "";
        clearPreview();
        refreshControls();
        setStatus(t("sent"), "success");
        sourceText.focus();
      } catch {
        operation = "idle";
        refreshControls();
        setStatus(
          t("sendFailed"),
          "error"
        );
      }
    };

    const persistPanelSettings = async (
      patch: Partial<ExtensionSettings>
    ): Promise<void> => {
      currentSettings = { ...currentSettings, ...patch };
      const response = (await browser.runtime.sendMessage({
        type: "save-settings",
        payload: currentSettings
      } satisfies BackgroundMessage)) as BackgroundResponse<ExtensionSettings>;
      if (!response.ok) throw new Error(response.error);
    };

    const clampPanelPosition = (left: number, top: number) => {
      const rect = panel.getBoundingClientRect();
      return {
        left: Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(top, window.innerHeight - Math.min(rect.height, window.innerHeight - 16) - 8))
      };
    };

    const applyPanelPosition = (left: number, top: number) => {
      const position = clampPanelPosition(left, top);
      panel.style.left = `${position.left}px`;
      panel.style.top = `${position.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      return position;
    };

    const restorePanelPosition = () => {
      if (currentSettings.panelPosition) {
        applyPanelPosition(
          currentSettings.panelPosition.left,
          currentSettings.panelPosition.top
        );
      }
    };

    const translateIncomingMessage = async (
      overlay: IncomingOverlay
    ): Promise<void> => {
      const { candidate, button, result } = overlay;
      if (button.disabled) return;
      const cacheKey = `${currentConversationKey}:${currentSettings.userLanguage}:${activeProfile.relationship}:${activeProfile.relativeAge}:${activeProfile.recipientGender}:${candidate.text}`;
      const cached = incomingCache.get(cacheKey);
      if (cached) {
        delete result.dataset.state;
        result.textContent = cached;
        result.hidden = false;
        button.dataset.state = "translated";
        button.setAttribute("aria-label", t("incomingClose", { language: languageName(uiLanguage, uiLanguage) }));
        button.title = button.getAttribute("aria-label") ?? "";
        return;
      }

      button.disabled = true;
      button.dataset.state = "loading";
      button.setAttribute("aria-label", t("incomingLoading", { language: languageName(uiLanguage, uiLanguage) }));
      button.title = button.getAttribute("aria-label") ?? "";
      result.hidden = true;
      const message: BackgroundMessage = {
        type: "translate",
        payload: {
          text: candidate.text,
          sourceLanguage: overlay.sourceLanguage,
          targetLanguage: currentSettings.userLanguage,
          tone: "natural",
          vietnameseAddress: "neutral",
          socialContext: incomingSocialContext(activeProfile, currentSettings.userGender)
        }
      };

      try {
        const response = (await browser.runtime.sendMessage(
          message
        )) as BackgroundResponse<TranslationResult>;
        if (!response.ok) throw new Error(response.error);
        incomingCache.set(cacheKey, response.data.translatedText);
        delete result.dataset.state;
        result.textContent = response.data.translatedText;
        result.hidden = false;
        button.dataset.state = "translated";
        button.setAttribute("aria-label", t("incomingClose", { language: languageName(uiLanguage, uiLanguage) }));
        button.title = button.getAttribute("aria-label") ?? "";
      } catch (error) {
        result.textContent =
          uiLanguage === "ko" && error instanceof Error ? error.message : t("incomingFailed");
        result.dataset.state = "error";
        result.hidden = false;
        button.dataset.state = "error";
        button.setAttribute("aria-label", t("incomingRetry", { language: languageName(uiLanguage, uiLanguage) }));
        button.title = button.getAttribute("aria-label") ?? "";
      } finally {
        button.disabled = false;
      }
    };

    interface IncomingOverlay {
      candidate: IncomingMessageCandidate;
      button: HTMLButtonElement;
      result: HTMLDivElement;
      sourceLanguage: TranslationSourceLanguage;
      autoEligible: boolean;
    }

    const translationIcon = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
        <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
      </svg>`;
    const incomingOverlays = new Map<HTMLElement, IncomingOverlay>();
    let openOverlay: IncomingOverlay | null = null;
    let repositionFrame: number | null = null;

    interface IconPlacement {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }

    const positionIncomingOverlay = (
      overlay: IncomingOverlay,
      occupied: IconPlacement[]
    ) => {
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

      const spaceOnRight = window.innerWidth - rect.right;
      const iconLeft =
        spaceOnRight >= INCOMING_ICON_SIZE + INCOMING_ICON_GAP + 6
          ? rect.right + INCOMING_ICON_GAP
          : rect.left - INCOMING_ICON_SIZE - INCOMING_ICON_GAP;
      const clampedLeft = Math.max(
        6,
        Math.min(iconLeft, window.innerWidth - INCOMING_ICON_SIZE - 6)
      );
      const idealTop = Math.max(
        6,
        Math.min(
          rect.top + Math.max(0, (rect.height - INCOMING_ICON_SIZE) / 2),
          window.innerHeight - INCOMING_ICON_SIZE - 6
        )
      );
      let iconTop = idealTop;
      const overlaps = (top: number, placement: IconPlacement) =>
        clampedLeft < placement.right + 4 &&
        clampedLeft + INCOMING_ICON_SIZE + 4 > placement.left &&
        top < placement.bottom + 4 &&
        top + INCOMING_ICON_SIZE + 4 > placement.top;
      for (let attempts = 0; attempts < occupied.length + 1; attempts += 1) {
        const collision = occupied.find((placement) => overlaps(iconTop, placement));
        if (!collision) break;
        const below = collision.bottom + 4;
        iconTop =
          below <= window.innerHeight - INCOMING_ICON_SIZE - 6
            ? below
            : Math.max(6, collision.top - INCOMING_ICON_SIZE - 4);
      }
      overlay.button.style.left = `${clampedLeft}px`;
      overlay.button.style.top = `${iconTop}px`;
      occupied.push({
        left: clampedLeft,
        right: clampedLeft + INCOMING_ICON_SIZE,
        top: iconTop,
        bottom: iconTop + INCOMING_ICON_SIZE
      });

      const cardWidth = Math.max(220, Math.min(440, rect.width));
      overlay.result.style.width = `${cardWidth}px`;
      overlay.result.style.left = `${Math.max(
        8,
        Math.min(rect.left, window.innerWidth - cardWidth - 8)
      )}px`;
      const availableBelow = window.innerHeight - rect.bottom - 14;
      const availableAbove = rect.top - 14;
      const showBelow = availableBelow >= 100 || availableBelow >= availableAbove;
      const cardHeight = Math.min(
        220,
        Math.max(80, overlay.result.scrollHeight || 100),
        Math.max(80, showBelow ? availableBelow : availableAbove)
      );
      overlay.result.style.top = `${Math.max(
        8,
        showBelow ? rect.bottom + 6 : rect.top - cardHeight - 6
      )}px`;
      overlay.result.style.setProperty(
        "max-height",
        `${Math.max(80, Math.min(220, showBelow ? availableBelow : availableAbove))}px`,
        "important"
      );
    };

    const repositionIncomingOverlays = () => {
      if (repositionFrame !== null) return;
      repositionFrame = window.requestAnimationFrame(() => {
        repositionFrame = null;
        const occupied: IconPlacement[] = [];
        [...incomingOverlays.values()]
          .sort(
            (left, right) =>
              left.candidate.container.getBoundingClientRect().top -
              right.candidate.container.getBoundingClientRect().top
          )
          .forEach((overlay) => positionIncomingOverlay(overlay, occupied));
      });
    };
    const incomingResizeObserver = new ResizeObserver(repositionIncomingOverlays);

    const closeOpenOverlay = (except?: IncomingOverlay) => {
      if (openOverlay && openOverlay !== except) openOverlay.result.hidden = true;
      openOverlay = except ?? null;
    };

    const createIncomingOverlay = (
      candidate: IncomingMessageCandidate,
      sourceLanguage: TranslationSourceLanguage,
      autoEligible: boolean,
      translateAutomatically: boolean
    ): IncomingOverlay => {
      const button = createButton("", "zat-incoming-overlay zat-incoming-icon");
      button.innerHTML = translationIcon;
      button.setAttribute("aria-label", t("incomingTranslate", { language: languageName(uiLanguage, uiLanguage) }));
      button.title = button.getAttribute("aria-label") ?? "";
      const result = document.createElement("div");
      result.className = "zat-incoming-overlay zat-incoming-card";
      result.hidden = true;
      result.title = t("closeTranslation");
      button.hidden = true;
      const overlay = { candidate, button, result, sourceLanguage, autoEligible };
      incomingLayer.append(button, result);
      incomingResizeObserver.observe(candidate.container);

      button.addEventListener("click", () => {
        if (!result.hidden) {
          result.hidden = true;
          if (openOverlay === overlay) openOverlay = null;
          const cacheKey = `${currentConversationKey}:${currentSettings.userLanguage}:${activeProfile.relationship}:${activeProfile.relativeAge}:${activeProfile.recipientGender}:${overlay.candidate.text}`;
          button.dataset.state = incomingCache.has(cacheKey)
            ? "translated"
            : "";
          button.setAttribute("aria-label", t("incomingTranslate", { language: languageName(uiLanguage, uiLanguage) }));
          button.title = button.getAttribute("aria-label") ?? "";
          return;
        }
        closeOpenOverlay(overlay);
        repositionIncomingOverlays();
        void translateIncomingMessage(overlay).then(() => {
          if (openOverlay !== overlay) result.hidden = true;
          repositionIncomingOverlays();
        });
      });
      result.addEventListener("click", () => {
        result.hidden = true;
        if (openOverlay === overlay) openOverlay = null;
      });

      if (translateAutomatically) {
        closeOpenOverlay(overlay);
        void translateIncomingMessage(overlay).then(() => {
          if (openOverlay !== overlay) result.hidden = true;
          repositionIncomingOverlays();
        });
      }
      return overlay;
    };

    const activeConversationKey = (): string => {
      const qid = document
        .querySelector<HTMLElement>('[data-component="message-content-view"][data-qid]')
        ?.dataset.qid;
      const conversationId = qid?.split("_").at(-1);
      const rawKey = conversationId
        ? `qid:${conversationId}`
        : `url:${location.pathname}${location.search}${location.hash}`;
      let hash = 2166136261;
      for (let index = 0; index < rawKey.length; index += 1) {
        hash ^= rawKey.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return `chat:${(hash >>> 0).toString(36)}`;
    };

    const activeConversationLooksLikeGroup = (): boolean => {
      const qid = document
        .querySelector<HTMLElement>('[data-component="message-content-view"][data-qid]')
        ?.dataset.qid;
      const conversationId = qid?.split("_").at(-1) ?? "";
      if (/^g\d+/i.test(conversationId)) return true;
      const headerText = Array.from(
        document.querySelectorAll<HTMLElement>("header, [class*='conversation-header'], [class*='chat-header']")
      )
        .map((element) => element.innerText)
        .join(" ");
      return /\b\d+\s*(?:thành viên|members?|명)\b/i.test(headerText);
    };

    const relationshipText = (value: ConversationRelationship): string => {
      const item = relationships.find(([candidate]) => candidate === value);
      return item ? t(item[1]) : t("relationshipUnknown");
    };

    const setConversationSettingsCollapsed = (collapsed: boolean) => {
      conversationSettings.classList.toggle("zat-hidden", collapsed);
      conversationSettingsHeader.classList.toggle("zat-hidden", !collapsed);
      requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        applyPanelPosition(rect.left, rect.top);
      });
    };

    const renderConversationProfile = () => {
      targetSelect.value = activeProfile.targetLanguage;
      conversationLanguageSelect.value = activeProfile.incomingLanguage;
      toneSelect.value = activeProfile.tone;
      relationshipSelect.value = activeProfile.relationship;
      relativeAgeSelect.value = activeProfile.relativeAge;
      recipientGenderSelect.value = activeProfile.recipientGender;
      conversationSummaryText.textContent = [
        languageName(uiLanguage, activeProfile.targetLanguage),
        toneName(uiLanguage, activeProfile.tone),
        relationshipText(activeProfile.relationship)
      ].join(" · ");
      setConversationSettingsCollapsed(activeProfile.configured && !conversationSettingsEditing);
      refreshControls();
    };

    const syncConversationProfile = () => {
      const key = activeConversationKey();
      if (key === currentConversationKey) return;
      currentConversationKey = key;
      conversationSettingsEditing = false;
      const fallback = defaultConversationProfile(currentSettings);
      const stored = currentSettings.conversationProfiles[key];
      if (!stored && activeConversationLooksLikeGroup()) fallback.relationship = "group";
      activeProfile = {
        ...fallback,
        ...stored,
        incomingLanguage:
          stored?.incomingLanguage ??
          currentSettings.conversationLanguageOverrides[key] ??
          "auto"
      };
      if (activeProfile.targetLanguage === currentSettings.userLanguage) {
        activeProfile.targetLanguage = fallback.targetLanguage;
      }
      renderConversationProfile();
    };

    const persistActiveProfile = async (
      patch: Partial<ConversationProfile>
    ): Promise<void> => {
      activeProfile = { ...activeProfile, ...patch };
      const profiles = {
        ...currentSettings.conversationProfiles,
        [currentConversationKey || activeConversationKey()]: activeProfile
      };
      await persistPanelSettings({ conversationProfiles: profiles });
      renderConversationProfile();
    };

    const selectedConversationLanguage = (): TranslationSourceLanguage =>
      activeProfile.incomingLanguage;

    const syncIncomingOverlays = (translateNewMessages: boolean) => {
      syncConversationProfile();
      const candidates = findIncomingMessages(document);
      const seen = new Set<HTMLElement>();
      const allCandidateContainers = new Set(candidates.map((candidate) => candidate.container));
      const conversationLanguage = selectedConversationLanguage();
      conversationLanguageSelect.value = conversationLanguage;
      candidates.forEach((candidate) => {
        const decision = incomingTranslationDecision(
          candidate.text,
          currentSettings.userLanguage,
          conversationLanguage
        );
        if (!decision.showButton) return;
        seen.add(candidate.container);
        let overlay = incomingOverlays.get(candidate.container);
        if (!overlay) {
          overlay = createIncomingOverlay(
            candidate,
            decision.sourceLanguage,
            decision.autoTranslate,
            translateNewMessages && incomingToggle.checked && decision.autoTranslate
          );
          incomingOverlays.set(candidate.container, overlay);
        } else {
          if (overlay.candidate.text !== candidate.text) {
            overlay.result.hidden = true;
            delete overlay.button.dataset.state;
            overlay.button.setAttribute("aria-label", t("incomingTranslate", { language: languageName(uiLanguage, uiLanguage) }));
            overlay.button.title = overlay.button.getAttribute("aria-label") ?? "";
            if (openOverlay === overlay) openOverlay = null;
          }
          overlay.candidate = candidate;
          overlay.sourceLanguage = decision.sourceLanguage;
          overlay.autoEligible = decision.autoTranslate;
        }
      });

      incomingOverlays.forEach((overlay, container) => {
        if (!document.contains(container)) {
          incomingResizeObserver.unobserve(container);
          overlay.button.remove();
          overlay.result.remove();
          incomingOverlays.delete(container);
          if (openOverlay === overlay) openOverlay = null;
        } else if (!seen.has(container)) {
          if (allCandidateContainers.has(container)) {
            incomingResizeObserver.unobserve(container);
            overlay.button.remove();
            overlay.result.remove();
            incomingOverlays.delete(container);
            if (openOverlay === overlay) openOverlay = null;
            return;
          }
          // Zalo virtualizes its chat list. A periodic scan can temporarily omit
          // a visible message even though its DOM node and text are unchanged.
          // Keep that message's control alive instead of making it disappear.
          if (incomingCandidateStillMatches(overlay.candidate)) {
            return;
          } else {
            incomingResizeObserver.unobserve(container);
            overlay.button.remove();
            overlay.result.remove();
            incomingOverlays.delete(container);
            if (openOverlay === overlay) openOverlay = null;
          }
        }
      });
      repositionIncomingOverlays();
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
    document.addEventListener("scroll", repositionIncomingOverlays, true);
    window.addEventListener("resize", repositionIncomingOverlays);
    host.dataset.status = "ready";

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

    let dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
      const rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      header.setPointerCapture(event.pointerId);
      panel.classList.add("zat-dragging");
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      applyPanelPosition(
        event.clientX - dragState.offsetX,
        event.clientY - dragState.offsetY
      );
    });
    const finishDragging = (event: PointerEvent) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      dragState = null;
      panel.classList.remove("zat-dragging");
      const rect = panel.getBoundingClientRect();
      const position = applyPanelPosition(rect.left, rect.top);
      void persistPanelSettings({ panelPosition: position }).catch(() => undefined);
    };
    header.addEventListener("pointerup", finishDragging);
    header.addEventListener("pointercancel", finishDragging);
    resetPositionButton.addEventListener("click", () => {
      panel.style.removeProperty("left");
      panel.style.removeProperty("top");
      panel.style.removeProperty("right");
      panel.style.removeProperty("bottom");
      void persistPanelSettings({ panelPosition: null }).catch(() => undefined);
    });

    collapseButton.addEventListener("click", () => {
      const collapsed = body.classList.toggle("zat-hidden");
      collapseButton.textContent = collapsed ? "+" : "−";
      collapseButton.setAttribute("aria-label", collapsed ? t("expand") : t("collapse"));
      requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        applyPanelPosition(rect.left, rect.top);
      });
    });

    translateButton.addEventListener("click", () => void requestTranslation());
    clearAllButton.addEventListener("click", clearAll);
    cancelButton.addEventListener("click", cancelTranslation);
    sendButton.addEventListener("click", () => void sendTranslation(previewText.value));

    sourceText.addEventListener("input", invalidatePreview);
    const handleTranslationOptionChange = () => {
      invalidatePreview();
      void persistActiveProfile({
        tone: toneSelect.value as TranslationTone,
        targetLanguage: targetSelect.value as TranslationLanguage,
        incomingLanguage: conversationLanguageSelect.value as TranslationSourceLanguage,
        relationship: relationshipSelect.value as ConversationRelationship,
        relativeAge: relativeAgeSelect.value as RelativeAge,
        recipientGender: recipientGenderSelect.value as ParticipantGender
      }).catch(() => undefined);
      if (sourceText.value.trim()) void requestTranslation();
    };
    toneSelect.addEventListener("change", handleTranslationOptionChange);
    relationshipSelect.addEventListener("change", handleTranslationOptionChange);
    relativeAgeSelect.addEventListener("change", handleTranslationOptionChange);
    recipientGenderSelect.addEventListener("change", handleTranslationOptionChange);
    targetSelect.addEventListener("change", handleTranslationOptionChange);
    conversationLanguageSelect.addEventListener("change", () => {
      handleTranslationOptionChange();
      void Promise.resolve()
        .then(() => syncIncomingOverlays(false))
        .catch(() => undefined);
    });
    conversationSettingsHeader.addEventListener("click", () => {
      conversationSettingsEditing = true;
      setConversationSettingsCollapsed(false);
    });
    doneConversationButton.addEventListener("click", () => {
      conversationSettingsEditing = false;
      void persistActiveProfile({ configured: true }).catch(() => undefined);
    });
    resetConversationButton.addEventListener("click", () => {
      const profiles = { ...currentSettings.conversationProfiles };
      delete profiles[currentConversationKey];
      const overrides = { ...currentSettings.conversationLanguageOverrides };
      delete overrides[currentConversationKey];
      activeProfile = defaultConversationProfile(currentSettings);
      conversationSettingsEditing = true;
      void persistPanelSettings({
        conversationProfiles: profiles,
        conversationLanguageOverrides: overrides
      }).then(renderConversationProfile).catch(() => undefined);
    });
    incomingToggle.addEventListener("change", () => {
      void persistPanelSettings({ autoTranslateIncoming: incomingToggle.checked }).catch(() => {
        incomingToggle.checked = !incomingToggle.checked;
        setStatus(t("autoSaveFailed"), "error");
      });
      setStatus(
        incomingToggle.checked
          ? t("autoOn")
          : t("autoOff")
      );
    });
    previewText.addEventListener("input", () => {
      refreshControls();
      if (previewIsCurrent()) {
        setStatus(t("editedPreview"), "success");
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

    syncConversationProfile();
    incomingToggle.checked = currentSettings.autoTranslateIncoming;
    if (!currentSettings.enabled) body.classList.add("zat-hidden");
    refreshControls();
    requestAnimationFrame(restorePanelPosition);
    window.addEventListener("resize", () => {
      const rect = panel.getBoundingClientRect();
      const position = applyPanelPosition(rect.left, rect.top);
      currentSettings.panelPosition = position;
    });
  }
});
