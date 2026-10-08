import { createServer } from "node:http";
import {
  TranslationError,
  translateWithGemini,
  validateTranslationRequest
} from "./gemini.mjs";

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

export function createApiServer({ translate = translateWithGemini, logger = console } = {}) {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    const origin = allowedOrigin(request.headers.origin);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Max-Age", "600");
      response.end();
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { status: "ok", model: process.env.ZALO_GEMINI_MODEL || "gemini-3.1-flash-lite" }, origin);
      return;
    }

    if (request.method !== "POST" || requestUrl.pathname !== "/v1/translations") {
      sendJson(response, 404, { error: { code: "not_found", message: "요청 경로를 찾을 수 없습니다." } }, origin);
      return;
    }

    const startedAt = performance.now();
    let requestId = "unknown";
    let inputCharacters = 0;

    try {
      const payload = validateTranslationRequest(await readJson(request));
      requestId = payload.requestId;
      inputCharacters = [...payload.text.normalize("NFC")].length;
      const result = await translate(payload);
      sendJson(response, 200, result, origin);
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
        code: safeError.code
      });
    }
  });
}
