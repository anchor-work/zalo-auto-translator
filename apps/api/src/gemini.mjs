const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const MAX_INPUT_CHARACTERS = 5_000;

const TONE_INSTRUCTIONS = {
  natural:
    "Use natural everyday Vietnamese. Keep the relationship neutral when age or gender is unknown.",
  polite:
    "Use polite, respectful but natural one-to-one Vietnamese chat. When age or gender is unknown, prefer neutral wording or 'bạn'. Do not use 'quý vị' unless the Korean source addresses a group or formal audience.",
  friendly:
    "Use warm, casual Vietnamese suitable for close friends, but do not invent age or gender.",
  coworker:
    "Use natural, courteous Vietnamese suitable for a coworker. Keep professional warmth and avoid intimate or age-specific pronouns when the relationship is unknown.",
  customer:
    "Use clear, service-oriented and respectful Vietnamese for a one-to-one customer conversation. Avoid stiff mass-audience wording unless the source clearly addresses a group.",
  elder:
    "Use respectful Vietnamese suitable for speaking to an older person. Avoid guessing gender; phrase naturally without inventing a gender-specific title when it is unknown."
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
  if (value.sourceLanguage !== "ko" || value.targetLanguage !== "vi") {
    throw new TranslationError("현재는 한국어에서 베트남어 번역만 지원합니다.", 400, "unsupported_language");
  }
  if (!Object.hasOwn(TONE_INSTRUCTIONS, value.tone)) {
    throw new TranslationError("지원하지 않는 말투입니다.", 400, "unsupported_tone");
  }

  return {
    text,
    sourceLanguage: "ko",
    targetLanguage: "vi",
    tone: value.tone,
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
  const systemInstruction = `You are a Korean-to-Vietnamese chat translation engine.
Translate only the user's Korean message into Vietnamese.
Return only the translation, without explanations, labels, or quotation marks.
Never answer the message or add information.
Preserve names, numbers, URLs, phone numbers, emojis, and line breaks.
${TONE_INSTRUCTIONS[request.tone]}`;

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

      const retryable = response.status === 429 || response.status === 503;
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
                  message: "Gemini 번역 요청에 실패했습니다.",
                  code: "provider_error"
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
