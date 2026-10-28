import {describe,it,expect} from 'vitest';
import {catalog} from '../src/lib/catalog';
import {decorationCategory,furnishingPositions,starterDeskIds} from '../src/lib/decorations';
describe('desk customization and depth',()=>{
  it('has two art variants in every desk furnishing slot and one original starter each',()=>{
    for(const slot of ['desk_lamp','books','desk_plant','desk_runner','journal','stationery','study_book','drink']){
      const items=catalog.filter(i=>i.slot===slot);
      expect(items).toHaveLength(2);
      expect(items.every(i=>decorationCategory(i)==='desk')).toBe(true);
      if(slot!=='drink')expect(items.filter(i=>starterDeskIds.includes(i.id))).toHaveLength(1);
    }
  });
  it('registers every item on a surface and orders the desk fabric beneath objects and pet behind drink',()=>{
    for(const item of catalog)expect(furnishingPositions[item.slot]).toBeDefined();
    expect(furnishingPositions.desk_runner.depth).toBeLessThan(furnishingPositions.books.depth);
    expect(furnishingPositions.pet.depth).toBeLessThan(furnishingPositions.drink.depth);
    expect(furnishingPositions.drink.depth).toBeLessThan(furnishingPositions.study_book.depth);
    expect(furnishingPositions.drink.y+furnishingPositions.drink.h).toBeLessThan(furnishingPositions.study_book.y);
    expect(furnishingPositions.drink.y+furnishingPositions.drink.h).toBeGreaterThan(414);
    expect(furnishingPositions.desk_lamp.y+furnishingPositions.desk_lamp.h).toBeGreaterThan(443);
    expect(decorationCategory(catalog.find(i=>i.id==='aurora')!)).toBe('walls');
    expect(decorationCategory(catalog.find(i=>i.id==='fern')!)).toBe('room');
  });
});
