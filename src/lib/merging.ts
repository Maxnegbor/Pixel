import type {Item,Owned,Rarity} from './types';
export type MergeInput={item_id:string;quantity:number};
export const rarityOrder:Rarity[]=['Common','Uncommon','Rare','Epic','Legendary'];
export function mergeTarget(rarity:Rarity):Rarity{return rarityOrder[Math.min(4,rarityOrder.indexOf(rarity)+1)];}
export function mergeAvailable(owned:Owned|undefined){return Math.max(0,(owned?.quantity||0)-(owned?.equipped?1:0));}
export function mergePlan(input:unknown,inventory:Owned[],catalog:Item[]){
  if(!Array.isArray(input)||input.length<1||input.length>5)throw Error('Select exactly five copies from one rarity.');
  const seen=new Set<string>();let total=0;let rarity:Rarity|undefined;
  const items:MergeInput[]=input.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.item_id!=='string'||!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>5||seen.has(row.item_id))throw Error('Invalid merge selection.');
    seen.add(row.item_id);total+=row.quantity;
    const item=catalog.find(i=>i.id===row.item_id),owned=inventory.find(o=>o.item_id===row.item_id);
    if(!item||mergeAvailable(owned)<row.quantity)throw Error('Not enough spare copies. Unequip your last copy to merge it.');
    if(rarity&&rarity!==item.rarity)throw Error('All five items must have the same rarity.');
    rarity=item.rarity;return {item_id:row.item_id,quantity:row.quantity};
  });
  if(total!==5||!rarity)throw Error('Select exactly five copies from one rarity.');
  return {items,rarity,target:mergeTarget(rarity)};
}
