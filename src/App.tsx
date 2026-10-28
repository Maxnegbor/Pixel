import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { gameAction } from "./lib/api";
import type { Action, GameState, Item } from "./lib/types";
import { demoAction, DEV_SAVE_KEY, simulateSession } from "./lib/demo";
import { RewardSounds } from "./lib/reward-effects";
import RewardFlight, { COIN_ART, CHEST_ART, type Flight } from "./components/RewardFlight";
import CollectionDelivery, {type PurchaseDelivery} from "./components/CollectionDelivery";
import type {ChestBonus} from "./lib/types";
import {displayedBalances,remainingAmounts,type RewardAmounts} from "./lib/reward-ledger";
import type {DeliveryOrigin} from "./lib/collection-effects";
import ChestRitual from "./components/ChestRitual";
import XPProgress from "./components/XPProgress";
import RewardClaim from "./components/RewardClaim";
import DevMenu from "./components/DevMenu";
import { clock, remainingSeconds, localDay } from "./lib/timer";
import Cabin from "./components/Cabin";
import CabinIcon from "./components/CabinIcon";
import Timer from "./components/Timer";
import Sounds from "./components/Sounds";
import Auth from "./components/Auth";
import Stats from "./components/Stats";

import { Collection } from "./components/Collection";
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(!supabase),
    [game, setGame] = useState<GameState | null>(null),
    [tab, setTab] = useState("focus"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState<Item | null>(null),
    [now, setNow] = useState(Date.now()),
    [username, setUsername] = useState("");
  const [timerOpen,setTimerOpen]=useState(true);
  const focusLockedRef=useRef(false);
  const [zen, setZen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRarity,setTestRarity]=useState("Random");
  const [slowRewards, setSlowRewards] = useState(false);
  const testingRef = useRef(false);
  const [deliveries,setDeliveries]=useState<{id:number;delivery:PurchaseDelivery;rate:number}[]>([]);
  const buying=useRef(false),effectId=useRef(0);
  const effectRate=useRef(1);effectRate.current=testing && slowRewards ? .25 : 1;
  const [flights,setFlights]=useState<{id:number;flight:Flight;remaining:RewardAmounts;rate:number}[]>([]);
  const [chestHold,setChestHold]=useState<ChestBonus|null>(null);
  const chestHoldRef=useRef<ChestBonus|null>(null);
  const [cinematic,setCinematic]=useState(false);
  function addFlight(flight:Flight){
    const id=++effectId.current;
    setFlights(all=>[...all,{id,flight,remaining:{coins:flight.reward.coins,boxes:flight.reward.boxes,xp:flight.reward.xp},rate:effectRate.current}]);
  }
  const [dismissedReward, setDismissedReward] = useState("");
  const [rewardSound, setRewardSound] = useState(() => localStorage.getItem("pixel-reward-sound") !== "off");
  const rewardAudio = useRef(new RewardSounds());
  useEffect(() => {rewardAudio.current.enabled=rewardSound;localStorage.setItem("pixel-reward-sound",rewardSound?"on":"off");},[rewardSound]);
  useEffect(() => () => rewardAudio.current.close(),[]);
  const offset = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const lastStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") setGame(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const fetchAction = useCallback(
    (action: Action, payload: Record<string, unknown> = {}) => {
      const work = async () => {
        const start = Date.now();
        const g = testingRef.current ? demoAction(action, payload, DEV_SAVE_KEY) : await gameAction(action, payload);
        if (action === "claim" && g.result?.reward && !g.result.already_claimed) {
          const reward = g.result.reward;
          setNotice("");setTab("focus");setPreview(null);addFlight({reward,coins:0,boxes:0,xp:0});setZen(false);
        }
        if(action==='open' && g.result?.chest_bonus){
          chestHoldRef.current=g.result.chest_bonus;setChestHold(g.result.chest_bonus);
        }
        offset.current = Date.parse(g.server_now) - (start + Date.now()) / 2;
        const active = g.sessions.find(
          (s) => s.status === "running" || s.status === "paused",
        );
        if (
          lastStatus.current === "running" &&
          !active &&
          g.sessions[0]?.status === "completed"
        )
          setNotice(
            g.sessions[0].kind === "focus"
              ? ""
              : "Break complete. Ready when you are.",
          );
        lastStatus.current = active?.status;
        setGame({ ...g, result: action === "open" ? g.result : undefined });
        setUsername(g.profile.username);
        setNow(Date.now() + offset.current);
        return g;
      };
      const p = queue.current.catch(() => {}).then(work);
      queue.current = p;
      return p;
    },
    [],
  );
  const act = useCallback(
    async (a: Action, p: Record<string, unknown> = {}) => {
      setBusy(true);
      setError("");
      try {
        const result = await fetchAction(a, p);
        if (a === "sell")
          setNotice("Sold one item. Coins added to your purse.");
        return result;
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [fetchAction],
  );
  useEffect(() => {
    if (authReady && (!supabase || session)) void act("sync");
  }, [authReady, session?.user.id, act]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!game) return;
    const sync = () =>
      void fetchAction("sync").catch(() =>
        setError(
          "Connection interrupted. Your timer keeps running; reconnect to save rewards.",
        ),
      );
    const timer = setInterval(sync, 15000);
    const visible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", sync);
    };
  }, [!!game, fetchAction]);
  const active = game?.sessions.find(
    (s) => s.status === "running" || s.status === "paused",
  );
  const focusLocked=active?.kind==='focus'&&active.status==='running';
  focusLockedRef.current=focusLocked;
  const pending = game?.pending_rewards?.[0];
  const shown=game?displayedBalances(game.profile,flights.map(f=>f.remaining),chestHold):{coins:0,boxes:0,xp:0};
  const coinCount=shown.coins,xpCount=shown.xp,boxCount=shown.boxes;
  const completionSync = useRef("");
  useEffect(() => {
    if(active?.status === "running" && remainingSeconds(active,now)===0 && completionSync.current!==active.id){
      completionSync.current=active.id;
      void fetchAction("sync").catch(()=>{completionSync.current="";});
    }
  },[active,now,fetchAction]);
  async function toggleTesting(enabled:boolean) {
    if(busy || buying.current) return;
    setBusy(true);
    await queue.current.catch(()=>{});
    chestHoldRef.current=null;setChestHold(null);setFlights([]);setDeliveries([]);setCinematic(false);testingRef.current=enabled;setTesting(enabled);setNotice("");setError("");setDismissedReward("");setPreview(null);
    try {await fetchAction("sync");} catch(e){setError((e as Error).message);} finally{setBusy(false);}
  }
  async function testSession(minutes:number,seconds:number) {
    if(!testingRef.current || busy || buying.current) return;
    setBusy(true);
    await queue.current.catch(()=>{});
    try { setNotice("");simulateSession(minutes,seconds);setDismissedReward("");setTab("focus");await fetchAction("sync"); }
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function buyItem(item:Item,origin:DeliveryOrigin){
    if(buying.current || busy)return;
    buying.current=true;rewardAudio.current.unlock();setNotice('');
    try{
      const result=await act('buy',{item_id:item.id});
      if(result){setPreview(null);setZen(false);const id=++effectId.current;setDeliveries(all=>[...all,{id,delivery:{item,origin},rate:effectRate.current}]);}
    }finally{buying.current=false;}
  }
  function restoreChestBonus(bonus:ChestBonus){
    if(chestHoldRef.current)return;
    chestHoldRef.current=bonus;setChestHold(bonus);
  }
  function collectChestReward(item:Item,bonus:ChestBonus|undefined,origin:DeliveryOrigin,size:number){
    const id=++effectId.current;
    setDeliveries(all=>[...all,{id,delivery:{item,origin,size,lift:false},rate:effectRate.current}]);
    chestHoldRef.current=null;setChestHold(null);setNotice('');
    if(bonus)addFlight({source:'chest',coins:0,boxes:0,xp:0,reward:{session_id:'chest',minutes:0,coins:bonus.coins,xp:bonus.xp,boxes:0}});
  }
  function claimRewards() {
    if(!pending || busy)return;
    setZen(false);rewardAudio.current.unlock();void act("claim",{session_id:pending.session_id});
  }
  const equipped = useMemo(
    () =>
      game
        ? game.catalog.filter((i) =>
            game.inventory.some(
              (o) => o.item_id === i.id && o.equipped && o.quantity > 0,
            ),
          )
        : [],
    [game],
  );
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape" && !focusLockedRef.current) {
        setTimerOpen(false);
        setTab("focus");
        setPreview(null);
        setZen(false);
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  function navigate(t: string) {
    if(focusLockedRef.current)return;
    if(t==='focus')setTimerOpen(true);
    setZen(false);
    setTab(t);
    setPreview(null);
  }
  if (!authReady) return <div className="loading">Lighting the lamps…</div>;
  if (supabase && !session) return <Auth />;
  if (!game)
    return (
      <div className="loading">
        <span>✦</span>
        <h1>Pixel Study</h1>
        <p>{error || "Opening your cozy little cabin…"}</p>
        {error && <button onClick={() => void act("sync")}>Try again</button>}
      </div>
    );
  const p = game.profile;
  const level = Math.floor(xpCount / game.config.level_xp) + 1;
  const progress = xpCount % game.config.level_xp;
  const today = game.sessions
    .filter(
      (s) =>
        s.kind === "focus" && localDay(s.started_at) === localDay(new Date()),
    )
    .reduce((a, s) => a + s.credited_minutes, 0);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice(
        "Your browser doesn’t support fullscreen here. The cabin still fills your window.",
      );
    }
  }
  const panelTitles: Record<string, string> = {
    inventory: "Your collection",
    shop: "The cabin shop",
    boxes: "A little mystery",
    sounds: "Ambient sounds",
    stats: "Your focus journal",
    settings: "Your profile",
  };
  function dockButton(id:string,label:string){return <button key={id} aria-current={tab===id?'page':undefined} className={`${tab===id?'active':''} ${id==='focus'?'study-dock-button':''}`} onClick={()=>navigate(id)}><span data-collection-target={id==='inventory'?'true':undefined}><CabinIcon name={id}/></span><small>{label}</small>{id==='boxes'&&boxCount>0&&<i className="dock-count">{boxCount}</i>}</button>;}
  return (
    <div className={`app immersive ${zen ? "zen-mode" : ""} ${cinematic?"legendary-opening":""} ${focusLocked?"focus-locked":""} ${tab === "boxes" ? "chest-mode" : ""} ${flights.some(f=>f.flight.source==='chest')?"chest-bonus-flight":""} panel-${tab}`}>
      <Cabin ritual={tab === "boxes"} equipped={equipped} preview={preview} onInteract={navigate} />
      <div className="scene-shade" aria-hidden="true" />
      <header className="cabin-hud">
        <a
          className="cabin-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("focus");
          }}
        >
          <span>✦</span>
          <div>
            pixel study<small>YOUR QUIET LITTLE CORNER</small>
          </div>
        </a>
        <DevMenu rarity={testRarity} onRarity={setTestRarity} slow={slowRewards} onSlow={setSlowRewards} enabled={testing} busy={busy} onToggle={v=>void toggleTesting(v)} onSimulate={(m,t)=>void testSession(m,t)}/>
        <div className="hud-actions">
          <span className="hud-coins" aria-label={`${coinCount} coins`}>
            <img src={COIN_ART} alt=""/><b key={coinCount}>{coinCount}</b>
          </span>
          <button
            className="hud-boxes"
            aria-label={`Mystery boxes, ${boxCount} available`}
            onClick={() => navigate("boxes")}
          >
            <img src={CHEST_ART} alt=""/><b key={boxCount}>{boxCount}</b>
          </button>
          <button
            className="hud-avatar"
            aria-label="Profile settings"
            onClick={() => navigate("settings")}
          >
            {p.username.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>
      <div className="view-controls">
        <button
          onClick={() => setZen(!zen)}
          aria-label={zen ? "Show controls" : "Hide controls"}
          title={zen ? "Show controls" : "Hide controls"}
        >
          {zen ? "◉" : "◌"}
          <span>{zen ? "Show controls" : "Just the cabin"}</span>
        </button>
        <button
          onClick={() => void fullscreen()}
          aria-label="Toggle fullscreen"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
      <main className="immersive-main" aria-label="Your study cabin">
        <aside className="focus-overlay" hidden={!timerOpen||focusLocked} aria-label="Focus timer">
          <button className="timer-close" aria-label="Close timer" onClick={()=>setTimerOpen(false)}>×</button>
          <Timer game={game} now={now} act={act} busy={busy} onRewards={()=>setDismissedReward("")} />
          <div className="focus-footnote">
            <i className="live-dot" />
            {active?.status === "running"
              ? "One page. One moment. One little step."
              : "The world can wait a little."}
          </div>
        </aside>
        <section className="progress-hud" aria-label="Your progress">
          <div className="progress-identity">
            <span className="level-medallion">{level}</span>
            <div>
              <p className="eyebrow">
                LEVEL {level} · {p.username}
              </p>
              <h3>
                {level < 5
                  ? "Quiet beginner"
                  : level < 15
                    ? "Cabin regular"
                    : "Forest scholar"}
              </h3>
            </div>
          </div>
          <XPProgress xp={xpCount} levelXp={game.config.level_xp}/>
          <div className="progress-numbers">
            <span>
              {progress} / {game.config.level_xp} XP
            </span>
            <span>{today} min today</span>
          </div>
        </section>
        <div
          className="floating-panel"
          hidden={tab === "focus" || tab === "boxes"}
          role="region"
          aria-label={panelTitles[tab] || "Cabin panel"}
        >
          <div className="floating-panel-top">
            <span>✦ {panelTitles[tab]}</span>
            <button aria-label="Close panel" onClick={() => navigate("focus")}>
              ×
            </button>
          </div>
          <div className="panel-scroll">
            {tab === "inventory" && (
              <Collection
                game={game}
                act={act}
                onCollect={(item,origin)=>{rewardAudio.current.unlock();const id=++effectId.current;setDeliveries(all=>[...all,{id,delivery:{item,origin},rate:effectRate.current}]);}}
                onBuy={(item,origin)=>void buyItem(item,origin)}
                busy={busy}
                setPreview={setPreview}
              />
            )}
            {tab === "shop" && (
              <Collection
                game={game}
                act={act}
                onCollect={(item,origin)=>{rewardAudio.current.unlock();const id=++effectId.current;setDeliveries(all=>[...all,{id,delivery:{item,origin},rate:effectRate.current}]);}}
                onBuy={(item,origin)=>void buyItem(item,origin)}
                busy={busy}
                setPreview={setPreview}
                shop
              />
            )}

            {tab === "stats" && <Stats game={game} />}
            <div hidden={tab !== "sounds"}>
              <Sounds />
            </div>
            {tab === "settings" && (
              <section>
                <p className="eyebrow">MAKE YOURSELF AT HOME</p>
                <h2>Hello, {p.username}.</h2>
                <form
                  className="profile-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act("username", { username });
                  }}
                >
                  <label>
                    Username
                    <input
                      value={username}
                      minLength={3}
                      maxLength={24}
                      required
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Save username</button>
                </form>
                <p className="muted">
                  {supabase
                    ? "Connected · Your progress is saved to your account."
                    : "Local demo · Progress stays in this browser. Connect Supabase to enable accounts and secure cloud saves. Includes 120 demo coins and one welcome box."}
                </p>
                <p className="tiny">
                  Lifetime focus: {(p.focus_minutes / 60).toFixed(1)} hours ·{" "}
                  {p.xp} XP earned
                </p>
                {supabase && (
                  <button onClick={() => void supabase?.auth.signOut()}>
                    Sign out
                  </button>
                )}
              </section>
            )}
          </div>
        </div>
        {preview && (
          <div className="scene-preview">
            <div>
              <span className="eyebrow">TRYING SOMETHING COZY</span>
              <p>{preview.name}</p>
            </div>
            <button onClick={() => setPreview(null)}>Cancel</button>
            <button
              className="primary"
              disabled={busy || p.coins < preview.price}
              onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();void buyItem(preview,{x:rect.x+rect.width/2,y:rect.y+rect.height/2});}}
            >
              Buy ◈ {preview.price}
            </button>
          </div>
        )}
      </main>
      {focusLocked&&<div className="focus-only-timer" role="timer" aria-label="Focus time remaining">{clock(remainingSeconds(active,now))}</div>}
      <nav className="cabin-dock" aria-label="Cabin navigation">
        <div className="dock-side dock-left">{[['inventory','Collection'],['shop','Shop']].map(([id,label])=>dockButton(id,label))}</div>
        {dockButton('focus','Study')}
        <div className="dock-side dock-right">{[['boxes','Mystery boxes'],['sounds','Sounds'],['stats','Journal']].map(([id,label])=>dockButton(id,label))}</div>
      </nav>
      {!supabase && (
        <button className="demo-tag" onClick={() => navigate("settings")}>
          ✧ Local demo <span>· saved on this device</span>
        </button>
      )}
      {zen && active && (
        <div className="zen-session">
          ◷ {active.kind === "focus" ? "Focus session" : "Break"}{" "}
          {active.status === "paused" ? "paused" : "in progress"} ·{" "}
          <button onClick={() => setZen(false)}>Show timer</button>
        </div>
      )}
      <ChestRitual playbackRate={testing && slowRewards ? .25 : 1} key={`${testing ? "dev" : session?.user.id || "local"}`} active={tab === "boxes"}
        game={game} busy={busy} sounds={rewardAudio.current} sound={rewardSound} onSound={setRewardSound}
        storageKey={`pixel-chest-reveal:${testing ? "dev" : session?.user.id || "local"}`}
        onCinematicChange={setCinematic} onBonusReady={restoreChestBonus} onCollectReward={collectChestReward}
        onClose={()=>navigate("focus")}
        onOpen={async()=>{const result=await act("open",testing && testRarity!=="Random"?{test_rarity:testRarity}:{});const item=result?.catalog.find(item=>item.id===result.result?.item_id);return item?{item,bonus:result?.result?.chest_bonus}:undefined;}} />
      {pending && active?.kind !== "focus" && dismissedReward !== pending.session_id && <RewardClaim
        key={pending.session_id} reward={pending} busy={busy} testing={testing} sound={rewardSound} onSound={setRewardSound}
        onClaim={claimRewards} onLater={()=>setDismissedReward(pending.session_id)} />}
      {deliveries.map(({id,delivery,rate})=><CollectionDelivery key={id} delivery={delivery} sounds={rewardAudio.current} playbackRate={rate}
        onDone={()=>setDeliveries(all=>all.filter(d=>d.id!==id))} />)}
      {flights.map(({id,flight,rate})=><RewardFlight key={id} playbackRate={rate} flight={flight} sounds={rewardAudio.current}
        onProgress={(coins,boxes,xp)=>setFlights(all=>all.map(f=>f.id===id?{...f,remaining:remainingAmounts(f.flight.reward,{coins,boxes,xp})}:f))}
        onDone={()=>setFlights(all=>all.filter(f=>f.id!==id))} />)}
      {testing && <div className="dev-world-label">TEST WORLD · progress is separate</div>}
      {error && (
        <div role="alert" className="toast error">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="toast">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
