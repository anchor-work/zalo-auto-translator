import type { AccountUsage, BillingRedirect, TranslationRequest, TranslationResult } from "../types";
import { validateApiBaseUrl } from "../settings";

interface LocalApiResponse {
  translatedText?: unknown;
  usage?: { inputCharacters?: unknown };
  account?: AccountUsage;
  error?: { message?: unknown };
}

export async function translateWithLocalApi(
  request: TranslationRequest,
  baseUrl: string,
  idToken?: string | null
): Promise<TranslationResult> {
  const safeBaseUrl = validateApiBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${safeBaseUrl}/v1/translations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
      },
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
      inputCharacters,
      account: body.account
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("번역 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "번역 서버에 연결할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAccountUsage(
  baseUrl: string,
  idToken: string
): Promise<AccountUsage> {
  const safeBaseUrl = validateApiBaseUrl(baseUrl);
  const response = await fetch(`${safeBaseUrl}/v1/account`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const body = (await response.json()) as AccountUsage & {
    error?: { message?: unknown };
  };
  if (!response.ok) {
    throw new Error(
      typeof body.error?.message === "string"
        ? body.error.message
        : `사용량 API 오류 (${response.status})`
    );
  }
  return body;
}

export async function createBillingRedirect(
  baseUrl: string,
  idToken: string,
  destination: "checkout" | "portal"
): Promise<BillingRedirect> {
  const safeBaseUrl = validateApiBaseUrl(baseUrl);
  const response = await fetch(`${safeBaseUrl}/v1/billing/${destination}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const body = (await response.json()) as BillingRedirect & {
    error?: { message?: unknown };
  };
  if (!response.ok || typeof body.url !== "string" || !body.url.startsWith("https://")) {
    throw new Error(
      typeof body.error?.message === "string"
        ? body.error.message
        : `결제 API 오류 (${response.status})`
    );
  }
  return { url: body.url };
}
