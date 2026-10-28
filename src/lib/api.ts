import { uuid } from "./uuid";
import { supabase } from "./supabase";
import { demoAction } from "./demo";
import type { Action, GameState } from "./types";
class TransportError extends Error {}
export async function gameAction(
  action: Action,
  payload: Record<string, unknown> = {},
  requestId?: string,
): Promise<GameState> {
  if (!supabase) return demoAction(action, payload);
  let pendingKey = "";
  let id = requestId || uuid();
  if (action !== "sync") {
    const { data } = await supabase.auth.getSession();
    // Retain an uncertain mutation UUID across refresh/manual retry, scoped to its owner.
    pendingKey = `pixel-pending:${data.session?.user.id}:${action}:${JSON.stringify(payload)}`;
    id = localStorage.getItem(pendingKey) || id;
    localStorage.setItem(pendingKey, id);
  }
  for (let i = 0; i < 2; i++) {
    try {
      const { data, error } = await supabase.rpc("pixel_game", {
        action,
        payload,
        request_id: id,
      });
      if (error) {
        if (!error.code || error.code.startsWith("PGRST00"))
          throw new TransportError(error.message);
        if (pendingKey) localStorage.removeItem(pendingKey);
        throw Error(error.message);
      }
      if (pendingKey) localStorage.removeItem(pendingKey);
      return data as GameState;
    } catch (e) {
      if (!(e instanceof TransportError || e instanceof TypeError)) throw e;
      if (i)
        throw Error(
          "Connection interrupted. Your timer keeps running. Retry the same action safely after reconnecting.",
        );
    }
  }
  throw Error("Connection lost. Please retry.");
}
