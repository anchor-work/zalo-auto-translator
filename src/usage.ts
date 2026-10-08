import { browser } from "wxt/browser";
import type { DailyUsage } from "./types";

const USAGE_KEY = "dailyUsage";
const MAX_USAGE_DAYS = 90;

export function localDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function updateDailyUsage(
  entries: DailyUsage[],
  change: { characters?: number; error?: boolean },
  date = localDateKey()
): DailyUsage[] {
  const next = entries.map((entry) => ({ ...entry }));
  let today = next.find((entry) => entry.date === date);

  if (!today) {
    today = { date, translations: 0, inputCharacters: 0, errors: 0 };
    next.push(today);
  }

  if (change.error) {
    today.errors += 1;
  } else {
    today.translations += 1;
    today.inputCharacters += change.characters ?? 0;
  }

  return next.sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_USAGE_DAYS);
}

export async function recordTranslation(inputCharacters: number): Promise<void> {
  const entries = await getUsage();
  await browser.storage.local.set({
    [USAGE_KEY]: updateDailyUsage(entries, { characters: inputCharacters })
  });
}

export async function recordTranslationError(): Promise<void> {
  const entries = await getUsage();
  await browser.storage.local.set({
    [USAGE_KEY]: updateDailyUsage(entries, { error: true })
  });
}

export async function getUsage(): Promise<DailyUsage[]> {
  const stored = await browser.storage.local.get(USAGE_KEY);
  return (stored[USAGE_KEY] as DailyUsage[] | undefined) ?? [];
}
