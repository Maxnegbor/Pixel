# Pixel Study V1

A working React + TypeScript + Vite productivity game, with Tailwind CSS, a hand-drawn Canvas pixel-art cabin, and a Supabase/PostgreSQL backend. The full-screen cabin artwork is bundled locally; no remote art or audio requests are required.

## Run immediately

Requires Node.js 22.12+ and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173). Without both Supabase variables, the app clearly labels itself **Local demo**. Demo progression uses browser localStorage, includes 120 demo coins and a welcome box, and supports the same timer, inventory, shop, box, pet, and statistics UI. This sandbox is not secure, is never uploaded to a real account, and is separate from production progression. Production users start with zero currency, Miso, a fern, coffee, and the seven original desk furnishings.

## Enable the full Supabase backend

Use a **dedicated new Supabase project**. No existing user projects were modified. The connected projects available during implementation belonged to other apps; this version therefore ships with a locally tested backend and the deployed demo, rather than reusing another app's database.

1. Create a project in the Supabase dashboard.
2. In SQL Editor, run the SQL files in `supabase/migrations/` in filename order (V1, completion rewards, then `20261027171355_starter_drink_slot.sql`), followed by `supabase/seed.sql`. Alternatively, link the CLI to your project, push the migration, and run the seed SQL in SQL Editor.
3. Leave `pixel_private` out of the project's exposed Data API schemas. `public` must be exposed for `pixel_game`. The migration explicitly grants the authenticated RPC; no direct access to game tables is needed.
4. Enable Email authentication. Configure Auth Site URL to your frontend URL and add `http://localhost:5173` / your deployed origin to allowed redirect URLs. Email confirmation is supported: create an account, confirm the received email, then sign in.
5. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Project Settings → API. The frontend uses a **publishable** key. Never place service-role, secret, or database passwords in Vite variables.
6. Restart `npm run dev`, or run `npm run build` and deploy `dist`. Vite variables are embedded at build time; merely adding hosting runtime variables to a prebuilt static app does not configure it. Rebuild after setting them.
7. Register two test accounts. Complete a real one-minute session, reload, click **Get rewards**, and verify XP/coins on one account and isolation on the other. This live Auth/PostgREST check needs your project credentials and was not executable in this build environment.

### Local Supabase (Docker required)

A CLI configuration is included, with localhost:5173 as the Auth site URL. Review the CLI's current help before running commands:

```bash
npx supabase start --help
npx supabase start
npx supabase db reset --help
npx supabase db reset
npx supabase status
```

The reset command rebuilds the **local development** database from the migration and seed; do not point it at a remote database. Use the local API URL/key in `.env`. Production email delivery requires configuring Supabase SMTP appropriately.

## Features

- Email/password signup and login, email confirmation, persistent Supabase sessions, validated editable display usernames (3–24 ASCII letters/numbers/spaces/underscores/hyphens). Usernames are display labels, not unique identities.
- Full-viewport, detailed generated pixel-art cabin seen from the writing desk, with a pine forest and lake outside. A 1280×720 Canvas composites window-masked animated rain, lake ripples, tea steam, localized firelight, equipped cosmetics, and a breathing/blinking companion over the bundled artwork. Canvas uses nearest-neighbor scaling and cover cropping. Timer, XP, navigation, and panels float above the scene. “Just the cabin” hides controls; Escape restores them. The fullscreen button uses the browser Fullscreen API when supported.
- Focus presets 25/50/90 minutes; custom 1–240 minutes; 5/10/15 minute breaks; pause/resume, early end, refresh/device recovery. Task notes stay local to each browser.
- Completed focus sessions earn 10 XP + 2 coins per whole minute. One box every 10 completed focus minutes, carried across sessions. A level every 500 XP. Nothing is credited to XP/coin/box balances while focusing: completion creates a saved claim, and **Get rewards** atomically credits it. Breaks and early-ended sessions earn nothing.
- Mystery chests open inside the cabin: the book slides aside, a chest drops onto the desk, and a tap shakes and opens its hinged lid. The reward rises, then clicking it sends it to the collection. Common 60%, Uncommon 25%, Rare 10%, Epic 4%, Legendary 1%; server chooses a tier and one item in it. Duplicates are allowed. No currency or real-money box purchases.
- 8 pets and 21 cosmetics, all five rarities. Inventory groups pets/decor, rarity filter, counts, equip/unequip, confirmed sales, and equipped-last-copy protection. Cosmetic shop offers live room previews. Purchases enter inventory; equip from Collection.
- One active pet and one item per decoration slot (plant/lamp/rug/wall/desk). Detailed shared-style pixel sprite atlases with subtle idle breathing.
- Independently adjustable rain, fire, and wind using seamless synthesized Web Audio; explicit opt-in, saved volume settings, master mute. Sound keeps playing when changing app tabs, and starts muted on a new browser session. It is a synthesized ambience layer, not recorded field audio.
- Today's minutes, lifetime hours, completed focus sessions, seven-day history and recent session journal. Minutes are grouped by session **start date** in the viewing device's timezone. A session crossing midnight is assigned to its starting day.
- Responsive desktop-first layout, keyboard controls, focus indicators, labels, and reduced-motion support. Rewards save silently; boxes cannot interrupt an active/paused focus session.

## Timer and trust model

The browser displays a deadline using the server timestamp offset, not an interval counter. A background sync runs every 15 seconds and after visibility/reconnect. Paused time does not accrue. Running time persists in PostgreSQL and is capped at the session duration. Closing the page does not pause a running session. On return, the server settles elapsed time exactly once. Rewards can appear up to 15 seconds after the visible timer reaches zero.

“Verified” means **authenticated elapsed server time**, not proof of human attention. There is no webcam, invasive activity tracking, or way to prove someone really studied. A user can start a timer and walk away; this is intentional for a private focus companion. Client clock changes can affect the temporary display but cannot mint server rewards. Very short sessions are supported for testing without accelerated production rewards.

## Database and security

`public.pixel_game(action, payload, request_id)` is the sole exposed API and uses SECURITY INVOKER. It calls `pixel_private.dispatch`, the intentionally privileged, private-schema transaction. Every call checks `auth.uid()`, fixes `search_path`, derives ownership from Auth, and locks the player's profile before reading/updating economy state. The user ID, rewards, item price, roll, elapsed time, and rarity are never trusted from payloads. Display usernames from signup metadata are validated and never used for authorization.

All six internal tables enable RLS and revoke direct access from anon/authenticated/PUBLIC. No permissive table policies exist. The private schema is not exposed via PostgREST. Only authenticated callers get execution on the public wrapper and private dispatch; PUBLIC and anon have no execution grants. No service-role key is needed in the client.

Profile locking serializes concurrent tabs/devices, prevents simultaneous sessions, negative funds, overselling and double box grants. A partial unique index additionally enforces one active session. Mutation receipts store user + UUID + action + payload + result: replaying the same request is safe; reusing its UUID with a different operation fails. Every RPC is a single PostgreSQL transaction; rejected operations roll back all effects. CSPRNG box rolls use random bits from PostgreSQL `gen_random_uuid`, never JavaScript or PostgreSQL `random()`. Requests automatically retry transient transport errors with the same UUID. Uncertain mutation UUIDs persist locally per user/action/payload across refresh so a manual retry cannot double charge; successful or definitively rejected requests clear the key.

Session rows and mutation receipts are retained indefinitely for V1. Before larger public use, add bounded history pagination, receipt retention and operational rate limiting. Run Supabase security/performance advisors on the actual project after migration; no remote advisors can inspect a database that hasn't been provisioned. The embedded test suite checks permissions and RLS locally.

## Configure economy / extend

An administrator can update the single `pixel_private.config` row: `xp_per_minute`, `coins_per_minute`, `box_minutes`, `level_xp`. Values are validated by constraints; rates are snapshotted when a focus session completes; existing claims retain those amounts. Changing box cadence mid-progression should be treated as a versioned economy migration to preserve expected milestones. Rarity thresholds are explicit in the database dispatcher and `src/lib/catalog.ts`; change both together and update tests/disclosure if designing a new economy.

The seeded item catalog is returned by the backend. `src/lib/catalog.ts` supplies demo data only. Add new items to both the demo catalog and `supabase/seed.sql`. `Item.slot` and the room's placement map separate customization from progression so future environments can reuse inventories. `src/lib/art.ts` loads and isolates the 29 detailed transparent sprites and renders them in both the room and inventory; `Cabin.tsx` composites the environment and animations. The generated background is `public/art/forest-desk-v3-wide.png`; its generation brief is in `docs/ART_DIRECTION.md`. Future crafting, pet interactions, and social rooms should add validated atomic database operations rather than direct client writes. Social/multiplayer features and environment unlocks are extension points, not shipped features.

## Validate

```bash
npm test
npm run test:db
npm run build
```

The unit suite covers wall-clock timing, refresh, pause, clock rollback, published rarity boundaries, content counts and demo focus/economy flows. The database integration suite executes the **actual migration and seed** in PGlite (embedded PostgreSQL), with test doubles only for `auth.users` and `auth.uid()`. It checks real SQL rewards, no client-time forgery, breaks, retries/idempotency, rollback, equipment slots, ownership, unprivileged/anonymous access, and RLS. Test setup advances server-side session timestamps as an administrator; the client cannot do so. PGlite tests do not replace a live Supabase Auth/PostgREST or multi-connection concurrency test.

Browser QA: local preview tested for timer start/pause/reload/end, box opening, collection and shop interactions, and sound control. The production build is static and may be hosted on any HTTPS static host. The Supabase database supplies the full-stack backend.

## Project map

```text
src/App.tsx                  auth, navigation, queued mutations and sync
src/components/              cabin, timer, collection, boxes, stats, audio UI
src/lib/api.ts               Supabase RPC / demo adapter
src/lib/demo.ts              isolated browser-local sandbox
src/lib/timer.ts             deterministic timing helpers
src/lib/art.ts               reusable pixel item sprites
src/lib/audio.ts             Web Audio mixer
supabase/migrations/         schema, constraints and atomic RPC
supabase/seed.sql            29 collectible definitions
tests/                       unit and actual SQL integration checks
```

## Cabin art integration (V4)

The HUD uses a bundled aged-walnut texture with brass framing and cream typography. Eight pets and twenty-one cosmetics use detailed transparent sprite atlases plus a standalone coffee sprite, matched to the cabin's amber lighting and pixel density. These same sprites appear in collection cards, box rewards, previews and the room. Art source paths and exact generation prompts are documented in `docs/ART_DIRECTION.md`.

Scene collectibles have explicit placement dimensions and depth values in `Cabin.tsx`. Wall/shelf decorations render first, the active pet rests on the far desk edge, then foreground desk objects render. A silhouette mask redraws the original coffee cup and coaster over the pet, including the hollow handle; cup steam renders last. Sprites have contact shadows and scene color grading. Equipping/unequipping a pet changes only the sprite pass; the baked background contains no pet. Scene surfaces and masks share the same 1280×720 coordinate system and cover transform, so occlusion remains aligned when the viewport changes.

## Pixel interface (V5)

Silkscreen display text and VT323 interface text are bundled as local WOFF2 files with their licenses. Timber-stick frames use nine-slice borders from `public/art/timber-panel-v5.png`; the center is a deliberately chunky pixel-walnut fill. The pet is positioned on the right-back desktop with a shared ground baseline of y=476, contact shadow, idle breathing anchored at the ground, and the existing coffee foreground mask. All viewport scaling keeps the scene, sprite, shadow and occlusion in the same coordinate system.

## Integrated ambient animation (V6)

`src/lib/room-motion.ts` animates nine authored flame regions (the hearth and eight candle/lantern flames) by displacing their existing texture pixels inside warm-color masks. Flame bases and region edges are pinned; dark grate bars and surrounding holders retain their original pixels. A subtle luminance change follows the existing lit hearth surfaces. Equipped candle and lantern collectibles use the same renderer on a full transparent sprite frame, without painting a second flame over the original sprite.

Coffee vapour uses a continuous buoyant advection field anchored at the hot drink surface. The baked static steam is first removed within a small authored silhouette using neighboring artwork on the same forest/sill scanline, then the animated plume is composited after cup foreground occlusion. This avoids double steam and keeps the mug solid. All effects share the artwork's 1280×720 pixel coordinates and cover transform. Reduced-motion mode uses the original still artwork, and hidden tabs stop drawing frames.

The motion unit suite checks fixed flame bases/edges, region bounds, evolving steam density, transparent field boundaries and bounded opacity. A temporary local closeup harness verified changing flame/steam pixels and unchanged holder/grate/mug regions in the browser; the harness is not shipped.

### V7 visual update
Mystery boxes use a detailed transparent walnut-and-brass chest sprite, with four-tap progress and reduced-motion-aware feedback. All UI text uses the uploaded Pixelta font, self-hosted and preloaded. The supplied font's personal-use terms are in `public/fonts/Pixelta-Usage-Information.pdf`; obtain the appropriate license before commercial use.

### V8: three-layer study-space parallax
The scene composites three independent surfaces: static forest/lake, a chalet interior with transparent window panes, and a transparent foreground desk. Generated full-size assets under `public/art/*-v8.png` include scenery previously hidden behind the desk, so movement exposes real painted content. Mouse position eases into a bounded camera offset: desk ±12/6.6 world pixels, interior ±4/2.2, forest fixed. A 4% overscan prevents edge gaps. UI stays fixed. Pet sprites, desk cosmetics, cup occlusion and steam share the desk transform; fireplace/candles and room decorations share the interior transform. Touch devices and reduced-motion preferences keep a centered camera. Pointer exit and blur return it to center. The compositor updates at display refresh rate while pixel animation surfaces update at 12.5 fps.


### V9: completion claims and reward collection
The top-center cabin label is replaced by **Dev mode**. Focus timer completion creates one durable pending reward per session. Sync, pauses and early ends never mint XP/coins/boxes. A native modal offers **Get rewards** or **Later**. Claims are owner-scoped, serialized and idempotent in SQL; a refresh before claiming restores the claim, while a refresh after claiming shows the saved balance without paying twice. Completed minutes update statistics at completion. Previously credited V1 balances are preserved; an active legacy session only earns a claim for minutes not already credited.

Claiming launches one shiny pixel coin per coin and one miniature walnut chest per box. They launch rapidly from center, continue drifting outward with exponential drag, and blend into accelerating magnetic paths before that outward motion stops. Flying coins are 32px (a third smaller than V9); chest size is unchanged. Each arrival advances its counter; the dock badge uses the same displayed chest count. XP credits on claim. Chime notes and a completion chord use Web Audio unlocked only by the claim click, with a saved **Reward sounds** toggle. Reduced-motion users get a short counter settlement instead of traveling particles. A refresh during animation cannot lose the awarded balance.

**Testing:** open Dev mode → enable test mode → choose 1–240 simulated minutes → **Run final 3 seconds** or **Complete instantly** → **Get rewards**. A quarter-speed option helps inspect the animation. The test world uses its own local storage key and balance, even when production Supabase is connected. No timer acceleration action exists in the server RPC. Leaving test mode restores the real profile and any real running timer. The deployed app remains the local demo until a dedicated Supabase project is configured; apply all migrations before enabling it.

Validation includes 19 unit tests and 13 embedded PostgreSQL integration checks covering completion-only payouts, pending-claim persistence, duplicate claims, another user's claim, untrusted reward payloads, early ends, test-world isolation, cumulative box thresholds and server rejection of timer cheats. Browser QA covered final-three-second completion, 10/25-minute test sessions, simultaneous coin/chest collection, counter settlement and return to the unchanged normal demo profile.


### V10: continuous reward motion
The burst now has a fast initial push and a longer, decelerating outward tail. Magnetic attraction starts after 820ms, overlapping that tail rather than holding sprites still. The pull blends from each sprite’s current moving position with a smooth velocity handoff. Staggered arrivals still advance the counters and play the existing chimes.


### V11: XP delivery and in-room chest opening
Experience now travels as sage/ivory pixel motes to the bottom-left XP bar, simultaneous with coins/chests. Displayed XP, level and bar fill advance only as motes arrive; the saved economy still credits the complete, atomic claim first. Larger XP totals are divided exactly across at most 48 motes, generally 10 XP each. The bar pulses on arrival, fills brightly through a level boundary and then carries the remainder into the next level. XP chimes have their own soft timbre.

The large mystery-box panel is replaced by `ChestRitual`: book slides away, chest falls onto the tabletop with a small landing bounce, one tap triggers a shake and a six-frame hinged opening, interior glow/sparks, then the actual inventory sprite rises. Name and rarity appear above it. Click the reward to send it along a curved magnetic path to the collection icon; a short brightness/scale pulse and bloop mark arrival. Remaining chest count and all five rarity chances remain visible. A Next chest button repeats the sequence; Return to desk slides the book back. The room's three-layer parallax centers while opening so scene objects and overlay share the same perspective.

The no-book desk is its own transparent source asset, with the original book rendered separately from its authored silhouette. Atlas frames register to their feet using dominant alpha bounds, preventing the body from floating as the lid moves. Chest opening still calls the existing secure, idempotent `open` RPC exactly once; collecting is visual acknowledgement of the already-saved item. A local, account/test-world-scoped reveal marker lets an interrupted reveal resume only for an item the current inventory owns. Refresh recovery never charges a second chest. Reduced-motion users get immediate placement/reveal and a short collection acknowledgement. The dev quarter-speed option also applies to the chest sequence.

Validation: 24 unit tests include continuous motion, XP conservation, chest drop/lid states and scene-to-HUD coordinates. Browser QA verified a chest decrement of one, a restored reveal after refresh, collection quantity of one, the book returning, and XP crossing from level 2 to level 3 with the correct remainder. The 13 database checks from V9 remain applicable; this revision does not change the database economy.


### V12: one drink slot, starter coffee
`coffee` (Cabin coffee) is a Common cosmetic, owned and equipped for new players, included in the Common chest pool and shop. `mug` (Sage tea set) moves into the same `drink` slot. Equipping/previewing tea replaces coffee at the right-back desktop location; switching to coffee replaces tea. Unequipping leaves an empty surface, with no baked mug or coaster and no steam. Both drink sprites render after the pet, so their alpha silhouettes and handle holes provide the correct depth. Steam emission follows the equipped sprite's actual fitted bounds.

`20261027171355_starter_drink_slot.sql` extends the catalog constraint, updates the tea slot, creates Common coffee, backfills one coffee for existing players while preserving an equipped tea set, and grants coffee once on new profile creation through a private SECURITY INVOKER trigger. Repeat syncs cannot regenerate a sold starter. The browser demo performs the same one-time upgrade, including separate dev saves. Current catalog: 8 pets + 21 cosmetics. Validation adds starter/swap/no-regeneration coverage, for 26 unit tests and 14 PostgreSQL checks.


### V13: collectible desk, decoration categories and chest chaining
Every loose desktop furnishing is now a normal collectible with two visual variations: articulated lamps, book stacks, desk plants, woven runners, journal/pen bundles, writing sets/trinket dishes, open study books and the existing drinks. The catalog has 43 items (8 pets, 35 cosmetics). The bare desk asset contains no removable props. Shared slot placements render the runner first, then the back-edge furnishings and books, then writing supplies, the pet and open study book, and finally the drink in front of the pet. Every desk item follows foreground parallax; room and wall items retain their own plane. Both open books slide aside for chest opening.

Collection and Shop have Desk / Walls / Room categories and a furnishing selector. Original furnishings are owned/equipped once for new and existing players to preserve the furnished cabin; alternatives remain normal earnable/purchasable items. `20261028065743_desk_collectibles.sql` expands allowed slots, adds catalog rows, backfills original furnishings and grants them through a private invoker trigger. Sold items do not regenerate. No additional public endpoint or database permission is introduced.

Dev mode automatically owns all 43 collectibles in `pixel-study-dev-v1`. Its equipment, purchases, sales and rewards remain separate from the regular browser save or Supabase profile. Leaving dev mode immediately restores the normal inventory and equipped scene. The next unopened chest automatically begins falling when a collected reward reaches Collection; it still requires an explicit tap to open, and no further chest is spent automatically. With no chests left, the empty state appears.

Validation: 30 unit tests and 15 embedded PostgreSQL checks, including two variants per desk slot, layer registration, category mapping, full dev inventory isolation, normal starter migration, server slot exclusivity and no regeneration after sale. Browser QA covers alternate furnishing swaps, clean removals, automatic chest chaining, and restoring the normal collection.

Chest interaction refinement: three deliberate taps are required for each chest. Taps one and two trigger a brief damped shake with an increasing chime; tap three calls the atomic open action and starts the hinged reveal. The counter resets for every automatically dropped chest. Navigation/reload may reset unspent tap progress; collected rewards retain their existing recovery behavior.

The chest now casts a soft alpha-derived shadow forward-left on the tabletop, with a short contact core under its feet. A masked warm screen pass lights its right-hand wood and brass, using the same flicker frequencies as the fireplace and retaining the original grain. Both lamp variants sit 50 world pixels lower, with the contact shadow aligned to the left-hand foot rather than the full sprite center.

Drink placement refinement: coffee and tea move back to a shared baseline of 439, leaving ten world pixels of wood before the open book begins at 449. Their pass follows the pet and precedes the open book, so the pages correctly occlude the drink if their silhouettes meet. Steam follows the same fitted sprite bounds.

### V15: shop delivery to Collection
Successful shop purchases lift their actual sprite from the clicked card and flow into the same magnetic path, dock pulse and two-tone bloop as chest collectibles. Preview purchases also deliver from their buy control. Delivery starts only after the existing atomic buy action succeeds; failed/insufficient-funds purchases never animate or add an item. The shop stays open, with mutations briefly locked during delivery. Reduced motion uses a short arrival indication; the saved reward-sound preference and dev quarter-speed apply. Refreshing during delivery retains the already-persisted purchase.

Chest refinements: shake frames accept further taps immediately, so three fast clicks open normally without a cooldown. On opening-to-reveal transition the render returns before sampling the new phase, giving the rise its own zero-based clock. Loot begins inside the chest mouth, grows/fades in as it rises and is clipped by the front lip until clear.


### V16: rarity presentation and small chest bonuses
Chest item names use their exact rarity color. Epic names gently breathe between darker and brighter purple; Legendary names shimmer with a warm gold glow. Reduced motion keeps a static rarity color/glow. Rewards now rise from the inner mouth with their own fresh animation clock and front-lip occlusion. Three taps may be entered as quickly as desired; no shake cooldown blocks input.

Each chest grants one item plus the following fixed bonus, derived from the securely rolled tier:

| Rarity | Coins | XP |
| --- | ---: | ---: |
| Common | 3 | 10 |
| Uncommon | 5 | 20 |
| Rare | 10 | 40 |
| Epic | 20 | 80 |
| Legendary | 50 | 200 |

`20261028073344_chest_rarity_bonuses.sql` updates the existing guarded dispatcher: item, coins, XP, chest debit and idempotency receipt commit atomically. The private bonus helper is not callable by players. No reward amount or tier is trusted from request payloads. The local demo mirrors it. Bonuses are safely credited on opening, while displayed counters wait until the item is collected, then the existing session reward flight sends individual coins to the purse and XP motes to the visible XP bar. Reveal recovery stores the visual bonus alongside the item, scoped to the current user/test world; it never grants currency again.

Dev mode includes a Next test chest rarity selector to demo Epic/Legendary presentation. Forced tiers are supported only by the isolated browser test save; normal local play and the production RPC ignore them. All prior production permissions, rarity chances, and active-focus restrictions remain in force.

Latest validation: 33 unit tests and 16 embedded PostgreSQL checks pass, including bonus values across every tier, server idempotency, ignored client reward forgeries, dev-only forced rarity, legacy reveal recovery, and visual bonus validation. Browser QA verifies fast three-tap opening, Legendary/Epic name animations, deferred bonus display, exact 50-coin/200-XP collection, and automatic next-chest reset.

### V17: scattered firework reward bursts
Reward tokens sample individual directions, travel distances, launch offsets, drag, downward arcs and spin speeds once per burst. Samples fill a broad irregular bloom with local spacing, rather than converging onto concentric rings. Each moving tail still blends continuously into the existing magnetic path and exact staggered counter arrivals. The spread scales down to fit smaller viewports, with reduced motion unchanged. Both study completion and chest bonus flights share this behavior.


### V18: independent effects, Legendary opening, compact scatter
Shop purchases and collected chest items create independent delivery records; coin/XP grants create independent reward flights. All effects use pointer-transparent canvases and persist across normal navigation. New purchases, opening the next chest, timer actions and navigation no longer wait for visual settlement. Only an actual economy request briefly sets its existing request-busy state. A shared pending-amount ledger derives displayed balances from the persisted profile minus each flight's remaining units and any uncollected reveal, so overlapping arrivals, new chest openings, and purchases cannot overwrite or double-count one another. Changing test worlds clears visual records without altering saved progression. Each effect captures its playback speed at launch.

Chest collection now acknowledges the reveal immediately, sends the item through the global delivery layer, and drops the next chest while coins/XP continue flying. Re-entering or refreshing cannot collect the visual bonus twice. Arrival pulses/chimes remain, without repeated purchase/chest completion toasts. Legendary lids open at 42% of the normal speed and their items rise over 1.5 seconds. The surrounding UI hides for the opening/rise and returns when the reward is fully revealed. Gold light fills a larger halo and a soft beam from the chest mouth, with more sparks; reduced motion still skips prolonged animation. The caption “Somewhere in the pines” and its subtitle are removed.

The random reward bloom is tightened to a 24–180px reach with smaller downward drift. Direction, reach, launch timing, drag and spin stay random, giving a compact irregular cloud instead of the previous wide firework or perfect rings. Validation adds three ledger regression tests for overlapping deliveries, concurrent spending/new chest bonuses, and nonnegative displayed balances (37 tests total).


### V19: merging, compact collection, and focused Study mode
Collection has a saved Detailed / Overview toggle. Overview fits more small cards on screen while retaining rarity, duplicate counts, equipped state, equip and sell actions. The Merge items workbench accepts five spare copies from one rarity (duplicates or different items), shows five ingredient slots, and requires review of the exact consumed copies. Common → Uncommon → Rare → Epic → Legendary; Legendary merges reroll within Legendary. Random outputs may already be owned. Equipped copies are reserved; unequip to use a last copy. No coins or XP are granted. The result can fly to Collection through the independent delivery layer.

`20261028083345_item_merging.sql` adds a private invoker helper and extends the existing guarded dispatcher. Validation derives rarity and ownership server-side, rejects duplicate rows, mixed tiers, incorrect totals and malformed quantities, and serializes consumption/output with the existing player lock and idempotency receipt. All five tiers, replay, rollback, equipped protection, ownership and active-focus restrictions are covered by actual PostgreSQL tests.

Study is centered in the navigation bar and opens the closeable timer panel. A running focus session replaces all product UI with a centered countdown on the cabin. Navigation/hotspots and Escape cannot reopen the controls; the full UI returns automatically when server-confirmed completion arrives. Timing continues to use persisted wall-clock sessions. Paused legacy sessions and breaks retain their existing controls. Session reward flights no longer show the “Time well spent / A little treasure, well earned” text overlay.

Validation: 42 unit tests, 21 embedded PostgreSQL checks, and browser checks for five-copy merge review/result/delivery, compact overview, timer close/reopen, a full one-minute focus-only session, Escape blocking, completion UI restoration, and reward flights without text overlays.

## Open this project in Cursor
The working project is stored in Sites' private source repository; it has not been pushed to GitHub. The source ZIP contains the complete tracked project, migrations, art, font/license files and environment example, with no installed dependencies, build output or private credentials.

1. Install Node.js 22.12+.
2. Unzip the source archive and open its `pixel-study` folder using Cursor → File → Open Folder.
3. In Cursor's terminal, run `npm ci` then `npm run dev`.
4. Open the local URL printed by Vite. Blank Supabase variables use the local demo; follow the backend section above to connect a dedicated Supabase project.

To put your copy on GitHub, create a private repository in your own account, initialize Git in the unzipped folder, commit the files and push to that repository. Keep `.env` files private; the included `.gitignore` excludes them. The Sites hosting identity in `.openai/hosting.json` is only relevant if continuing to publish to the existing Site.
