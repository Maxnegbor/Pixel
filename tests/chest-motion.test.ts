import {describe,it,expect} from 'vitest';
import {chestDrop,lidFrame,collectionPosition,screenToWorld} from '../src/lib/chest-motion';
describe('in-room chest ritual',()=>{
  it('drops after the book has started moving, then lands with a bounded bounce',()=>{
    expect(chestDrop(0)).toBe(-760);
    expect(chestDrop(420)).toBe(-760);
    expect(chestDrop(800)).toBeGreaterThan(-760);
    expect(chestDrop(1040)).toBeCloseTo(0);
    expect(chestDrop(1140)).toBeLessThan(0);
    expect(Math.abs(chestDrop(1700))).toBeLessThan(1);
  });
  it('opens the hinged lid progressively and carries a reward exactly into the collection target',()=>{
    expect(lidFrame(0)).toBe(0);expect(lidFrame(500)).toBe(1);expect(lidFrame(1000)).toBe(5);
    const start={x:650,y:330},end={x:500,y:670};
    expect(collectionPosition(0,start,end)).toMatchObject(start);
    expect(collectionPosition(1,start,end)).toMatchObject({...end,size:25});
    expect(collectionPosition(.8,start,end).x).toBeLessThan(start.x);
  });
  it('maps the collection HUD into the same cover-and-overscan world as the room',()=>{
    for(const [w,h] of [[1280,720],[1363,936],[390,844]]){
      expect(screenToWorld(w/2,h/2,w,h)).toEqual({x:640,y:360});
    }
  });
});
