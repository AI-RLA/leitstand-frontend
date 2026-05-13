export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#DCFCE7", text: "#15803D" },
  idle: { bg: "#FEF9C3", text: "#A16207" },
  charging: { bg: "#EFF6FF", text: "#1D4ED8" },
  alert: { bg: "#FEF3C7", text: "#B45309" },
  offline: { bg: "#F3F4F6", text: "#9CA3AF" },
};

// Map marker fill colors (circle dot on the map canvas)
export const MARKER_COLOR: Record<string, string> = {
  active: "#16A34A",
  idle: "#EAB308",
  charging: "#3B82F6",
  alert: "#F59E0B",
  offline: "#9CA3AF",
};

export function batteryColor(pct: number): string {
  if (pct > 40) return "#16A34A";
  if (pct > 20) return "#F59E0B";
  return "#EF4444";
}

export function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function latestTs(...tss: (string | null | undefined)[]): string | null {
  const valid = tss.filter(Boolean) as string[];
  return valid.length ? valid.reduce((a, b) => (a > b ? a : b)) : null;
}
