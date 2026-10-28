import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({
  supabase: { rpc: mocks.rpc, auth: { getSession: mocks.getSession } },
}));
import { gameAction } from "../src/lib/api";
beforeEach(() => {
  vi.clearAllMocks();
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) || null,
    setItem: (k: string, v: string) => m.set(k, v),
    removeItem: (k: string) => m.delete(k),
  });
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "user-one" } } },
  });
});
describe("network-safe mutations", () => {
  it("retries an uncertain request with the same key, including a later manual retry", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Fetch failed", code: "" },
    });
    await expect(gameAction("buy", { item_id: "fern" })).rejects.toThrow(
      "Connection interrupted",
    );
    const first = mocks.rpc.mock.calls[0][1].request_id;
    expect(mocks.rpc.mock.calls[1][1].request_id).toBe(first);
    mocks.rpc.mockResolvedValue({ data: { profile: {} }, error: null });
    await gameAction("buy", { item_id: "fern" });
    expect(mocks.rpc.mock.calls[2][1].request_id).toBe(first);
    await gameAction("buy", { item_id: "fern" });
    expect(mocks.rpc.mock.calls[3][1].request_id).not.toBe(first);
  });
  it("does not retry or retain a definitively rejected purchase", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Not enough coins" },
    });
    await expect(gameAction("buy", { item_id: "fern" })).rejects.toThrow(
      "Not enough coins",
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const first = mocks.rpc.mock.calls[0][1].request_id;
    await expect(gameAction("buy", { item_id: "fern" })).rejects.toThrow();
    expect(mocks.rpc.mock.calls[1][1].request_id).not.toBe(first);
  });
});
