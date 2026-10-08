import { browser } from "wxt/browser";
import {
  PRODUCTION_API_BASE_URL,
  validateApiBaseUrl
} from "../../src/settings";
import type {
  BackgroundMessage,
  BackgroundResponse,
  DailyUsage,
  ExtensionSettings,
  TranslationMode,
  TranslationTone
} from "../../src/types";
import { localDateKey } from "../../src/usage";
import "./style.css";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}

const enabled = element<HTMLInputElement>("enabled");
const tone = element<HTMLSelectElement>("tone");
const mode = element<HTMLSelectElement>("mode");
const apiUrl = element<HTMLInputElement>("api-url");
const apiUrlLabel = element<HTMLLabelElement>("api-url-label");
const modeLabel = element<HTMLLabelElement>("mode-label");
const developerHint = element<HTMLDivElement>("developer-hint");
const serviceHint = element<HTMLDivElement>("service-hint");
const save = element<HTMLButtonElement>("save");
const status = element<HTMLParagraphElement>("status");
const isDevelopment = import.meta.env.DEV;

function updateModeVisibility(): void {
  modeLabel.hidden = !isDevelopment;
  developerHint.hidden = !isDevelopment;
  apiUrlLabel.hidden = !isDevelopment || mode.value !== "local-api";
  serviceHint.hidden = isDevelopment;
}

async function load(): Promise<void> {
  const [settingsResponse, usageResponse] = (await Promise.all([
    browser.runtime.sendMessage({ type: "get-settings" } satisfies BackgroundMessage),
    browser.runtime.sendMessage({ type: "get-usage" } satisfies BackgroundMessage)
  ])) as [
    BackgroundResponse<ExtensionSettings>,
    BackgroundResponse<DailyUsage[]>
  ];

  if (settingsResponse.ok) {
    enabled.checked = settingsResponse.data.enabled;
    tone.value = settingsResponse.data.tone;
    mode.value = settingsResponse.data.mode;
    apiUrl.value = settingsResponse.data.localApiBaseUrl;
    updateModeVisibility();
  }

  if (usageResponse.ok) {
    const today = usageResponse.data.find((entry) => entry.date === localDateKey());
    element<HTMLElement>("translations").textContent = `${today?.translations ?? 0}회`;
    element<HTMLElement>("characters").textContent = `${(
      today?.inputCharacters ?? 0
    ).toLocaleString("ko-KR")}자`;
    element<HTMLElement>("errors").textContent = `${today?.errors ?? 0}회`;
  }
}

mode.addEventListener("change", updateModeVisibility);

save.addEventListener("click", async () => {
  status.textContent = "";

  try {
    const settings: ExtensionSettings = {
      schemaVersion: 3,
      enabled: enabled.checked,
      tone: tone.value as TranslationTone,
      mode: isDevelopment ? (mode.value as TranslationMode) : "local-api",
      localApiBaseUrl:
        isDevelopment && mode.value === "local-api"
          ? validateApiBaseUrl(apiUrl.value)
          : isDevelopment
            ? apiUrl.value || "http://localhost:8787"
            : PRODUCTION_API_BASE_URL
    };

    const response = (await browser.runtime.sendMessage({
      type: "save-settings",
      payload: settings
    } satisfies BackgroundMessage)) as BackgroundResponse<ExtensionSettings>;

    if (!response.ok) throw new Error(response.error);
    status.textContent = "저장했습니다. 열려 있는 Zalo 탭을 새로고침해 주세요.";
    status.className = "success";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "설정 저장에 실패했습니다.";
    status.className = "error";
  }
});

void load().catch((error) => {
  status.textContent = error instanceof Error ? error.message : "설정을 불러오지 못했습니다.";
  status.className = "error";
});
