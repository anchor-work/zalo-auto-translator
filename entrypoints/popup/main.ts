import { browser } from "wxt/browser";
import { browserLanguage, languageName, uiText } from "../../src/i18n";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type {
  BackgroundMessage,
  BackgroundResponse,
  DailyUsage,
  ExtensionSettings,
  TranslationLanguage
} from "../../src/types";
import { localDateKey } from "../../src/usage";
import "./style.css";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

const onboarding = element<HTMLElement>("onboarding");
const settingsSection = element<HTMLElement>("settings");
const onboardingLanguage = element<HTMLSelectElement>("onboarding-language");
const onboardingTarget = element<HTMLSelectElement>("onboarding-target");
const userLanguage = element<HTMLSelectElement>("user-language");
const targetLanguage = element<HTMLSelectElement>("target-language");
const enabled = element<HTMLInputElement>("enabled");
const start = element<HTMLButtonElement>("start");
const status = element<HTMLParagraphElement>("status");
let loadedSettings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let usage: DailyUsage[] = [];
let uiLanguage: TranslationLanguage = browserLanguage(browser.i18n.getUILanguage());
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: Partial<ExtensionSettings> = {};
const languages: TranslationLanguage[] = ["ko", "en", "vi"];

function fillLanguageSelect(
  select: HTMLSelectElement,
  selected: TranslationLanguage,
  exclude?: TranslationLanguage
): void {
  select.replaceChildren();
  const available = languages.filter((language) => language !== exclude);
  available.forEach((language) => {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = languageName(uiLanguage, language);
    select.append(option);
  });
  select.value = available.includes(selected) ? selected : available[0]!;
}

function renderUsage(): void {
  const today = usage.find((entry) => entry.date === localDateKey());
  element("translations").textContent = `${today?.translations ?? 0}${uiText(uiLanguage, "times")}`;
  element("characters").textContent = `${(today?.inputCharacters ?? 0).toLocaleString(uiLanguage)}${uiText(uiLanguage, "chars")}`;
  element("errors").textContent = `${today?.errors ?? 0}${uiText(uiLanguage, "times")}`;
}

function renderCopy(): void {
  document.documentElement.lang = uiLanguage;
  document.title = uiText(uiLanguage, "appName");
  element("app-name").textContent = uiText(uiLanguage, "appName");
  element("description").textContent = uiText(uiLanguage, "popupDescription");
  element("welcome-title").textContent = uiText(uiLanguage, "welcomeTitle");
  element("welcome-description").textContent = uiText(uiLanguage, "welcomeDescription");
  element("onboarding-language-label").textContent = uiText(uiLanguage, "userLanguage");
  element("onboarding-target-label").textContent = uiText(uiLanguage, "outgoingLanguage");
  element("enabled-label").textContent = uiText(uiLanguage, "enabled");
  element("user-language-label").textContent = uiText(uiLanguage, "userLanguage");
  element("target-language-label").textContent = uiText(uiLanguage, "outgoingLanguage");
  element("language-hint").textContent = uiText(uiLanguage, "languageHint");
  element("usage-title").textContent = uiText(uiLanguage, "usageToday");
  element("translations-label").textContent = uiText(uiLanguage, "translations");
  element("characters-label").textContent = uiText(uiLanguage, "characters");
  element("errors-label").textContent = uiText(uiLanguage, "errors");
  start.textContent = uiText(uiLanguage, "start");
  renderUsage();
}

function renderSelectors(): void {
  fillLanguageSelect(onboardingLanguage, uiLanguage);
  fillLanguageSelect(onboardingTarget, loadedSettings.outgoingTargetLanguage, uiLanguage);
  fillLanguageSelect(userLanguage, loadedSettings.userLanguage);
  fillLanguageSelect(targetLanguage, loadedSettings.outgoingTargetLanguage, loadedSettings.userLanguage);
}

async function persist(patch: Partial<ExtensionSettings>, announce = true): Promise<void> {
  loadedSettings = { ...loadedSettings, ...patch, schemaVersion: 5 };
  const response = (await browser.runtime.sendMessage({
    type: "save-settings",
    payload: loadedSettings
  } satisfies BackgroundMessage)) as BackgroundResponse<ExtensionSettings>;
  if (!response.ok) throw new Error(response.error);
  loadedSettings = response.data;
  if (announce) {
    status.textContent = uiText(uiLanguage, "saved");
    status.className = "success";
  }
}

function scheduleSave(patch: Partial<ExtensionSettings>): void {
  loadedSettings = { ...loadedSettings, ...patch };
  pendingSave = { ...pendingSave, ...patch };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const patchToSave = pendingSave;
    pendingSave = {};
    void persist(patchToSave).catch(() => {
      status.textContent = uiText(uiLanguage, "saveFailed");
      status.className = "error";
    });
  }, 180);
}

onboardingLanguage.addEventListener("change", () => {
  uiLanguage = onboardingLanguage.value as TranslationLanguage;
  loadedSettings.userLanguage = uiLanguage;
  renderCopy();
  renderSelectors();
});

start.addEventListener("click", async () => {
  uiLanguage = onboardingLanguage.value as TranslationLanguage;
  try {
    await persist({
      userLanguage: uiLanguage,
      outgoingTargetLanguage: onboardingTarget.value as TranslationLanguage,
      languageSetupCompleted: true
    });
    onboarding.hidden = true;
    settingsSection.hidden = false;
    enabled.checked = loadedSettings.enabled;
    renderCopy();
    renderSelectors();
  } catch {
    status.textContent = uiText(uiLanguage, "saveFailed");
    status.className = "error";
  }
});

enabled.addEventListener("change", () => scheduleSave({ enabled: enabled.checked }));
userLanguage.addEventListener("change", () => {
  uiLanguage = userLanguage.value as TranslationLanguage;
  loadedSettings.userLanguage = uiLanguage;
  const nextTarget = targetLanguage.value === uiLanguage
    ? languages.find((language) => language !== uiLanguage)!
    : targetLanguage.value as TranslationLanguage;
  renderCopy();
  renderSelectors();
  scheduleSave({ userLanguage: uiLanguage, outgoingTargetLanguage: nextTarget });
});
targetLanguage.addEventListener("change", () => {
  scheduleSave({ outgoingTargetLanguage: targetLanguage.value as TranslationLanguage });
});

async function load(): Promise<void> {
  const [settingsResponse, usageResponse] = (await Promise.all([
    browser.runtime.sendMessage({ type: "get-settings" } satisfies BackgroundMessage),
    browser.runtime.sendMessage({ type: "get-usage" } satisfies BackgroundMessage)
  ])) as [BackgroundResponse<ExtensionSettings>, BackgroundResponse<DailyUsage[]>];
  if (usageResponse.ok) usage = usageResponse.data;
  if (settingsResponse.ok) loadedSettings = settingsResponse.data;
  if (loadedSettings.languageSetupCompleted) uiLanguage = loadedSettings.userLanguage;
  enabled.checked = loadedSettings.enabled;
  renderCopy();
  renderSelectors();
  onboarding.hidden = loadedSettings.languageSetupCompleted;
  settingsSection.hidden = !loadedSettings.languageSetupCompleted;
}

void load().catch(() => {
  status.textContent = uiText(uiLanguage, "loadFailed");
  status.className = "error";
});
