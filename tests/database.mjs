// Executes the actual migration and all economy RPCs in embedded PostgreSQL.
// auth.users/auth.uid() are test doubles; production Supabase Auth is a setup check.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const db = new PGlite();
const one = "11111111-1111-4111-8111-111111111111",
  two = "22222222-2222-4222-8222-222222222222";
let passed = 0,openedBonus={coins:0,xp:0};
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log("✓ " + name);
};
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users(id) values('${one}'),('${two}');`,
);
for (const file of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
}
await db.exec(readFileSync("supabase/seed.sql", "utf8"));
const as = async (id) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
};
const rpc = async (action, payload = {}, id = randomUUID()) =>
  (
    await db.query("select public.pixel_game($1,$2::jsonb,$3::uuid) as game", [
      action,
      JSON.stringify(payload),
      id,
    ])
  ).rows[0].game;
const admin = async (sql) => {
  await db.exec("reset role");
  await db.exec(sql);
  await db.exec("set role authenticated");
};
try {
  await as(one);
  await test("fresh user receives starter companions, zero production coins, full catalog", async () => {
    const g = await rpc("sync");
    assert.equal(g.profile.coins, 0);
    assert.equal(g.catalog.length, 43);
    assert.equal(g.inventory.length, 10);
    assert.equal(g.inventory.find(i=>i.item_id==='coffee').equipped,true);
  });
  await test("client cannot forge balances, durations or completion", async () => {
    await assert.rejects(() => rpc("start", { kind: "focus", duration: 1 }));
    await assert.rejects(() => rpc("start", { kind: "focus", duration: 60.1 }));
    await rpc("start", { kind: "focus", duration: 600 });
    const g = await rpc("sync", { elapsed: 60000, xp: 999999, coins: 99999 });
    assert.equal(g.profile.xp, 0);
    assert.equal(g.sessions[0].status, "running");
    await assert.rejects(() => rpc("start", { kind: "focus", duration: 600 }));
  });
  await test("active sessions earn nothing; completed rewards persist and claim once", async () => {
    await admin(
      `update pixel_private.sessions set running_since=clock_timestamp()-interval '121 seconds' where user_id='${one}' and status='running'`,
    );
    let g = await rpc("pause");
    assert.equal(g.profile.focus_minutes, 0);
    assert.equal(g.profile.xp, 0);
    assert.equal(g.profile.coins, 0);
    g = await rpc("sync");
    assert.equal(g.profile.xp, 0);
    await rpc("resume");
    await admin(
      `update pixel_private.sessions set running_since=clock_timestamp()-interval '500 seconds' where user_id='${one}' and status='running'`,
    );
    g = await rpc("sync");
    assert.equal(g.profile.xp, 0);
    assert.equal(g.profile.coins, 0);
    assert.equal(g.profile.boxes, 0);
    assert.equal(g.sessions[0].status, "completed");
    assert.equal(g.pending_rewards[0].coins, 20);
    const session_id = g.pending_rewards[0].session_id;
    assert.equal((await rpc("sync")).pending_rewards.length, 1);
    const request = randomUUID();
    g = await rpc("claim", {session_id, coins:999999}, request);
    assert.equal(g.profile.xp, 100);
    assert.equal(g.profile.coins, 20);
    assert.equal(g.profile.boxes, 1);
    assert.equal(g.pending_rewards.length, 0);
    assert.equal((await rpc("claim",{session_id,coins:999999},request)).profile.coins,20);
    assert.equal((await rpc("claim",{session_id})).profile.coins,20);
  });
  await test("breaks grant no rewards", async () => {
    await rpc("start", { duration: 60, kind: "break" });
    await admin(
      `update pixel_private.sessions set running_since=clock_timestamp()-interval '65 seconds' where user_id='${one}' and status='running'`,
    );
    const g = await rpc("sync");
    assert.equal(g.profile.xp, 100);
    assert.equal(g.profile.focus_minutes, 10);
  });
  await test("box opening is atomic, idempotent and independent of client rarity", async () => {
    const id = randomUUID();
    const a = await rpc("open", { rarity: "Legendary" }, id);
    const b = await rpc("open", { rarity: "Legendary" }, id);
    assert.equal(a.profile.boxes, 0);
    assert.equal(a.result.item_id, b.result.item_id);
    assert.deepEqual(a.inventory, b.inventory);
    const won=a.catalog.find(i=>i.id===a.result.item_id);
    const expected={Common:[3,10],Uncommon:[5,20],Rare:[10,40],Epic:[20,80],Legendary:[50,200]}[won.rarity];
    openedBonus=a.result.chest_bonus;
    assert.equal(openedBonus.coins,expected[0]);assert.equal(openedBonus.xp,expected[1]);
    assert.equal(a.profile.coins,20+expected[0]);assert.equal(a.profile.xp,100+expected[1]);
    assert.equal(b.profile.coins,a.profile.coins);assert.equal(b.profile.xp,a.profile.xp);
    await assert.rejects(() => rpc("open"));
    await assert.rejects(() => rpc("buy", { item_id: "candle" }, id));
    // Keep later equipment assertions independent of which random item this box won.
    await admin(`delete from pixel_private.inventory where user_id='${one}' and item_id not in ('miso','fern','coffee'); update pixel_private.inventory set quantity=1 where user_id='${one}' and item_id in ('miso','fern','coffee')`);
  });
  await test("insufficient funds rolls back inventory and receipt", async () => {
    await assert.rejects(() => rpc("buy", { item_id: "sunlamp" }));
    assert.equal((await rpc("sync")).profile.coins, 20+openedBonus.coins);
  });
  await test("purchase retry debits only once; equipment, duplicate sales and slot exclusivity work", async () => {
    await admin(
      `update pixel_private.profiles set coins=500 where id='${one}'`,
    );
    const id = randomUUID();
    const a = await rpc("buy", { item_id: "candle" }, id);
    const b = await rpc("buy", { item_id: "candle" }, id);
    assert.equal(a.profile.coins, 460);
    assert.equal(b.profile.coins, 460);
    await rpc("equip", { item_id: "candle" });
    await assert.rejects(() => rpc("sell", { item_id: "candle" }));
    await rpc("buy", { item_id: "candle" });
    const g = await rpc("sell", { item_id: "candle" });
    assert.equal(g.inventory.find((i) => i.item_id === "candle").quantity, 1);
    assert.equal(g.profile.coins, 430);
    await rpc("buy", { item_id: "lantern" });
    const h = await rpc("equip", { item_id: "lantern" });
    assert.equal(
      h.inventory.find((i) => i.item_id === "candle").equipped,
      false,
    );
    assert.equal(
      h.inventory.find((i) => i.item_id === "lantern").equipped,
      true,
    );
  });
  await test("coffee and tea share a drink slot; the starter cannot regenerate after sale", async () => {
    await rpc("buy",{item_id:"mug"});
    let g=await rpc("equip",{item_id:"mug"});
    assert.equal(g.inventory.find(i=>i.item_id==='coffee').equipped,false);
    assert.equal(g.inventory.find(i=>i.item_id==='mug').equipped,true);
    g=await rpc("equip",{item_id:"coffee"});
    assert.equal(g.inventory.find(i=>i.item_id==='mug').equipped,false);
    await rpc("unequip",{item_id:"coffee"});
    await rpc("sell",{item_id:"coffee"});
    g=await rpc("sync");
    assert.equal(g.inventory.some(i=>i.item_id==='coffee'),false);
  });
  await test("desk variants equip exclusively, persist and never regenerate sold starters", async () => {
    await admin(`update pixel_private.profiles set coins=1000 where id='${one}'`);
    await rpc('buy',{item_id:'greenlight'});
    await rpc('buy',{item_id:'brasslight'});
    await rpc('equip',{item_id:'brasslight'});
    let g=await rpc('equip',{item_id:'greenlight'});
    assert.equal(g.inventory.find(i=>i.item_id==='brasslight').equipped,false);
    assert.equal(g.inventory.find(i=>i.item_id==='greenlight').equipped,true);
    await rpc('sell',{item_id:'brasslight'});
    g=await rpc('sync');
    assert.equal(g.inventory.some(i=>i.item_id==='brasslight'),false);
    assert.equal(g.inventory.find(i=>i.item_id==='greenlight').equipped,true);
    assert.equal(g.catalog.filter(i=>i.slot==='desk_lamp').length,2);
  });
  await test("direct table writes/reads and anonymous RPC are denied", async () => {
    await assert.rejects(() =>
      db.exec("update pixel_private.profiles set coins=999999"),
    );
    await assert.rejects(() => db.exec("select * from pixel_private.profiles"));
    await db.exec("reset role;set role anon");
    await assert.rejects(() => rpc("sync"));
    await as(one);
  });
  await test("users cannot see or mutate another player and ownership is enforced", async () => {
    await as(two);
    const g = await rpc("sync", { user_id: one });
    assert.equal(g.profile.coins, 0);
    assert.equal(g.profile.xp, 0);
    await assert.rejects(() =>
      rpc("sell", { item_id: "lantern", user_id: one }),
    );
    await assert.rejects(() =>
      rpc("equip", { item_id: "lantern", user_id: one }),
    );
    await rpc("username", { username: "Second player" });
    await as(one);
    assert.equal((await rpc("sync")).profile.username, "Wanderer");
  });
  await test("session retry is idempotent; ending early forfeits rewards", async () => {
    const id = randomUUID();
    await rpc("start", { duration: 600, kind: "focus" }, id);
    await rpc("start", { duration: 600, kind: "focus" }, id);
    await admin(
      `update pixel_private.sessions set running_since=clock_timestamp()-interval '65 seconds' where user_id='${one}' and status='running'`,
    );
    const g = await rpc("end");
    assert.equal(g.profile.focus_minutes, 10);
    assert.equal(g.pending_rewards.length,0);
    assert.equal(g.sessions[0].status, "ended");
  });
  await test("completed claims survive refresh, enforce ownership, and block another focus until collected", async () => {
    await rpc("start",{duration:300,kind:"focus"});
    await admin(`update pixel_private.sessions set running_since=clock_timestamp()-interval '301 seconds' where user_id='${one}' and status='running'`);
    let g=await rpc("sync");
    const session_id=g.pending_rewards[0].session_id;
    const coins=g.profile.coins;
    await assert.rejects(()=>rpc("start",{duration:60,kind:"focus"}));
    await as(two);
    await assert.rejects(()=>rpc("claim",{session_id}));
    await as(one);
    g=await rpc("sync");
    assert.equal(g.pending_rewards[0].session_id,session_id);
    g=await rpc("claim",{session_id});
    assert.equal(g.profile.coins,coins+10);
    assert.equal(g.pending_rewards.length,0);
  });
  await test("timer cheats and reward forgeries are rejected by production RPC", async () => {
    await assert.rejects(()=>rpc("dev_complete",{duration:600}));
    await assert.rejects(()=>rpc("claim",{session_id:randomUUID(),coins:99999}));
  });
  await test("all five chest tiers use exact fixed bonuses; the private helper cannot be invoked by players",async()=>{
    await assert.rejects(()=>db.query("select pixel_private.chest_bonus('Legendary')"));
    await db.exec('reset role');
    for(const [rarity,coins,xp] of [['Common',3,10],['Uncommon',5,20],['Rare',10,40],['Epic',20,80],['Legendary',50,200]]){
      const result=await db.query('select pixel_private.chest_bonus($1) as bonus',[rarity]);
      assert.deepEqual(result.rows[0].bonus,{rarity,coins,xp});
    }
    await as(one);
  });
  await test("merging upgrades every tier, consumes five copies atomically and retries exactly once",async()=>{
    const tiers=[['notes','Uncommon'],['mug','Rare'],['stars','Epic'],['aurora','Legendary'],['ember','Legendary']];
    for(const [item_id,tier] of tiers){
      await admin(`insert into pixel_private.inventory(user_id,item_id,quantity,equipped) values('${one}','${item_id}',6,true) on conflict(user_id,item_id) do update set quantity=6,equipped=true`);
      const before=await rpc('sync'),id=randomUUID(),payload={items:[{item_id,quantity:5}],rarity:'Legendary',coins:999999};
      const after=await rpc('merge',payload,id),retry=await rpc('merge',payload,id);
      assert.equal(after.catalog.find(i=>i.id===after.result.item_id).rarity,tier);
      assert.equal(after.inventory.reduce((s,i)=>s+i.quantity,0),before.inventory.reduce((s,i)=>s+i.quantity,0)-4);
      assert(after.inventory.find(i=>i.item_id===item_id).equipped);
      assert.deepEqual(after.inventory,retry.inventory);assert.deepEqual(after.profile,before.profile);
      await assert.rejects(()=>rpc('merge',{items:[{item_id,quantity:4}]},id));
    }
  });
  await test("merge validation rejects mixed tiers, malformed counts and duplicate rows without consuming items",async()=>{
    await admin(`insert into pixel_private.inventory(user_id,item_id,quantity,equipped) values('${one}','notes',10,false),('${one}','mug',10,false) on conflict(user_id,item_id) do update set quantity=10,equipped=false`);
    const before=await rpc('sync');
    for(const items of [[],null,[{item_id:'notes',quantity:4}],[{item_id:'notes',quantity:3},{item_id:'mug',quantity:2}],[{item_id:'notes',quantity:3},{item_id:'notes',quantity:2}],[{item_id:'notes',quantity:5.1}],[{item_id:'notes',quantity:'5'}],[{item_id:'not-real',quantity:5}]])await assert.rejects(()=>rpc('merge',{items}));
    const after=await rpc('sync');assert.deepEqual(after.inventory,before.inventory);assert.deepEqual(after.profile,before.profile);
  });
  await test("merges protect an equipped last copy and reject insufficient quantities",async()=>{
    await admin(`update pixel_private.inventory set quantity=5,equipped=true where user_id='${one}' and item_id='notes'`);
    await assert.rejects(()=>rpc('merge',{items:[{item_id:'notes',quantity:5}]}));
    await rpc('unequip',{item_id:'notes'});
    await rpc('merge',{items:[{item_id:'notes',quantity:5}]});
    await assert.rejects(()=>rpc('merge',{items:[{item_id:'notes',quantity:5}]}));
  });
  await test("merging is owner-scoped and its helper is not callable directly",async()=>{
    await assert.rejects(()=>db.query("select pixel_private.merge_items($1,'{}')",[one]));
    await as(two);await assert.rejects(()=>rpc('merge',{items:[{item_id:'aurora',quantity:5}],user_id:one}));await as(one);
  });
  await test("focus sessions block merging until the session ends",async()=>{
    await rpc('start',{kind:'focus',duration:60});
    await assert.rejects(()=>rpc('merge',{items:[{item_id:'mug',quantity:5}]}));
    await rpc('end');
  });
  await test("all internal tables have RLS and public entrypoint is security invoker", async () => {
    await db.exec("reset role");
    const tables = await db.query(
      "select relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='pixel_private' and c.relkind='r'",
    );
    assert.equal(tables.rows.length, 7);
    assert(tables.rows.every((t) => t.relrowsecurity));
    const fn = await db.query(
      "select prosecdef from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and proname='pixel_game'",
    );
    assert.equal(fn.rows[0].prosecdef, false);
  });
  console.log(`\n${passed} database integration checks passed.`);
} finally {
  await db.close();
}
