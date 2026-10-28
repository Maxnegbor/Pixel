import { localDay } from "../lib/timer";
import type { GameState } from "../lib/types";
export default function Stats({ game }: { game: GameState }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const key = localDay(d);
    return {
      key,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      minutes: game.sessions
        .filter((s) => s.kind === "focus" && localDay(s.started_at) === key)
        .reduce((a, s) => a + s.credited_minutes, 0),
    };
  });
  const max = Math.max(60, ...days.map((d) => d.minutes));
  return (
    <section className="statistics">
      <p className="eyebrow">SMALL STEPS ADD UP</p>
      <h2>Look how far you’ve come.</h2>
      <div className="stats-metrics">
        <div>
          <strong>
            {days[6].minutes}
            <small> min</small>
          </strong>
          <span>Today’s focus</span>
        </div>
        <div>
          <strong>
            {(game.profile.focus_minutes / 60).toFixed(1)}
            <small> hr</small>
          </strong>
          <span>Lifetime focus</span>
        </div>
        <div>
          <strong>
            {
              game.sessions.filter(
                (s) => s.kind === "focus" && s.status === "completed",
              ).length
            }
          </strong>
          <span>Completed sessions</span>
        </div>
      </div>
      <h3>Your last seven days</h3>
      <div
        className="bar-chart"
        role="img"
        aria-label={days
          .map((d) => `${d.label}: ${d.minutes} focus minutes`)
          .join(", ")}
      >
        {days.map((d) => (
          <div key={d.key}>
            <span>{d.minutes}m</span>
            <div className="bar-track">
              <i
                style={{ height: `${Math.max(2, (d.minutes / max) * 100)}%` }}
              />
            </div>
            <span>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="tiny">
        Focus minutes grouped by session start date in your local timezone.
      </p>
      <h3>Recent sessions</h3>
      <div className="session-list">
        {game.sessions.slice(0, 15).map((s) => (
          <div key={s.id}>
            <span>
              {s.kind === "focus" ? "✦ Focus" : "☕ Break"}
              <small>{new Date(s.started_at).toLocaleString()}</small>
            </span>
            <span>
              {s.credited_minutes} min earned<small>{s.status}</small>
            </span>
          </div>
        ))}
        {!game.sessions.length && (
          <p className="muted">Your story starts with your first session.</p>
        )}
      </div>
    </section>
  );
}
