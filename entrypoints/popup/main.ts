import { browser } from "wxt/browser";
import { browserLanguage, languageName, uiText } from "../../src/i18n";
import { freeUsageState } from "../../src/account-usage";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type {
  BackgroundMessage,
  BackgroundResponse,
  AccountUsage,
  AuthState,
  ExtensionSettings,
  TranslationLanguage,
  UserGender
} from "../../src/types";
import "./style.css";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

const onboarding = element<HTMLElement>("onboarding");
const settingsSection = element<HTMLElement>("settings");
const authGate = element<HTMLElement>("auth-gate");
const authHint = element<HTMLParagraphElement>("auth-hint");
const signInButton = element<HTMLButtonElement>("sign-in");
const signOutButton = element<HTMLButtonElement>("sign-out");
const languageButtons = element<HTMLDivElement>("language-buttons");
const onboardingTarget = element<HTMLSelectElement>("onboarding-target");
const userLanguage = element<HTMLSelectElement>("user-language");
const userGender = element<HTMLSelectElement>("user-gender");
const targetLanguage = element<HTMLSelectElement>("target-language");
const enabled = element<HTMLInputElement>("enabled");
const start = element<HTMLButtonElement>("start");
const status = element<HTMLParagraphElement>("status");
let loadedSettings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let authState: AuthState = { configured: false, signedIn: false };
let accountUsage: AccountUsage | null = null;
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
  element("plan-value").textContent = accountUsage
    ? uiText(uiLanguage, accountUsage.plan === "pro" ? "proPlan" : "freePlan")
    : "-";
  (["outgoing", "incoming_manual"] as const).forEach((type) => {
    const id = type === "outgoing" ? "outgoing-usage" : "incoming-usage";
    const used = accountUsage?.used[type];
    const limit = accountUsage?.limits[type];
    element(id).textContent = used && limit
      ? uiText(uiLanguage, "usageValue", {
          characters: used.characters.toLocaleString(uiLanguage),
          characterLimit: limit.characters.toLocaleString(uiLanguage),
          requests: used.requests.toLocaleString(uiLanguage),
          requestLimit: limit.requests.toLocaleString(uiLanguage)
        })
      : "-";
  });
  element("reset-at").textContent = accountUsage
    ? new Date(accountUsage.resetAt).toLocaleDateString(uiLanguage)
    : "-";
  const upgradeCard = element<HTMLElement>("upgrade-card");
  const usageState = freeUsageState(accountUsage);
  upgradeCard.hidden = usageState === "unavailable" || usageState === "pro";
  upgradeCard.classList.toggle("near-limit", usageState === "near_limit");
  upgradeCard.classList.toggle("exhausted", usageState === "exhausted");
  element("upgrade-description").textContent = uiText(
    uiLanguage,
    usageState === "exhausted"
      ? "upgradeExhausted"
      : usageState === "near_limit"
        ? "upgradeNearLimit"
        : "upgradeDescription"
  );
}

function renderCopy(): void {
  document.documentElement.lang = uiLanguage;
  document.title = uiText(uiLanguage, "appName");
  element("app-name").textContent = uiText(uiLanguage, "appName");
  element("description").textContent = uiText(uiLanguage, "popupDescription");
  element("sign-in-title").textContent = uiText(uiLanguage, "signInTitle");
  element("sign-in-description").textContent = uiText(uiLanguage, "signInDescription");
  element("signed-in-as").textContent = uiText(uiLanguage, "signedInAs");
  signInButton.textContent = uiText(uiLanguage, "signInGoogle");
  signOutButton.textContent = uiText(uiLanguage, "signOut");
  element("welcome-title").textContent = uiText(uiLanguage, "welcomeTitle");
  element("welcome-description").textContent = uiText(uiLanguage, "welcomeDescription");
  element("onboarding-language-label").textContent = uiText(uiLanguage, "languageSelector");
  element("onboarding-gender-label").textContent = uiText(uiLanguage, "userGender");
  element("gender-description").textContent = uiText(uiLanguage, "genderDescription");
  element("onboarding-male").textContent = uiText(uiLanguage, "male");
  element("onboarding-female").textContent = uiText(uiLanguage, "female");
  element("onboarding-target-label").textContent = uiText(uiLanguage, "outgoingLanguage");
  element("enabled-label").textContent = uiText(uiLanguage, "enabled");
  element("user-language-label").textContent = uiText(uiLanguage, "userLanguage");
  element("user-gender-label").textContent = uiText(uiLanguage, "userGender");
  element("target-language-label").textContent = uiText(uiLanguage, "outgoingLanguage");
  element("language-hint").textContent = uiText(uiLanguage, "languageHint");
  element("usage-title").textContent = uiText(uiLanguage, "usageToday");
  element("plan-label").textContent = uiText(uiLanguage, "planLabel");
  element("outgoing-usage-label").textContent = uiText(uiLanguage, "outgoingUsage");
  element("incoming-usage-label").textContent = uiText(uiLanguage, "incomingUsage");
  element("reset-at-label").textContent = uiText(uiLanguage, "resetAt");
  element("upgrade-title").textContent = uiText(uiLanguage, "upgradeTitle");
  element("upgrade-link").textContent = uiText(uiLanguage, "upgradeAction");
  start.textContent = uiText(uiLanguage, "start");
  renderUsage();
}

function renderSections(): void {
  const signedIn = authState.configured && authState.signedIn;
  const setupComplete =
    loadedSettings.languageSetupCompleted && Boolean(loadedSettings.userGender);
  authGate.hidden = signedIn;
  onboarding.hidden = !signedIn || setupComplete;
  settingsSection.hidden = !signedIn || !setupComplete;
  authHint.hidden = authState.configured;
  authHint.textContent = authState.configured
    ? ""
    : uiText(uiLanguage, "authNotConfigured");
  signInButton.disabled = !authState.configured;
  element("account-email").textContent =
    authState.configured && authState.signedIn
      ? authState.user.email || authState.user.displayName
      : "";
}

function renderSelectors(): void {
  fillLanguageSelect(onboardingTarget, loadedSettings.outgoingTargetLanguage, uiLanguage);
  fillLanguageSelect(userLanguage, loadedSettings.userLanguage);
  fillLanguageSelect(targetLanguage, loadedSettings.outgoingTargetLanguage, loadedSettings.userLanguage);
  userGender.replaceChildren();
  (["male", "female"] as UserGender[]).forEach((gender) => {
    const option = document.createElement("option");
    option.value = gender;
    option.textContent = uiText(uiLanguage, gender);
    userGender.append(option);
  });
  if (loadedSettings.userGender) userGender.value = loadedSettings.userGender;
  languageButtons.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const selected = button.dataset.language === uiLanguage;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll<HTMLInputElement>('input[name="onboarding-gender"]').forEach((radio) => {
    radio.checked = radio.value === loadedSettings.userGender;
  });
}

async function persist(patch: Partial<ExtensionSettings>, announce = true): Promise<void> {
  loadedSettings = { ...loadedSettings, ...patch, schemaVersion: 6 };
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

const languageLabels: Record<TranslationLanguage, string> = {
  ko: "한국어",
  en: "English",
  vi: "Tiếng Việt"
};
languages.forEach((language) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.language = language;
  button.textContent = languageLabels[language];
  button.addEventListener("click", () => {
    uiLanguage = language;
    loadedSettings.userLanguage = language;
    if (loadedSettings.outgoingTargetLanguage === language) {
      loadedSettings.outgoingTargetLanguage = language === "vi" ? "ko" : "vi";
    }
    renderCopy();
    renderSelectors();
  });
  languageButtons.append(button);
});

document.querySelectorAll<HTMLInputElement>('input[name="onboarding-gender"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    loadedSettings.userGender = radio.value as UserGender;
    status.textContent = "";
  });
});

start.addEventListener("click", async () => {
  const selectedGender = document.querySelector<HTMLInputElement>('input[name="onboarding-gender"]:checked');
  if (!selectedGender) {
    status.textContent = uiText(uiLanguage, "genderRequired");
    status.className = "error";
    return;
  }
  try {
    await persist({
      userLanguage: uiLanguage,
      userGender: selectedGender.value as UserGender,
      outgoingTargetLanguage: onboardingTarget.value as TranslationLanguage,
      languageSetupCompleted: true
    });
    enabled.checked = loadedSettings.enabled;
    renderCopy();
    renderSelectors();
    renderSections();
  } catch {
    status.textContent = uiText(uiLanguage, "saveFailed");
    status.className = "error";
  }
});

signInButton.addEventListener("click", async () => {
  signInButton.disabled = true;
  signInButton.textContent = uiText(uiLanguage, "signingIn");
  status.textContent = "";
  try {
    const response = (await browser.runtime.sendMessage({
      type: "sign-in"
    } satisfies BackgroundMessage)) as BackgroundResponse<AuthState>;
    if (!response.ok) throw new Error(response.error);
    authState = response.data;
    if (authState.configured && authState.signedIn) {
      const usageResponse = (await browser.runtime.sendMessage({
        type: "get-account-usage"
      } satisfies BackgroundMessage)) as BackgroundResponse<AccountUsage>;
      if (usageResponse.ok) accountUsage = usageResponse.data;
    }
    renderCopy();
    renderSections();
  } catch {
    status.textContent = uiText(uiLanguage, "signInFailed");
    status.className = "error";
    signInButton.disabled = !authState.configured;
    signInButton.textContent = uiText(uiLanguage, "signInGoogle");
  }
});

signOutButton.addEventListener("click", async () => {
  const response = (await browser.runtime.sendMessage({
    type: "sign-out"
  } satisfies BackgroundMessage)) as BackgroundResponse<AuthState>;
  if (response.ok) authState = response.data;
  accountUsage = null;
  renderSections();
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
userGender.addEventListener("change", () => {
  scheduleSave({ userGender: userGender.value as UserGender });
});
targetLanguage.addEventListener("change", () => {
  scheduleSave({ outgoingTargetLanguage: targetLanguage.value as TranslationLanguage });
});

async function load(): Promise<void> {
  const [settingsResponse, authResponse] = (await Promise.all([
    browser.runtime.sendMessage({ type: "get-settings" } satisfies BackgroundMessage),
    browser.runtime.sendMessage({ type: "get-auth-state" } satisfies BackgroundMessage)
  ])) as [
    BackgroundResponse<ExtensionSettings>,
    BackgroundResponse<AuthState>
  ];
  if (settingsResponse.ok) loadedSettings = settingsResponse.data;
  if (authResponse.ok) authState = authResponse.data;
  if (authState.configured && authState.signedIn) {
    const accountResponse = (await browser.runtime.sendMessage({
      type: "get-account-usage"
    } satisfies BackgroundMessage)) as BackgroundResponse<AccountUsage>;
    if (accountResponse.ok) accountUsage = accountResponse.data;
  }
  if (loadedSettings.languageSetupCompleted) uiLanguage = loadedSettings.userLanguage;
  else {
    uiLanguage = browserLanguage(browser.i18n.getUILanguage());
    loadedSettings.userLanguage = uiLanguage;
    if (loadedSettings.outgoingTargetLanguage === uiLanguage) {
      loadedSettings.outgoingTargetLanguage = uiLanguage === "vi" ? "ko" : "vi";
    }
  }
  enabled.checked = loadedSettings.enabled;
  renderCopy();
  renderSelectors();
  renderSections();
}

void load().catch(() => {
  status.textContent = uiText(uiLanguage, "loadFailed");
  status.className = "error";
});
