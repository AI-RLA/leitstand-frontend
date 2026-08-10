import type {
  Mission,
  MissionStatus,
  MissionError,
  MissionState,
  StageStateView,
  StageStatus,
} from "@/api/client";
import { haversineMeters } from "@/lib/geo";

export type MissionLifecycleBucket =
  | "running"
  | "assigned"
  | "draft"
  | "history";

export function bucketOf(status: MissionStatus): MissionLifecycleBucket {
  if (status === "RUNNING" || status === "DISPATCHED" || status === "PAUSED")
    return "running";
  if (status === "ASSIGNED") return "assigned";
  if (status === "DRAFT") return "draft";
  return "history";
}

export function countByBucket(
  missions: Mission[],
): Record<MissionLifecycleBucket | "all", number> {
  const counts = {
    all: missions.length,
    running: 0,
    assigned: 0,
    draft: 0,
    history: 0,
  };
  for (const m of missions) {
    counts[bucketOf(m.status)]++;
  }
  return counts;
}

export interface StageViewModel {
  id: string;
  index: number;
  waypointCount: number;
  distanceM: number | null;
  // Widen to string (the schema literal is "navigation" today) so the timeline
  // can label future non-navigation kinds without a type change here.
  kind: string;
  frame: "wgs84" | "site_local" | "mixed" | null;
  status: StageStatus;
  progress: number | null;
  startedAt: string | null;
  endedAt: string | null;
  errors: MissionError[];
  waypoints: Waypoint[];
}

export interface MissionViewModel {
  id: string;
  name: string;
  description: string | null;
  status: MissionStatus;
  bucket: MissionLifecycleBucket;
  robotId: string | null;
  stages: StageViewModel[];
  stageCount: number;
  overallProgress: number | null;
  elapsedMs: number | null;
  finishedStageCount: number;
  currentStageIndex: number | null;
  createdAt: string;
  updatedAt: string;
  dispatchedAt: string | null;
}

type Waypoint = Mission["stages"][number]["waypoints"][number];

function stageDistance(waypoints: Waypoint[]): number | null {
  if (waypoints.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    if (a.kind === "wgs84" && b.kind === "wgs84") {
      sum += haversineMeters(a.lat, a.lon, b.lat, b.lon);
    } else if (a.kind === "site_local" && b.kind === "site_local") {
      sum += Math.hypot(b.x - a.x, b.y - a.y);
    } else {
      return null;
    }
  }
  return sum;
}

function stageFrame(
  waypoints: Waypoint[],
): "wgs84" | "site_local" | "mixed" | null {
  let hasWgs = false;
  let hasLocal = false;
  for (const w of waypoints) {
    if (w.kind === "wgs84") hasWgs = true;
    else if (w.kind === "site_local") hasLocal = true;
  }
  if (hasWgs && hasLocal) return "mixed";
  if (hasWgs) return "wgs84";
  if (hasLocal) return "site_local";
  return null;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function toMissionViewModel(
  m: Mission,
  state: MissionState | null,
): MissionViewModel {
  // Join the backend's per-stage runtime entries onto the definition spine by
  // stage_id (the authoritative stage list + order is the mission definition).
  const runtimeByStageId = new Map<string, StageStateView>();
  for (const ss of state?.stage_states ?? []) {
    runtimeByStageId.set(ss.stage_id, ss);
  }

  const stages: StageViewModel[] = m.stages.map((s, i) => {
    // The backend resolves and serves per-stage status (incl. CANCELLED/SKIPPED);
    // render it directly. A stage with no served entry defaults to WAITING.
    const runtime = runtimeByStageId.get(s.stage_id) ?? null;
    return {
      id: s.stage_id,
      index: i,
      waypointCount: s.waypoints.length,
      distanceM: stageDistance(s.waypoints),
      kind: s.kind,
      frame: stageFrame(s.waypoints),
      status: runtime?.status ?? "WAITING",
      progress: runtime?.progress ?? null,
      startedAt: runtime?.started_at ?? null,
      endedAt: runtime?.ended_at ?? null,
      errors: runtime?.errors ?? [],
      waypoints: s.waypoints,
    };
  });

  const activeIdx = stages.findIndex(
    (s) =>
      s.status === "RUNNING" ||
      s.status === "PAUSED" ||
      s.status === "INITIALIZING",
  );
  const currentStageIndex = activeIdx >= 0 ? activeIdx : null;
  const finishedStageCount = stages.filter(
    (s) => s.status === "FINISHED",
  ).length;

  let overallProgress: number | null = null;
  if (currentStageIndex !== null && stages.length > 0) {
    const cur = clamp01(stages[currentStageIndex].progress ?? 0);
    overallProgress = clamp01((currentStageIndex + cur) / stages.length);
  } else if (stages.length > 0 && finishedStageCount === stages.length) {
    overallProgress = 1;
  }

  const elapsedMs = m.dispatched_at
    ? Date.now() - new Date(m.dispatched_at).getTime()
    : null;

  return {
    id: m.mission_id,
    name: m.name,
    description: m.description ?? null,
    status: m.status,
    bucket: bucketOf(m.status),
    robotId: m.robot_id ?? null,
    stages,
    stageCount: stages.length,
    overallProgress,
    elapsedMs,
    finishedStageCount,
    currentStageIndex,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    dispatchedAt: m.dispatched_at ?? null,
  };
}

export function isActiveStatus(status: MissionStatus): boolean {
  return status === "RUNNING" || status === "DISPATCHED" || status === "PAUSED";
}
