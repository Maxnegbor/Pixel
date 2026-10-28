import { describe, it, expect } from "vitest";
import { elapsedSeconds, remainingSeconds, clock } from "../src/lib/timer";
import { rarityAt, catalog, odds } from "../src/lib/catalog";
import type { StudySession } from "../src/lib/types";
const s: StudySession = {
  id: "a",
  kind: "focus",
  duration: 1500,
  elapsed: 60,
  running_since: "2026-01-01T10:00:00Z",
  status: "running",
  credited_minutes: 1,
  started_at: "2026-01-01T09:59:00Z",
  finished_at: null,
};
describe("wall clock timer", () => {
  it("recovers elapsed time after refresh and throttling", () => {
    expect(elapsedSeconds(s, Date.parse("2026-01-01T10:10:00Z"))).toBe(660);
    expect(remainingSeconds(s, Date.parse("2026-01-01T10:10:00Z"))).toBe(840);
  });
  it("never accrues paused time or overshoots duration", () => {
    expect(
      elapsedSeconds(
        { ...s, status: "paused" },
        Date.parse("2026-01-01T11:00:00Z"),
      ),
    ).toBe(60);
    expect(elapsedSeconds(s, Date.parse("2026-01-01T11:00:00Z"))).toBe(1500);
  });
  it("does not subtract progress after clock rollback", () => {
    expect(elapsedSeconds(s, Date.parse("2026-01-01T09:00:00Z"))).toBe(60);
    expect(clock(90)).toBe("01:30");
  });
});
describe("catalog and published probabilities", () => {
  it("includes all starter content and rarity tiers", () => {
    expect(catalog.filter((i) => i.kind === "pet")).toHaveLength(8);
    expect(catalog.filter((i) => i.kind === "cosmetic")).toHaveLength(35);
    expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("has exact tier boundaries", () => {
    expect(
      [0, 59.999, 60, 84.999, 85, 94.999, 95, 98.999, 99, 99.999].map(rarityAt),
    ).toEqual([
      "Common",
      "Common",
      "Uncommon",
      "Uncommon",
      "Rare",
      "Rare",
      "Epic",
      "Epic",
      "Legendary",
      "Legendary",
    ]);
  });
});
