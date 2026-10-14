import { createPolar, webhooks } from "@polar-sh/sdk/2026-10";
import { FieldValue } from "firebase-admin/firestore";
import { firestoreInstance } from "./firebase.mjs";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const BILLING_PROCESSING_VERSION = 2;
const SUPPORTED_SUBSCRIPTION_EVENTS = new Set([
  "subscription.active",
  "subscription.canceled",
  "subscription.created",
  "subscription.cycled",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.revoked",
  "subscription.uncanceled",
  "subscription.updated"
]);

export class BillingError extends Error {
  constructor(message, statusCode = 500, code = "billing_failed") {
    super(message);
    this.name = "BillingError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function required(value, name) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new BillingError(`${name} 환경변수가 설정되지 않았습니다.`, 503, "billing_not_configured");
  }
  return normalized;
}

function customerUid(subscription) {
  const metadataUid = subscription?.metadata?.firebase_uid;
  if (typeof metadataUid === "string" && metadataUid.trim()) return metadataUid.trim();
  const externalId = subscription?.customer?.external_id;
  return typeof externalId === "string" ? externalId.trim() : "";
}

export function subscriptionAccountUpdate(
  subscription,
  productId,
  now = new Date(),
  eventType = "subscription.updated"
) {
  if (!subscription || subscription.product_id !== productId) return null;
  const uid = customerUid(subscription);
  if (!uid) {
    throw new BillingError("구독에서 Firebase 사용자를 확인할 수 없습니다.", 400, "missing_customer_uid");
  }
  const periodEnd = subscription.current_period_end || null;
  const paidThroughPeriodEnd =
    subscription.status === "canceled" &&
    Boolean(subscription.cancel_at_period_end) &&
    typeof periodEnd === "string" &&
    Number.isFinite(Date.parse(periodEnd)) &&
    Date.parse(periodEnd) > now.getTime();
  const revoked = eventType === "subscription.revoked";
  const active = !revoked && (
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status) || paidThroughPeriodEnd
  );
  return {
    uid,
    plan: active ? "pro" : "free",
    subscriptionStatus: subscription.status,
    polarCustomerId: subscription.customer_id,
    polarSubscriptionId: subscription.id,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
  };
}

export function createFirestoreBillingStore({ db = firestoreInstance() } = {}) {
  return {
    async assertCheckoutAllowed(identity) {
      const snapshot = await db.collection("users").doc(identity.uid).get();
      if (!snapshot.exists) return;
      const account = snapshot.data() || {};
      if (
        account.plan === "pro" ||
        ACTIVE_SUBSCRIPTION_STATUSES.has(account.subscriptionStatus)
      ) {
        throw new BillingError(
          "이미 Pro 요금제를 이용 중입니다. 구독 관리에서 현재 구독을 확인해 주세요.",
          409,
          "subscription_already_active"
        );
      }
    },
    async applySubscriptionEvent(eventId, event, productId) {
      if (!SUPPORTED_SUBSCRIPTION_EVENTS.has(event.type)) return { handled: false };
      const update = subscriptionAccountUpdate(event.data, productId, new Date(), event.type);
      if (!update) return { handled: false };
      const eventRef = db.collection("billingEvents").doc(eventId);
      const userRef = db.collection("users").doc(update.uid);
      return db.runTransaction(async (transaction) => {
        const eventSnapshot = await transaction.get(eventRef);
        if (
          eventSnapshot.exists &&
          Number(eventSnapshot.data()?.processingVersion || 0) >= BILLING_PROCESSING_VERSION
        ) {
          return { handled: true, duplicate: true };
        }
        transaction.set(userRef, {
          plan: update.plan,
          status: "active",
          billingProvider: "polar",
          polarCustomerId: update.polarCustomerId,
          polarSubscriptionId: update.polarSubscriptionId,
          subscriptionStatus: update.subscriptionStatus,
          currentPeriodEnd: update.currentPeriodEnd,
          cancelAtPeriodEnd: update.cancelAtPeriodEnd,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        transaction.set(eventRef, {
          type: event.type,
          uid: update.uid,
          subscriptionId: update.polarSubscriptionId,
          processingVersion: BILLING_PROCESSING_VERSION,
          processedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        return { handled: true, duplicate: false, plan: update.plan };
      });
    }
  };
}

export function createPolarBillingService({
  accessToken = process.env.POLAR_ACCESS_TOKEN,
  productId = process.env.POLAR_PRODUCT_ID,
  webhookSecret = process.env.POLAR_WEBHOOK_SECRET,
  environment = process.env.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
  successUrl = process.env.POLAR_SUCCESS_URL || "https://anchor-work.github.io/zalo-auto-translator/#billing-success",
  returnUrl = process.env.POLAR_RETURN_URL || "https://anchor-work.github.io/zalo-auto-translator/#pro",
  client
} = {}) {
  const polarClient = () => client || createPolar({
    accessToken: required(accessToken, "POLAR_ACCESS_TOKEN"),
    environment,
    timeout: 15
  });

  return {
    getProductId() {
      return required(productId, "POLAR_PRODUCT_ID");
    },
    async createCheckout(identity) {
      const checkout = await polarClient().checkouts.create({
        products: [this.getProductId()],
        external_customer_id: identity.uid,
        customer_email: identity.email || undefined,
        customer_name: identity.name || undefined,
        customer_metadata: { firebase_uid: identity.uid, app: "zalo-language-bridge" },
        metadata: { firebase_uid: identity.uid, plan: "pro", app: "zalo-language-bridge" },
        success_url: successUrl,
        return_url: returnUrl,
        allow_discount_codes: true
      });
      return { url: checkout.url, checkoutId: checkout.id };
    },
    async createCustomerPortal(identity) {
      try {
        const session = await polarClient().customerSessions.create({
          external_customer_id: identity.uid,
          return_url: returnUrl
        });
        return { url: session.customer_portal_url };
      } catch (error) {
        if (error?.statusCode === 404 || error?.status === 404) {
          throw new BillingError("활성화된 결제 계정을 찾을 수 없습니다.", 404, "billing_customer_not_found");
        }
        throw error;
      }
    },
    async validateWebhook(rawBody, headers) {
      try {
        return await webhooks.validateEvent(rawBody, headers, required(webhookSecret, "POLAR_WEBHOOK_SECRET"));
      } catch (error) {
        if (error instanceof webhooks.PolarWebhookVerificationError) {
          throw new BillingError("웹훅 서명이 올바르지 않습니다.", 403, "invalid_webhook_signature");
        }
        if (error instanceof webhooks.PolarWebhookError) {
          throw new BillingError("웹훅 데이터가 올바르지 않습니다.", 400, "invalid_webhook_payload");
        }
        throw error;
      }
    }
  };
}
