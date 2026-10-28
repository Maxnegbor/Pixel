import {useEffect,useRef} from 'react';
import type {Item} from '../lib/types';
import {drawItem,loadCollectibleArt} from '../lib/art';
import {collectionPosition} from '../lib/chest-motion';
import {collectionArrival,type DeliveryOrigin} from '../lib/collection-effects';
import type {RewardSounds} from '../lib/reward-effects';
export type PurchaseDelivery={item:Item;origin:DeliveryOrigin;size?:number;lift?:boolean};
export default function CollectionDelivery({delivery,sounds,onDone,playbackRate=1}:{delivery:PurchaseDelivery;sounds:RewardSounds;onDone:()=>void;playbackRate?:number}){
  const ref=useRef<HTMLCanvasElement>(null),done=useRef(onDone);done.current=onDone;
  useEffect(()=>{
    const canvas=ref.current!,c=canvas.getContext('2d')!;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,cancelled=false,since=0;
    const finish=()=>{if(cancelled)return;cancelled=true;collectionArrival(sounds,reduced.matches);done.current();};
    const render=(now:number)=>{
      if(cancelled)return;
      frame=requestAnimationFrame(render);
      if(document.hidden){since=0;return;}
      if(!since)since=now;
      const elapsed=(now-since)*playbackRate;
      const dpr=Math.min(2,devicePixelRatio||1),width=innerWidth,height=innerHeight;
      if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
        canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      }
      c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.imageSmoothingEnabled=false;
      if(reduced.matches){if(elapsed>=120)finish();return;}
      const rect=document.querySelector('[data-collection-target]')?.getBoundingClientRect();
      const target=rect&&rect.width?{x:rect.x+rect.width/2,y:rect.y+rect.height/2}:{x:width/2,y:height-55};
      const origin={x:Math.max(45,Math.min(width-45,delivery.origin.x)),y:Math.max(45,Math.min(height-45,delivery.origin.y))};
      const lift=1-Math.exp(-elapsed/130);
      const floating={x:origin.x,y:origin.y-(delivery.lift===false?0:32)*lift};
      // Short, continuous lift flows into the exact same accelerating magnet curve as chest loot.
      const delay=delivery.lift===false?0:180;
      const p=Math.max(0,(elapsed-delay)/720),position=collectionPosition(p,floating,target);
      const size=position.size+((delivery.size||110)-110)*(1-Math.min(1,p)**2.5);
      c.save();c.shadowColor='#ffe1a366';c.shadowBlur=10*(1-Math.min(1,p));
      drawItem(c,delivery.item,position.x-size/2,position.y-size/2,size,size);c.restore();
      canvas.dataset.item=delivery.item.id;canvas.dataset.progress=Math.min(1,p).toFixed(3);
      if(elapsed>=delay+720)finish();
    };
    void loadCollectibleArt().catch(()=>{}).then(()=>{if(!cancelled)frame=requestAnimationFrame(render);});
    return()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[delivery,sounds,playbackRate]);
  return <div className="collection-delivery" role="status" aria-label={`Sending ${delivery.item.name} to your collection`}><canvas ref={ref} aria-hidden="true"/><span className="sr-only">{delivery.item.name} is on its way to your collection.</span></div>;
}
