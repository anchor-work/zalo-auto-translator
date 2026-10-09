import type {
  TranslationLanguage,
  TranslationSourceLanguage
} from "./types";

export interface LanguageDetection {
  language: TranslationLanguage | null;
  confident: boolean;
}

export interface IncomingTranslationDecision {
  showButton: boolean;
  autoTranslate: boolean;
  sourceLanguage: TranslationSourceLanguage;
}

const VIETNAMESE_MARKS = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const HANGUL = /[\uac00-\ud7a3]/;
const LATIN_WORD = /[a-z]+/gi;
const VIETNAMESE_WORDS = new Set([
  "anh", "em", "chị", "chi", "tôi", "toi", "bạn", "ban", "dạ", "da",
  "vâng", "vang", "không", "khong", "được", "duoc", "cảm", "cam", "ơn",
  "xin", "chào", "chao", "nhé", "nhe", "nha", "rồi", "roi", "với", "voi",
  "cho", "của", "cua", "mình", "minh", "này", "nay", "thì", "thi", "là",
  "la", "có", "co", "sẽ", "se", "giúp", "giup", "phản", "phan", "hồi", "hoi"
]);
const ENGLISH_WORDS = new Set([
  "the", "and", "you", "your", "are", "is", "am", "this", "that", "with",
  "for", "from", "have", "has", "will", "can", "could", "please", "thanks",
  "thank", "hello", "hi", "yes", "no", "need", "message", "today", "tomorrow",
  "check", "help", "send", "received", "about", "what", "when", "where"
]);

function usefulText(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ")
    .replace(/@[\p{L}\p{N}_.-]+/gu, " ")
    .replace(/[\p{N}\p{P}\p{S}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectMessageLanguage(text: string): LanguageDetection {
  const sample = usefulText(text);
  if (!sample) return { language: null, confident: false };
  if (HANGUL.test(sample)) return { language: "ko", confident: true };
  if (VIETNAMESE_MARKS.test(sample)) return { language: "vi", confident: true };

  const words = (sample.match(LATIN_WORD) ?? []).map((word) => word.toLowerCase());
  if (words.length < 3 || sample.length < 12) {
    return { language: null, confident: false };
  }
  const viScore = words.filter((word) => VIETNAMESE_WORDS.has(word)).length;
  const enScore = words.filter((word) => ENGLISH_WORDS.has(word)).length;
  if (viScore >= 2 && viScore > enScore) return { language: "vi", confident: true };
  if (enScore >= 2 && enScore > viScore) return { language: "en", confident: true };
  return { language: null, confident: false };
}

export function incomingTranslationDecision(
  text: string,
  userLanguage: TranslationLanguage,
  override: TranslationSourceLanguage = "auto"
): IncomingTranslationDecision {
  if (override !== "auto") {
    return override === userLanguage
      ? { showButton: false, autoTranslate: false, sourceLanguage: override }
      : { showButton: true, autoTranslate: true, sourceLanguage: override };
  }

  const detection = detectMessageLanguage(text);
  if (detection.confident && detection.language === userLanguage) {
    return { showButton: false, autoTranslate: false, sourceLanguage: detection.language };
  }
  if (detection.confident && detection.language) {
    return {
      showButton: true,
      autoTranslate: true,
      sourceLanguage: detection.language
    };
  }
  return { showButton: true, autoTranslate: false, sourceLanguage: "auto" };
}
