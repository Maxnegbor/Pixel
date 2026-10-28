// Each coin/chest is one unit; exact XP totals travel in bounded experience motes.
export type RewardKind = 'coin' | 'box' | 'xp';
export type RewardToken = { kind: RewardKind; index: number; count: number; value: number; flyAt: number; duration: number; arrived: boolean; angle:number; distance:number; drag:number; gravity:number; stretch:number; launchAt:number; spinPeriod:number; spinPhase:number };
export function rewardTokens(coins: number, boxes: number, xp=0, random:()=>number=Math.random): RewardToken[] {
  const occupied:{x:number;y:number}[]=[];
  const motion=()=>{
    let angle=0,distance=0,stretch=1,point={x:0,y:0};
    // Sample the full bloom, with small local gaps instead of uniform rings.
    // Store the sample once: motion stays stable throughout the flight.
    for(let attempt=0;attempt<10;attempt++){
      angle=random()*Math.PI*2;distance=24+Math.pow(random(),.65)*156;stretch=.72+random()*.36;
      point={x:Math.cos(angle)*distance,y:Math.sin(angle)*distance*stretch};
      if(!occupied.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<20))break;
    }
    occupied.push(point);
    return {angle,distance,stretch,drag:190+random()*230,gravity:8+random()*24,
      launchAt:random()*95,spinPeriod:120+random()*160,spinPhase:random()*Math.PI*2};
  };
  return ([['coin', coins], ['box', boxes], ['xp', xp]] as const).flatMap(([kind,amount]) => {
    const total=Math.max(0,Math.floor(amount));
    // XP is carried by small experience motes, generally 10 XP each, bounded for long sessions.
    const count=kind==='xp'?Math.min(48,Math.ceil(total/10)):total;
    return Array.from({length:count},(_,index)=>({kind,index,count,
      value:Math.floor((index+1)*total/count)-Math.floor(index*total/count),
      flyAt: 820 + index * Math.min(85, 900 / Math.max(1,count-1)),
      duration: 650, arrived:false,...motion()}));
  });
}
export type RewardPoint = { x: number; y: number };
export function rewardPosition(elapsed:number, token:RewardToken, center:RewardPoint, target:RewardPoint, spread=1) {
  const age=Math.max(0,elapsed-token.launchAt);
  // Each spark has its own initial speed, reach, drag and gentle downward arc.
  // Exponential drag keeps a moving tail under the accelerating magnetic pull.
  const pop=1-Math.exp(-age/token.drag);
  const outward={
    x:center.x+Math.cos(token.angle)*token.distance*spread*pop,
    y:center.y+Math.sin(token.angle)*token.distance*token.stretch*spread*pop
      +token.gravity*spread*pop*pop,
  };
  const pull=Math.max(0,Math.min(1,(elapsed-token.flyAt)/token.duration));
  const magnet=pull**2.7;
  // Blend from the STILL MOVING outward trajectory. Zero initial pull velocity
  // makes the handoff continuous; the attraction then accelerates sharply.
  return {
    x:outward.x+(target.x-outward.x)*magnet,
    y:outward.y+(target.y-outward.y)*magnet-Math.sin(pull*Math.PI)*pull*45,
    magnet, pop,
  };
}
export class RewardSounds {
  private ctx: AudioContext | null = null;
  private last = 0;
  private lastXp = -1;
  enabled = true;
  // Called synchronously by the Get rewards click, never by timer completion.
  unlock() {
    if (!this.enabled) return;
    try { this.ctx ??= new AudioContext(); void this.ctx.resume().catch(()=>{}); } catch { /* visuals still work */ }
  }
  private tone(hz:number, when:number, length:number, gain=.06, type: OscillatorType='sine') {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const osc=this.ctx.createOscillator(), amp=this.ctx.createGain();
    osc.type=type; osc.frequency.setValueAtTime(hz,when);
    amp.gain.setValueAtTime(.0001,when);
    amp.gain.exponentialRampToValueAtTime(gain,when+.007);
    amp.gain.exponentialRampToValueAtTime(.0001,when+length);
    osc.connect(amp).connect(this.ctx.destination); osc.start(when); osc.stop(when+length+.01);
  }
  burst() {
    const t=this.ctx?.currentTime || 0;
    [392,523.25,659.25,783.99].forEach((n,i)=>this.tone(n,t+i*.045,.2,.045,'triangle'));
  }
  arrive(kind:RewardKind, index:number) {
    const t=this.ctx?.currentTime || 0;
    if(kind==='xp') {
      if(t-this.lastXp<.065)return;
      this.lastXp=t;
      const note=[523,659,784,1047][index%4];
      this.tone(note,t,.18,.025);this.tone(note*1.5,t+.025,.24,.012);return;
    }
    if(t-this.last<.045 && kind==='coin') return;
    this.last=t;
    const note=[784,880,988,1047,1175,1319,1397,1568][index%8];
    this.tone(kind==='box'?523:note,t,.13,.035,'triangle');
    this.tone(kind==='box'?1047:note*2,t+.012,.19,.018);
  }
  finish() {
    const t=this.ctx?.currentTime || 0;
    [523.25,659.25,783.99,1046.5].forEach((n,i)=>this.tone(n,t+i*.06,.4,.035));
  }
  close() { void this.ctx?.close().catch(()=>{}); this.ctx=null; }
}
