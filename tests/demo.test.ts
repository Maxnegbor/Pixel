import { beforeEach, describe, it, expect, vi } from "vitest";
import {chestBonuses} from "../src/lib/chest-bonus";
import { demoAction, loadDemo, simulateSession, DEV_SAVE_KEY } from "../src/lib/demo";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
});
describe("local demo vertical flow", () => {
  it("persists focus, pause, refresh and break without duplicated rewards", () => {
    demoAction("start", { duration: 600, kind: "focus" });
    vi.advanceTimersByTime(120000);
    let g = demoAction("pause");
    expect(g.profile.xp).toBe(0);
    vi.advanceTimersByTime(180000);
    g = demoAction("sync");
    expect(g.profile.xp).toBe(0);
    expect(loadDemo().sessions[0].status).toBe("paused");
    demoAction("resume");
    vi.advanceTimersByTime(480000);
    g = demoAction("sync");
    expect(g.profile.xp).toBe(0);
    expect(g.profile.coins).toBe(120);
    expect(g.profile.boxes).toBe(1);
    expect(g.sessions[0].status).toBe("completed");
    const session_id=g.pending_rewards![0].session_id;
    expect(loadDemo().pending_rewards).toHaveLength(1);
    g=demoAction("claim",{session_id});
    expect(g.profile.xp).toBe(100);
    expect(g.profile.coins).toBe(140);
    expect(g.profile.boxes).toBe(2);
    g=demoAction("claim",{session_id});
    expect(g.profile.coins).toBe(140);
    demoAction("start", { duration: 60, kind: "break" });
    vi.advanceTimersByTime(60000);
    g = demoAction("sync");
    expect(g.profile.xp).toBe(100);
  });
  it("forfeits early-ended focus and never grants active-session coins",()=>{
    demoAction("start",{duration:600,kind:"focus"});
    vi.advanceTimersByTime(121000);
    let g=demoAction("sync");
    expect(g.profile.coins).toBe(120);
    expect(g.pending_rewards).toHaveLength(0);
    g=demoAction("end");
    expect(g.profile.coins).toBe(120);
    expect(g.pending_rewards).toHaveLength(0);
    expect(g.sessions[0].status).toBe("ended");
  });
  it("isolates accelerated dev sessions and carries box minutes across claims",()=>{
    simulateSession(5,3);
    expect(loadDemo().sessions).toHaveLength(0);
    expect(loadDemo(DEV_SAVE_KEY).profile.coins).toBe(120);
    vi.advanceTimersByTime(3000);
    let g=demoAction("sync",{},DEV_SAVE_KEY);
    expect(g.pending_rewards![0].coins).toBe(10);
    expect(g.pending_rewards![0].boxes).toBe(0);
    g=demoAction("claim",{session_id:g.pending_rewards![0].session_id},DEV_SAVE_KEY);
    expect(g.profile.coins).toBe(130);
    g=simulateSession(5,0);
    expect(g.pending_rewards![0].boxes).toBe(1);
    g=demoAction("claim",{session_id:g.pending_rewards![0].session_id},DEV_SAVE_KEY);
    expect(g.profile.coins).toBe(140);
    expect(g.profile.boxes).toBe(2);
    expect(loadDemo().profile.coins).toBe(120);
  });
  it("starts with Common coffee and swaps tea exclusively without regenerating sold starters",()=>{
    let g=loadDemo();
    expect(g.catalog.find(i=>i.id==='coffee')).toMatchObject({slot:'drink',rarity:'Common'});
    expect(g.inventory.find(i=>i.item_id==='coffee')).toMatchObject({quantity:1,equipped:true});
    demoAction("buy",{item_id:"mug"});
    g=demoAction("equip",{item_id:"mug"});
    expect(g.inventory.find(i=>i.item_id==='coffee')?.equipped).toBe(false);
    expect(g.inventory.find(i=>i.item_id==='mug')?.equipped).toBe(true);
    demoAction("equip",{item_id:"coffee"});
    demoAction("unequip",{item_id:"coffee"});
    demoAction("sell",{item_id:"coffee"});
    expect(demoAction("sync").inventory.find(i=>i.item_id==='coffee')?.quantity).toBe(0);
  });
  it("migrates an existing tea owner's starter without replacing their equipped tea",()=>{
    const old=loadDemo();old.inventory=old.inventory.filter(i=>i.item_id!=='coffee');
    old.inventory.push({item_id:'mug',quantity:1,equipped:true});
    localStorage.setItem('pixel-study-demo-v1',JSON.stringify(old));
    const g=loadDemo();
    expect(g.inventory.find(i=>i.item_id==='coffee')?.equipped).toBe(false);
    expect(g.inventory.find(i=>i.item_id==='mug')?.equipped).toBe(true);
    expect(g.profile.coins).toBe(120);
    expect(loadDemo().inventory.filter(i=>i.item_id==='coffee')).toHaveLength(1);
  });
  it("unlocks every collectible exclusively in the dev save, including reloads and swaps",()=>{
    const normal=demoAction('sync');
    const test=demoAction('sync',{},DEV_SAVE_KEY);
    expect(test.inventory.filter(o=>o.quantity>0)).toHaveLength(test.catalog.length);
    expect(normal.inventory.filter(o=>o.quantity>0)).toHaveLength(10);
    demoAction('equip',{item_id:'greenlight'},DEV_SAVE_KEY);
    const dev=demoAction('sync',{},DEV_SAVE_KEY);
    expect(dev.inventory.find(o=>o.item_id==='greenlight')?.equipped).toBe(true);
    expect(dev.inventory.find(o=>o.item_id==='brasslight')?.equipped).toBe(false);
    expect(loadDemo().inventory.some(o=>o.item_id==='greenlight')).toBe(false);
    expect(loadDemo().inventory.find(o=>o.item_id==='brasslight')?.equipped).toBe(true);
    expect(loadDemo().profile).toEqual(normal.profile);
  });
  it("migrates starter furnishings once and does not regenerate sold copies",()=>{
    const old=loadDemo();old.inventory=old.inventory.filter(o=>!['brasslight','oldbooks','desk_pothos','cabinrunner','maplejournal','coppertools','fieldguide'].includes(o.item_id));
    localStorage.setItem('pixel-study-demo-v1',JSON.stringify(old));
    expect(loadDemo().inventory.find(o=>o.item_id==='oldbooks')).toMatchObject({quantity:1,equipped:true});
    demoAction('unequip',{item_id:'oldbooks'});demoAction('sell',{item_id:'oldbooks'});
    expect(demoAction('sync').inventory.find(o=>o.item_id==='oldbooks')?.quantity).toBe(0);
    expect(loadDemo().inventory.filter(o=>o.item_id==='oldbooks')).toHaveLength(1);
  });
  it("allows rarity demos only in the isolated dev save",()=>{
    vi.stubGlobal('crypto',{getRandomValues:(v:Uint32Array)=>v.fill(0)});
    const normal=demoAction('open',{test_rarity:'Legendary'});
    expect(normal.result?.chest_bonus?.rarity).toBe('Common');
    const dev=demoAction('open',{test_rarity:'Legendary'},DEV_SAVE_KEY);
    expect(dev.result?.chest_bonus).toEqual(chestBonuses.Legendary);
    expect(dev.profile.coins).toBe(170);
    expect(loadDemo().profile.coins).toBe(123);
    vi.unstubAllGlobals();
  });
  it("merges five spare copies into one higher-tier item and persists exactly one result",()=>{
    const initial=loadDemo();initial.inventory.push({item_id:'notes',quantity:5,equipped:false});
    localStorage.setItem('pixel-study-demo-v1',JSON.stringify(initial));
    const before=initial.inventory.reduce((sum,o)=>sum+o.quantity,0);
    const g=demoAction('merge',{items:[{item_id:'notes',quantity:5}],rarity:'Legendary',coins:999999});
    expect(g.catalog.find(i=>i.id===g.result?.item_id)?.rarity).toBe('Uncommon');
    expect(g.inventory.reduce((sum,o)=>sum+o.quantity,0)).toBe(before-4);
    expect(g.profile).toEqual(initial.profile);
    expect(loadDemo().inventory).toEqual(g.inventory);
  });
  it("rolls back invalid merges and protects equipped copies",()=>{
    const initial=loadDemo();const saved=JSON.stringify(initial);localStorage.setItem('pixel-study-demo-v1',saved);
    expect(()=>demoAction('merge',{items:[{item_id:'coffee',quantity:5}]})).toThrow('spare');
    expect(loadDemo().inventory).toEqual(initial.inventory);
  });
  it("buys, equips, sells duplicates and opens one box", () => {
    let g = demoAction("buy", { item_id: "candle" });
    expect(g.profile.coins).toBe(80);
    g = demoAction("equip", { item_id: "candle" });
    expect(g.inventory.find((i) => i.item_id === "candle")?.equipped).toBe(
      true,
    );
    expect(() => demoAction("sell", { item_id: "candle" })).toThrow("Unequip");
    demoAction("buy", { item_id: "candle" });
    g = demoAction("sell", { item_id: "candle" });
    expect(g.profile.coins).toBe(50);
    g = demoAction("open");
    expect(g.profile.boxes).toBe(0);
    expect(g.result?.item_id).toBeTruthy();
    const won=g.catalog.find(i=>i.id===g.result?.item_id)!;
    expect(g.result?.chest_bonus).toEqual(chestBonuses[won.rarity]);
    expect(g.profile.coins).toBe(50+chestBonuses[won.rarity].coins);
    expect(g.profile.xp).toBe(chestBonuses[won.rarity].xp);
    expect(() => demoAction("open")).toThrow("Study");
  });
});
