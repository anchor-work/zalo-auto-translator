export type TranslationTone =
  | "natural"
  | "polite"
  | "friendly"
  | "coworker"
  | "customer"
  | "elder";
export type TranslationMode = "demo" | "local-api";
export type TranslationLanguage = "ko" | "vi" | "en";
export type TranslationSourceLanguage = TranslationLanguage | "auto";
export type TranslationTargetLanguage = TranslationLanguage;
export type VietnameseAddress =
  | "neutral"
  | "older_male"
  | "older_female"
  | "younger_from_male"
  | "younger_from_female"
  | "same_age"
  | "much_older_male"
  | "much_older_female"
  | "customer";

export interface ExtensionSettings {
  schemaVersion: 4;
  enabled: boolean;
  tone: TranslationTone;
  vietnameseAddress: VietnameseAddress;
  outgoingTargetLanguage: "vi" | "en";
  autoTranslateIncoming: boolean;
  mode: TranslationMode;
  localApiBaseUrl: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: TranslationSourceLanguage;
  targetLanguage: TranslationTargetLanguage;
  tone: TranslationTone;
  vietnameseAddress: VietnameseAddress;
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
