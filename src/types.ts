export type TranslationTone =
  | "natural"
  | "polite"
  | "friendly"
  | "coworker"
  | "customer"
  | "elder";
export type TranslationMode = "demo" | "local-api";

export interface ExtensionSettings {
  schemaVersion: 3;
  enabled: boolean;
  tone: TranslationTone;
  mode: TranslationMode;
  localApiBaseUrl: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: "ko";
  targetLanguage: "vi";
  tone: TranslationTone;
  requestId: string;
}

export interface TranslationResult {
  translatedText: string;
  provider: "demo" | "local-api";
  inputCharacters: number;
}

export interface DailyUsage {
  date: string;
  translations: number;
  inputCharacters: number;
  errors: number;
}

export type BackgroundMessage =
  | { type: "translate"; payload: Omit<TranslationRequest, "requestId"> }
  | { type: "get-settings" }
  | { type: "save-settings"; payload: ExtensionSettings }
  | { type: "get-usage" };

export type BackgroundResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
