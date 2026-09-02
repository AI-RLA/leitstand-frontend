import type { Mission } from "@/api/client";

type Stage = Mission["stages"][number];
type Waypoint = Extract<Stage, { kind: "navigation" }>["waypoints"][number];

/**
 * The waypoints a stage works, in order, whatever shape it carries them in.
 *
 * A coverage stage is a route of swaths and the turns joining them; only the swaths are worked, so
 * only they should be drawn as the job or searched for a site. Anything that needs the whole drive,
 * turns included, wants stageDrivenWaypoints instead.
 */
export function stageWaypoints(stage: Stage): Waypoint[] {
  return stage.kind === "coverage"
    ? stage.segments
        .filter((s) => s.kind === "swath")
        .flatMap((s) => s.waypoints)
    : stage.waypoints;
}

/**
 * Every point a stage is driven along, turns included.
 *
 * Distinct from stageWaypoints, which keeps the swaths alone because that is what gets worked.
 * Measuring along the swaths skips the turns joining them, so it understates the drive and
 * disagrees with the length the planner reported.
 */
export function stageDrivenWaypoints(stage: Stage): Waypoint[] {
  return stage.kind === "coverage"
    ? stage.segments.flatMap((s, i) =>
        // Consecutive segments share an endpoint, so the joint is counted once.
        i === 0 ? s.waypoints : s.waypoints.slice(1),
      )
    : stage.waypoints;
}
