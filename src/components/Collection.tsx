import { useState } from "react";
import type { DeliveryOrigin } from "../lib/collection-effects";
import MergeWorkshop from "./MergeWorkshop";
import ItemArt from "./ItemArt";
import { decorationCategory, slotNames } from "../lib/decorations";
import { odds } from "../lib/catalog";
import type { Action, GameState, Item } from "../lib/types";
type Props = {
  onCollect:(item:Item,origin:DeliveryOrigin)=>void;
  onBuy:(item:Item,origin:DeliveryOrigin)=>void;
  game: GameState;
  busy: boolean;
  act: (a: Action, p?: Record<string, unknown>) => Promise<GameState | undefined>;
  setPreview: (i: Item | null) => void;
};
export function Collection({
  game,
  onBuy,
  onCollect,
  busy,
  act,
  setPreview,
  shop = false,
}: Props & { shop?: boolean }) {
  const [merging,setMerging]=useState(false);
  const [view,setView]=useState(()=>localStorage.getItem('pixel-collection-view')==='overview'?'overview':'detailed');
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [slot, setSlot] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [sellId, setSellId] = useState<string | null>(null);
  const list = game.catalog.filter(
    (i) =>
      (shop
        ? i.kind === "cosmetic"
        : game.inventory.some((o) => o.item_id === i.id && o.quantity > 0)) &&
      (filter === "all" || i.kind === filter) &&
      (rarity === "all" || i.rarity === rarity) &&
      (category === "all" || (i.kind==='cosmetic' && decorationCategory(i)===category)) &&
      (slot === 'all' || i.slot===slot),
  );
  if(merging&&!shop)return <MergeWorkshop game={game} busy={busy} act={act} onClose={()=>setMerging(false)} onCollect={onCollect}/>;
  return (
    <section className={`collection ${!shop&&view==='overview'?'is-overview':''}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            {shop ? "LITTLE THINGS, BIG COMFORT" : "FOUND ALONG THE WAY"}
          </p>
          <h2>{shop ? "The cabin shop" : "Your collection"}</h2>
        </div>
        <span className="gold">◈ {game.profile.coins} coins</span>
      </div>
      <p className="muted">
        {shop
          ? "Make this little corner feel a little more like you."
          : "Every companion and keepsake has a place here."}
      </p>
      {!shop&&<div className="collection-tools"><div className="segmented" aria-label="Collection view">{['detailed','overview'].map(v=><button key={v} aria-pressed={view===v} className={view===v?'selected':''} onClick={()=>{setView(v);localStorage.setItem('pixel-collection-view',v);}}>{v==='detailed'?'Detailed view':'Overview'}</button>)}</div><button onClick={()=>setMerging(true)}>Merge items</button></div>}
      <div className="filter-row">
        <div className="segmented">
          {(shop ? ["all"] : ["all", "pet", "cosmetic"]).map((f) => (
            <button
              className={filter === f ? "selected" : ""}
              onClick={() => {setFilter(f);setCategory("all");setSlot("all");}}
              key={f}
            >
              {f === "all"
                ? "All items"
                : f === "pet"
                  ? "Companions"
                  : "Decorations"}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by rarity"
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
        >
          <option value="all">All rarities</option>
          {Object.keys(odds).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      {(shop || filter !== 'pet') && <div className="decoration-filters" aria-label="Decoration categories">
        <div className="segmented">{['all','desk','walls','room'].map(c=><button key={c} className={category===c?'selected':''} onClick={()=>{setCategory(c);setSlot('all');if(c!=='all')setFilter('cosmetic');}}>{c==='all'?'Everywhere':c==='desk'?'Desk':c==='walls'?'Walls':'Room'}</button>)}</div>
        <select aria-label="Filter by furnishing" value={slot} onChange={e=>setSlot(e.target.value)}>
          <option value="all">All furnishings</option>
          {Object.entries(slotNames).filter(([s])=>s!=='pet' && game.catalog.some(i=>i.slot===s&&(category==='all'||decorationCategory(i)===category))).map(([s,name])=><option key={s} value={s}>{name}</option>)}
        </select>
      </div>}
      <div className={`item-grid ${!shop&&view==='overview'?'overview-grid':''}`}>
        {list.map((item) => {
          const o = game.inventory.find((x) => x.item_id === item.id);
          return (
            <article
              className={`item-card rarity-${item.rarity.toLowerCase()}`}
              key={item.id}
            >
              <div className="item-image">
                <ItemArt item={item} />
                {o?.equipped && (
                  <span className="equipped-mark">✓ Equipped</span>
                )}
                {!!o?.quantity && (
                  <span className="quantity">×{o.quantity}</span>
                )}
              </div>
              <span className="rarity-label">
                {item.rarity}{shop||view!=='overview'?` · ${slotNames[item.slot]}`:''}
              </span>
              <h3>{item.name}</h3>
              <p className="tiny item-value">
                {shop
                  ? `◈ ${item.price} coins`
                  : `Sell value: ◈ ${item.value} each`}
              </p>
              <div className="item-buttons">
                {shop ? (
                  <>
                    <button disabled={busy} onClick={() => setPreview(item)}>
                      Preview
                    </button>
                    <button
                      className="buy"
                      disabled={busy || game.profile.coins < item.price}
                      onClick={event => {
                        const rect=event.currentTarget.closest('article')?.querySelector('canvas')?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
                        onBuy(item,{x:rect.x+rect.width/2,y:rect.y+rect.height/2});
                      }}
                    >
                      Buy ◈ {item.price}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void act(o?.equipped ? "unequip" : "equip", {
                          item_id: item.id,
                        })
                      }
                    >
                      {o?.equipped ? "Unequip" : "Equip"}
                    </button>
                    <button
                      disabled={busy || (o?.equipped && o.quantity === 1)}
                      onClick={() => setSellId(item.id)}
                    >
                      Sell
                    </button>
                  </>
                )}
              </div>
              {sellId === item.id && (
                <div className="sell-confirm">
                  <p>Sell one for ◈ {item.value}?</p>
                  <button
                    disabled={busy}
                    onClick={() => {
                      void act("sell", { item_id: item.id });
                      setSellId(null);
                    }}
                  >
                    Sell one
                  </button>
                  <button onClick={() => setSellId(null)}>Keep</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!list.length && (
        <div className="empty-state">
          A little room for something wonderful.
          <p>Keep studying to find new treasures.</p>
        </div>
      )}
    </section>
  );
}
