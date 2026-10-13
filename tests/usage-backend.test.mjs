import { describe, expect, it } from "vitest";
import {
  PLAN_LIMITS,
  billingPeriod,
  nextResetAt,
  usageSummary
} from "../apps/api/src/usage.mjs";

describe("monthly account usage", () => {
  const date = new Date("2026-10-13T12:00:00.000Z");

  it("uses a stable UTC billing period and reset date", () => {
    expect(billingPeriod(date)).toBe("2026-10");
    expect(nextResetAt(date)).toBe("2026-11-01T00:00:00.000Z");
  });

  it("returns separate outgoing and incoming free limits", () => {
    const summary = usageSummary(
      "free",
      "2026-10",
      {
        outgoingRequests: 3,
        outgoingCharacters: 700,
        incomingManualRequests: 2,
        incomingManualCharacters: 400
      },
      date
    );
    expect(summary.used.outgoing).toEqual({ requests: 3, characters: 700 });
    expect(summary.used.incoming_manual).toEqual({ requests: 2, characters: 400 });
    expect(summary.limits.outgoing).toEqual(PLAN_LIMITS.free.outgoing);
    expect(summary.limits.outgoing.requests).toBe(30);
    expect(summary.limits.outgoing.characters).toBe(3_000);
    expect(summary.limits.incoming_auto.requests).toBe(0);
  });
});
