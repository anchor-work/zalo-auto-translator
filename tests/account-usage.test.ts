import { describe, expect, it } from "vitest";
import { freeUsageState } from "../src/account-usage";
import type { AccountUsage } from "../src/types";

function account(plan: "free" | "pro", outgoingRequests: number, outgoingCharacters = 0): AccountUsage {
  return {
    plan,
    period: "2026-10",
    resetAt: "2026-11-01T00:00:00.000Z",
    limits: {
      outgoing: { requests: plan === "pro" ? 1_000 : 30, characters: plan === "pro" ? 150_000 : 3_000, perRequestCharacters: 1_000 },
      incoming_manual: { requests: 30, characters: 5_000, perRequestCharacters: 5_000 },
      incoming_auto: { requests: plan === "pro" ? 1_000 : 0, characters: plan === "pro" ? 150_000 : 0, perRequestCharacters: plan === "pro" ? 5_000 : 0 }
    },
    used: {
      outgoing: { requests: outgoingRequests, characters: outgoingCharacters },
      incoming_manual: { requests: 0, characters: 0 },
      incoming_auto: { requests: 0, characters: 0 }
    }
  };
}

describe("free usage state", () => {
  it("marks Free usage near 80 percent and exhausted at either limit", () => {
    expect(freeUsageState(account("free", 23))).toBe("normal");
    expect(freeUsageState(account("free", 24))).toBe("near_limit");
    expect(freeUsageState(account("free", 1, 3_000))).toBe("exhausted");
  });

  it("does not show Free upgrade urgency to Pro accounts", () => {
    expect(freeUsageState(account("pro", 1_000, 150_000))).toBe("pro");
    expect(freeUsageState(null)).toBe("unavailable");
  });
});
