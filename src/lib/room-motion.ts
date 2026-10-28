/** Pixel-space motion: source artwork is displaced inside authored fire masks.
 * Frames, candles, wicks, grate, logs and furniture retain their original pixels. */
export interface FlameRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  strength: number;
  protectGrate?: boolean;
}
export const ROOM_FLAMES: FlameRegion[] = [
  { x: 1080, y: 352, w: 84, h: 66, seed: 1, strength: 3, protectGrate: true },
  { x: 66, y: 339, w: 25, h: 24, seed: 2, strength: 1.15 },
  { x: 241, y: 157, w: 24, h: 20, seed: 3, strength: 1.05 },
  { x: 318, y: 110, w: 21, h: 23, seed: 4, strength: 1.15 },
  { x: 1043, y: 238, w: 25, h: 25, seed: 5, strength: 1.25 },
  { x: 1117, y: 217, w: 22, h: 25, seed: 6, strength: 1.3 },
  { x: 1248, y: 204, w: 24, h: 27, seed: 7, strength: 1.2 },
  { x: 1007, y: 300, w: 22, h: 26, seed: 8, strength: 1.2 },
  { x: 938, y: 371, w: 23, h: 25, seed: 9, strength: 1.1 },
];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export function flameOffset(
  x: number,
  y: number,
  width: number,
  height: number,
  time: number,
  seed: number,
  strength: number,
) {
  if (x <= 0 || x >= width - 1 || y >= height - 3) return { x: 0, y: 0 };
  const lift = 1 - clamp(y / (height - 1), 0, 1);
  const edge = Math.sin(Math.PI * clamp(x / (width - 1), 0, 1));
  const pinned = clamp((height - y - 3) / 6, 0, 1) * edge;
  return {
    x:
      (Math.sin(time * 3.7 + y * 0.19 + seed) * 0.7 +
        Math.sin(time * 2.1 + y * 0.09 + x * 0.11 + seed) * 0.5) *
      strength *
      pinned,
    y:
      (Math.sin(time * 4.2 + x * 0.17 + seed) * 0.8 +
        Math.sin(time * 2.6 + y * 0.07 + seed) * 0.5) *
      strength *
      lift *
      pinned,
  };
}
function hot(r: number, g: number, b: number) {
  return r > 145 && g > 65 && g < r * 1.04 && b < r * 0.89;
}
export class TextureFlame {
  private source: Uint8ClampedArray;
  private mask: Float32Array;
  private output: ImageData;
  private wholeSprite: HTMLCanvasElement;
  private original: HTMLCanvasElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  constructor(
    source: HTMLCanvasElement,
    readonly region: FlameRegion,
  ) {
    const { x, y, w, h } = region;
    this.original = source;
    this.wholeSprite = document.createElement("canvas");
    this.wholeSprite.width = source.width;
    this.wholeSprite.height = source.height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext("2d")!;
    this.source = source.getContext("2d")!.getImageData(x, y, w, h).data;
    this.mask = new Float32Array(w * h);
    this.output = new ImageData(w, h);
    for (let py = 1; py < h - 3; py++)
      for (let px = 1; px < w - 1; px++) {
        let warmth = 0;
        for (let oy = -2; oy <= 2; oy++)
          for (let ox = -2; ox <= 2; ox++) {
            const sx = clamp(px + ox, 0, w - 1),
              sy = clamp(py + oy, 0, h - 1),
              i = (sy * w + sx) * 4;
            if (hot(this.source[i], this.source[i + 1], this.source[i + 2]))
              warmth = Math.max(warmth, 1 - Math.hypot(ox, oy) / 4);
          }
        // Dark bars in the lower grate remain a fixed foreground silhouette.
        const i = (py * w + px) * 4;
        if (region.protectGrate && py > h - 12 && this.source[i] < 125)
          warmth = 0;
        this.mask[py * w + px] =
          warmth *
          clamp(px / 2, 0, 1) *
          clamp((w - 1 - px) / 2, 0, 1) *
          clamp((h - 3 - py) / 4, 0, 1);
      }
  }
  private update(time: number) {
    const { w, h, seed, strength } = this.region;
    const out = this.output.data;
    const flicker =
      1 +
      0.055 * Math.sin(time * 6.7 + seed) +
      0.025 * Math.sin(time * 11.3 + seed * 3);
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4,
          amount = this.mask[py * w + px];
        const offset = flameOffset(px, py, w, h, time, seed, strength);
        const sx = clamp(Math.round(px + offset.x), 0, w - 1),
          sy = clamp(Math.round(py + offset.y), 0, h - 1),
          j = (sy * w + sx) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const moving = this.source[j + channel] * flicker;
          out[i + channel] =
            this.source[i + channel] +
            (moving - this.source[i + channel]) * amount;
        }
        out[i + 3] =
          this.source[i + 3] +
          (this.source[j + 3] - this.source[i + 3]) * amount;
      }
    this.ctx.putImageData(this.output, 0, 0);
  }
  draw(
    c: CanvasRenderingContext2D,
    time: number,
    x = this.region.x,
    y = this.region.y,
    scale = 1,
  ) {
    this.update(time);
    c.drawImage(
      this.canvas,
      Math.round(x),
      Math.round(y),
      Math.round(this.region.w * scale),
      Math.round(this.region.h * scale),
    );
  }
  spriteFrame(time: number) {
    this.update(time);
    const c = this.wholeSprite.getContext("2d")!;
    c.clearRect(0, 0, this.wholeSprite.width, this.wholeSprite.height);
    c.drawImage(this.original, 0, 0);
    c.clearRect(this.region.x, this.region.y, this.region.w, this.region.h);
    c.drawImage(this.canvas, this.region.x, this.region.y);
    return this.wholeSprite;
  }
}
/** Buoyant, continuous vapour density; no detached repeating dots or flying sprites. */
export class SteamField {
  readonly width = 60;
  readonly height = 88;
  private density = new Float32Array(60 * 88);
  private next = new Float32Array(60 * 88);
  private elapsed = 0;
  private sample(x: number, y: number) {
    const w = this.width,
      h = this.height;
    x = clamp(x, 0, w - 1);
    y = clamp(y, 0, h - 1);
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    const at = (dx: number, dy: number) =>
      this.density[Math.min(h - 1, iy + dy) * w + Math.min(w - 1, ix + dx)];
    return (
      at(0, 0) * (1 - fx) * (1 - fy) +
      at(1, 0) * fx * (1 - fy) +
      at(0, 1) * (1 - fx) * fy +
      at(1, 1) * fx * fy
    );
  }
  step(time: number, dt = 0.08) {
    this.elapsed += dt;
    const w = this.width,
      h = this.height;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const rise = (h - y) / h;
        const vx =
          Math.sin(time * 0.8 + y * 0.1) * 5 +
          Math.sin(time * 1.4 + y * 0.17 + x * 0.06) * 2.5;
        const vy = 12 + rise * 7 + Math.sin(time + y * 0.09) * 2;
        let d =
          this.sample(x - vx * dt, y + vy * dt) *
          Math.exp(-dt * (0.15 + rise * 0.3));
        // Emission stays connected to the hot liquid, fades before it meets the rim.
        if (y > h - 5) {
          const center = 28 + Math.sin(time * 0.7) * 1.1;
          const spread = 3.5 + (h - y) * 0.3;
          const source =
            Math.exp(-(((x - center) / spread) ** 2)) *
            (0.83 + 0.1 * Math.sin(time * 1.3));
          d = Math.max(d, source * (y === h - 1 ? 0.5 : 1));
        }
        const border =
          clamp(x / 7, 0, 1) *
          clamp((w - x - 1) / 7, 0, 1) *
          clamp(y / 13, 0, 1);
        this.next[y * w + x] = d * border;
      }
    [this.density, this.next] = [this.next, this.density];
  }
  pixels() {
    const output = new Uint8ClampedArray(this.width * this.height * 4);
    for (let i = 0; i < this.density.length; i++) {
      output[i * 4] = 220;
      output[i * 4 + 1] = 211;
      output[i * 4 + 2] = 190;
      output[i * 4 + 3] = Math.round(
        clamp(this.density[i] * 0.42, 0, 0.3) * 255,
      );
    }
    return output;
  }
  mass() {
    return this.density.reduce((sum, n) => sum + n, 0);
  }
}
export class RoomMotion {
  readonly cleanPlate: HTMLCanvasElement;
  private flames: TextureFlame[];
  private steam = new SteamField();
  private steamCanvas: HTMLCanvasElement;
  private steamCtx: CanvasRenderingContext2D;
  private last = -1;
  constructor(original: HTMLCanvasElement) {
    this.cleanPlate = document.createElement("canvas");
    this.cleanPlate.width = original.width;
    this.cleanPlate.height = original.height;
    const ctx = this.cleanPlate.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(original, 0, 0);
    // The baked vapour must be removed, otherwise a static plume would remain
    // behind the animated one. A tight authored silhouette reconstructs only that
    // vapor area from neighboring pixels on the SAME forest/sill scanline.
    const x0 = 748,
      y0 = 365,
      w = 53,
      h = 55;
    const patch = ctx.getImageData(x0, y0, w, h);
    const originalPixels = ctx.getImageData(
      0,
      0,
      original.width,
      original.height,
    ).data;
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mc = maskCanvas.getContext("2d")!;
    mc.translate(-x0, -y0);
    mc.beginPath();
    mc.moveTo(768, 367);
    mc.bezierCurveTo(788, 365, 795, 375, 785, 386);
    mc.bezierCurveTo(801, 385, 800, 400, 783, 406);
    mc.bezierCurveTo(786, 414, 780, 419, 767, 420);
    mc.lineTo(756, 420);
    mc.bezierCurveTo(759, 409, 749, 408, 752, 396);
    mc.bezierCurveTo(753, 388, 761, 388, 758, 380);
    mc.bezierCurveTo(757, 372, 762, 371, 768, 367);
    mc.closePath();
    mc.fill();
    const mask = mc.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4,
          a = mask[i + 3] / 255;
        if (!a) continue;
        const sx = x0 + x + 42,
          sy = y0 + y,
          source = (sy * original.width + sx) * 4;
        for (let k = 0; k < 3; k++)
          patch.data[i + k] =
            patch.data[i + k] * (1 - a) + originalPixels[source + k] * a;
      }
    ctx.putImageData(patch, x0, y0);
    this.flames = ROOM_FLAMES.map((r) => new TextureFlame(this.cleanPlate, r));
    this.steamCanvas = document.createElement("canvas");
    this.steamCanvas.width = this.steam.width;
    this.steamCanvas.height = this.steam.height;
    this.steamCtx = this.steamCanvas.getContext("2d")!;
    // Warm up without a visible first-frame puff: the plume is already established.
    for (let i = 0; i < 110; i++) this.steam.step(i * 0.08);
  }
  drawFire(c: CanvasRenderingContext2D, t: number) {
    for (const flame of this.flames) flame.draw(c, t);
    // Shift luminance on existing lit surfaces; no rectangular colored glow layer.
    c.save();
    c.beginPath();
    c.moveTo(1017, 427);
    c.lineTo(1190, 429);
    c.lineTo(1216, 480);
    c.lineTo(1045, 464);
    c.closePath();
    c.clip();
    c.filter = `brightness(${1 + 0.018 * Math.sin(t * 6.7) + 0.009 * Math.sin(t * 11.3)})`;
    c.drawImage(this.cleanPlate, 0, 0);
    c.restore();
  }
  drawSteam(c: CanvasRenderingContext2D, t: number, x = 744, y = 332) {
    const dt = this.last < 0 ? 0.08 : clamp(t - this.last, 0.02, 0.14);
    this.last = t;
    this.steam.step(t, dt);
    this.steamCtx.putImageData(
      new ImageData(this.steam.pixels(), this.steam.width, this.steam.height),
      0,
      0,
    );
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(this.steamCanvas, x, y);
    c.restore();
  }
}
