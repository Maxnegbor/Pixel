import { useEffect, useRef } from 'react';
import { rewardPosition, rewardTokens, RewardSounds } from '../lib/reward-effects';
import type { RewardGrant } from '../lib/types';
export const COIN_ART = '/art/gold-coin-v9.png';
export const XP_ART = '/art/xp-mote-v10.png';
export const CHEST_ART = '/art/walnut-chest-v7.png';
export type Flight = { reward: RewardGrant; source?:"chest"; coins: number; boxes: number; xp: number };
export default function RewardFlight({flight,sounds,playbackRate=1,onProgress,onDone}:{
  flight:Flight;sounds:RewardSounds;playbackRate?:number;onProgress:(coins:number,boxes:number,xp:number)=>void;onDone:()=>void;
}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const callbacks=useRef({onProgress,onDone}); callbacks.current={onProgress,onDone};
  useEffect(()=>{
    const canvas=ref.current!, c=canvas.getContext('2d')!;
    const tokens=rewardTokens(flight.reward.coins,flight.reward.boxes,flight.reward.xp);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0, cancelled=false, start=0, coins=0, boxes=0, xp=0, completedAt=0;
    const coin=new Image(), chest=new Image(), mote=new Image();
    const load=(im:HTMLImageElement,src:string)=>new Promise<void>(resolve=>{ im.onload=()=>resolve();im.onerror=()=>resolve();im.src=src; });
    const target=(selector:string,fallX:number)=>{
      const rect=document.querySelector(selector)?.getBoundingClientRect();
      return rect && rect.width ? {x:rect.x+rect.width/2,y:rect.y+rect.height/2} : {x:innerWidth-fallX,y:48};
    };
    const render=(now:number)=>{
      if(cancelled) return;
      start ||= now;
      const elapsed=(now-start)*playbackRate;
      const dpr=Math.min(2,devicePixelRatio||1), w=innerWidth,h=innerHeight;
      const pixelWidth=Math.round(w*dpr),pixelHeight=Math.round(h*dpr);
      if(canvas.width!==pixelWidth || canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
      c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
      const coinTarget=target('.hud-coins',165),boxTarget=target('.hud-boxes',95),xpTarget=target('.xp-progress',innerWidth-150);
      let changed=false;
      for(const token of tokens){
        if(token.arrived)continue;
        const time=elapsed-token.flyAt;
        if(time>=token.duration || (reduced.matches && elapsed>500+token.index*Math.min(25,1500/Math.max(1,token.count)))){
          token.arrived=true;
          if(token.kind==='coin')coins+=token.value;else if(token.kind==='box')boxes+=token.value;else xp+=token.value;
          sounds.arrive(token.kind,token.index); changed=true; continue;
        }
        const end=token.kind==='coin'?coinTarget:token.kind==='box'?boxTarget:xpTarget;
        const {x,y,magnet}=rewardPosition(elapsed,token,{x:w/2,y:h/2},end,Math.min(1,w/1050,h/750));
        const baseSize=token.kind==='coin'?32:token.kind==='box'?75:25;
        const shrink=token.kind==='coin'?.35:token.kind==='box'?.56:.5;
        const size=baseSize*(1-magnet*shrink)*(elapsed<200?.5+elapsed/400:1);
        const im=token.kind==='coin'?coin:token.kind==='box'?chest:mote;
        if(elapsed>=token.launchAt && !reduced.matches && im.complete && im.naturalWidth){
          c.save();c.translate(x,y);
          const spin=token.kind==='coin'?Math.max(.28,Math.abs(Math.cos((elapsed-token.launchAt)/token.spinPeriod+token.spinPhase))):1;
          c.scale(spin,1);
          const spriteHeight=size*im.naturalHeight/im.naturalWidth;
          c.drawImage(im,-size/2,-spriteHeight/2,size,spriteHeight);
          if(token.kind==='coin' && (elapsed/100+token.index)%13<1){
            c.fillStyle='#fff3b7';c.fillRect(-3,-size*.29,6,2);c.fillRect(-1,-size*.29-2,2,6);
          }
          c.restore();
        }
      }
      if(changed)callbacks.current.onProgress(flight.coins+coins,flight.boxes+boxes,flight.xp+xp);
      if(tokens.every(t=>t.arrived)){
        if(!completedAt){completedAt=now;sounds.finish();}
        if(now-completedAt>500){callbacks.current.onDone();return;}
      }
      frame=requestAnimationFrame(render);
    };
    void Promise.all([load(coin,COIN_ART),load(chest,CHEST_ART),load(mote,XP_ART)]).then(()=>{
      if(!cancelled){sounds.burst();frame=requestAnimationFrame(render);}
    });
    return()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[flight,sounds,playbackRate]);
  return <div className="reward-flight" role="status" aria-label={flight.source==='chest'?"Collecting your chest rewards":"Collecting your session rewards"}>
    <canvas ref={ref} aria-hidden="true" />

  </div>;
}
