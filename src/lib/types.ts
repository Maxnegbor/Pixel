export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export type Slot = "pet" | "plant" | "lamp" | "rug" | "wall" | "desk" | "drink" | "desk_lamp" | "books" | "desk_plant" | "desk_runner" | "journal" | "stationery" | "study_book";
export interface Item {
  id: string;
  name: string;
  kind: "pet" | "cosmetic";
  slot: Slot;
  rarity: Rarity;
  price: number;
  value: number;
  color: string;
  sprite: string;
}
export interface Owned {
  item_id: string;
  quantity: number;
  equipped: boolean;
}
export interface StudySession {
  id: string;
  kind: "focus" | "break";
  duration: number;
  elapsed: number;
  running_since: string | null;
  status: "running" | "paused" | "completed" | "ended";
  credited_minutes: number;
  started_at: string;
  finished_at: string | null;
}
export interface Profile {
  username: string;
  xp: number;
  coins: number;
  boxes: number;
  focus_minutes: number;
}
export interface ChestBonus {coins:number;xp:number;rarity:Rarity}
export interface RewardGrant {
  session_id: string;
  minutes: number;
  xp: number;
  coins: number;
  boxes: number;
}
export interface GameState {
  profile: Profile;
  inventory: Owned[];
  sessions: StudySession[];
  catalog: Item[];
  config: {
    xp_per_minute: number;
    coins_per_minute: number;
    box_minutes: number;
    level_xp: number;
  };
  server_now: string;
  pending_rewards?: RewardGrant[];
  result?: { item_id?: string; chest_bonus?:ChestBonus; reward?: RewardGrant; already_claimed?: boolean };
}
export type Action =
  | "claim"
  | "sync"
  | "start"
  | "pause"
  | "resume"
  | "end"
  | "merge"
  | "open"
  | "buy"
  | "sell"
  | "equip"
  | "unequip"
  | "username";
