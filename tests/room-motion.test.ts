import { describe, it, expect } from "vitest";
import { flameOffset, SteamField, ROOM_FLAMES } from "../src/lib/room-motion";
describe("integrated ambient motion", () => {
  it("pins flame bases and patch edges while the flame interior moves", () => {
    const w = 84,
      h = 66;
    for (const time of [0, 0.5, 1.7, 7]) {
      expect(flameOffset(40, h - 1, w, h, time, 1, 3)).toEqual({ x: 0, y: 0 });
      expect(flameOffset(0, 20, w, h, time, 1, 3)).toEqual({ x: 0, y: 0 });
    }
    const a = flameOffset(40, 20, w, h, 1, 1, 3),
      b = flameOffset(40, 20, w, h, 2, 1, 3);
    expect(a).not.toEqual(b);
    expect(Math.abs(a.x)).toBeLessThan(4);
  });
  it("keeps every authored flame region inside the cabin canvas", () => {
    expect(ROOM_FLAMES.length).toBe(9);
    for (const r of ROOM_FLAMES) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(1280);
      expect(r.y + r.h).toBeLessThanOrEqual(720);
    }
  });
  it("emits a connected, changing translucent plume with transparent boundaries", () => {
    const field = new SteamField();
    for (let i = 0; i < 100; i++) field.step(i * 0.08);
    const a = field.pixels();
    expect(field.mass()).toBeGreaterThan(0);
    for (let x = 0; x < field.width; x++) expect(a[x * 4 + 3]).toBe(0);
    for (let y = 0; y < field.height; y++) {
      expect(a[y * field.width * 4 + 3]).toBe(0);
      expect(a[(y * field.width + field.width - 1) * 4 + 3]).toBe(0);
    }
    expect(
      a[(field.height * field.width - field.width + 28) * 4 + 3],
    ).toBeGreaterThan(0);
    for (let i = 100; i < 120; i++) field.step(i * 0.08);
    expect(field.pixels()).not.toEqual(a);
    expect(
      Math.max(...Array.from(a).filter((_, i) => i % 4 === 3)),
    ).toBeLessThanOrEqual(77);
  });
});
