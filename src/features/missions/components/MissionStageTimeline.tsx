import { useState } from "react";
import { Ban, Check, X } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";
import { durationFromMs } from "@/lib/relativeTime";
import type { StageStatus } from "@/api/client";
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
      <div className={cn(base, "bg-[#F8FAFC] border-[#CBD5E1] text-[#94A3B8]")}>
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-[#F8FAFC]">
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
                    {stage.waypointCount} waypoint
                    {stage.waypointCount === 1 ? "" : "s"}
                  </button>
                  {frame && <> · {frame}</>}
                  {dist && <> · {dist}</>}
                  {showDuration && <> · {durationFromMs(durationMs)}</>}
                </p>

                {isExpanded && (
                  <ul className="mt-1 space-y-0.5 font-mono text-ui-xs text-t3">
                    {stage.waypoints.map((wp, wi) => (
                      <li key={wi}>
                        {wi + 1}. {waypointLabel(wp)}
                      </li>
                    ))}
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
