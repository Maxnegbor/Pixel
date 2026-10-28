import {describe,it,expect,vi} from 'vitest';
import {chestBonuses,readChestReveal} from '../src/lib/chest-bonus';
describe('chest bonus progression and recovery',()=>{
  it('uses the requested small coin amounts and increasing XP for all tiers',()=>{
    expect(Object.values(chestBonuses).map(b=>b.coins)).toEqual([3,5,10,20,50]);
    expect(Object.values(chestBonuses).map(b=>b.xp)).toEqual([10,20,40,80,200]);
  });
  it('restores a visual reveal, supports old markers, and ignores forged bonus amounts',()=>{
    let value:string|null=JSON.stringify({item_id:'luna',bonus:chestBonuses.Epic});
    vi.stubGlobal('localStorage',{getItem:()=>value});
    expect(readChestReveal('reveal')).toEqual({item_id:'luna',bonus:chestBonuses.Epic});
    value='luna';expect(readChestReveal('reveal')).toEqual({item_id:'luna'});
    value=JSON.stringify({item_id:'luna',bonus:{rarity:'Epic',coins:99999,xp:99999}});
    expect(readChestReveal('reveal')?.bonus).toBeUndefined();
    value=null;expect(readChestReveal('reveal')).toBeNull();vi.unstubAllGlobals();
  });
});
