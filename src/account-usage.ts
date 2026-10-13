import type { AccountUsage, TranslationType } from "./types";

export type FreeUsageState = "unavailable" | "pro" | "normal" | "near_limit" | "exhausted";

export function freeUsageState(account: AccountUsage | null): FreeUsageState {
  if (!account) return "unavailable";
  if (account.plan === "pro") return "pro";

  const types: TranslationType[] = ["outgoing", "incoming_manual"];
  let highestRatio = 0;
  for (const type of types) {
    const used = account.used[type];
    const limit = account.limits[type];
    if (used.requests >= limit.requests || used.characters >= limit.characters) {
      return "exhausted";
    }
    highestRatio = Math.max(
      highestRatio,
      limit.requests ? used.requests / limit.requests : 0,
      limit.characters ? used.characters / limit.characters : 0
    );
  }
  return highestRatio >= 0.8 ? "near_limit" : "normal";
}
