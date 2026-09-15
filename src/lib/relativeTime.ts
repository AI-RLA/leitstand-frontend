export function relativeTime(
  iso: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!iso) return "—";
  const ms = now - new Date(iso).getTime();
  const sec = Math.abs(ms) / 1000;
  const past = ms >= 0;
  let val: number;
  let unit: string;
  if (sec < 60) {
    val = Math.floor(sec);
    unit = "s";
  } else if (sec < 3600) {
    val = Math.floor(sec / 60);
    unit = "m";
  } else if (sec < 86400) {
    val = Math.floor(sec / 3600);
    unit = "h";
  } else {
    val = Math.floor(sec / 86400);
    unit = "d";
  }
  return past ? `${val}${unit} ago` : `in ${val}${unit}`;
}

export function durationFromMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const sec = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
