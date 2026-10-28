import { useEffect, useRef } from 'react';
import type { RewardGrant } from '../lib/types';
import { COIN_ART, CHEST_ART, XP_ART } from './RewardFlight';
export default function RewardClaim({reward,busy,testing,sound,onSound,onClaim,onLater}:{reward:RewardGrant;busy:boolean;testing:boolean;sound:boolean;onSound:(v:boolean)=>void;onClaim:()=>void;onLater:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current!;d.showModal();return()=>d.close();},[]);
  return <dialog ref={ref} className="reward-claim" aria-labelledby="reward-title" onCancel={e=>{e.preventDefault();if(!busy)onLater();}}>
    <p className="eyebrow">{testing?'TEST SESSION COMPLETE':'FOCUS SESSION COMPLETE'}</p>
    <h2 id="reward-title">Time well spent.</h2>
    <p>{reward.minutes} focused {reward.minutes===1?'minute':'minutes'}. A little closer to your goals.</p>
    <div className="reward-bounty">
      <div><img src={XP_ART} alt="Experience mote"/><strong>+{reward.xp}</strong><small>experience</small></div>
      <div><img src={COIN_ART} alt="Gold coin"/><strong>+{reward.coins}</strong><small>coins</small></div>
      <div><img src={CHEST_ART} alt="Mystery chest"/><strong>+{reward.boxes}</strong><small>mystery {reward.boxes===1?'box':'boxes'}</small></div>
    </div>
    <button autoFocus className="primary get-rewards" disabled={busy} onClick={onClaim}>{busy?'Collecting…':'Get rewards'}</button>
    <div className="claim-options"><label><input type="checkbox" checked={sound} onChange={e=>onSound(e.target.checked)}/>Reward sounds</label><button disabled={busy} onClick={onLater}>Later</button></div>
    <p className="tiny">{testing?'Test rewards stay in your test world.':'Your rewards are saved until you collect them.'}</p>
  </dialog>;
}
