import { starterDeskIds } from "./decorations";
import { chestBonuses } from "./chest-bonus";
import {mergePlan} from "./merging";
import { uuid } from "./uuid";
// Deliberately untrusted browser-only sandbox. Never imported into production economy SQL.
import { catalog, defaultConfig, rarityAt } from "./catalog";
import { elapsedSeconds } from "./timer";
import type { Action, GameState, StudySession } from "./types";
const key = "pixel-study-demo-v1";
export const DEV_SAVE_KEY = "pixel-study-dev-v1";
function initial(): GameState {
  return {
    profile: {
      username: "Wanderer",
      xp: 0,
      coins: 120,
      boxes: 1,
      focus_minutes: 0,
    },
    pending_rewards: [],
    inventory: [
      { item_id: "miso", quantity: 1, equipped: true },
      { item_id: "fern", quantity: 1, equipped: true },
      { item_id: "coffee", quantity: 1, equipped: true },
      ...starterDeskIds.map(item_id=>({item_id,quantity:1,equipped:true})),
    ],
    sessions: [],
    catalog,
    config: defaultConfig,
    server_now: new Date().toISOString(),
  };
}
export function loadDemo(storageKey = key): GameState {
  try {
    const s = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (s?.profile && Array.isArray(s.sessions)) {
      // One-time migration: sold copies remain as quantity-zero inventory entries,
      // so returning to the app cannot regenerate starter coins/items.
      if(!s.inventory.some((o:{item_id:string})=>o.item_id==="coffee")){
        const hasTea=s.inventory.some((o:{item_id:string;equipped:boolean;quantity:number})=>o.item_id==="mug"&&o.equipped&&o.quantity>0);
        s.inventory.push({item_id:"coffee",quantity:1,equipped:!hasTea});
        localStorage.setItem(storageKey,JSON.stringify(s));
      }
      for (const id of starterDeskIds) {
        if (!s.inventory.some((o:{item_id:string})=>o.item_id===id)) s.inventory.push({item_id:id,quantity:1,equipped:true});
      }
      if(storageKey===DEV_SAVE_KEY) grantDevCollection(s);
      localStorage.setItem(storageKey,JSON.stringify(s));
      return { ...s, pending_rewards: s.pending_rewards || [], catalog, config: defaultConfig };
    }
  } catch {
    /* recover a damaged demo save */
  }
  const fresh=initial();
  if(storageKey===DEV_SAVE_KEY) grantDevCollection(fresh);
  return fresh;
}
function grantDevCollection(g:GameState) {
  for(const item of catalog){
    const owned=g.inventory.find(o=>o.item_id===item.id);
    if(owned)owned.quantity=Math.max(1,owned.quantity);
    else g.inventory.push({item_id:item.id,quantity:1,equipped:false});
  }
}
export function demoAction(
  action: Action,
  payload: Record<string, unknown> = {},
  storageKey = key,
): GameState {
  const g = loadDemo(storageKey);
  g.result = undefined;
  g.pending_rewards ??= [];
  const p = g.profile;
  const now = new Date().toISOString();
  const s = g.sessions.find(
    (x) => x.status === "running" || x.status === "paused",
  );
  if (s?.status === "running") {
    s.elapsed = elapsedSeconds(s);
    s.running_since = now;
    if (s.elapsed >= s.duration) {
      if (s.kind === "focus") {
        const minutes = Math.max(0, Math.floor(s.elapsed / 60) - s.credited_minutes);
        g.pending_rewards.push({
          session_id: s.id, minutes,
          xp: minutes * g.config.xp_per_minute,
          coins: minutes * g.config.coins_per_minute,
          boxes: Math.floor((p.focus_minutes + minutes) / g.config.box_minutes) - Math.floor(p.focus_minutes / g.config.box_minutes),
        });
        p.focus_minutes += minutes;
        s.credited_minutes += minutes;
      }
      s.status = "completed";
      s.running_since = null;
      s.finished_at = now;
    }
  }
  const active =
    s && (s.status === "running" || s.status === "paused") ? s : null;
  const item = catalog.find((x) => x.id === payload.item_id);
  const owned = g.inventory.find((x) => x.item_id === payload.item_id);
  function add(id: string) {
    const o = g.inventory.find((x) => x.item_id === id);
    if (o) o.quantity++;
    else g.inventory.push({ item_id: id, quantity: 1, equipped: false });
  }
  if (action === "start") {
    if (active) throw Error("Finish or end your current session first.");
    if (g.pending_rewards.length && payload.kind !== "break") throw Error("Collect your completed session rewards first.");
    const duration = Number(payload.duration);
    if (!Number.isInteger(duration) || duration < 60 || duration > 14400)
      throw Error("Choose 1–240 minutes.");
    g.sessions.unshift({
      id: uuid(),
      kind: payload.kind === "break" ? "break" : "focus",
      duration,
      elapsed: 0,
      running_since: now,
      status: "running",
      credited_minutes: 0,
      started_at: now,
      finished_at: null,
    });
  }
  if (action === "pause" && active) {
    active.status = "paused";
    active.running_since = null;
  }
  if (action === "resume" && active) {
    active.status = "running";
    active.running_since = now;
  }
  if (action === "end" && active) {
    active.status = "ended";
    active.running_since = null;
    active.finished_at = now;
  }
  if (action === "claim") {
    if (active?.kind === "focus") throw Error("Finish your focus session first.");
    const reward = g.pending_rewards.find(r => r.session_id === payload.session_id);
    if (reward) {
      p.xp += reward.xp; p.coins += reward.coins; p.boxes += reward.boxes;
      g.pending_rewards = g.pending_rewards.filter(r => r !== reward);
      g.result = { reward };
    } else {
      g.result = { already_claimed: true };
    }
  }
  if (action === "username") {
    const name = String(payload.username || "").trim();
    if (!/^[\w -]{3,24}$/.test(name))
      throw Error("Use 3–24 letters, numbers, spaces, or underscores.");
    p.username = name;
  }
  if (action === "open") {
    if (active?.kind === "focus")
      throw Error("Your box can wait until after your focus session.");
    if (p.boxes < 1) throw Error("Study for 10 minutes to earn a box.");
    const roll = new Uint32Array(1);
    crypto.getRandomValues(roll);
    const requested=String(payload.test_rarity||'');
    const tier = storageKey===DEV_SAVE_KEY && Object.hasOwn(chestBonuses,requested)
      ? requested as keyof typeof chestBonuses : rarityAt((roll[0] / 4294967296) * 100);
    const pool = catalog.filter((x) => x.rarity === tier);
    crypto.getRandomValues(roll);
    const won = pool[roll[0] % pool.length];
    p.boxes--;
    add(won.id);
    const bonus=chestBonuses[tier];p.coins+=bonus.coins;p.xp+=bonus.xp;
    g.result = { item_id: won.id,chest_bonus:bonus };
  }
  if(action==='merge'){
    if(active?.kind==='focus')throw Error('Merge items after your focus session.');
    const plan=mergePlan(payload.items,g.inventory,catalog);
    const pool=catalog.filter(i=>i.rarity===plan.target);
    if(!pool.length)throw Error('This merge tier is not configured.');
    const roll=new Uint32Array(1);crypto.getRandomValues(roll);
    const won=pool[Math.floor(roll[0]/4294967296*pool.length)];
    for(const input of plan.items){const owned=g.inventory.find(o=>o.item_id===input.item_id)!;owned.quantity-=input.quantity;if(!owned.quantity)owned.equipped=false;}
    add(won.id);g.result={item_id:won.id};
  }
  if (["buy", "sell", "equip", "unequip"].includes(action)) {
    if (!item) throw Error("Unknown item.");
    if (action === "buy") {
      if (item.kind !== "cosmetic" || p.coins < item.price)
        throw Error("Not enough coins.");
      p.coins -= item.price;
      add(item.id);
    } else {
      if (!owned || owned.quantity < 1)
        throw Error("You do not own this item.");
      if (action === "sell") {
        if (owned.equipped && owned.quantity === 1)
          throw Error("Unequip your last copy before selling.");
        owned.quantity--;
        p.coins += item.value;
      }
      if (action === "equip") {
        g.inventory.forEach((o) => {
          if (catalog.find((x) => x.id === o.item_id)?.slot === item.slot)
            o.equipped = false;
        });
        owned.equipped = true;
      }
      if (action === "unequip") owned.equipped = false;
    }
  }
  g.server_now = now;
  localStorage.setItem(storageKey, JSON.stringify(g));
  return structuredClone(g);
}
export type { StudySession };

// Isolated, browser-only test world. Never forwarded to a production RPC.
export function simulateSession(minutes: number, secondsLeft = 3): GameState {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw Error("Choose 1–240 test minutes.");
  const g = loadDemo(DEV_SAVE_KEY);
  g.sessions = g.sessions.filter(s => s.status !== "running" && s.status !== "paused");
  const now = new Date().toISOString();
  g.sessions.unshift({ id: uuid(), kind: "focus", duration: minutes * 60,
    elapsed: minutes * 60 - Math.max(0, Math.min(3, secondsLeft)), running_since: now,
    status: "running", credited_minutes: 0, started_at: now, finished_at: null });
  localStorage.setItem(DEV_SAVE_KEY, JSON.stringify(g));
  return demoAction("sync", {}, DEV_SAVE_KEY);
}
