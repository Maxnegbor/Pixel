import { useState, useRef, useEffect } from "react";
import { Ambience, type Channel } from "../lib/audio";
export default function Sounds() {
  const audio = useRef<Ambience | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [vol, setVol] = useState<Record<Channel, number>>(() => {
    try {
      return {
        ...{ rain: 0.4, fire: 0.3, wind: 0.1 },
        ...JSON.parse(localStorage.getItem("pixel-volumes") || "{}"),
      };
    } catch {
      return { rain: 0.4, fire: 0.3, wind: 0.1 };
    }
  });
  useEffect(() => {
    if (enabled)
      for (const k of Object.keys(vol) as Channel[])
        audio.current?.set(k, vol[k]);
    localStorage.setItem("pixel-volumes", JSON.stringify(vol));
  }, [vol, enabled]);
  useEffect(() => () => audio.current?.close(), []);
  async function toggle() {
    try {
      if (enabled) {
        await audio.current?.suspend();
        setEnabled(false);
      } else {
        audio.current ??= new Ambience();
        await audio.current.start();
        setEnabled(true);
      }
    } catch {
      setError(
        "Your browser could not start audio. Try again after allowing sound.",
      );
    }
  }
  return (
    <div className="sound-controls">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h2>The sound of slowing down</h2>
        </div>
        <button onClick={() => void toggle()}>
          {enabled ? "Mute all" : "Enable sounds"}
        </button>
      </div>
      <p className="muted">
        A soft, seamless soundscape. Headphones recommended.
      </p>
      {(["rain", "fire", "wind"] as Channel[]).map((k, i) => (
        <label className="sound-row" key={k}>
          <span className="sound-icon">{["☂", "♨", "≋"][i]}</span>
          <span>
            {
              [
                "Rain on the window",
                "Crackling fireplace",
                "Wind in the trees",
              ][i]
            }
          </span>
          <input
            aria-label={`${k} volume`}
            type="range"
            min="0"
            max="1"
            step=".01"
            value={vol[k]}
            onChange={(e) => setVol({ ...vol, [k]: Number(e.target.value) })}
          />
          <span>{Math.round(vol[k] * 100)}%</span>
        </label>
      ))}
      <p className="tiny">
        {enabled
          ? "Playing · synthesized ambience, works offline"
          : "Sound is off until you turn it on."}
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
