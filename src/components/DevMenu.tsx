import { useState } from 'react';
export default function DevMenu({enabled,busy,rarity,onRarity,slow,onSlow,onToggle,onSimulate}:{enabled:boolean;busy:boolean;rarity:string;onRarity:(v:string)=>void;slow:boolean;onSlow:(v:boolean)=>void;onToggle:(enabled:boolean)=>void;onSimulate:(minutes:number,seconds:number)=>void}){
  const [open,setOpen]=useState(false),[minutes,setMinutes]=useState(25);
  return <div className="dev-tools">
    <button className={enabled?'dev-trigger testing':'dev-trigger'} aria-expanded={open} onClick={()=>setOpen(!open)}>✦ {enabled?'Dev mode · testing':'Dev mode'}</button>
    {open&&<section className="dev-menu" aria-label="Developer testing controls">
      <div className="panel-heading"><h3>Test your study rewards</h3><button aria-label="Close developer menu" onClick={()=>setOpen(false)}>×</button></div>
      <p>A separate test world. All collectibles are unlocked here. Your regular collection and study progress stay safe.</p>
      <label className="dev-enable"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>onToggle(e.target.checked)}/>Enable test mode</label>
      {enabled&&<>
        <label>Next test chest <select aria-label="Test chest rarity" value={rarity} disabled={busy} onChange={e=>onRarity(e.target.value)}>{['Random','Common','Uncommon','Rare','Epic','Legendary'].map(r=><option key={r}>{r}</option>)}</select></label>
        <label>Simulated focus duration <input aria-label="Simulated focus minutes" type="number" min="1" max="240" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/><span>minutes</span></label>
        <div className="dev-presets">{[1,5,10,25,50,90].map(m=><button key={m} className={m===minutes?'selected':''} onClick={()=>setMinutes(m)}>{m} min</button>)}</div>
        <label className="dev-enable"><input type="checkbox" checked={slow} disabled={busy} onChange={e=>onSlow(e.target.checked)}/>Slow animation (¼ speed)</label>
        <button className="primary" disabled={busy||!Number.isInteger(minutes)||minutes<1||minutes>240} onClick={()=>{onSimulate(minutes,3);setOpen(false);}}>Run final 3 seconds</button>
        <button disabled={busy||!Number.isInteger(minutes)||minutes<1||minutes>240} onClick={()=>{onSimulate(minutes,0);setOpen(false);}}>Complete instantly</button>
        <p className="tiny">Uses the normal completion → Get rewards flow at {minutes*2} coins and {Math.floor(minutes/10)} {Math.floor(minutes/10)===1?'box':'boxes'}, plus any carried minutes.</p>
      </>}
    </section>}
  </div>;
}
