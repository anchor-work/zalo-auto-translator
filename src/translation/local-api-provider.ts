import type { TranslationRequest, TranslationResult } from "../types";
import { validateApiBaseUrl } from "../settings";

interface LocalApiResponse {
  translatedText?: unknown;
  usage?: { inputCharacters?: unknown };
  error?: { message?: unknown };
}

export async function translateWithLocalApi(
  request: TranslationRequest,
  baseUrl: string
): Promise<TranslationResult> {
  const safeBaseUrl = validateApiBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${safeBaseUrl}/v1/translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    const body = (await response.json()) as LocalApiResponse;
    if (!response.ok) {
      const message = body.error?.message;
      throw new Error(
        typeof message === "string" && message
          ? message
          : `번역 API 오류 (${response.status})`
      );
    }
    if (typeof body.translatedText !== "string" || !body.translatedText.trim()) {
      throw new Error("번역 API 응답에 translatedText가 없습니다.");
    }

    const reportedCharacters = body.usage?.inputCharacters;
    const inputCharacters =
      typeof reportedCharacters === "number" && Number.isFinite(reportedCharacters)
        ? reportedCharacters
        : [...request.text.normalize("NFC")].length;

    return {
      translatedText: body.translatedText,
      provider: "local-api",
      inputCharacters
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("번역 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "번역 서버에 연결할 수 없습니다. 터미널에서 npm run api:start가 실행 중인지 확인해 주세요."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
