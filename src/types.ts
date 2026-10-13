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
export type TranslationType = "outgoing" | "incoming_manual" | "incoming_auto";
export type UserGender = "male" | "female";
export type ParticipantGender = UserGender | "unknown";
export type RelativeAge = "unknown" | "older" | "same" | "younger";
export type ConversationRelationship =
  | "unknown"
  | "friend"
  | "coworker"
  | "customer"
  | "group";
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

export interface PanelPosition {
  left: number;
  top: number;
}

export interface ConversationProfile {
  targetLanguage: TranslationLanguage;
  incomingLanguage: TranslationSourceLanguage;
  tone: TranslationTone;
  relationship: ConversationRelationship;
  relativeAge: RelativeAge;
  recipientGender: ParticipantGender;
  configured: boolean;
}

export interface TranslationSocialContext {
  speakerGender: ParticipantGender;
  recipientGender: ParticipantGender;
  recipientRelativeAge: RelativeAge;
  relationship: ConversationRelationship;
}

export interface ExtensionSettings {
  schemaVersion: 6;
  enabled: boolean;
  userLanguage: TranslationLanguage;
  userGender: UserGender | null;
  languageSetupCompleted: boolean;
  tone: TranslationTone;
  vietnameseAddress: VietnameseAddress;
  outgoingTargetLanguage: TranslationLanguage;
  autoTranslateIncoming: boolean;
  conversationLanguageOverrides: Record<string, TranslationSourceLanguage>;
  conversationProfiles: Record<string, ConversationProfile>;
  panelPosition: PanelPosition | null;
  mode: TranslationMode;
  localApiBaseUrl: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: TranslationSourceLanguage;
  targetLanguage: TranslationTargetLanguage;
  tone: TranslationTone;
  vietnameseAddress: VietnameseAddress;
  socialContext?: TranslationSocialContext;
  translationType?: TranslationType;
  requestId: string;
}

export interface UsageBucket {
  requests: number;
  characters: number;
}

export interface UsageLimit extends UsageBucket {
  perRequestCharacters: number;
}

export interface AccountUsage {
  plan: "free" | "pro";
  period: string;
  resetAt: string;
  limits: Record<TranslationType, UsageLimit>;
  used: Record<TranslationType, UsageBucket>;
}

export interface BillingRedirect {
  url: string;
}

export interface TranslationResult {
  translatedText: string;
  provider: "demo" | "local-api";
  inputCharacters: number;
  account?: AccountUsage;
}

export interface DailyUsage {
  date: string;
  translations: number;
  inputCharacters: number;
  errors: number;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

export type AuthState =
  | { configured: false; signedIn: false }
  | { configured: true; signedIn: false }
  | { configured: true; signedIn: true; user: AuthUser };

export type BackgroundMessage =
  | { type: "translate"; payload: Omit<TranslationRequest, "requestId"> }
  | { type: "get-settings" }
  | { type: "save-settings"; payload: ExtensionSettings }
  | { type: "get-usage" }
  | { type: "get-account-usage" }
  | { type: "create-billing-checkout" }
  | { type: "create-billing-portal" }
  | { type: "get-auth-state" }
  | { type: "sign-in" }
  | { type: "sign-out" };

export type BackgroundResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
