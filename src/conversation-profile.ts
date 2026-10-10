import type {
  ConversationProfile,
  ExtensionSettings,
  RelativeAge,
  TranslationSocialContext,
  UserGender,
  VietnameseAddress
} from "./types";

export function defaultConversationProfile(
  settings: ExtensionSettings
): ConversationProfile {
  return {
    targetLanguage: settings.outgoingTargetLanguage,
    incomingLanguage: "auto",
    tone: settings.tone,
    relationship: "unknown",
    relativeAge: "unknown",
    recipientGender: "unknown",
    configured: false
  };
}

export function vietnameseAddressForProfile(
  profile: ConversationProfile,
  userGender: UserGender | null
): VietnameseAddress {
  if (profile.relationship === "customer") return "customer";
  if (profile.relationship === "group") return "neutral";
  if (profile.relativeAge === "same") return "same_age";
  if (profile.relativeAge === "older") {
    if (profile.recipientGender === "male") return "older_male";
    if (profile.recipientGender === "female") return "older_female";
  }
  if (profile.relativeAge === "younger") {
    if (userGender === "male") return "younger_from_male";
    if (userGender === "female") return "younger_from_female";
  }
  return "neutral";
}

export function vietnameseAddressExample(value: VietnameseAddress): string {
  const examples: Record<VietnameseAddress, string> = {
    neutral: "tôi → bạn",
    older_male: "em → anh",
    older_female: "em → chị",
    younger_from_male: "anh → em",
    younger_from_female: "chị → em",
    same_age: "mình → bạn",
    much_older_male: "cháu → chú/bác",
    much_older_female: "cháu → cô/bác",
    customer: "tôi → anh/chị/quý khách"
  };
  return examples[value];
}

export function inverseRelativeAge(value: RelativeAge): RelativeAge {
  if (value === "older") return "younger";
  if (value === "younger") return "older";
  return value;
}

export function outgoingSocialContext(
  profile: ConversationProfile,
  userGender: UserGender | null
): TranslationSocialContext {
  return {
    speakerGender: userGender ?? "unknown",
    recipientGender: profile.recipientGender,
    recipientRelativeAge: profile.relativeAge,
    relationship: profile.relationship
  };
}

export function incomingSocialContext(
  profile: ConversationProfile,
  userGender: UserGender | null
): TranslationSocialContext {
  return {
    speakerGender: profile.recipientGender,
    recipientGender: userGender ?? "unknown",
    recipientRelativeAge: inverseRelativeAge(profile.relativeAge),
    relationship: profile.relationship
  };
}
