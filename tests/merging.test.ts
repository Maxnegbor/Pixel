import {describe,it,expect} from 'vitest';
import {mergePlan,mergeTarget,mergeAvailable} from '../src/lib/merging';
import {catalog} from '../src/lib/catalog';
const inventory=[{item_id:'notes',quantity:5,equipped:false},{item_id:'coffee',quantity:4,equipped:true},{item_id:'mug',quantity:5,equipped:false}];
describe('five-item merges',()=>{
  it('accepts duplicates and mixed items from one rarity and upgrades exactly one tier',()=>{
    expect(mergePlan([{item_id:'notes',quantity:5}],inventory,catalog).target).toBe('Uncommon');
    expect(mergePlan([{item_id:'notes',quantity:2},{item_id:'coffee',quantity:3}],inventory,catalog).rarity).toBe('Common');
    expect(['Common','Uncommon','Rare','Epic','Legendary'].map(r=>mergeTarget(r as Parameters<typeof mergeTarget>[0]))).toEqual(['Uncommon','Rare','Epic','Legendary','Legendary']);
  });
  it('reserves the equipped copy and rejects insufficient ownership',()=>{
    expect(mergeAvailable(inventory[1])).toBe(3);
    expect(()=>mergePlan([{item_id:'coffee',quantity:5}],inventory,catalog)).toThrow('spare');
    expect(()=>mergePlan([{item_id:'ember',quantity:5}],inventory,catalog)).toThrow();
  });
  it('rejects mixed tiers, wrong totals, repeated IDs and malformed quantities',()=>{
    for(const input of [[],[{item_id:'notes',quantity:4}],[{item_id:'notes',quantity:3},{item_id:'mug',quantity:2}],[{item_id:'notes',quantity:3},{item_id:'notes',quantity:2}],[{item_id:'notes',quantity:5.1}],[{item_id:'notes',quantity:'5'}],null])expect(()=>mergePlan(input,inventory,catalog)).toThrow();
  });
});
