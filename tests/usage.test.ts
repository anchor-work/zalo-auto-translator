import { describe, expect, it } from "vitest";
import { updateDailyUsage } from "../src/usage";

describe("usage aggregation", () => {
  it("stores only aggregate counters", () => {
    const result = updateDailyUsage([], { characters: 21 }, "2026-10-07");
    expect(result).toEqual([
      {
        date: "2026-10-07",
        translations: 1,
        inputCharacters: 21,
        errors: 0
      }
    ]);
  });

  it("increments errors without counting a translation", () => {
    const result = updateDailyUsage([], { error: true }, "2026-10-07");
    expect(result[0]).toMatchObject({ translations: 0, inputCharacters: 0, errors: 1 });
  });
});
