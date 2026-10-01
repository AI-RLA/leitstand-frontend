import type { RunStatus, StageStatus } from "@/api/client";

/** The colours a status is shown in: its accent for dots, lines and rings, and a pill's background and text. */
export interface StatusColors {
  accent: string;
  background: string;
  text: string;
}

// A mission shows its latest run's status, and "NOT_RUN" when it has never run.
export type MissionPillStatus = RunStatus | "NOT_RUN";

// Plain colour values rather than Tailwind classes, because the map paints the accents and
// Tailwind only emits classes it finds written out in the source.
const ACTIVE: StatusColors = {
  accent: "#16A34A",
  background: "#F0FDF4",
  text: "#16A34A",
};
const PAUSED: StatusColors = {
  accent: "#F59E0B",
  background: "#FFFBEB",
  text: "#B45309",
};
const FAILED: StatusColors = {
  accent: "#EF4444",
  background: "#FEF2F2",
  text: "#B91C1C",
};
const STOPPED: StatusColors = {
  accent: "#94A3B8",
  background: "var(--muted)",
  text: "#64748B",
};
const PREPARING: StatusColors = {
  accent: "#6366F1",
  background: "#EEF2FF",
  text: "#4F46E5",
};

const IDLE: StatusColors = {
  accent: "#94A3B8",
  background: "#F1F5F9",
  text: "#64748B",
};

const STAGE_COLORS: Record<StageStatus, StatusColors> = {
  WAITING: IDLE,
  INITIALIZING: PREPARING,
  RUNNING: ACTIVE,
  PAUSED,
  FINISHED: { ...ACTIVE, background: "#DCFCE7", text: "#15803D" },
  FAILED,
  CANCELLED: STOPPED,
  SKIPPED: { ...STOPPED, accent: "#CBD5E1", text: "#94A3B8" },
};

const MISSION_COLORS: Record<MissionPillStatus, StatusColors> = {
  NOT_RUN: { ...IDLE, text: "#475569" },
  PENDING: { accent: "#3B82F6", background: "#EFF6FF", text: "#2563EB" },
  DISPATCHED: PREPARING,
  RUNNING: ACTIVE,
  PAUSED,
  SUCCEEDED: { ...ACTIVE, text: "#15803D" },
  FAILED,
  CANCELLED: STOPPED,
  REJECTED: { ...FAILED, accent: "#F87171" },
  PAUSING: PAUSED,
  RESUMING: ACTIVE,
  CANCELLING: STOPPED,
};

/** The colours of a stage status, idle for a status newer than this build's API types. */
export function stageColors(status: StageStatus): StatusColors {
  return STAGE_COLORS[status] ?? IDLE;
}

/** The colours of a mission's latest run, not-run for a status newer than this build's API types. */
export function missionColors(status: MissionPillStatus): StatusColors {
  return MISSION_COLORS[status] ?? MISSION_COLORS.NOT_RUN;
}
