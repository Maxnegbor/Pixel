import { useEffect, useRef } from "react";
import type { Item } from "../lib/types";
import { drawItem, getSprite, loadCollectibleArt } from "../lib/art";
import { RoomMotion } from "../lib/room-motion";
import { furnishingPositions } from "../lib/decorations";
import { SCENE_SCALE, easePointer, layerOffset, pointerPosition, windowSilhouette } from "../lib/parallax";

// Coordinates are authored in the same 1280×720 world as the background.
// The canvas and artwork are cropped together with object-fit: cover.
const WIDTH = 1280,
  HEIGHT = 720;
export default function Cabin({
  equipped,
  ritual=false,
  preview,
  onInteract,
}: {
  equipped: Item[];
  ritual?: boolean;
  preview: Item | null;
  onInteract: (tab: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ritualRef = useRef(ritual);
  ritualRef.current = ritual;
  const items = useRef({ equipped, preview });
  useEffect(() => {
    items.current = { equipped, preview };
  }, [equipped, preview]);
  useEffect(() => {
    const canvas = ref.current!, output = canvas.getContext("2d")!;
    const makeCanvas = () => {
      const surface = document.createElement("canvas");
      surface.width = WIDTH; surface.height = HEIGHT;
      surface.getContext("2d")!.imageSmoothingEnabled = false;
      return surface;
    };
    const base = makeCanvas(), room = makeCanvas(), foreground = makeCanvas();
    const roomArt = makeCanvas(), forestArt = makeCanvas(), clearDesk = makeCanvas();
    let bookAmount = 0;
    let loaded = false, disposed = false, flatFallback = false;
    let motion: RoomMotion | null = null;
    let target = { x: 0, y: 0 }, camera = { x: 0, y: 0 };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const onPointer = (event: PointerEvent) => {
      if (ritualRef.current || event.pointerType !== "mouse" || reduced.matches || !finePointer.matches) return;
      target = pointerPosition(event.clientX, event.clientY, innerWidth, innerHeight);
    };
    const reset = () => { target = { x: 0, y: 0 }; };
    const preferences = () => { reset(); if (reduced.matches) camera = { x: 0, y: 0 }; };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    reduced.addEventListener("change", preferences);
    finePointer.addEventListener("change", preferences);
    const loadImage = (url: string, surface: HTMLCanvasElement) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => { surface.getContext("2d")!.drawImage(image, 0, 0, WIDTH, HEIGHT); resolve(); };
      image.onerror = reject; image.src = url;
    });
    void loadCollectibleArt().catch(() => {});
    // Real transparent foreground and cut-out interior, with fully painted hidden
    // scenery behind them. No rectangles slide across a flattened room image.
    void Promise.all([
      loadImage("/art/chalet-backplate-v8.png", roomArt),
      loadImage("/art/forest-backplate-v8.png", forestArt),
      loadImage("/art/desk-bare-v13.png", clearDesk),
    ]).then(() => {
      if (disposed) return;
      motion = new RoomMotion(roomArt);
      const rc = roomArt.getContext("2d")!;
      rc.save(); rc.globalCompositeOperation = "destination-out";
      rc.fill(windowSilhouette()); rc.restore();
      loaded = true;
    }).catch(() => {
      // A failed optional layer must not leave the study space blank.
      void loadImage("/art/forest-desk-v3-wide.png", base).then(() => {
        if (disposed) return;
        flatFallback = true;
        motion = null;
        forestArt.getContext("2d")!.clearRect(0, 0, WIDTH, HEIGHT);
        roomArt.getContext("2d")!.clearRect(0, 0, WIDTH, HEIGHT);
        roomArt.getContext("2d")!.drawImage(base, 0, 0);
        loaded = true;
      });
    });
    let frame = 0, last = -1000, previous = 0;
    const render = (ts: number) => {
      frame = requestAnimationFrame(render);
      if (document.hidden || !loaded) { previous = ts; return; }
      const dt = previous ? (ts - previous) / 1000 : 1 / 60;
      previous = ts;
      camera = reduced.matches ? { x: 0, y: 0 } : easePointer(camera, ritualRef.current ? {x:0,y:0} : target, dt);
      bookAmount = reduced.matches ? (ritualRef.current?1:0) : bookAmount+((ritualRef.current?1:0)-bookAmount)*(1-Math.exp(-Math.min(.1,dt)*8));
      const t = reduced.matches ? 0 : ts / 1000;
      if (ts - last >= (ritualRef.current || bookAmount>.001 ? 16 : 80)) {
        last = ts;
        const c = room.getContext("2d")!;
        c.clearRect(0, 0, WIDTH, HEIGHT);
        c.drawImage(roomArt, 0, 0);
        if (!reduced.matches && motion) {
          c.save(); c.clip(windowSilhouette());
          for (let i = 0; i < 145; i++) {
            const x = 365 + ((i * 47 + Math.floor(t * 7)) % 590),
              y = 96 + ((i * 83 + t * (75 + (i % 3) * 22)) % 301);
            c.fillStyle = i % 4 === 0 ? "#b3d8df63" : "#92b9ce30";
            c.fillRect(Math.floor(x), Math.floor(y), 1, 3 + (i % 5));
          }
          c.restore();
          motion.drawFire(c, t);
        }
        const fc = foreground.getContext("2d")!;
        fc.clearRect(0, 0, WIDTH, HEIGHT);
        // The bare desk has no baked furnishings. Collectibles are separate
        // registered surfaces, so swapping/unequipping leaves clean wood.
        fc.drawImage(clearDesk, 0, 0);
        const current = items.current;
        const visible = current.preview
          ? [
              ...current.equipped.filter((i) => i.slot !== current.preview!.slot),
              current.preview,
            ]
          : current.equipped;
        // Back-to-front render passes. The pet rests along the FAR desk edge.
        // Depth values represent surfaces, not the order in which items were equipped.
        const positions = furnishingPositions;
        const ordered = visible
          .map((item) => ({ item, placement: positions[item.slot] }))
          .filter((x) => x.placement)
          .sort((a, b) => a.placement.depth - b.placement.depth);
        for (const { item, placement: p } of ordered) {
          const petSize: Record<string, [number, number]> = {
            miso: [135, 83],
            moss: [52, 36],
            biscuit: [140, 86],
            clover: [89, 70],
            juniper: [140, 86],
            nova: [65, 78],
            luna: [60, 80],
            ember: [125, 82],
          };
          const size = item.kind === "pet" ? petSize[item.id] : undefined;
          const surface=p.plane==='desk'?fc:c;
          if(item.slot==='study_book'){
            if(bookAmount>=.999)continue;
            surface.save();surface.translate(685-bookAmount*220,530+bookAmount*340);surface.rotate(-bookAmount*.09);surface.translate(-685,-530);
          }
          drawItem(
            surface,
            item,
            size ? p.x + (p.w - size[0]) / 2 : p.x,
            size ? p.y + p.h - size[1] : p.y,
            size ? size[0] : p.w,
            size ? size[1] : p.h,
            t,
            true,
          );
          if(item.slot==='study_book')surface.restore();
        }
        // The equipped drink is its own foreground sprite. Its actual alpha
        // silhouette naturally occludes the pet, including the hollow handle.
        const drink=visible.find(item=>item.slot==='drink');
        const sprite=drink&&getSprite(drink.id);
        if(!reduced.matches&&drink&&sprite){
          const p=positions.drink,fit=Math.min(p.w/sprite.width,p.h/sprite.height);
          const w=sprite.width*fit,h=sprite.height*fit,dx=p.x+(p.w-w)/2,dy=p.y+p.h-h;
          const liquidX=dx+w*(drink.id==='coffee'?.43:.5);
          const liquidY=dy+h*(drink.id==='coffee'?.065:.16);
          motion?.drawSteam(fc,t,liquidX-28,liquidY-88);
        }

      }
      output.clearRect(0, 0, WIDTH, HEIGHT);
      const drawLayer = (surface: HTMLCanvasElement, layer: "background" | "room" | "desk") => {
        const offset = layerOffset(camera, layer, reduced.matches || flatFallback);
        output.save();
        output.imageSmoothingEnabled = false;
        output.translate(WIDTH / 2 + offset.x, HEIGHT / 2 + offset.y);
        output.scale(SCENE_SCALE, SCENE_SCALE);
        output.drawImage(surface, -WIDTH / 2, -HEIGHT / 2);
        output.restore();
      };
      drawLayer(forestArt, "background");
      drawLayer(room, "room");
      drawLayer(foreground, "desk");
      // Expose the actual rendered transforms for hit regions and diagnostics.
      const deskOffset = layerOffset(camera, "desk", reduced.matches || flatFallback);
      const roomOffset = layerOffset(camera, "room", reduced.matches || flatFallback);
      const wrap = canvas.parentElement!;
      wrap.style.setProperty("--desk-shift-x", `${deskOffset.x / WIDTH * 100}%`);
      wrap.style.setProperty("--desk-shift-y", `${deskOffset.y / HEIGHT * 100}%`);
      wrap.style.setProperty("--room-shift-x", `${roomOffset.x / WIDTH * 100}%`);
      wrap.style.setProperty("--room-shift-y", `${roomOffset.y / HEIGHT * 100}%`);
      canvas.dataset.deskOffset = `${deskOffset.x.toFixed(2)},${deskOffset.y.toFixed(2)}`;
      canvas.dataset.roomOffset = `${roomOffset.x.toFixed(2)},${roomOffset.y.toFixed(2)}`;
      canvas.dataset.backgroundOffset = "0,0";
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      disposed = true;
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      reduced.removeEventListener("change", preferences);
      finePointer.removeEventListener("change", preferences);
    };
  }, []);
  return (
    <div className="cabin-wrap">
      <canvas
        ref={ref}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="Detailed pixel-art cabin seen from your writing desk: an open book, warm lamp, fireplace, and a rainy pine forest and lake outside the window"
      />
      <div className="scene-hotspots">
        <button
          className="room-hotspot desk-hotspot"
          aria-label="Open focus timer"
          onClick={() => onInteract("focus")}
        >
          Study at your desk
        </button>
        <button
          className="room-hotspot fire-hotspot"
          aria-label="Open ambient sounds"
          onClick={() => onInteract("sounds")}
        >
          Adjust fireplace sounds
        </button>
        <button
          className="room-hotspot pet-hotspot"
          aria-label="Open pet collection"
          onClick={() => onInteract("inventory")}
        >
          Visit your companion
        </button>
      </div>
    </div>
  );
}
