import type {
  CoverageProvenance,
  Mission,
  MissionError,
  Robot,
  Run,
  RunState,
  RunSummary,
  RunStatus,
  StageStateView,
  StageStatus,
} from "@/api/client";
import { haversineMeters } from "@/lib/geo";
import { stageDrivenWaypoints, stageWaypoints } from "./stageWaypoints";

export type MissionLifecycleBucket =
  | "running"
  | "assigned"
  | "draft"
  | "history";

export function isActiveStatus(status: RunStatus | null | undefined): boolean {
  return (
    status === "PENDING" ||
    status === "DISPATCHED" ||
    status === "RUNNING" ||
    status === "PAUSED" ||
    isConfirming(status)
  );
}

/** An operator's pause, resume or cancel that the robot has not reported yet. */
export function isConfirming(status: RunStatus | null | undefined): boolean {
  return (
    status === "PAUSING" || status === "RESUMING" || status === "CANCELLING"
  );
}

/** Every run of this mission still occupying a robot. */
export function activeRunsOf(m: Mission): RunSummary[] {
  return m.active_runs ?? [];
}

/**
 * Whether any robot is still executing this mission: every run still occupying a robot counts,
 * not only `latest_run`, which is the newest run created whatever became of it.
 */
export function isMissionActive(m: Mission): boolean {
  return activeRunsOf(m).length > 0;
}

/**
 * Which bucket a mission is in. A mission that has run belongs to history even with a default
 * robot; only a never-run mission with a default robot reads as "assigned".
 */
export function bucketOf(m: Mission): MissionLifecycleBucket {
  if (isMissionActive(m)) return "running";
  if (m.latest_run) return "history";
  return m.assigned_robot_id ? "assigned" : "draft";
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
    counts[bucketOf(m)]++;
  }
  return counts;
}

export interface StageViewModel {
  id: string;
  index: number;
  waypointCount: number;
  // Absent on a stage that is not coverage, where swaths mean nothing.
  swathCount: number | null;
  coverage: CoverageProvenance | null;
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
  // The latest run's status; null when the mission has never run.
  status: RunStatus | null;
  runId: string | null;
  bucket: MissionLifecycleBucket;
  // The latest run's robot, else the default robot the next run would go to.
  robotId: string | null;
  assignedRobotId: string | null;
  archived: boolean;
  stages: StageViewModel[];
  stageCount: number;
  overallProgress: number | null;
  elapsedMs: number | null;
  finishedStageCount: number;
  currentStageIndex: number | null;
  createdAt: string;
  updatedAt: string;
  dispatchedAt: string | null;
  // The latest run's end, by the backend clock; null while it runs or if it never ran.
  endedAt: string | null;
}

type Waypoint = ReturnType<typeof stageWaypoints>[number];

export function stageDistance(waypoints: Waypoint[]): number | null {
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

export function stageFrame(
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

/** The per-stage view of a stage list, joined with a run's per-stage state when there is one. */
export function stageViewModels(
  spine: Mission["stages"],
  state: RunState | null,
): StageViewModel[] {
  const runtimeByStageId = new Map<string, StageStateView>();
  for (const ss of state?.stage_states ?? []) {
    runtimeByStageId.set(ss.stage_id, ss);
  }
  return spine.map((s, i) => {
    // The backend resolves and serves per-stage status (incl. CANCELLED/SKIPPED);
    // render it directly. A stage with no served entry defaults to WAITING.
    const runtime = runtimeByStageId.get(s.stage_id) ?? null;
    const waypoints = stageWaypoints(s);
    return {
      id: s.stage_id,
      index: i,
      waypointCount: waypoints.length,
      swathCount:
        s.kind === "coverage"
          ? s.segments.filter((seg) => seg.kind === "swath").length
          : null,
      coverage: s.kind === "coverage" ? s.provenance : null,
      distanceM: stageDistance(stageDrivenWaypoints(s)),
      kind: s.kind,
      frame: stageFrame(waypoints),
      status: runtime?.status ?? "WAITING",
      progress: runtime?.progress ?? null,
      startedAt: runtime?.started_at ?? null,
      endedAt: runtime?.ended_at ?? null,
      errors: runtime?.errors ?? [],
      waypoints,
    };
  });
}

/** Where a run stands across its stages: the active stage and the share of the whole done. */
export function runProgress(stages: StageViewModel[]): {
  currentStageIndex: number | null;
  finishedStageCount: number;
  overallProgress: number | null;
} {
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
  return { currentStageIndex, finishedStageCount, overallProgress };
}

export function toMissionViewModel(
  m: Mission,
  state: RunState | null,
  run: Run | null = null,
  now: number = Date.now(),
): MissionViewModel {
  // The spine is the run's frozen plan when a run is given, so editing the mission afterwards
  // never redraws what a finished run did; the definition serves only a mission without a run.
  const stages = stageViewModels(run?.stages ?? m.stages, state);
  const { currentStageIndex, finishedStageCount, overallProgress } =
    runProgress(stages);

  const latest = m.latest_run ?? null;
  const elapsedMs = latest?.dispatched_at
    ? (latest.ended_at ? new Date(latest.ended_at).getTime() : now) -
      new Date(latest.dispatched_at).getTime()
    : null;

  return {
    id: m.mission_id,
    name: m.name,
    description: m.description ?? null,
    status: latest?.status ?? null,
    runId: latest?.run_id ?? null,
    bucket: bucketOf(m),
    robotId: latest?.robot_id ?? m.assigned_robot_id ?? null,
    assignedRobotId: m.assigned_robot_id ?? null,
    archived: m.archived_at != null,
    stages,
    stageCount: stages.length,
    overallProgress,
    elapsedMs,
    finishedStageCount,
    currentStageIndex,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    dispatchedAt: latest?.dispatched_at ?? null,
    endedAt: latest?.ended_at ?? null,
  };
}

/** The live frame of the run a mission list row is showing, or null. */
export function liveFor(
  states: Map<string, RunState>,
  m: Mission,
): RunState | null {
  const runId = m.latest_run?.run_id;
  return runId ? (states.get(runId) ?? null) : null;
}

/**
 * Why a robot cannot run this mission now, or null when it can. Checked here for the greyed
 * choices only; the backend decides for real on dispatch.
 */
export function dispatchRefusal(mission: Mission, robot: Robot): string | null {
  if (!robot.online) return "offline";
  if (robot.current_run) return "busy with another run";
  const factsheet = robot.factsheet;
  if (!factsheet) return "no factsheet";
  const needed = coverageTurningRadius(mission);
  if (needed !== null) {
    if (!factsheet.coverage) return "cannot drive coverage";
    const radius = factsheet.physical_parameters?.min_turning_radius_m;
    if (radius != null && radius > needed + 1e-9) {
      return `turns at ${radius} m, wider than the plan's ${needed} m`;
    }
  }
  return null;
}

/** The tightest turning radius any coverage stage was planned for, or null without one. */
export function coverageTurningRadius(mission: Mission): number | null {
  const radii = mission.stages.flatMap((s) =>
    s.kind === "coverage" ? [s.provenance.params.turning_radius_m] : [],
  );
  return radii.length ? Math.min(...radii) : null;
}
