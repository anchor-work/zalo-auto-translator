import type { TranslationRequest, TranslationResult } from "../types";

const NATURAL_TRANSLATIONS = new Map<string, string>([
  ["안녕하세요", "Xin chào!"],
  ["지금 어디에 있어요?", "Bây giờ bạn đang ở đâu?"],
  ["오늘 시간 괜찮아요?", "Hôm nay bạn có rảnh không?"],
  ["조금 늦을 것 같아요.", "Có lẽ tôi sẽ đến hơi muộn."],
  ["도착하면 연락해 주세요.", "Khi đến nơi, hãy nhắn cho tôi nhé."],
  ["감사합니다", "Cảm ơn bạn."],
  ["잘 자요", "Chúc bạn ngủ ngon."],
  ["보고 싶어요", "Tôi nhớ bạn."],
  ["가격이 얼마예요?", "Giá bao nhiêu vậy?"],
  ["내일 다시 연락할게요.", "Ngày mai tôi sẽ liên lạc lại nhé."]
]);

function applyTone(text: string, tone: TranslationRequest["tone"]): string {
  if (tone === "friendly") {
    return text.replace(/\.$/, " nhé!");
  }
  if (tone === "polite" && !/[.!?]$/.test(text)) {
    return `${text}.`;
  }
  return text;
}

export async function translateWithDemo(
  request: TranslationRequest
): Promise<TranslationResult> {
  const normalized = request.text.trim();
  const translated = NATURAL_TRANSLATIONS.get(normalized);

  if (!translated) {
    throw new Error(
      "데모 번역기는 예시 문장만 지원합니다. 팝업에서 예시를 확인하거나 로컬 API 모드를 선택해 주세요."
    );
  }

  return {
    translatedText: applyTone(translated, request.tone),
    provider: "demo",
    inputCharacters: [...normalized.normalize("NFC")].length
  };
}
