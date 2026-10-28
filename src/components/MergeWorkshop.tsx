import {useEffect,useRef,useState} from 'react';
import ItemArt from './ItemArt';
import {mergeAvailable,mergePlan,mergeTarget,rarityOrder} from '../lib/merging';
import type {Action,GameState,Item,Rarity} from '../lib/types';
import type {DeliveryOrigin} from '../lib/collection-effects';
const colors:Record<Rarity,string>={Common:'#d3c8a7',Uncommon:'#b1d28e',Rare:'#8dcadf',Epic:'#d4a8ed',Legendary:'#ffd575'};
export default function MergeWorkshop({game,busy,act,onClose,onCollect}:{game:GameState;busy:boolean;act:(a:Action,p?:Record<string,unknown>)=>Promise<GameState|undefined>;onClose:()=>void;onCollect:(item:Item,origin:DeliveryOrigin)=>void}){
  const [tier,setTier]=useState<Rarity>('Common'),[selected,setSelected]=useState<Record<string,number>>({}),[review,setReview]=useState(false),[won,setWon]=useState<Item|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),merging=useRef(false);
  const inputs=Object.entries(selected).filter(([,quantity])=>quantity>0).map(([item_id,quantity])=>({item_id,quantity}));
  const count=inputs.reduce((sum,i)=>sum+i.quantity,0),target=mergeTarget(tier);
  const focusing=game.sessions.some(s=>s.kind==='focus'&&['running','paused'].includes(s.status));
  const available=game.catalog.filter(i=>i.rarity===tier&&mergeAvailable(game.inventory.find(o=>o.item_id===i.id))>0);
  const slots=inputs.flatMap(row=>Array.from({length:row.quantity},()=>game.catalog.find(i=>i.id===row.item_id)!));
  let valid=false;try{mergePlan(inputs,game.inventory,game.catalog);valid=true;}catch{/* the counter stays incomplete until all five are valid */}
  useEffect(()=>{if(review&&!dialog.current?.open)dialog.current?.showModal();else if(!review)dialog.current?.close();},[review]);
  async function merge(){
    if(!valid||busy||merging.current||focusing)return;
    merging.current=true;
    try{const result=await act('merge',{items:inputs});const item=result?.catalog.find(i=>i.id===result.result?.item_id);if(item){setWon(item);setSelected({});setReview(false);}}finally{merging.current=false;}
  }
  return <section className="merge-workshop">
    <div className="panel-heading"><div><p className="eyebrow">FIVE KEEPSAKES, ONE NEW POSSIBILITY</p><h2>Merge your treasures</h2></div><button onClick={onClose}>Back to collection</button></div>
    <p className="muted">Trade five copies from one rarity for one random {tier==='Legendary'?'Legendary item':'item of the next rarity'}. Duplicates can be used together.</p>
    <div className="merge-controls"><label>Rarity <select aria-label="Merge rarity" value={tier} disabled={busy} onChange={e=>{setTier(e.target.value as Rarity);setSelected({});}}>{rarityOrder.map(r=><option key={r}>{r}</option>)}</select></label><span style={{color:colors[target]}}>{tier} → {target}</span><strong>{count} / 5 selected</strong></div>
    <div className="merge-slots" aria-label={`${count} of 5 merge ingredients selected`}>{Array.from({length:5},(_,i)=><div key={i}>{slots[i]?<ItemArt item={slots[i]} size={58}/>:<span>+</span>}</div>)}</div>
    <p className="tiny">Equipped copies are kept. Unequip an item to use its last copy. The result may be something you already own. Merging gives no coins or XP.</p>
    <button className="primary merge-review" disabled={!valid||busy||focusing} onClick={()=>setReview(true)}>Review merge · {count} / 5</button>
    {focusing&&<p>Merge after your focus session.</p>}
    {won&&<article className="merge-result" aria-label="Merge result"><p className="eyebrow">A NEW KEEPSAKE</p><ItemArt item={won} size={130}/><span style={{color:colors[won.rarity]}}>{won.rarity}</span><h3 style={{color:colors[won.rarity]}}>{won.name}</h3><button onClick={e=>{const rect=e.currentTarget.closest('article')!.querySelector('canvas')!.getBoundingClientRect();onCollect(won,{x:rect.x+rect.width/2,y:rect.y+rect.height/2});setWon(null);}}>Collect {won.name}</button></article>}
    <div className="merge-item-grid">{available.map(item=>{const owned=game.inventory.find(o=>o.item_id===item.id),qty=selected[item.id]||0,max=mergeAvailable(owned);return <article className={`merge-item ${qty?'chosen':''}`} key={item.id}><ItemArt item={item} size={65}/><div><h3>{item.name}</h3><small>{max} spare {max===1?'copy':'copies'}</small></div><div className="merge-quantity"><button aria-label={`Remove ${item.name} from merge`} disabled={!qty||busy} onClick={()=>setSelected(s=>({...s,[item.id]:Math.max(0,qty-1)}))}>−</button><b>{qty}</b><button aria-label={`Add ${item.name} to merge`} disabled={count>=5||qty>=max||busy} onClick={()=>setSelected(s=>({...s,[item.id]:qty+1}))}>+</button></div></article>;})}</div>
    {!available.length&&<p className="empty-state">No spare {tier.toLowerCase()} copies yet. Collect more treasures, or unequip an item to use it.</p>}
    <dialog className="merge-confirm" ref={dialog} onCancel={()=>setReview(false)} aria-label="Confirm item merge"><h2>Make something new?</h2><p>These five copies will be consumed:</p><ul>{inputs.map(row=><li key={row.item_id}>{row.quantity} × {game.catalog.find(i=>i.id===row.item_id)?.name}</li>)}</ul><p style={{color:colors[target]}}>You receive one random {target} item. Duplicates are possible.</p><div className="item-buttons"><button disabled={busy} onClick={()=>void merge()}>Merge 5 items</button><button disabled={busy} onClick={()=>setReview(false)}>Keep my items</button></div></dialog>
  </section>;
}
