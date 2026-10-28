import { useEffect, useState } from "react";
import { clock, remainingSeconds } from "../lib/timer";
import type { Action, GameState } from "../lib/types";
export default function Timer({
  game,
  now,
  busy,
  act,
  onRewards,
}: {
  game: GameState;
  now: number;
  busy: boolean;
  act: (a: Action, p?: Record<string, unknown>) => Promise<GameState | undefined>;
  onRewards: () => void;
}) {
  const [minutes, setMinutes] = useState(25);
  const [kind, setKind] = useState<"focus" | "break">("focus");
  const [task, setTask] = useState(
    () => localStorage.getItem("pixel-task") || "",
  );
  const s = game.sessions.find(
    (x) => x.status === "running" || x.status === "paused",
  );
  const pending = game.pending_rewards?.[0];
  const selectedKind = s?.kind || kind;
  const shownMinutes = s ? s.duration / 60 : minutes;
  const remaining = s ? remainingSeconds(s, now) : minutes * 60;
  const pct = s ? Math.min(100, (1 - remaining / s.duration) * 100) : 0;
  useEffect(() => {
    localStorage.setItem("pixel-task", task);
  }, [task]);
  return (
    <section className="timer-panel">
      <div className="panel-top">
        <span className="eyebrow">YOUR TIME, WELL SPENT</span>
        <span className="small-badge">
          {s?.status === "running"
            ? "● In the zone"
            : s?.status === "paused"
              ? "Ⅱ Paused"
              : "✧ Find your flow"}
        </span>
      </div>
      <div className="timer-ornament" aria-hidden="true">
        <span />✦<span />
      </div>
      <div className="timer-tabs">
        <button
          className={(s?.kind || kind) === "focus" ? "selected" : ""}
          disabled={!!s || busy}
          onClick={() => {
            setKind("focus");
            setMinutes(25);
          }}
        >
          Focus
        </button>
        <button
          className={(s?.kind || kind) === "break" ? "selected" : ""}
          disabled={!!s || busy}
          onClick={() => {
            setKind("break");
            setMinutes(5);
          }}
        >
          Short break
        </button>
      </div>
      <div
        className="timer-digits"
        aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
      >
        {clock(remaining)}
      </div>
      <p className="timer-message">
        {(s?.kind || kind) === "break"
          ? "Stretch, breathe, look out the window."
          : s
            ? "One small step at a time. You’re doing well."
            : "Settle in. Something good starts here."}
      </p>
      <div className="preset-row">
        {(selectedKind === "focus" ? [25, 50, 90] : [5, 10, 15]).map((m) => (
          <button
            disabled={!!s || busy}
            className={shownMinutes === m ? "selected" : ""}
            key={m}
            onClick={() => setMinutes(m)}
          >
            {m} min
          </button>
        ))}
        <label className="custom-time">
          <input
            type="number"
            aria-label="Custom duration in minutes"
            min="1"
            max="240"
            value={shownMinutes}
            disabled={!!s || busy}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <span>min</span>
        </label>
      </div>
      <input
        className="task-input"
        aria-label="What are you working on?"
        placeholder="✎  What are you working on?"
        value={task}
        maxLength={140}
        onChange={(e) => setTask(e.target.value)}
      />
      <div className="timer-actions">
        {s ? (
          <>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void act(s.status === "running" ? "pause" : "resume")
              }
            >
              {s.status === "running" ? "Ⅱ Pause session" : "▶ Resume session"}
            </button>
            <button
              className="end-button"
              disabled={busy}
              onClick={() => void act("end")}
            >
              End
            </button>
          </>
        ) : pending ? (
          <button className="primary" disabled={busy} onClick={onRewards}>Get rewards</button>
        ) : (
          <button
            className="primary"
            disabled={
              busy || !Number.isInteger(minutes) || minutes < 1 || minutes > 240
            }
            onClick={() => void act("start", { duration: minutes * 60, kind })}
          >
            ▶ {kind === "focus" ? "Begin focus session" : "Take a breather"}
          </button>
        )}
      </div>
      <div className="session-progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="reward-hint">
        <span>✦ {game.config.xp_per_minute} XP / min</span>
        <span className="gold">
          ◈ {game.config.coins_per_minute} coins / min
        </span>
        <span>▣ 1 box / {game.config.box_minutes} min</span>
      </div>
      <p className="tiny">
        {s
          ? "Rewards unlock after completing your focus session. Ending early earns no rewards."
          : "Complete a focus session, then collect your rewards."}
      </p>
    </section>
  );
}
