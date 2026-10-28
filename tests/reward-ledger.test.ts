import {describe,it,expect} from 'vitest';
import {displayedBalances,remainingAmounts} from '../src/lib/reward-ledger';
describe('independent reward flight accounting',()=>{
  it('adds arrivals from overlapping flights independently, in either order',()=>{
    const profile={coins:158,boxes:4,xp:340};
    let a={coins:50,boxes:2,xp:200},b={coins:5,boxes:0,xp:20};
    const hold={rarity:'Common' as const,coins:3,xp:10};
    expect(displayedBalances(profile,[a,b],hold)).toEqual({coins:100,boxes:2,xp:110});
    a=remainingAmounts(a,{coins:10,boxes:1,xp:40});
    b=remainingAmounts(b,{coins:2,boxes:0,xp:10});
    expect(displayedBalances(profile,[a,b],hold)).toEqual({coins:112,boxes:3,xp:160});
    expect(displayedBalances(profile,[b,a],hold)).toEqual({coins:112,boxes:3,xp:160});
    expect(displayedBalances(profile,[],null)).toEqual(profile);
  });
  it('rebases purchases and a newly opened chest while previous currency is still in flight',()=>{
    const oldFlight={coins:20,boxes:0,xp:80};
    expect(displayedBalances({coins:150,boxes:3,xp:580},[oldFlight],null).coins).toBe(130);
    // Spend 40, then open a Common chest (+3/+10) without waiting for the old flight.
    const profile={coins:113,boxes:2,xp:590};
    const hold={rarity:'Common' as const,coins:3,xp:10};
    expect(displayedBalances(profile,[oldFlight],hold)).toEqual({coins:90,boxes:2,xp:500});
    // Collect the new reveal: transfer its withheld units to another independent flight.
    expect(displayedBalances(profile,[oldFlight,{coins:3,boxes:0,xp:10}],null)).toEqual({coins:90,boxes:2,xp:500});
    expect(displayedBalances(profile,[],null)).toEqual(profile);
  });
  it('never shows negative balances when already-credited coins are spent before arriving',()=>{
    expect(displayedBalances({coins:0,boxes:0,xp:20},[{coins:50,boxes:0,xp:10}],null)).toEqual({coins:0,boxes:0,xp:10});
  });
});
