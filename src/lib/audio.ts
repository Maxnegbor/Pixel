// Offline, seamless ambience synthesized with Web Audio. No downloads or autoplay.
export type Channel = "rain" | "fire" | "wind";
export class Ambience {
  private ctx: AudioContext | null = null;
  private gains: Partial<Record<Channel, GainNode>> = {};
  private sources: AudioBufferSourceNode[] = [];
  private lfo: OscillatorNode[] = [];
  async start() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new AudioContext());
    for (const kind of ["rain", "fire", "wind"] as Channel[]) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 8, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        data[i] =
          kind === "wind"
            ? brown * 3
            : kind === "fire"
              ? brown * 2 + (Math.random() > 0.999 ? white * 0.7 : 0)
              : white * 0.24;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = kind === "rain" ? "lowpass" : "lowpass";
      filter.frequency.value =
        kind === "rain" ? 2600 : kind === "fire" ? 850 : 350;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      this.gains[kind] = gain;
      src.start();
      this.sources.push(src);
      // Slow amplitude motion for wind; no abrupt loop seam.
      if (kind === "wind") {
        const osc = ctx.createOscillator();
        const depth = ctx.createGain();
        osc.frequency.value = 0.12;
        depth.gain.value = 0.03;
        osc.connect(depth).connect(filter.frequency);
        osc.start();
        this.lfo.push(osc);
      }
    }
  }
  set(kind: Channel, value: number) {
    if (this.ctx && this.gains[kind])
      this.gains[kind]!.gain.setTargetAtTime(
        Math.max(0, Math.min(1, value)),
        this.ctx.currentTime,
        0.2,
      );
  }
  async suspend() {
    await this.ctx?.suspend();
  }
  close() {
    this.sources.forEach((s) => s.stop());
    this.lfo.forEach((s) => s.stop());
    void this.ctx?.close();
    this.ctx = null;
  }
}
