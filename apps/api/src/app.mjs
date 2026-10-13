import { createServer } from "node:http";
import {
  TranslationError,
  translateWithGemini,
  validateTranslationRequest
} from "./gemini.mjs";
import { bearerToken, verifyFirebaseIdToken } from "./auth.mjs";
import { createFirestoreUsageStore } from "./usage.mjs";

const MAX_BODY_BYTES = 20_000;

function allowedOrigin(origin) {
  if (!origin) return null;
  if (origin.startsWith("chrome-extension://")) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function sendJson(response, statusCode, body, origin) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.end(JSON.stringify(body));
}

function diagnosticError(error) {
  if (!error || typeof error !== "object") return {};
  const errorCode =
    typeof error.code === "string" || typeof error.code === "number"
      ? String(error.code).slice(0, 100)
      : undefined;
  const errorName =
    typeof error.name === "string" ? error.name.slice(0, 100) : undefined;
  const errorMessage =
    typeof error.message === "string" ? error.message.slice(0, 500) : undefined;
  return {
    ...(errorCode ? { errorCode } : {}),
    ...(errorName ? { errorName } : {}),
    ...(errorMessage ? { errorMessage } : {})
  };
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new TranslationError("요청 본문이 너무 큽니다.", 413, "body_too_large");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TranslationError("JSON 요청 형식이 올바르지 않습니다.", 400, "invalid_json");
  }
}

export function createApiServer({
  translate = translateWithGemini,
  logger = console,
  verifyToken = verifyFirebaseIdToken,
  usageStore = createFirestoreUsageStore(),
  requireAuth = process.env.ZALO_REQUIRE_AUTH === "true"
} = {}) {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    const origin = allowedOrigin(request.headers.origin);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.setHeader("Access-Control-Max-Age", "600");
      response.end();
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { status: "ok", model: process.env.ZALO_GEMINI_MODEL || "gemini-3.1-flash-lite" }, origin);
      return;
    }

    const accountRequest = request.method === "GET" && requestUrl.pathname === "/v1/account";
    const translationRequest =
      request.method === "POST" && requestUrl.pathname === "/v1/translations";
    if (!accountRequest && !translationRequest) {
      sendJson(response, 404, { error: { code: "not_found", message: "요청 경로를 찾을 수 없습니다." } }, origin);
      return;
    }

    const startedAt = performance.now();
    let requestId = "unknown";
    let inputCharacters = 0;
    let reservation;
    let failureStage = "authentication";

    try {
      const token = bearerToken(request.headers.authorization);
      if (!token && (requireAuth || accountRequest)) {
        throw new TranslationError("로그인이 필요합니다.", 401, "auth_required");
      }
      let identity;
      if (token) {
        try {
          identity = await verifyToken(token);
        } catch {
          throw new TranslationError(
            "로그인 정보가 만료되었거나 올바르지 않습니다.",
            401,
            "invalid_auth_token"
          );
        }
      }

      if (accountRequest) {
        failureStage = "account_usage";
        const account = await usageStore.getSummary(identity);
        sendJson(response, 200, account, origin);
        return;
      }

      failureStage = "request_validation";
      const payload = validateTranslationRequest(await readJson(request));
      requestId = payload.requestId;
      inputCharacters = [...payload.text.normalize("NFC")].length;
      if (identity) {
        failureStage = "usage_reservation";
        reservation = await usageStore.reserve(
          identity,
          payload.translationType,
          inputCharacters
        );
      }
      let result;
      try {
        failureStage = "translation_provider";
        result = await translate(payload);
      } catch (error) {
        if (reservation) {
          await usageStore.rollback(reservation).catch((rollbackError) => {
            logger.error?.({ event: "usage_rollback_failed", requestId });
          });
        }
        throw error;
      }
      if (reservation) {
        await usageStore.commit(reservation, result.usage).catch(() => {
          logger.error?.({ event: "usage_token_record_failed", requestId });
        });
      }
      sendJson(
        response,
        200,
        { ...result, ...(reservation ? { account: reservation.summary } : {}) },
        origin
      );
      logger.info?.({
        event: "translation_completed",
        requestId,
        inputCharacters,
        durationMs: Math.round(performance.now() - startedAt),
        model: result.model
      });
    } catch (error) {
      const safeError =
        error instanceof TranslationError
          ? error
          : failureStage === "account_usage" || failureStage === "usage_reservation"
            ? new TranslationError(
                "사용량 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
                503,
                "usage_service_unavailable"
              )
            : new TranslationError("번역 처리 중 오류가 발생했습니다.");
      sendJson(
        response,
        safeError.statusCode,
        { error: { code: safeError.code, message: safeError.message } },
        origin
      );
      logger.error?.({
        event: "translation_failed",
        requestId,
        inputCharacters,
        durationMs: Math.round(performance.now() - startedAt),
        code: safeError.code,
        stage: failureStage,
        ...(error instanceof TranslationError ? {} : diagnosticError(error))
      });
    }
  });
}
