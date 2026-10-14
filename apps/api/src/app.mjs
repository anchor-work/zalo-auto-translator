import { createServer } from "node:http";
import {
  TranslationError,
  translateWithGemini,
  validateTranslationRequest
} from "./gemini.mjs";
import { bearerToken, verifyFirebaseIdToken } from "./auth.mjs";
import { createFirestoreUsageStore } from "./usage.mjs";
import {
  BillingError,
  createFirestoreBillingStore,
  createPolarBillingService
} from "./billing.mjs";
import {
  createEnterpriseInquiryService,
  EnterpriseInquiryError,
  validateEnterpriseInquiry
} from "./enterprise.mjs";

const MAX_BODY_BYTES = 20_000;
const EXTENSION_ORIGIN = "chrome-extension://plpnodgifmdinnphgnlhknmapmikjncn";

function isAllowedOrigin(origin) {
  return origin === EXTENSION_ORIGIN;
}

function sendJson(response, statusCode, body, allowCors) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (allowCors) response.setHeader("Access-Control-Allow-Origin", EXTENSION_ORIGIN);
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

async function readRawBody(request, maxBytes = 100_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new BillingError("요청 본문이 너무 큽니다.", 413, "body_too_large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createApiServer({
  translate = translateWithGemini,
  logger = console,
  verifyToken = verifyFirebaseIdToken,
  usageStore = createFirestoreUsageStore(),
  billingStore = createFirestoreBillingStore(),
  billingService = createPolarBillingService(),
  enterpriseService = createEnterpriseInquiryService(),
  requireAuth = process.env.ZALO_REQUIRE_AUTH === "true"
} = {}) {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    const allowCors = isAllowedOrigin(request.headers.origin);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      if (allowCors) response.setHeader("Access-Control-Allow-Origin", EXTENSION_ORIGIN);
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.setHeader("Access-Control-Max-Age", "600");
      response.end();
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { status: "ok", model: process.env.ZALO_GEMINI_MODEL || "gemini-3.1-flash-lite" }, allowCors);
      return;
    }

    const accountRequest = request.method === "GET" && requestUrl.pathname === "/v1/account";
    const checkoutRequest =
      request.method === "POST" && requestUrl.pathname === "/v1/billing/checkout";
    const portalRequest =
      request.method === "POST" && requestUrl.pathname === "/v1/billing/portal";
    const webhookRequest =
      request.method === "POST" && requestUrl.pathname === "/v1/billing/polar/webhook";
    const translationRequest =
      request.method === "POST" && requestUrl.pathname === "/v1/translations";
    const enterpriseRequest =
      request.method === "POST" && requestUrl.pathname === "/v1/enterprise-inquiries";
    if (!accountRequest && !checkoutRequest && !portalRequest && !webhookRequest && !translationRequest && !enterpriseRequest) {
      sendJson(response, 404, { error: { code: "not_found", message: "요청 경로를 찾을 수 없습니다." } }, allowCors);
      return;
    }

    const startedAt = performance.now();
    let requestId = "unknown";
    let inputCharacters = 0;
    let reservation;
    let failureStage = "authentication";

    try {
      if (webhookRequest) {
        failureStage = "webhook_verification";
        const rawBody = await readRawBody(request);
        const eventId = request.headers["webhook-id"];
        if (typeof eventId !== "string" || !eventId) {
          throw new BillingError("웹훅 ID가 없습니다.", 400, "missing_webhook_id");
        }
        const event = await billingService.validateWebhook(rawBody, {
          "webhook-id": eventId,
          "webhook-timestamp": String(request.headers["webhook-timestamp"] || ""),
          "webhook-signature": String(request.headers["webhook-signature"] || "")
        });
        failureStage = "webhook_processing";
        const result = await billingStore.applySubscriptionEvent(
          eventId,
          event,
          billingService.getProductId()
        );
        sendJson(response, 200, { received: true, ...result }, null);
        logger.info?.({ event: "billing_webhook_processed", eventId, type: event.type, handled: result.handled });
        return;
      }

      const token = bearerToken(request.headers.authorization);
      if (!token && (requireAuth || accountRequest || checkoutRequest || portalRequest || enterpriseRequest)) {
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
        sendJson(response, 200, account, allowCors);
        return;
      }

      if (checkoutRequest) {
        failureStage = "checkout_creation";
        await billingStore.assertCheckoutAllowed(identity);
        const checkout = await billingService.createCheckout(identity);
        sendJson(response, 200, checkout, allowCors);
        logger.info?.({ event: "billing_checkout_created" });
        return;
      }

      if (portalRequest) {
        failureStage = "customer_portal_creation";
        sendJson(response, 200, await billingService.createCustomerPortal(identity), allowCors);
        return;
      }

      if (enterpriseRequest) {
        failureStage = "enterprise_inquiry";
        const inquiry = validateEnterpriseInquiry(await readJson(request));
        sendJson(response, 200, await enterpriseService.send(inquiry, identity), allowCors);
        logger.info?.({ event: "enterprise_inquiry_sent", language: inquiry.language, teamSize: inquiry.teamSize });
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
        allowCors
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
        error instanceof TranslationError || error instanceof BillingError || error instanceof EnterpriseInquiryError
          ? error
          : failureStage === "account_usage" || failureStage === "usage_reservation"
            ? new TranslationError(
                "사용량 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
                503,
                "usage_service_unavailable"
              )
            : failureStage === "enterprise_inquiry"
              ? new EnterpriseInquiryError(
                  "문의를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
                  503,
                  "inquiry_service_unavailable"
                )
            : new TranslationError("번역 처리 중 오류가 발생했습니다.");
      sendJson(
        response,
        safeError.statusCode,
        { error: { code: safeError.code, message: safeError.message } },
        allowCors
      );
      logger.error?.({
        event: webhookRequest || checkoutRequest || portalRequest ? "billing_failed" : enterpriseRequest ? "enterprise_inquiry_failed" : "translation_failed",
        requestId,
        inputCharacters,
        durationMs: Math.round(performance.now() - startedAt),
        code: safeError.code,
        stage: failureStage,
        ...(error instanceof TranslationError || error instanceof EnterpriseInquiryError ? {} : diagnosticError(error))
      });
    }
  });
}
