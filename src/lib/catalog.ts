import type { Item, Rarity, Slot } from "./types";
export const odds: Record<Rarity, number> = {
  Common: 60,
  Uncommon: 25,
  Rare: 10,
  Epic: 4,
  Legendary: 1,
};
const petRows = [
  ["miso", "Miso the cat", "Common", "#d69b62", "cat"],
  ["moss", "Moss the frog", "Common", "#8aa96b", "frog"],
  ["biscuit", "Biscuit the corgi", "Uncommon", "#c88a54", "dog"],
  ["clover", "Clover the bunny", "Uncommon", "#e4d4bc", "bunny"],
  ["juniper", "Juniper the fox", "Rare", "#d77248", "fox"],
  ["nova", "Nova the owl", "Rare", "#a7a3d4", "owl"],
  ["luna", "Luna the spirit", "Epic", "#a7e0d5", "spirit"],
  ["ember", "Ember the dragon", "Legendary", "#eab866", "dragon"],
];
const decorRows = [
  ["brasslight", "Brass study lamp", "desk_lamp", "Common", "#d9a456", "brasslight"],
  ["greenlight", "Pine enamel lamp", "desk_lamp", "Uncommon", "#759375", "greenlight"],
  ["oldbooks", "Gilded cabin books", "books", "Common", "#ac7955", "oldbooks"],
  ["naturebooks", "Naturalist’s library", "books", "Uncommon", "#8b9e72", "naturebooks"],
  ["desk_pothos", "Golden desk pothos", "desk_plant", "Common", "#a4ac59", "desk_pothos"],
  ["desk_fern", "Terracotta desk fern", "desk_plant", "Uncommon", "#72935b", "desk_fern"],
  ["cabinrunner", "Heritage desk runner", "desk_runner", "Common", "#ac785b", "cabinrunner"],
  ["mossrunner", "Moss woven runner", "desk_runner", "Uncommon", "#87936a", "mossrunner"],
  ["maplejournal", "Maple journal & pen", "journal", "Common", "#c4904d", "maplejournal"],
  ["nightjournal", "Stargazer journal & pen", "journal", "Rare", "#7c8ba9", "nightjournal"],
  ["coppertools", "Copper writing set", "stationery", "Common", "#b98956", "coppertools"],
  ["greentools", "Sage writing set", "stationery", "Uncommon", "#8e9b7b", "greentools"],
  ["fieldguide", "Open forest field guide", "study_book", "Common", "#ceb88c", "fieldguide"],
  ["skyguide", "Open night-sky atlas", "study_book", "Rare", "#8794b6", "skyguide"],
  ["coffee", "Cabin coffee", "drink", "Common", "#d7c59b", "coffee"],
  ["fern", "Forest fern", "plant", "Common", "#6d9a64", "plant"],
  ["pothos", "Trailing pothos", "plant", "Common", "#91a867", "plant"],
  ["candle", "Little candle", "lamp", "Common", "#efb568", "candle"],
  ["woven", "Woven mat", "rug", "Common", "#b99768", "rug"],
  ["notes", "Field notes", "desk", "Common", "#d2bd87", "book"],
  ["print", "Botanical print", "wall", "Common", "#789269", "frame"],
  ["monstera", "Monstera", "plant", "Uncommon", "#4f9975", "plant"],
  ["lantern", "Amber lantern", "lamp", "Uncommon", "#f5c46b", "lantern"],
  ["mug", "Sage tea set", "drink", "Uncommon", "#9daf92", "mug"],
  ["mushrooms", "Mushroom garden", "plant", "Uncommon", "#c26c55", "mushroom"],
  ["plaid", "Autumn plaid", "rug", "Uncommon", "#aa694c", "rug"],
  ["moonprint", "Moon chart", "wall", "Uncommon", "#afb6c1", "frame"],
  ["bonsai", "Old forest bonsai", "plant", "Rare", "#7caa80", "bonsai"],
  ["crystal", "Crystal lamp", "lamp", "Rare", "#b5a8e2", "crystal"],
  ["velvet", "Midnight rug", "rug", "Rare", "#6e7197", "rug"],
  ["stars", "Star atlas", "desk", "Rare", "#929cc0", "book"],
  ["aurora", "Aurora tapestry", "wall", "Epic", "#7dbdb5", "frame"],
  ["glowcap", "Glowing mushrooms", "plant", "Epic", "#96d2dc", "mushroom"],
  ["sunlamp", "Captured sunlight", "lamp", "Legendary", "#ffd786", "lantern"],
  ["celestial", "Celestial rug", "rug", "Legendary", "#c5ab73", "rug"],
];
const costs: Record<string, number> = {
  Common: 40,
  Uncommon: 100,
  Rare: 250,
  Epic: 600,
  Legendary: 1500,
};
export const catalog: Item[] = [
  ...petRows.map(([id, name, rarity, color, sprite]) => ({
    id,
    name,
    kind: "pet" as const,
    slot: "pet" as const,
    rarity: rarity as Rarity,
    color,
    sprite,
    price: costs[rarity] * 2,
    value: costs[rarity] / 2,
  })),
  ...decorRows.map(([id, name, slot, rarity, color, sprite]) => ({
    id,
    name,
    kind: "cosmetic" as const,
    slot: slot as Slot,
    rarity: rarity as Rarity,
    color,
    sprite,
    price: costs[rarity],
    value: costs[rarity] / 4,
  })),
];
export const defaultConfig = {
  xp_per_minute: 10,
  coins_per_minute: 2,
  box_minutes: 10,
  level_xp: 500,
};
export function rarityAt(n: number): Rarity {
  return n < 60
    ? "Common"
    : n < 85
      ? "Uncommon"
      : n < 95
        ? "Rare"
        : n < 99
          ? "Epic"
          : "Legendary";
}
