import type { StudySession } from "./types";
export function elapsedSeconds(s: StudySession, now = Date.now()): number {
  return Math.min(
    s.duration,
    Math.max(
      0,
      s.elapsed +
        (s.status === "running" && s.running_since
          ? Math.max(0, (now - Date.parse(s.running_since)) / 1000)
          : 0),
    ),
  );
}
export function remainingSeconds(s: StudySession, now = Date.now()) {
  return Math.max(0, Math.ceil(s.duration - elapsedSeconds(s, now)));
}
export function clock(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function localDay(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
