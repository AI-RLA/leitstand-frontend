import { useState } from "react";
import { Ban, Check, X } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatArea } from "@/lib/units";
import { cn } from "@/lib/utils";
import { durationFromMs } from "@/lib/relativeTime";
import { useFields } from "@/api/fields";
import type { CoverageProvenance, StageStatus } from "@/api/client";
import type { StageViewModel } from "../adapters";

interface MissionStageTimelineProps {
  stages: StageViewModel[];
  // True while a terminal mission's durable /state is still loading, so the per-stage
  // status is not yet known and a neutral placeholder stands in for the WAITING floor.
  statePending?: boolean;
}

function formatDistance(m: number | null): string | null {
  if (m === null) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

// Rounding to nearest would turn a real excursion of a few millimetres into a flat zero, so
// anything under the displayed resolution is reported as the bound it is.
function excursionLabel(outside: number | null | undefined): string {
  if (outside == null) return "not measured";
  if (outside > 0 && outside < 0.005) return "< 0.01 m";
  return `${outside.toFixed(2)} m`;
}

function frameLabel(frame: StageViewModel["frame"]): string | null {
  if (frame === "wgs84") return "WGS84";
  if (frame === "site_local") return "Site-local";
  if (frame === "mixed") return "Mixed frame";
  return null;
}

function kindLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function stageDurationMs(stage: StageViewModel): number | null {
  if (!stage.startedAt || !stage.endedAt) return null;
  return (
    new Date(stage.endedAt).getTime() - new Date(stage.startedAt).getTime()
  );
}

// A covered field carries hundreds of these, and a list that long is scrolled past rather than
// read. Enough to see the shape of the coordinates, and the count says what is not shown.
const WAYPOINTS_LISTED = 20;

function waypointLabel(wp: StageViewModel["waypoints"][number]): string {
  if (wp.kind === "wgs84") {
    const head = wp.heading_deg != null ? ` · ${wp.heading_deg}°` : "";
    return `${wp.lat}, ${wp.lon}${head}`;
  }
  const theta = wp.theta != null ? ` · θ ${wp.theta}` : "";
  return `${wp.site_id} · ${wp.x}, ${wp.y}${theta}`;
}

function StageNode({
  status,
  index,
}: {
  status: StageStatus | null;
  index: number;
}) {
  const base =
    "w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 shrink-0 mt-0.5";
  if (status === "FINISHED") {
    return (
      <div className={cn(base, "bg-primary border-primary text-white")}>
        <Check className="w-3 h-3" strokeWidth={3} />
      </div>
    );
  }
  if (status === "FAILED") {
    return (
      <div className={cn(base, "bg-[#EF4444] border-[#EF4444] text-white")}>
        <X className="w-3 h-3" strokeWidth={3} />
      </div>
    );
  }
  if (status === "CANCELLED") {
    return (
      <div className={cn(base, "bg-muted border-[#CBD5E1] text-[#94A3B8]")}>
        <Ban className="w-3 h-3" strokeWidth={2.5} />
      </div>
    );
  }
  if (status === "SKIPPED") {
    return (
      <div
        className={cn(
          base,
          "bg-white border-dashed border-[#CBD5E1] text-[#CBD5E1]",
        )}
      >
        <span className="w-1.5 h-0.5 bg-[#CBD5E1]" />
      </div>
    );
  }
  if (status === "RUNNING") {
    return (
      <div
        className={cn(base, "bg-white border-primary ring-4 ring-primary/15")}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }
  const amber = status === "PAUSED" || status === "INITIALIZING";
  return (
    <div
      className={cn(
        base,
        "bg-white font-mono text-ui-xs font-semibold",
        amber ? "border-[#F59E0B] text-[#B45309]" : "border-border text-t3",
      )}
    >
      {index + 1}
    </div>
  );
}

export function MissionStageTimeline({
  stages,
  statePending = false,
}: MissionStageTimelineProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  if (stages.length === 0) {
    return (
      <div className="bg-white border border-border rounded-lg p-4">
        <p className="text-ui-sm text-t3">No stages defined.</p>
      </div>
    );
  }

  const total = stages.length;
  const activeIdx = stages.findIndex(
    (s) => s.status === "RUNNING" || s.status === "PAUSED",
  );
  const summary =
    activeIdx >= 0
      ? `Stage ${activeIdx + 1} of ${total}`
      : `${total} stage${total === 1 ? "" : "s"}`;

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <p className="text-ui-xs uppercase tracking-wider text-t3 font-semibold">
          Stage timeline
        </p>
        <span className="text-ui-xs text-t3 font-mono">{summary}</span>
      </div>
      <div className="p-4">
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;
          const dist = formatDistance(stage.distanceM);
          const frame = frameLabel(stage.frame);
          const durationMs = stageDurationMs(stage);
          const showDuration =
            durationMs !== null &&
            (stage.status === "FINISHED" || stage.status === "FAILED");
          const isRunning = stage.status === "RUNNING";
          const isExpanded = expanded.has(i);

          return (
            <div key={stage.id} className="flex gap-3">
              {/* Rail + node */}
              <div className="relative flex flex-col items-center w-5 shrink-0">
                <StageNode status={stage.status} index={stage.index} />
                {!isLast && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 -mt-0.5",
                      stage.status === "FINISHED" ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  "flex-1 min-w-0 pt-0.5",
                  isLast ? "pb-0" : "pb-4",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-ui-xs font-semibold text-t3">
                    STAGE {String(stage.index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ui-xs font-medium px-1.5 py-0.5 rounded bg-[#F1F5F9] text-t2">
                    {kindLabel(stage.kind)}
                  </span>
                  <span className="flex-1" />
                  {statePending ? (
                    <span className="inline-block h-5 w-14 rounded-full bg-[#F1F5F9] animate-pulse" />
                  ) : (
                    <StatusPill variant="stage" status={stage.status} />
                  )}
                </div>

                <p className="text-ui-xs text-t3 mt-1">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="hover:text-t1 transition-colors"
                  >
                    {/* A coverage stage is counted in swaths: its waypoint total is the swath
                        endpoints, which is neither what it drives nor what it covers. */}
                    {stage.swathCount === null
                      ? `${stage.waypointCount} waypoint${stage.waypointCount === 1 ? "" : "s"}`
                      : `${stage.swathCount} swath${stage.swathCount === 1 ? "" : "s"}`}
                  </button>
                  {stage.coverage && (
                    <> at {stage.coverage.params.operation_width_m} m</>
                  )}
                  {frame && !stage.coverage && <> · {frame}</>}
                  {dist && <> · {dist}</>}
                  {stage.coverage && (
                    <>
                      {" "}
                      · {formatArea(
                        stage.coverage.metrics.covered_area_m2,
                      )}{" "}
                      worked
                    </>
                  )}
                  {showDuration && <> · {durationFromMs(durationMs)}</>}
                </p>

                {isExpanded && stage.coverage && (
                  <CoverageDetails coverage={stage.coverage} />
                )}
                {isExpanded && !stage.coverage && (
                  <ul className="mt-1 space-y-0.5 font-mono text-ui-xs text-t3">
                    {stage.waypoints
                      .slice(0, WAYPOINTS_LISTED)
                      .map((wp, wi) => (
                        <li key={wi}>
                          {wi + 1}. {waypointLabel(wp)}
                        </li>
                      ))}
                    {stage.waypoints.length > WAYPOINTS_LISTED && (
                      <li className="text-t3">
                        &hellip; {stage.waypoints.length - WAYPOINTS_LISTED}{" "}
                        more of {stage.waypoints.length}
                      </li>
                    )}
                  </ul>
                )}

                {stage.errors.map((e, ei) => (
                  <p key={ei} className="text-ui-xs text-[#B91C1C] mt-1">
                    {e.type} — {e.description}
                  </p>
                ))}

                {/* Progress bar: only while running with real fractional progress. */}
                {isRunning && stage.progress !== null && stage.progress > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${stage.progress * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-ui-xs font-semibold text-primary tabular-nums w-9 text-right">
                      {Math.round(stage.progress * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What the planner produced and what it was given. Excursion is called out because Fields2Cover
 * constrains the swaths to the field and never the turns joining them, and only the operator
 * knows whether the edge is a hedge or a mown margin.
 */
function CoverageDetails({ coverage }: { coverage: CoverageProvenance }) {
  const { data: fields = [] } = useFields();
  const field = fields.find((f) => f.id === coverage.field_id);
  const { params, metrics } = coverage;
  const outside = metrics.max_excursion_m;
  // Measured against the field the operator asked to have covered rather than the mainland, so
  // a chosen headland still counts as unworked; a share above 100 % (an older planner) is left out.
  const rawShare = Math.round(
    (metrics.covered_area_m2 / coverage.field_area_m2) * 100,
  );
  const share = rawShare <= 100 ? rawShare : null;
  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ui-xs">
      <Row label="Field" value={field?.name ?? "deleted"} />
      <Row
        label="Working area"
        value={`${Math.round(metrics.covered_area_m2)} m² of ${Math.round(coverage.field_area_m2)} m²${share === null ? "" : ` (${share}%)`}`}
      />
      <Row label="Implement width" value={`${params.operation_width_m} m`} />
      <Row label="Turning radius" value={`${params.turning_radius_m} m`} />
      <Row label="Headland" value={`${params.headland_width_m} m`} />
      {params.swath_angle_deg != null && (
        <Row
          label="Swath direction"
          value={`${Number(params.swath_angle_deg.toFixed(1))}°`}
        />
      )}
      {params.allow_overlap != null && (
        <Row
          label="Last pass"
          value={params.allow_overlap ? "may overlap" : "skipped if partial"}
        />
      )}
      <Row
        label="Outside boundary"
        value={excursionLabel(outside)}
        warn={outside != null && outside > 0.05}
      />
      {metrics.path_length_m != null && (
        <Row
          label="Path length"
          value={`${Math.round(metrics.path_length_m)} m`}
        />
      )}
      <Row
        label="Machine values"
        value={
          coverage.planned_for_robot_id
            ? `from ${coverage.planned_for_robot_id}`
            : "entered by hand"
        }
      />
      <Row
        label="Planned"
        value={`${new Date(coverage.planned_at).toLocaleString()} · ${coverage.planner_version}`}
      />
    </dl>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <>
      <dt className="text-t3">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          warn ? "text-[#B45309] font-medium" : "text-t2",
        )}
      >
        {value}
      </dd>
    </>
  );
}
