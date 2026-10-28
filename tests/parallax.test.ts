import { describe, expect, it } from "vitest";
import { easePointer, layerOffset, pointerPosition, SCENE_SCALE, SCENE_WIDTH, SCENE_HEIGHT } from "../src/lib/parallax";

describe("three-layer camera", () => {
  it("keeps the forest fixed and gives the desk three times the room movement", () => {
    for (const point of [{x:-1,y:-1},{x:1,y:1},{x:.3,y:-.6}]) {
      expect(layerOffset(point,"background")).toEqual({x:0,y:0});
      const room = layerOffset(point,"room"), desk = layerOffset(point,"desk");
      expect(desk.x).toBeCloseTo(room.x * 3);
      expect(desk.y).toBeCloseTo(room.y * 3);
      expect(layerOffset(point,"desk",true)).toEqual({x:0,y:0});
    }
  });
  it("clamps screen coordinates and provides enough overscan at every extreme", () => {
    expect(pointerPosition(2000,-30,1000,700)).toEqual({x:1,y:-1});
    expect(pointerPosition(500,350,1000,700)).toEqual({x:0,y:0});
    const extreme = layerOffset({x:1,y:1},"desk");
    expect((SCENE_SCALE-1)*SCENE_WIDTH/2).toBeGreaterThan(Math.abs(extreme.x));
    expect((SCENE_SCALE-1)*SCENE_HEIGHT/2).toBeGreaterThan(Math.abs(extreme.y));
  });
  it("eases without overshoot and with the same response at 30 and 60 fps", () => {
    const target = {x:1,y:-1};
    let slow = {x:0,y:0}, fast = {x:0,y:0};
    for (let i=0;i<30;i++) slow = easePointer(slow,target,1/30);
    for (let i=0;i<60;i++) fast = easePointer(fast,target,1/60);
    expect(slow.x).toBeCloseTo(fast.x,8);
    expect(slow.y).toBeCloseTo(fast.y,8);
    expect(slow.x).toBeLessThan(1);
    expect(slow.x).toBeGreaterThan(.99);
    const returned = easePointer(slow,{x:0,y:0},1/60);
    expect(returned.x).toBeLessThan(slow.x);
  });
});
