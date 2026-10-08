const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const MAX_INPUT_CHARACTERS = 5_000;
const SOURCE_LANGUAGES = new Set(["auto", "ko", "vi", "en"]);
const TARGET_LANGUAGES = new Set(["ko", "vi", "en"]);
const LANGUAGE_NAMES = {
  auto: "the automatically detected source language",
  ko: "Korean",
  vi: "Vietnamese",
  en: "English"
};

const TONE_INSTRUCTIONS = {
  natural:
    "Use natural everyday chat language without changing the meaning.",
  polite:
    "Use polite, respectful but natural one-to-one chat language.",
  friendly:
    "Use warm, casual language suitable for close friends, but do not invent personal details.",
  coworker:
    "Use natural, courteous language suitable for a coworker with professional warmth.",
  customer:
    "Use clear, service-oriented and respectful language for a one-to-one customer conversation.",
  elder:
    "Use respectful language suitable for speaking to an older person without inventing facts."
};

const VIETNAMESE_ADDRESS_INSTRUCTIONS = {
  neutral:
    "The relationship is unknown. Prefer tôi for the speaker and bạn for the recipient, or omit pronouns when that sounds more natural.",
  older_male:
    "The recipient is a slightly older man. Use em for the speaker and anh for the recipient.",
  older_female:
    "The recipient is a slightly older woman. Use em for the speaker and chị for the recipient.",
  younger_from_male:
    "The speaker is male and older than the recipient. Use anh for the speaker and em for the recipient.",
  younger_from_female:
    "The speaker is female and older than the recipient. Use chị for the speaker and em for the recipient.",
  same_age:
    "They are similar in age. Use mình for the speaker and bạn for the recipient when pronouns are needed.",
  much_older_male:
    "The recipient is a substantially older man. Use cháu for the speaker and chú for the recipient unless the source context clearly calls for bác.",
  much_older_female:
    "The recipient is a substantially older woman. Use cháu for the speaker and cô for the recipient unless the source context clearly calls for bác.",
  customer:
    "The recipient is a customer. Use tôi or chúng tôi for the speaker and anh/chị or quý khách naturally according to the sentence; do not write the literal combined token anh/chị when a pronoun can be omitted."
};

export class TranslationError extends Error {
  constructor(message, statusCode = 502, code = "translation_failed") {
    super(message);
    this.name = "TranslationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function countCharacters(text) {
  return [...text.normalize("NFC")].length;
}

export function validateTranslationRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TranslationError("요청 형식이 올바르지 않습니다.", 400, "invalid_request");
  }

  const text = typeof value.text === "string" ? value.text.trim() : "";
  if (!text) {
    throw new TranslationError("번역할 문장을 입력해 주세요.", 400, "empty_text");
  }
  if (countCharacters(text) > MAX_INPUT_CHARACTERS) {
    throw new TranslationError("한 번에 최대 5,000자까지 번역할 수 있습니다.", 400, "text_too_long");
  }
  if (
    !SOURCE_LANGUAGES.has(value.sourceLanguage) ||
    !TARGET_LANGUAGES.has(value.targetLanguage) ||
    value.sourceLanguage === value.targetLanguage
  ) {
    throw new TranslationError("지원하지 않는 번역 언어 조합입니다.", 400, "unsupported_language");
  }
  if (!Object.hasOwn(TONE_INSTRUCTIONS, value.tone)) {
    throw new TranslationError("지원하지 않는 말투입니다.", 400, "unsupported_tone");
  }
  const vietnameseAddress = value.vietnameseAddress ?? "neutral";
  if (!Object.hasOwn(VIETNAMESE_ADDRESS_INSTRUCTIONS, vietnameseAddress)) {
    throw new TranslationError("지원하지 않는 베트남어 호칭 설정입니다.", 400, "unsupported_address");
  }

  return {
    text,
    sourceLanguage: value.sourceLanguage,
    targetLanguage: value.targetLanguage,
    tone: value.tone,
    vietnameseAddress,
    requestId:
      typeof value.requestId === "string" && value.requestId.length <= 128
        ? value.requestId
        : crypto.randomUUID()
  };
}

function extractTranslation(body) {
  return (
    body.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim() || ""
  );
}

function cleanTranslation(text) {
  return text
    .replace(/^```(?:text|vietnamese)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^(["“])([\s\S]*)(["”])$/, "$2")
    .trim()
    .normalize("NFC");
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function translateWithGemini(
  request,
  {
    apiKey = process.env.ZALO_GEMINI_API_KEY,
    model = process.env.ZALO_GEMINI_MODEL || DEFAULT_MODEL,
    fallbackModel = process.env.ZALO_GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite",
    fetchImpl = fetch,
    timeoutMs = 20_000,
    retryBaseDelayMs = 400
  } = {}
) {
  if (!apiKey) {
    throw new TranslationError(
      "번역 서버에 Gemini API 키가 설정되지 않았습니다.",
      503,
      "missing_api_key"
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const addressInstruction =
    request.targetLanguage === "vi"
      ? `Vietnamese address terms are important. ${VIETNAMESE_ADDRESS_INSTRUCTIONS[request.vietnameseAddress]}`
      : "Preserve the social relationship and level of respect expressed in the source without inventing one.";
  const systemInstruction = `You are a multilingual chat translation engine.
Translate only the user's message from ${LANGUAGE_NAMES[request.sourceLanguage]} into ${LANGUAGE_NAMES[request.targetLanguage]}.
Return only the translation, without explanations, labels, or quotation marks.
Never answer the message or add information.
Preserve names, numbers, URLs, phone numbers, emojis, and line breaks.
${TONE_INSTRUCTIONS[request.tone]}
${addressInstruction}`;

  try {
    const requestBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: request.text }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512
      }
    });

    let body = {};
    let response;
    let activeModel = model;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      activeModel = attempt === 2 ? fallbackModel : model;
      response = await fetchImpl(
        `${GEMINI_ENDPOINT}/${encodeURIComponent(activeModel)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: requestBody,
          signal: controller.signal
        }
      );
      body = await response.json().catch(() => ({}));
      if (response.ok) break;

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < 2) {
        await delay(retryBaseDelayMs * 3 ** attempt);
        continue;
      }

      const providerFailure =
        response.status === 400
          ? {
              message:
                "Gemini가 요청을 거부했습니다 (HTTP 400). Secret Manager의 API 키 값과 모델 설정을 확인해 주세요.",
              code: "provider_bad_request"
            }
          : response.status === 401 || response.status === 403
            ? {
                message:
                  "Gemini 인증에 실패했습니다. API 키와 Generative Language API 권한을 확인해 주세요.",
                code: "provider_auth_failed"
              }
            : response.status === 404
              ? {
                  message: "설정된 Gemini 모델을 찾을 수 없습니다.",
                  code: "provider_model_not_found"
                }
              : {
                  message: `Gemini 번역 요청에 실패했습니다 (HTTP ${response.status}).`,
                  code: `provider_http_${response.status}`
                };

      throw new TranslationError(
        retryable
          ? "Gemini 사용량이 많습니다. 잠시 후 다시 시도해 주세요."
          : providerFailure.message,
        retryable ? 503 : 502,
        retryable ? "provider_busy" : providerFailure.code
      );
    }

    const translatedText = cleanTranslation(extractTranslation(body));
    if (!translatedText) {
      throw new TranslationError("Gemini가 빈 번역 결과를 반환했습니다.", 502, "empty_result");
    }

    return {
      translatedText,
      provider: "gemini",
      model: activeModel,
      usage: {
        inputCharacters: countCharacters(request.text),
        promptTokens: body.usageMetadata?.promptTokenCount ?? null,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
        totalTokens: body.usageMetadata?.totalTokenCount ?? null
      }
    };
  } catch (error) {
    if (error instanceof TranslationError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TranslationError("번역 요청 시간이 초과되었습니다.", 504, "provider_timeout");
    }
    throw new TranslationError("번역 제공자에 연결하지 못했습니다.", 502, "provider_unreachable");
  } finally {
    clearTimeout(timeout);
  }
}
