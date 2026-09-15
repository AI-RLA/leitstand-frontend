import type {
  CoveragePreviewQuery,
  CoverageStage,
  CoverageStageInput,
  Mission,
  Robot,
} from "@/api/client";
import type { WaypointFrame } from "./FrameChip";
import type { WaypointDraft } from "./WaypointRow";

export type StageKind = "navigation" | "coverage";

export interface NavigationStageDraft {
  kind: "navigation";
  // Set on a stage loaded from an existing mission and sent back on save, so the stage keeps
  // its identity across the edit and its runs stay comparable. A stage added here has none.
  stage_id?: string;
  frame: WaypointFrame;
  site_id: string;
  waypoints: WaypointDraft[];
}

export interface CoverageStageDraft {
  kind: "coverage";
  stage_id?: string;
  field_id: string;
  operation_width_m: string;
  // null: the machine values are typed by hand rather than read from a robot's factsheet.
  params_robot_id: string | null;
  turning_radius_m: string;
  headland_width_m: string;
  swath_angle_deg: string;
  allow_overlap: boolean;
  // The preview the operator last planned, or the stored stage when loaded; null until planned.
  planned: CoverageStage | null;
  // The stage as the mission holds it; `planned === stored` means nothing was re-planned.
  stored: CoverageStage | null;
  // Inputs changed since `planned`, so the swaths on the map no longer show what would be saved.
  dirty: boolean;
}

export type StageDraft = NavigationStageDraft | CoverageStageDraft;

export const KIND_LABEL: Record<StageKind, string> = {
  navigation: "Navigation",
  coverage: "Coverage",
};

export const KIND_DESCRIPTION: Record<StageKind, string> = {
  navigation: "Navigation: drive through waypoints",
  coverage: "Coverage: work a whole field",
};

export type CoverageInputsWire = CoveragePreviewQuery;

function numberOrNull(value: string): number | null | undefined {
  if (value.trim() === "") return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? undefined : n;
}

/** Turn a draft into the wire inputs shared by the preview and the stage input, or name what is missing. */
export function coverageInputs(
  d: CoverageStageDraft,
): { inputs: CoverageInputsWire } | { error: string } {
  if (!d.field_id) return { error: "Choose a field" };
  const width = numberOrNull(d.operation_width_m);
  if (width === null || width === undefined || width <= 0) {
    return { error: "Enter the implement width in metres" };
  }
  const radius = numberOrNull(d.turning_radius_m);
  if (radius === undefined || (radius !== null && radius < 0)) {
    return { error: "The turning radius must be a number of metres" };
  }
  if (d.params_robot_id === null && radius === null) {
    return { error: "Enter a turning radius or choose a robot" };
  }
  const headland = numberOrNull(d.headland_width_m);
  if (headland === undefined || (headland !== null && headland < 0)) {
    return { error: "The headland must be a number of metres" };
  }
  const angle = numberOrNull(d.swath_angle_deg);
  if (angle === undefined || (angle !== null && (angle < 0 || angle >= 180))) {
    return { error: "The swath direction is a bearing from 0 to 179 degrees" };
  }
  return {
    inputs: {
      field_id: d.field_id,
      operation_width_m: width,
      params_robot_id: d.params_robot_id,
      turning_radius_m: radius,
      headland_width_m: headland,
      swath_angle_deg: angle,
      allow_overlap: d.allow_overlap,
    },
  };
}

export function robotTurningRadius(robot: Robot | undefined): string {
  const radius = robot?.factsheet?.physical_parameters?.min_turning_radius_m;
  return radius == null ? "" : String(radius);
}

export function emptyCoverageDraft(
  robots: Robot[],
  paramsRobotId: string | null,
): CoverageStageDraft {
  const robot = robots.find((r) => r.id === paramsRobotId);
  return {
    kind: "coverage",
    field_id: "",
    operation_width_m: "",
    params_robot_id: robot ? paramsRobotId : null,
    turning_radius_m: "",
    headland_width_m: "",
    swath_angle_deg: "",
    allow_overlap: false,
    planned: null,
    stored: null,
    dirty: false,
  };
}

export function coverageDraftFrom(stage: CoverageStage): CoverageStageDraft {
  const { provenance } = stage;
  const { params } = provenance;
  const sources = provenance.param_sources ?? {};
  return {
    kind: "coverage",
    stage_id: stage.stage_id,
    field_id: provenance.field_id,
    operation_width_m: String(params.operation_width_m),
    params_robot_id: provenance.planned_for_robot_id ?? null,
    // A value that came from the robot or the planner stays blank, so saving again does not
    // pin it by hand.
    turning_radius_m: (sources.turning_radius_m ?? "manual").startsWith(
      "factsheet:",
    )
      ? ""
      : String(params.turning_radius_m),
    headland_width_m:
      sources.headland_width_m === "turning_radius"
        ? ""
        : String(params.headland_width_m),
    swath_angle_deg:
      sources.swath_angle_deg === "manual" && params.swath_angle_deg != null
        ? String(params.swath_angle_deg)
        : "",
    allow_overlap: params.allow_overlap ?? false,
    planned: stage,
    stored: stage,
    dirty: false,
  };
}

/** What a coverage draft sends on save: carried by id while it shows the stored plan, else its inputs. */
export function coverageStageInput(
  d: CoverageStageDraft,
  inputs: CoverageInputsWire,
): CoverageStageInput {
  if (d.stage_id && d.stored !== null && d.planned === d.stored) {
    return { kind: "coverage", stage_id: d.stage_id, allow_overlap: false };
  }
  return {
    kind: "coverage",
    stage_id: d.stage_id ?? null,
    ...inputs,
    allow_overlap: inputs.allow_overlap ?? false,
  };
}

export function emptyWaypoint(): WaypointDraft {
  return { lat: "", lon: "", heading_deg: "", x: "", y: "", theta: "" };
}

export function emptyNavigationDraft(): NavigationStageDraft {
  return {
    kind: "navigation",
    frame: "wgs84",
    site_id: "",
    waypoints: [emptyWaypoint()],
  };
}

export function stagesToDrafts(stages: Mission["stages"]): StageDraft[] {
  return stages.map((s): StageDraft => {
    if (s.kind === "coverage") return coverageDraftFrom(s);
    const first = s.waypoints[0];
    const frame: WaypointFrame =
      first?.kind === "site_local" ? "site_local" : "wgs84";
    const site_id = first?.kind === "site_local" ? first.site_id : "";
    return {
      kind: "navigation",
      stage_id: s.stage_id,
      frame,
      site_id,
      waypoints: s.waypoints.map(
        (w): WaypointDraft =>
          w.kind === "wgs84"
            ? {
                lat: String(w.lat),
                lon: String(w.lon),
                heading_deg: w.heading_deg != null ? String(w.heading_deg) : "",
                x: "",
                y: "",
                theta: "",
              }
            : {
                lat: "",
                lon: "",
                heading_deg: "",
                x: String(w.x),
                y: String(w.y),
                theta: w.theta != null ? String(w.theta) : "",
              },
      ),
    };
  });
}
