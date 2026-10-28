import {describe,it,expect} from 'vitest';
import {rewardTokens,rewardPosition} from '../src/lib/reward-effects';
describe('reward flight timing',()=>{
  it('uses one token and one arrival per earned coin or chest',()=>{
    const tokens=rewardTokens(5,1);
    expect(tokens.filter(t=>t.kind==='coin')).toHaveLength(5);
    expect(tokens.filter(t=>t.kind==='box')).toHaveLength(1);
    expect(tokens[0].flyAt).toBe(820);
    expect(tokens[5].flyAt).toBe(820);
    expect(tokens[1].flyAt-tokens[0].flyAt).toBe(85);
  });
  it('preserves all units for long sessions while bounding the animation duration',()=>{
    const tokens=rewardTokens(480,24);
    expect(tokens).toHaveLength(504);
    expect(Math.max(...tokens.map(t=>t.flyAt+t.duration))).toBeLessThan(2400);
    expect(rewardTokens(0,0)).toHaveLength(0);
  });
  it('keeps drifting until the magnetic pull takes over with no positional or velocity jump',()=>{
    const token=rewardTokens(5,1,0,()=>.5)[0], center={x:0,y:0}, end={x:500,y:-300};
    const at=(t:number)=>rewardPosition(t,token,center,end);
    const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
    expect(distance(at(100),at(200))).toBeGreaterThan(distance(at(600),at(700)));
    expect(distance(at(700),at(800))).toBeGreaterThan(.1);
    const before=at(token.flyAt-1),during=at(token.flyAt),after=at(token.flyAt+1);
    expect(Math.abs((during.x-before.x)-(after.x-during.x))).toBeLessThan(.001);
    expect(Math.abs((during.y-before.y)-(after.y-during.y))).toBeLessThan(.01);
    expect(at(token.flyAt+100).magnet).toBeGreaterThan(0);
    expect(at(token.flyAt+650).x).toBeCloseTo(end.x);
    expect(at(token.flyAt+650).y).toBeCloseTo(end.y);
  });

  it('scatters a stable firework in a compact cloud with different angles, distances, speeds and launch times',()=>{
    let seed=1643;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const tokens=rewardTokens(80,4,250,random);
    expect(Math.max(...tokens.map(t=>t.distance))-Math.min(...tokens.map(t=>t.distance))).toBeGreaterThan(120);
    expect(Math.max(...tokens.map(t=>t.distance))).toBeLessThanOrEqual(180);
    expect(Math.max(...tokens.map(t=>t.drag))-Math.min(...tokens.map(t=>t.drag))).toBeGreaterThan(180);
    expect(new Set(tokens.map(t=>Math.floor(t.angle/(Math.PI/2)))).size).toBe(4);
    expect(tokens.every(t=>t.launchAt>=0&&t.launchAt<95)).toBe(true);
    expect(new Set(tokens.map(t=>t.spinPeriod)).size).toBe(tokens.length);
    const token=tokens[0],a=rewardPosition(500,token,{x:500,y:400},{x:950,y:45});
    expect(rewardPosition(500,token,{x:500,y:400},{x:950,y:45})).toEqual(a);
    const smaller=rewardPosition(500,token,{x:500,y:400},{x:950,y:45},.5);
    expect(Math.hypot(smaller.x-500,smaller.y-400)).toBeCloseTo(Math.hypot(a.x-500,a.y-400)/2);
  });

  it('preserves exact XP through bounded motes alongside currency tokens',()=>{
    for(const xp of [1,10,250,2400,12345]){
      const tokens=rewardTokens(5,1,xp),motes=tokens.filter(t=>t.kind==='xp');
      expect(motes.length).toBeLessThanOrEqual(48);
      expect(motes.reduce((sum,t)=>sum+t.value,0)).toBe(xp);
      expect(tokens.filter(t=>t.kind==='coin').reduce((sum,t)=>sum+t.value,0)).toBe(5);
      expect(motes[0].flyAt).toBe(820);
    }
  });

});
