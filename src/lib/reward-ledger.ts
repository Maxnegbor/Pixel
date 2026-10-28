import type {Profile,ChestBonus} from './types';
export type RewardAmounts={coins:number;boxes:number;xp:number};
export function remainingAmounts(total:RewardAmounts,arrived:RewardAmounts):RewardAmounts{
  return {coins:Math.max(0,total.coins-arrived.coins),boxes:Math.max(0,total.boxes-arrived.boxes),xp:Math.max(0,total.xp-arrived.xp)};
}
// Server balances already contain every grant. Only still-travelling units and
// the one uncollected chest reveal are withheld from the displayed counters.
export function displayedBalances(profile:Pick<Profile,'coins'|'boxes'|'xp'>,pending:RewardAmounts[],hold:ChestBonus|null):RewardAmounts{
  const total=pending.reduce((a,p)=>({coins:a.coins+p.coins,boxes:a.boxes+p.boxes,xp:a.xp+p.xp}),{coins:hold?.coins||0,boxes:0,xp:hold?.xp||0});
  return remainingAmounts(profile,total);
}
