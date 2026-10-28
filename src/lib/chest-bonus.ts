import type {ChestBonus,Rarity} from './types';
export const chestBonuses:Record<Rarity,ChestBonus>={
  Common:{rarity:'Common',coins:3,xp:10},Uncommon:{rarity:'Uncommon',coins:5,xp:20},Rare:{rarity:'Rare',coins:10,xp:40},Epic:{rarity:'Epic',coins:20,xp:80},Legendary:{rarity:'Legendary',coins:50,xp:200},
};
export function readChestReveal(key:string):{item_id:string;bonus?:ChestBonus}|null{
  const saved=localStorage.getItem(key);if(!saved)return null;
  try{
    const data=JSON.parse(saved);
    if(typeof data.item_id!=='string')return null;
    const expected=chestBonuses[data.bonus?.rarity as Rarity];
    const valid=expected&&data.bonus.coins===expected.coins&&data.bonus.xp===expected.xp;
    return {item_id:data.item_id,bonus:valid?expected:undefined};
  }catch{return {item_id:saved};} // legacy item-only reveal
}
