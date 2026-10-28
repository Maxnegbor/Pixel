import type { Item, Slot } from './types';
export const starterDeskIds = ['brasslight','oldbooks','desk_pothos','cabinrunner','maplejournal','coppertools','fieldguide'];
export type DecorationCategory = 'desk' | 'walls' | 'room';
export const slotNames: Record<Slot,string> = {pet:'Companion',plant:'Room plants',lamp:'Room lights',rug:'Room rugs',wall:'Wall art',desk:'Side-table keepsakes',drink:'Drinks',desk_lamp:'Desk lamps',books:'Book stacks',desk_plant:'Desk plants',desk_runner:'Desk runners',journal:'Journals & pens',stationery:'Writing sets',study_book:'Open study books'};
export function decorationCategory(item:Item):DecorationCategory {
  return item.slot==='wall'?'walls':['plant','lamp','rug','desk'].includes(item.slot)?'room':'desk';
}
export const furnishingPositions:Record<Slot,{x:number;y:number;w:number;h:number;depth:number;plane:'room'|'desk'}>={
  wall:{x:1015,y:144,w:40,h:49,depth:10,plane:'room'},
  plant:{x:920,y:351,w:52,h:48,depth:20,plane:'room'},
  lamp:{x:974,y:352,w:31,h:45,depth:20,plane:'room'},
  rug:{x:936,y:497,w:104,h:44,depth:5,plane:'room'},
  desk:{x:927,y:467,w:57,h:43,depth:50,plane:'desk'},
  desk_runner:{x:0,y:422,w:430,h:298,depth:0,plane:'desk'},
  desk_lamp:{x:180,y:139,w:320,h:321,depth:10,plane:'desk'},
  stationery:{x:134,y:349,w:120,h:134,depth:25,plane:'desk'},
  desk_plant:{x:390,y:270,w:308,h:176,depth:20,plane:'desk'},
  books:{x:255,y:355,w:262,h:134,depth:30,plane:'desk'},
  journal:{x:173,y:456,w:309,h:126,depth:40,plane:'desk'},
  pet:{x:866,y:379,w:142,h:90,depth:50,plane:'desk'},
  study_book:{x:439,y:449,w:495,h:165,depth:60,plane:'desk'},
  drink:{x:780,y:345,w:110,h:94,depth:55,plane:'desk'},
};
