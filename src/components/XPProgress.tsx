import { useEffect, useRef, useState } from 'react';
export default function XPProgress({xp,levelXp}:{xp:number;levelXp:number}) {
  const ref=useRef<HTMLDivElement>(null), previous=useRef(xp), timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [levelUp,setLevelUp]=useState(false);
  useEffect(()=>{
    const old=previous.current;
    previous.current=xp;
    if(xp<=old)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(Math.floor(xp/levelXp)>Math.floor(old/levelXp)) {
      clearTimeout(timer.current);setLevelUp(true);
      timer.current=setTimeout(()=>setLevelUp(false),reduced?100:400);
    }
    if(!reduced)ref.current?.animate([
      {filter:'brightness(1.9)',boxShadow:'0 0 15px #c5ec9488'},
      {filter:'brightness(1)',boxShadow:'0 0 0px #c5ec9400'},
    ],{duration:220,easing:'ease-out'});
  },[xp,levelXp]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <div ref={ref} className={`xp-progress${levelUp?' xp-level-up':''}`} role="progressbar"
    aria-label="Level experience" aria-valuemin={0} aria-valuemax={levelXp} aria-valuenow={xp%levelXp}>
    <span style={{width:levelUp?'100%':`${(xp%levelXp)/levelXp*100}%`}}/>
  </div>;
}
