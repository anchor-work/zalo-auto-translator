import { browser } from "wxt/browser";
import type { ExtensionSettings } from "./types";

const SETTINGS_KEY = "settings";
export const PRODUCTION_API_BASE_URL =
  "https://zalo-translator-api-s6bip5vp3a-du.a.run.app";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  schemaVersion: 5,
  enabled: true,
  userLanguage: "ko",
  languageSetupCompleted: false,
  tone: "natural",
  vietnameseAddress: "neutral",
  outgoingTargetLanguage: "vi",
  autoTranslateIncoming: false,
  conversationLanguageOverrides: {},
  mode: "local-api",
  localApiBaseUrl: PRODUCTION_API_BASE_URL
};

const LANGUAGES = new Set(["ko", "en", "vi"]);

export function normalizeSettings(
  value?: Partial<ExtensionSettings>
): ExtensionSettings {
  const userLanguage = LANGUAGES.has(value?.userLanguage ?? "")
    ? value!.userLanguage!
    : DEFAULT_SETTINGS.userLanguage;
  let outgoingTargetLanguage = LANGUAGES.has(value?.outgoingTargetLanguage ?? "")
    ? value!.outgoingTargetLanguage!
    : DEFAULT_SETTINGS.outgoingTargetLanguage;
  if (outgoingTargetLanguage === userLanguage) {
    outgoingTargetLanguage = userLanguage === "vi" ? "ko" : "vi";
  }

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    schemaVersion: 5,
    userLanguage,
    outgoingTargetLanguage,
    conversationLanguageOverrides:
      value?.conversationLanguageOverrides &&
      typeof value.conversationLanguageOverrides === "object"
        ? value.conversationLanguageOverrides
        : {}
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return normalizeSettings(value);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

export function validateApiBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("번역 API 주소 형식이 올바르지 않습니다.");
  }

  const isLocal =
    url.protocol === "http:" && new Set(["localhost", "127.0.0.1"]).has(url.hostname);
  const isProductionApi = url.origin === PRODUCTION_API_BASE_URL;

  if ((!isLocal && !isProductionApi) || url.username || url.password) {
    throw new Error(
      "번역 API 주소는 로컬 개발 주소 또는 공식 번역 서버 주소를 사용해야 합니다."
    );
  }

  return url.origin;
}
