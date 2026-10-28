import { useEffect, useRef, useState } from 'react';
import { drawItem, loadCollectibleArt } from '../lib/art';
import { CHEST_CENTER, CHEST_FRAME_SIZE, chestDrop, lidFrame, registerChestFrames } from '../lib/chest-motion';
import { RewardSounds } from '../lib/reward-effects';
import { ChestLighting } from '../lib/chest-lighting';
import type {DeliveryOrigin} from '../lib/collection-effects';
import { readChestReveal } from '../lib/chest-bonus';
import { odds } from '../lib/catalog';
import type { GameState, Item, ChestBonus } from '../lib/types';
type Phase='dropping'|'knocking'|'ready'|'waiting'|'opening'|'revealing'|'revealed'|'collected';
const rarityColors:Record<string,string>={Common:'#d3c8a7',Uncommon:'#b1d28e',Rare:'#8dcadf',Epic:'#d4a8ed',Legendary:'#ffd575'};
export default function ChestRitual({active,game,busy,sounds,sound,onSound,onOpen,onClose,storageKey,onBonusReady,onCollectReward,onCinematicChange,playbackRate=1}:{
  playbackRate?:number;active:boolean;game:GameState;busy:boolean;sounds:RewardSounds;sound:boolean;onSound:(v:boolean)=>void;
  onCinematicChange:(active:boolean)=>void;
  onBonusReady:(bonus:ChestBonus)=>void;onCollectReward:(item:Item,bonus:ChestBonus|undefined,origin:DeliveryOrigin,size:number)=>void;
  onOpen:()=>Promise<{item:Item;bonus?:ChestBonus}|undefined>;onClose:()=>void;storageKey:string;
}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const saved=useRef(readChestReveal(storageKey));
  const restored=game.catalog.find(i=>i.id===saved.current?.item_id && game.inventory.some(o=>o.item_id===i.id&&o.quantity>0)) || null;
  const [taps,setTaps]=useState(0);
  const [won,setWon]=useState<Item|null>(restored),[phase,setPhase]=useState<Phase>(restored?'revealed':'dropping');
  const runtime=useRef({phase:phase as Phase,since:0,item:restored,landed:false,chain:false,taps:0,bonus:restored?saved.current?.bonus:undefined});
  const props=useRef({game,onOpen,onBonusReady,onCollectReward,onCinematicChange});props.current={game,onOpen,onBonusReady,onCollectReward,onCinematicChange};
  function transition(next:Phase){runtime.current.phase=next;runtime.current.since=performance.now();setPhase(next);props.current.onCinematicChange(runtime.current.item?.rarity==='Legendary'&&['opening','revealing'].includes(next));}
  useEffect(()=>{
    const reveal=readChestReveal(storageKey),id=reveal?.item_id;
    if(!id || runtime.current.item || !['dropping','ready','collected'].includes(runtime.current.phase))return;
    const item=game.catalog.find(i=>i.id===id && game.inventory.some(o=>o.item_id===id&&o.quantity>0));
    if(item){runtime.current.item=item;runtime.current.bonus=reveal?.bonus;setWon(item);if(reveal?.bonus)props.current.onBonusReady(reveal.bonus);transition('revealed');}
  },[game.inventory,game.catalog,storageKey,active]);
  useEffect(()=>{
    if(!active)return;
    if(runtime.current.item && runtime.current.bonus)props.current.onBonusReady(runtime.current.bonus);
    transition(runtime.current.item?'revealed':'dropping');runtime.current.landed=false;runtime.current.chain=false;runtime.current.taps=0;setTaps(0);
    const canvas=ref.current!,c=canvas.getContext('2d')!;
    const frames=new Image(),closed=new Image();
    let ready=false,frame=0,cancelled=false,registered:HTMLCanvasElement|null=null;
    let lighting:ChestLighting|null=null,lightTime=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const load=(im:HTMLImageElement,src:string)=>new Promise<void>(resolve=>{im.onload=()=>resolve();im.onerror=()=>resolve();im.src=src;});
    void Promise.all([load(frames,'/art/chest-opening-v11.png'),load(closed,'/art/walnut-chest-v7.png'),loadCollectibleArt().catch(()=>{})]).then(()=>{
      if(cancelled)return;
      if(frames.naturalWidth){registered=registerChestFrames(frames);lighting=new ChestLighting(registered);}
      if(runtime.current.phase==='dropping')runtime.current.since=performance.now();
      ready=true;
    });
    function chest(index:number,y:number,shake=0){
      const size=CHEST_FRAME_SIZE,x=CHEST_CENTER.x-size/2,top=CHEST_CENTER.y-size*450/512+y;
      c.save();c.translate(CHEST_CENTER.x,CHEST_CENTER.y+y);c.rotate(shake);c.translate(-CHEST_CENTER.x,-CHEST_CENTER.y-y);
      if(registered){
        const cw=registered.width/3,ch=registered.height/2;
        c.drawImage(registered,index%3*cw,Math.floor(index/3)*ch,cw,ch,x,top,size,size);
        lighting?.drawReflection(c,index,x,top,lightTime);
      }else if(closed.naturalWidth)c.drawImage(closed,x+25,top+65,size-50,(size-50)*closed.naturalHeight/closed.naturalWidth);
      c.restore();
    }
    const render=(now:number)=>{
      if(cancelled)return;
      frame=requestAnimationFrame(render);
      if(!ready || document.hidden)return;
      lightTime=reduced.matches?0:now/1000;
      const state=runtime.current, elapsed=(now-state.since)*playbackRate;
      c.clearRect(0,0,1280,720);c.imageSmoothingEnabled=false;
      const dropping=state.phase==='dropping',empty=props.current.game.profile.boxes<1&&!state.item;
      const y=dropping&&!reduced.matches?chestDrop(elapsed+(state.chain?420:0)):0;
      if(dropping && (elapsed>(state.chain?1030:1450) || reduced.matches))transition('ready');
      if(dropping && elapsed>=1040 && !state.landed){state.landed=true;/* landing remains quiet until a user click unlocks audio */}
      if(empty)return;
      const legendary=state.item?.rarity==='Legendary';
      const openingElapsed=legendary?elapsed*.42:elapsed;
      const opening=state.phase==='opening';
      const open=['revealing','revealed','collected'].includes(state.phase);
      const currentFrame=open?5:opening?(reduced.matches?5:lidFrame(openingElapsed)):0;
      const knocking=state.phase==='knocking';
      const shake=knocking?Math.sin(elapsed*.065)*(.026+state.taps*.006)*Math.exp(-elapsed/100):state.phase==='waiting'||(opening&&openingElapsed<280)?Math.sin(elapsed*.075)*.023*Math.exp(-elapsed/800):0;
      if(knocking&&(elapsed>300||reduced.matches))transition('ready');
      const glow=open?1:opening?Math.max(0,(openingElapsed-(legendary?120:360))/500):0;
      if(state.phase!=='collected'){
        lighting?.drawShadow(c,currentFrame,y,reduced.matches?0:shake);
        if(glow>0){
          const tint=state.item?rarityColors[state.item.rarity]:'#f9cf78';
          const radius=legendary?245:145;
          const gradient=c.createRadialGradient(650,470,5,650,470,radius);
          gradient.addColorStop(0,`${tint}${legendary?'ee':'b0'}`);gradient.addColorStop(.45,`${tint}${legendary?'66':'30'}`);gradient.addColorStop(1,`${tint}00`);
          c.globalAlpha=Math.min(1,glow)*(.88+Math.sin(now*.003)*.08);c.fillStyle=gradient;c.fillRect(650-radius,470-radius,radius*2,radius*2);c.globalAlpha=1;
          if(legendary){
            c.save();c.globalCompositeOperation='screen';
            const beam=c.createLinearGradient(0,470,0,190);beam.addColorStop(0,'#ffd57565');beam.addColorStop(1,'#ffd57500');
            c.fillStyle=beam;c.globalAlpha=Math.min(1,glow)*.75;
            c.beginPath();c.moveTo(607,480);c.lineTo(515,190);c.lineTo(785,190);c.lineTo(693,480);c.closePath();c.fill();c.restore();
          }
          if(!reduced.matches)for(let i=0;i<(legendary?28:14);i++){
            const p=(now/1900+i*.071)%1;
            c.fillStyle=tint;c.globalAlpha=(1-p)*.6*Math.min(1,glow);
            c.fillRect(650+Math.sin(i*5.1)*45*p,475-p*130,2,2);
          }
          c.globalAlpha=1;
        }
        chest(currentFrame,y,reduced.matches?0:shake);
      }
      if(opening && (openingElapsed>1040 || reduced.matches)){transition('revealing');return;}
      const rewardItem=state.item;
      if(rewardItem && ['revealing','revealed'].includes(state.phase)){
        const rise=state.phase==='revealing'?(reduced.matches?1:1-(1-Math.min(1,elapsed/(legendary?1500:780)))**3):1;
        let x=650,itemY=505-rise*235,size=54+rise*56;
        if(!reduced.matches && state.phase==='revealed')itemY+=Math.sin(now/750)*2;
        c.save();
        if(state.phase==='revealing'){
          // The inner mouth is the physical source. The front lip occludes
          // the lower sprite as it rises, rather than painting it over the box.
          c.globalAlpha=Math.min(1,rise*4);
          c.beginPath();c.rect(450,0,400,505);c.clip();
        }
        drawItem(c,rewardItem,x-size/2,itemY-size/2,size,size);c.restore();
        if(state.phase==='revealing' && (elapsed>(legendary?1520:800) || reduced.matches))transition('revealed');
      }
      canvas.dataset.phase=state.phase;
    };
    frame=requestAnimationFrame(render);
    return()=>{cancelled=true;cancelAnimationFrame(frame);props.current.onCinematicChange(false);};
  },[active,sounds,storageKey,playbackRate]);
  const focusing=game.sessions.some(s=>s.kind==='focus'&&(s.status==='running'||s.status==='paused'));
  async function open(){
    if(!['ready','knocking'].includes(runtime.current.phase)||busy||focusing||game.profile.boxes<1)return;
    sounds.unlock();runtime.current.taps=Math.min(3,runtime.current.taps+1);setTaps(runtime.current.taps);sounds.arrive('box',runtime.current.taps-1);
    if(runtime.current.taps<3){transition('knocking');return;}
    transition('waiting');
    const reward=await props.current.onOpen();
    if(!reward){runtime.current.taps=2;setTaps(2);transition('ready');return;}
    const {item,bonus}=reward;runtime.current.item=item;runtime.current.bonus=bonus;setWon(item);localStorage.setItem(storageKey,JSON.stringify({item_id:item.id,bonus}));sounds.burst();transition('opening');
  }
  function collect(){
    const state=runtime.current;
    if(state.phase!=='revealed'||!state.item)return;
    sounds.unlock();
    const rect=ref.current!.getBoundingClientRect();
    const item=state.item,bonus=state.bonus;
    const origin={x:rect.left+rect.width*650/1280,y:rect.top+rect.height*270/720};
    localStorage.removeItem(storageKey);
    state.item=null;state.bonus=undefined;state.landed=false;state.chain=true;state.taps=0;
    setWon(null);setTaps(0);transition(props.current.game.profile.boxes>0?'dropping':'collected');
    props.current.onCollectReward(item,bonus,origin,110*rect.width/1280);
  }
  if(!active)return null;
  const hasReward=won&&['revealing','revealed'].includes(phase);
  const opening=['waiting','opening','revealing'].includes(phase);
  return <section className="chest-ritual" aria-label="Open a chest in your cabin">
    <div className="ritual-world">
      <canvas ref={ref} width={1280} height={720} aria-hidden="true"/>
      <button className="ritual-chest-hit" aria-label="Open chest on the desk" disabled={!['ready','knocking'].includes(phase)||busy||focusing||game.profile.boxes<1} onClick={()=>void open()}/>
      {hasReward && <div className={`ritual-reward-name rarity-title-${won.rarity.toLowerCase()}`} style={{color:rarityColors[won.rarity]}} aria-live="polite"><span>{won.rarity}</span><h2>{won.name}</h2>{runtime.current.bonus&&<p className="chest-bonus-label">+{runtime.current.bonus.coins} coins · +{runtime.current.bonus.xp} XP</p>}</div>}
      {phase==='revealed'&&<button className="ritual-item-hit" aria-label={`Collect ${won?.name}`} onClick={collect}/>} 
      {phase==='revealed'&&<p className="ritual-collect-hint">Click your reward to collect</p>}
      {!hasReward && !opening && <div className="ritual-caption"><h2>{phase==='collected'?'A new keepsake, safely home.':game.profile.boxes?'A little mystery awaits.':'All your treasures are home.'}</h2>
        <p>{focusing?'Your chests will wait until after your focus session.':phase==='dropping'?'Making a little room…':['ready','knocking'].includes(phase)&&game.profile.boxes?`Tap the chest to open it · ${taps} / 3`:'Complete focus sessions to find more chests.'}</p>
      </div>}
    </div>
    <div className="ritual-topline"><span><b>{game.profile.boxes}</b> {game.profile.boxes===1?'chest':'chests'} left</span><button onClick={onClose}>Return to desk</button><label><input type="checkbox" checked={sound} onChange={e=>onSound(e.target.checked)}/>Sounds</label></div>
    <div className="ritual-odds" aria-label="Mystery chest rarity chances">{Object.entries(odds).map(([rarity,chance])=><span key={rarity} style={{color:rarityColors[rarity]}}>{rarity} {chance}%</span>)}</div>
  </section>;
}
