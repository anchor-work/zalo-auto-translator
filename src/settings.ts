import { browser } from "wxt/browser";
import type { ExtensionSettings } from "./types";

const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  schemaVersion: 2,
  enabled: true,
  tone: "natural",
  mode: "local-api",
  localApiBaseUrl: "http://localhost:8787"
};

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  if (value && value.schemaVersion !== 2) {
    return {
      ...DEFAULT_SETTINGS,
      enabled: value.enabled ?? DEFAULT_SETTINGS.enabled,
      tone: value.tone ?? DEFAULT_SETTINGS.tone
    };
  }
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
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
  const isCloudRun = url.protocol === "https:" && url.hostname.endsWith(".run.app");

  if ((!isLocal && !isCloudRun) || url.username || url.password) {
    throw new Error(
      "번역 API 주소는 로컬 개발 주소 또는 HTTPS Cloud Run 주소를 사용해야 합니다."
    );
  }

  return url.origin;
}
