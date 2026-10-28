import type { Item } from "./types";
import { TextureFlame } from "./room-motion";
const collectibleFlames = new Map<string, TextureFlame>();

export interface Sprite {
  image: HTMLCanvasElement;
  width: number;
  height: number;
}
const sprites = new Map<string, Sprite>();
let loading: Promise<void> | null = null;
const pets = [
  "miso",
  "moss",
  "biscuit",
  "clover",
  "juniper",
  "nova",
  "luna",
  "ember",
];
const decor = [
  "fern",
  "pothos",
  "candle",
  "woven",
  "notes",
  "print",
  "monstera",
  "lantern",
  "mug",
  "mushrooms",
  "plaid",
  "moonprint",
  "bonsai",
  "crystal",
  "velvet",
  "stars",
  "aurora",
  "glowcap",
  "sunlamp",
  "celestial",
];
// Generated sheets are packed by visual row. Source regions include generous gutters;
// alpha bounds are measured once on load, rather than making padded sprites float.
const petRegions = [
  [0, 0, 0.268, 0.5],
  [0.268, 0, 0.222, 0.5],
  [0.49, 0, 0.26, 0.5],
  [0.75, 0, 0.25, 0.5],
  [0, 0.5, 0.29, 0.5],
  [0.29, 0.5, 0.21, 0.5],
  [0.5, 0.5, 0.23, 0.5],
  [0.73, 0.5, 0.27, 0.5],
];
async function loadSheet(url: string, ids: string[], regions: number[][]) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const ctx = source.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  for (let i = 0; i < ids.length; i++) {
    const [rx, ry, rw, rh] = regions[i];
    const x = Math.floor(rx * source.width),
      y = Math.floor(ry * source.height),
      w = Math.min(source.width - x, Math.floor(rw * source.width)),
      h = Math.min(source.height - y, Math.floor(rh * source.height));
    const pixels = ctx.getImageData(x, y, w, h).data;
    // Keep the dominant silhouette. Tiny neighboring atlas fragments must not
    // expand its bounds or turn into floating specks when the sprite is equipped.
    const seen = new Uint8Array(w * h),
      stack = new Int32Array(w * h);
    const parts:{count:number;left:number;right:number;upper:number;lower:number}[]=[];
    let minX = w,
      minY = h,
      maxX = -1,
      maxY = -1,
      largest = 0;
    for (let seed = 0; seed < w * h; seed++) {
      if (seen[seed] || pixels[seed * 4 + 3] <= 45) continue;
      let count = 0,
        top = 1,
        left = w,
        right = -1,
        upper = h,
        lower = -1;
      stack[0] = seed;
      seen[seed] = 1;
      while (top) {
        const index = stack[--top],
          px = index % w,
          py = Math.floor(index / w);
        count++;
        left = Math.min(left, px);
        right = Math.max(right, px);
        upper = Math.min(upper, py);
        lower = Math.max(lower, py);
        for (const next of [
          px > 0 ? index - 1 : -1,
          px < w - 1 ? index + 1 : -1,
          py > 0 ? index - w : -1,
          py < h - 1 ? index + w : -1,
        ]) {
          if (next >= 0 && !seen[next] && pixels[next * 4 + 3] > 45) {
            seen[next] = 1;
            stack[top++] = next;
          }
        }
      }
      parts.push({count,left,right,upper,lower});
      if (count > largest) {
        largest = count;
        minX = Math.max(0, left - 2);
        minY = Math.max(0, upper - 2);
        maxX = Math.min(w - 1, right + 2);
        maxY = Math.min(h - 1, lower + 2);
      }
    }
    if(['maplejournal','nightjournal','coppertools','greentools'].includes(ids[i])){
      const kept=parts.filter(p=>p.count>largest*.04);
      minX=Math.max(0,Math.min(...kept.map(p=>p.left))-2);minY=Math.max(0,Math.min(...kept.map(p=>p.upper))-2);
      maxX=Math.min(w-1,Math.max(...kept.map(p=>p.right))+2);maxY=Math.min(h-1,Math.max(...kept.map(p=>p.lower))+2);
    }
    if (maxX < minX) continue;
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out
      .getContext("2d")!
      .drawImage(
        source,
        x + minX,
        y + minY,
        out.width,
        out.height,
        0,
        0,
        out.width,
        out.height,
      );
    sprites.set(ids[i], { image: out, width: out.width, height: out.height });
  }
}
export function loadCollectibleArt() {
  if (!loading) {
    const rows = [0, 310 / 1122, 570 / 1122, 830 / 1122, 1];
    const columns = [0, 0.21, 0.418, 0.598, 0.798, 1];
    const regions = decor.map((_, i) => {
      const r = Math.floor(i / 5),
        c = i % 5;
      return [
        columns[c],
        rows[r],
        columns[c + 1] - columns[c],
        rows[r + 1] - rows[r],
      ];
    });
    const deskIds=['brasslight','greenlight','oldbooks','naturebooks','desk_pothos','desk_fern','cabinrunner','mossrunner','maplejournal','nightjournal','coppertools','greentools'];
    loading = Promise.all([
      loadSheet('/art/desk-furnishings-v13.png',deskIds,deskIds.map((_,i)=>{const r=Math.floor(i/2),rows=[0,332/1536,555/1536,820/1536,1080/1536,1285/1536,1];return [i%2/2,rows[r],.5,rows[r+1]-rows[r]];})),
      loadSheet('/art/open-books-v13.png',['fieldguide','skyguide'],[[0,0,.5,1],[.5,0,.5,1]]),
      loadSheet("/art/pets-atlas-v4.png", pets, petRegions),
      loadSheet("/art/cabin-coffee-v12.png", ["coffee"], [[0,0,1,1]]),
      loadSheet("/art/collectibles-atlas-v4.png", decor, regions),
    ])
      .then(() => {})
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}
export function getSprite(id: string) {
  return sprites.get(id);
}
export function drawItem(
  c: CanvasRenderingContext2D,
  item: Item,
  x: number,
  y: number,
  width: number,
  height: number,
  t = 0,
  scene = false,
) {
  const sprite = sprites.get(item.id);
  if (!sprite) return;
  const fit = Math.min(width / sprite.width, height / sprite.height);
  const w = scene && item.slot==='study_book' ? width : Math.round(sprite.width * fit),
    h = scene && item.slot==='study_book' ? height : Math.round(sprite.height * fit);
  const dx = Math.round(x + (width - w) / 2),
    dy = Math.round(y + height - h);
  const breath =
    scene && item.kind === "pet" ? 1 + Math.sin(t * 1.55) * 0.007 : 1;
  c.save();
  c.imageSmoothingEnabled = false;
  if (scene) {
    // Local ambient shading and contact shadow attach each object to its surface.
    c.fillStyle = ["study_book","desk_runner"].includes(item.slot)?"transparent":"rgba(22,12,6,.36)";
    c.beginPath();
    c.ellipse(
      dx + w * (item.slot==='desk_lamp'?.22:.51),
      dy + h - 1,
      w * (item.slot==='desk_lamp'?.23:.43),
      Math.max(1, h * (item.slot==='desk_lamp'?.012:.055)),
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
    c.filter = "brightness(0.79) saturate(0.86)";
  }
  let frame: HTMLCanvasElement = sprite.image;
  if (scene && ["candle", "lantern", "sunlamp"].includes(item.id)) {
    let flame = collectibleFlames.get(item.id);
    if (!flame) {
      const area =
        item.id === "candle"
          ? [0.33, 0.015, 0.38, 0.39]
          : [0.26, 0.37, 0.48, 0.37];
      flame = new TextureFlame(sprite.image, {
        x: Math.floor(sprite.width * area[0]),
        y: Math.floor(sprite.height * area[1]),
        w: Math.floor(sprite.width * area[2]),
        h: Math.floor(sprite.height * area[3]),
        seed: item.price / 17,
        strength: 2.1,
      });
      collectibleFlames.set(item.id, flame);
    }
    frame = flame.spriteFrame(t);
  }
  c.drawImage(frame, dx, dy + h - h * breath, w, h * breath);
  c.restore();
}
