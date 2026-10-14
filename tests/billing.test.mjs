import { describe, expect, it, vi } from "vitest";
import {
  BillingError,
  createPolarBillingService,
  subscriptionAccountUpdate
} from "../apps/api/src/billing.mjs";

function subscription(overrides = {}) {
  return {
    id: "sub_123",
    product_id: "prod_pro",
    customer_id: "cus_123",
    status: "active",
    current_period_end: "2026-11-13T00:00:00Z",
    cancel_at_period_end: false,
    metadata: { firebase_uid: "firebase-user-1" },
    customer: { external_id: "firebase-user-1" },
    ...overrides
  };
}

describe("Polar billing", () => {
  it("creates an authenticated checkout tied to the Firebase UID", async () => {
    const create = vi.fn().mockResolvedValue({ id: "checkout_1", url: "https://polar.sh/checkout/1" });
    const service = createPolarBillingService({
      accessToken: "polar_test",
      productId: "prod_pro",
      webhookSecret: "whsec_test",
      client: { checkouts: { create } }
    });

    await expect(service.createCheckout({
      uid: "firebase-user-1",
      email: "user@example.com",
      name: "Test User"
    })).resolves.toEqual({ url: "https://polar.sh/checkout/1", checkoutId: "checkout_1" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      products: ["prod_pro"],
      external_customer_id: "firebase-user-1",
      customer_email: "user@example.com",
      metadata: expect.objectContaining({ firebase_uid: "firebase-user-1", plan: "pro" })
    }));
  });

  it("fails safely when billing configuration is missing", async () => {
    const service = createPolarBillingService({ accessToken: "", productId: "" });
    await expect(service.createCheckout({ uid: "user-1" })).rejects.toMatchObject({
      code: "billing_not_configured",
      statusCode: 503
    });
  });

  it("grants Pro only for an active matching subscription", () => {
    expect(subscriptionAccountUpdate(subscription(), "prod_pro")).toMatchObject({
      uid: "firebase-user-1",
      plan: "pro",
      subscriptionStatus: "active"
    });
    expect(subscriptionAccountUpdate(subscription({ status: "revoked" }), "prod_pro")).toMatchObject({
      plan: "free"
    });
    expect(subscriptionAccountUpdate(subscription(), "another_product")).toBeNull();
  });

  it("keeps Pro access through the paid period after cancellation", () => {
    const canceled = subscription({
      status: "canceled",
      cancel_at_period_end: true,
      current_period_end: "2026-11-14T00:00:00Z"
    });
    expect(
      subscriptionAccountUpdate(canceled, "prod_pro", new Date("2026-10-14T00:00:00Z"))
    ).toMatchObject({ plan: "pro", subscriptionStatus: "canceled", cancelAtPeriodEnd: true });
    expect(
      subscriptionAccountUpdate(canceled, "prod_pro", new Date("2026-11-15T00:00:00Z"))
    ).toMatchObject({ plan: "free" });
  });

  it("revokes Pro immediately for a subscription.revoked event", () => {
    const revoked = subscription({
      status: "canceled",
      cancel_at_period_end: true,
      current_period_end: "2026-11-14T00:00:00Z"
    });
    expect(
      subscriptionAccountUpdate(
        revoked,
        "prod_pro",
        new Date("2026-10-14T00:00:00Z"),
        "subscription.revoked"
      )
    ).toMatchObject({
      plan: "free",
      subscriptionStatus: "canceled",
      cancelAtPeriodEnd: true
    });
  });

  it("rejects a subscription that cannot be tied to a Firebase user", () => {
    expect(() => subscriptionAccountUpdate(subscription({ metadata: {}, customer: {} }), "prod_pro"))
      .toThrowError(BillingError);
  });
});
